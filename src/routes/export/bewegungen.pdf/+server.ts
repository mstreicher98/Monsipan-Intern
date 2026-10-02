import { requirePermission } from '$lib/server/guard';
import { movementsPrintData } from '$lib/modules/lager/server/print';
import { pdfResponse } from '$lib/server/pdf';
import { today } from '$lib/server/csv';
import { dateTime, fullName, MOVEMENT_NOUNS } from '$lib/format';
import { routeParts, signedQty } from '$lib/modules/lager/movement-view';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'lager.movements.view');
	const { facts, notice, rows } = await movementsPrintData(url);

	return pdfResponse(`bewegungen-${today()}.pdf`, {
		title: 'Bewegungen',
		facts,
		notice,
		landscape: true,
		tables: [
			{
				columns: [
					{ label: 'Zeitpunkt', width: 12 },
					{ label: 'Art', width: 9 },
					{ label: 'Artikel', width: 26 },
					{ label: 'Menge', width: 7, align: 'right' },
					{ label: 'Von / Nach', width: 14 },
					{ label: 'Gebucht von', width: 12 },
					{ label: 'Notiz', width: 20 }
				],
				rows: rows.map((r) => {
					const [from, to] = routeParts(r);
					const notes = [r.articleNumber, r.note, r.cancelledAt ? `storniert: ${r.cancelReason ?? ''}`.trim() : null]
						.filter(Boolean)
						.join(' · ');
					return [
						dateTime(r.createdAt),
						MOVEMENT_NOUNS[r.type] + (r.cancelledAt ? ' (storniert)' : ''),
						r.productName,
						signedQty(r),
						[from, to].filter(Boolean).join(' → ') || '–',
						fullName(r),
						notes
					];
				}),
				empty: 'Keine Buchung im gewählten Zeitraum.'
			}
		]
	});
};
