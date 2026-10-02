import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { columnSums, mayView, QUANTITY_KEYS, reportDetail } from '$lib/modules/tagesberichte/server/reports';
import { dayLabel } from '$lib/modules/stunden/week';
import { pdfResponse, type PdfCell } from '$lib/server/pdf';
import type { RequestHandler } from './$types';

const MATERIALS = [
	{ kind: 'gelb', label: 'gelb' },
	{ kind: 'weiss', label: 'weiß' },
	{ kind: 'reflex', label: 'Reflexk.' }
] as const;

const show = (v: number | null | undefined) => (v == null ? '' : v);

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const report = await reportDetail(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');

	const sums = columnSums(report.rows);
	const rows = report.rows.filter((r) => r.label.trim() || QUANTITY_KEYS.some((k) => r[k] != null));
	// Spalten ohne Position und ohne Menge weglassen, damit das Blatt nicht leer wirkt
	const columns = report.positions.filter(
		(p, i) => p.lbPos.trim() || p.unit.trim() || rows.some((r) => r[QUANTITY_KEYS[i]] != null)
	);

	return pdfResponse(`tagesbericht-${report.number || report.id}-${report.date}.pdf`, {
		title: `Tagesbericht ${report.number}`.trim(),
		facts: [dayLabel(report.date), report.road, report.site, report.costCenter, report.partyName ?? ''].filter(Boolean),
		tables: [
			{
				columns: [
					{ label: 'Ortsbezeichnungen und Markierungsarten', width: 34 },
					...columns.map((p) => ({
						label: `${p.lbPos || `Pos. ${p.idx}`}${p.unit ? `\n${p.unit}` : ''}`,
						width: 66 / Math.max(1, columns.length),
						align: 'right' as const
					}))
				],
				rows: rows.map((r) => [r.label, ...columns.map((p) => show(r[QUANTITY_KEYS[p.idx - 1]]) as PdfCell)]),
				footer: ['Einheitssumme', ...columns.map((p) => show(sums[QUANTITY_KEYS[p.idx - 1]]) as PdfCell)],
				empty: 'Keine Zeilen erfasst.'
			},
			{
				heading: 'Material',
				columns: [
					{ label: 'Material', width: 20 },
					{ label: 'Kenn-Nr.', width: 20 },
					{ label: 'Filmdicke in mm', width: 20, align: 'right' },
					{ label: '', width: 40 }
				],
				rows: MATERIALS.map((m) => {
					const row = report.materials.find((x) => x.kind === m.kind);
					return [m.label, row?.code ?? '', show(row?.filmThickness), ''];
				})
			}
		],
		pairs: [
			{ label: 'Tagesleistung', value: report.dailyOutput },
			{ label: 'LV-Position Nr.', value: report.lvPosition },
			{ label: 'Status', value: report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'In Arbeit' }
		],
		note: report.note || null,
		signatures: ['Für den Auftragnehmer', 'Für den Auftraggeber']
	});
};
