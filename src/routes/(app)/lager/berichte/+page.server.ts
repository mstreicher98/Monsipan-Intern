import { and, asc, eq, gt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categories, colors, locations, products, stock } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { consumptionByMonth, consumptionMatrix } from '$lib/modules/lager/server/movements';
import { categoryOptions, partyOptions } from '$lib/server/options';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:stock');
	requirePermission(locals, 'lager.reports.view');
	const view = url.searchParams.get('ansicht') === 'bestand' ? 'bestand' : 'verbrauch';

	if (view === 'bestand') {
		const rows = await db
			.select({
				locationId: locations.id,
				location: locations.name,
				locationSort: locations.sortOrder,
				productId: products.id,
				name: products.name,
				articleNumber: products.articleNumber,
				packageSize: products.packageSize,
				unit: products.unit,
				categoryName: categories.name,
				colorHex: colors.hex,
				quantity: stock.quantity
			})
			.from(stock)
			.innerJoin(locations, eq(locations.id, stock.locationId))
			.innerJoin(products, eq(products.id, stock.productId))
			.leftJoin(categories, eq(categories.id, products.categoryId))
			.leftJoin(colors, eq(colors.id, products.colorId))
			.where(and(gt(stock.quantity, 0)))
			.orderBy(asc(locations.sortOrder), asc(locations.name), asc(products.name))
			.all();
		const groups: { locationId: number; location: string; items: typeof rows; total: number }[] = [];
		for (const r of rows) {
			let g = groups.at(-1);
			if (!g || g.locationId !== r.locationId) {
				g = { locationId: r.locationId, location: r.location, items: [], total: 0 };
				groups.push(g);
			}
			g.items.push(r);
			g.total += r.quantity;
		}
		return { view, groups, stand: new Date() };
	}

	const months = [6, 12, 24].includes(Number(url.searchParams.get('monate'))) ? Number(url.searchParams.get('monate')) : 12;
	const categoryId = Number(url.searchParams.get('kat')) || null;
	const partyId = Number(url.searchParams.get('partie')) || null;
	const [totals, matrix, cats, parties] = await Promise.all([
		consumptionByMonth(months, { categoryId, partyId }),
		consumptionMatrix(months, { categoryId, partyId }),
		categoryOptions(),
		partyOptions(false)
	]);
	return { view, months, categoryId, partyId, totals, matrix, categories: cats, parties };
};
