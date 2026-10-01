import { categoryOptions, colorOptions, locationOptions } from '$lib/server/options';
import { stockByLocation } from '$lib/modules/lager/server/products';
import { listStock, parseStockFilter } from '$lib/modules/lager/server/stock-list';
import type { PageServerLoad } from './$types';

/** So viele Zeilen kommen höchstens aufs Papier */
const MAX_ROWS = 2000;

const STATUS_TEXT: Record<string, string> = {
	aktiv: 'Alle aktiven Artikel',
	nachbestellen: 'Nur Artikel zum Nachbestellen',
	leer: 'Nur Artikel ohne Bestand',
	inaktiv: 'Nur inaktive Artikel',
	alle: 'Alle Artikel'
};

const SORT_TEXT: Record<string, string> = {
	name: 'nach Name',
	bestand: 'nach Bestand aufsteigend',
	'bestand-ab': 'nach Bestand absteigend',
	nummer: 'nach Artikelnummer'
};

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('app:stock');
	const filter = parseStockFilter(url);
	const [{ rows, count }, locations, categories, colors] = await Promise.all([
		listStock(filter, MAX_ROWS, 0),
		locationOptions(false),
		categoryOptions(),
		colorOptions()
	]);
	const byLoc = await stockByLocation(rows.map((r) => r.id));
	const locName = new Map(locations.map((l) => [l.id, l.name]));
	const locOrder = new Map(locations.map((l, i) => [l.id, i]));

	const facts = [STATUS_TEXT[filter.status] ?? STATUS_TEXT.aktiv];
	if (filter.q) facts.push(`Suche: „${filter.q}“`);
	if (filter.locationId) facts.push(`Lagerort: ${locName.get(filter.locationId) ?? '?'}`);
	if (filter.categoryId) facts.push(`Materialart: ${categories.find((c) => c.id === filter.categoryId)?.name ?? '?'}`);
	if (filter.colorId) facts.push(`Farbe: ${colors.find((c) => c.id === filter.colorId)?.name ?? '?'}`);
	facts.push(`Sortiert ${SORT_TEXT[filter.sort] ?? SORT_TEXT.name}`);
	facts.push(count === 1 ? '1 Artikel' : `${count} Artikel`);

	return {
		facts,
		count,
		notice: count > rows.length ? `Es werden die ersten ${rows.length} von ${count} Artikeln gedruckt. Zum Kürzen die Filter enger stellen.` : null,
		items: rows.map((r) => ({
			...r,
			locations: (byLoc.get(r.id) ?? [])
				.sort((a, b) => (locOrder.get(a.locationId) ?? 0) - (locOrder.get(b.locationId) ?? 0))
				.map((l) => ({ ...l, name: locName.get(l.locationId) ?? '?' }))
		}))
	};
};
