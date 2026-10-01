import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { locations, movements, products, stock } from '$lib/server/db/schema';
import { lowStockProducts } from '$lib/modules/lager/server/alerts';
import { requireUser } from '$lib/server/guard';
import { consumptionByMonth, listMovements } from '$lib/modules/lager/server/movements';
import { can } from '$lib/permissions';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ depends, locals }) => {
	depends('app:stock');
	const user = requireUser(locals);
	// Bewegungen und Auswertungen nur für Rollen, die sie sehen dürfen
	const showMovements = can(user.role, 'lager.movements.view');
	const showReports = can(user.role, 'lager.reports.view');
	const startOfDay = new Date();
	startOfDay.setHours(0, 0, 0, 0);

	const [productCount, units, locationCount, today, low, consumption, recent] = await Promise.all([
		db.select({ n: sql<number>`count(*)` }).from(products).where(eq(products.active, true)).get(),
		db.select({ n: sql<number>`coalesce(sum(${stock.quantity}), 0)` }).from(stock).get(),
		db
			.select({ n: sql<number>`count(distinct ${stock.locationId})` })
			.from(stock)
			.innerJoin(locations, eq(locations.id, stock.locationId))
			.where(sql`${stock.quantity} > 0`)
			.get(),
		showMovements
			? db
					.select({ n: sql<number>`count(*)` })
					.from(movements)
					.where(and(gte(movements.createdAt, startOfDay), isNull(movements.cancelledAt)))
					.get()
			: null,
		lowStockProducts(),
		showReports ? consumptionByMonth(6) : null,
		showMovements ? listMovements({}, 8) : null
	]);

	return {
		kpi: {
			products: Number(productCount?.n ?? 0),
			units: Number(units?.n ?? 0),
			locations: Number(locationCount?.n ?? 0),
			today: today ? Number(today.n ?? 0) : null,
			low: low.length
		},
		low: low.slice(0, 6),
		consumption,
		recent
	};
};
