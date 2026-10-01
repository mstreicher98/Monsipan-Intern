import { csvResponse, today, toCsv } from '$lib/server/csv';
import { requirePermission } from '$lib/server/guard';
import { orderList } from '$lib/modules/lager/server/order-list';
import { unitLabel } from '$lib/format';
import type { RequestHandler } from './$types';

/** ?m=<id>:<menge> je Zeile übernimmt die auf der Seite angepassten Mengen */
export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'lager.reports.view');
	const chosen = new Map<number, number>();
	for (const m of url.searchParams.getAll('m')) {
		const [id, q] = m.split(':').map(Number);
		if (Number.isInteger(id) && Number.isInteger(q) && q >= 0) chosen.set(id, q);
	}
	const items = (await orderList()).filter((p) => chosen.size === 0 || chosen.has(p.id));
	const header = ['Hersteller', 'Artikel', 'Artikelnummer', 'Inhalt je Stück', 'Einheit', 'Bestand', 'Mindestbestand', 'Sollbestand', 'Bestellmenge (Stück)', 'Bestellmenge gesamt'];
	const body = items.map((p) => {
		const q = chosen.get(p.id) ?? p.suggested;
		return [p.manufacturer, p.name, p.articleNumber, p.packageSize, unitLabel(p.unit), p.total, p.minStock, p.targetStock, q, p.packageSize != null ? q * p.packageSize : null];
	});
	return csvResponse(`bestellliste-${today()}.csv`, toCsv(header, body));
};
