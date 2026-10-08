import { csvResponse, today, toCsv } from '$lib/server/csv';
import { requirePermission } from '$lib/server/guard';
import { locationOptions } from '$lib/server/options';
import { stockByLocation } from '$lib/modules/lager/server/products';
import { listStock, parseStockFilter } from '$lib/modules/lager/server/stock-list';
import { unitLabel } from '$lib/format';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'lager.bestand.sehen');
	const filter = parseStockFilter(url);
	const { rows } = await listStock(filter, 100_000, 0);
	const locs = await locationOptions(false);
	const byLoc = await stockByLocation(rows.map((r) => r.id));

	const header = [
		'Artikel',
		'Artikelnummer',
		'Materialart',
		'Farbe',
		'Hersteller',
		'Inhalt je Stück',
		'Einheit',
		'Bestand (Stück)',
		'Menge gesamt',
		'Mindestbestand',
		'Sollbestand',
		...locs.map((l) => l.name),
		'Status'
	];
	const body = rows.map((p) => {
		const perLoc = new Map((byLoc.get(p.id) ?? []).map((l) => [l.locationId, l.quantity]));
		const status = !p.active ? 'Inaktiv' : p.total <= 0 ? 'Leer' : p.minStock && p.total <= p.minStock ? 'Nachbestellen' : 'OK';
		return [
			p.name,
			p.articleNumber,
			p.categoryName,
			p.colorName,
			p.manufacturer,
			p.packageSize,
			unitLabel(p.unit),
			p.total,
			p.packageSize != null ? p.total * p.packageSize : null,
			p.minStock,
			p.targetStock,
			...locs.map((l) => perLoc.get(l.id) ?? 0),
			status
		];
	});
	return csvResponse(`bestand-${today()}.csv`, toCsv(header, body));
};
