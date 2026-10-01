import { categoryOptions, colorOptions, locationOptions } from '$lib/server/options';
import { stockByLocation } from '$lib/modules/lager/server/products';
import { listStock, parseStockFilter } from '$lib/modules/lager/server/stock-list';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('app:stock');
	const filter = parseStockFilter(url);
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const [{ rows, count }, locations, categories, colors] = await Promise.all([
		listStock(filter, PAGE_SIZE, (page - 1) * PAGE_SIZE),
		locationOptions(false),
		categoryOptions(),
		colorOptions()
	]);
	const byLoc = await stockByLocation(rows.map((r) => r.id));
	const locName = new Map(locations.map((l) => [l.id, l.name]));
	const locOrder = new Map(locations.map((l, i) => [l.id, i]));
	return {
		filter,
		page,
		pageSize: PAGE_SIZE,
		count,
		items: rows.map((r) => ({
			...r,
			locations: (byLoc.get(r.id) ?? [])
				.sort((a, b) => (locOrder.get(a.locationId) ?? 0) - (locOrder.get(b.locationId) ?? 0))
				.map((l) => ({ ...l, name: locName.get(l.locationId) ?? '?' }))
		})),
		locations: locations.filter((l) => l.active),
		categories,
		colors
	};
};
