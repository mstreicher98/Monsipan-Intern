import { requireUser } from '$lib/server/guard';
import { stockPrintData } from '$lib/modules/lager/server/print';
import { pdfResponse } from '$lib/server/pdf';
import { today } from '$lib/server/csv';
import { unitLabel } from '$lib/format';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requireUser(locals);
	const { facts, notice, items } = await stockPrintData(url);

	return pdfResponse(`bestand-${today()}.pdf`, {
		title: 'Bestandsliste',
		facts,
		notice,
		landscape: true,
		tables: [
			{
				columns: [
					{ label: 'Artikel', width: 26 },
					{ label: 'Art.-Nr.', width: 10 },
					{ label: 'Materialart', width: 11 },
					{ label: 'Farbe', width: 8 },
					{ label: 'Inhalt', width: 8, align: 'right' },
					{ label: 'Bestand', width: 7, align: 'right' },
					{ label: 'Mind.', width: 6, align: 'right' },
					{ label: 'Lagerorte', width: 18 },
					{ label: 'Status', width: 8 }
				],
				rows: items.map((p) => [
					p.name,
					p.articleNumber,
					p.categoryName,
					p.colorName,
					p.packageSize != null ? `${p.packageSize} ${unitLabel(p.unit)}` : '',
					p.total,
					p.minStock,
					p.locations.map((l) => `${l.name} ${l.quantity}`).join(', '),
					!p.active ? 'Inaktiv' : p.total <= 0 ? 'Leer' : p.minStock && p.total <= p.minStock ? 'Nachbestellen' : 'OK'
				]),
				empty: 'Kein Artikel passt zu den Filtern.'
			}
		]
	});
};
