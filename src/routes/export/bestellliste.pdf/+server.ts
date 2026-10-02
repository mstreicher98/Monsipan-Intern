import { requirePermission } from '$lib/server/guard';
import { orderList } from '$lib/modules/lager/server/order-list';
import { pdfResponse } from '$lib/server/pdf';
import { today } from '$lib/server/csv';
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

	// Nach Hersteller gruppieren – so lässt sich das Blatt direkt beim Lieferanten abarbeiten
	const byManufacturer = new Map<string, typeof items>();
	for (const p of items) {
		const key = p.manufacturer || 'Ohne Hersteller';
		byManufacturer.set(key, [...(byManufacturer.get(key) ?? []), p]);
	}

	const columns = [
		{ label: 'Artikel', width: 34 },
		{ label: 'Art.-Nr.', width: 12 },
		{ label: 'Inhalt', width: 10, align: 'right' as const },
		{ label: 'Bestand', width: 9, align: 'right' as const },
		{ label: 'Mind.', width: 8, align: 'right' as const },
		{ label: 'Soll', width: 8, align: 'right' as const },
		{ label: 'Bestellen', width: 10, align: 'right' as const },
		{ label: 'Gesamt', width: 9, align: 'right' as const }
	];

	return pdfResponse(`bestellliste-${today()}.pdf`, {
		title: 'Bestellliste',
		facts: [items.length === 1 ? '1 Artikel' : `${items.length} Artikel`, 'Mengen wie auf der Seite eingestellt'],
		tables: [...byManufacturer.entries()].map(([manufacturer, list]) => ({
			heading: manufacturer,
			columns,
			rows: list.map((p) => {
				const q = chosen.get(p.id) ?? p.suggested;
				return [
					p.name,
					p.articleNumber,
					p.packageSize != null ? `${p.packageSize} ${unitLabel(p.unit)}` : '',
					p.total,
					p.minStock,
					p.targetStock,
					q,
					p.packageSize != null ? `${p.packageSize * q} ${unitLabel(p.unit)}` : ''
				];
			}),
			empty: 'Nichts zu bestellen.'
		})),
		signatures: ['Bestellt von', 'Datum']
	});
};
