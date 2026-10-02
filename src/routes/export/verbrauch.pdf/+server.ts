import { requirePermission } from '$lib/server/guard';
import { consumptionMatrix } from '$lib/modules/lager/server/movements';
import { categoryOptions, partyOptions } from '$lib/server/options';
import { pdfResponse } from '$lib/server/pdf';
import { today } from '$lib/server/csv';
import { monthShort, unitLabel } from '$lib/format';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'lager.reports.view');
	const months = [6, 12, 24].includes(Number(url.searchParams.get('monate'))) ? Number(url.searchParams.get('monate')) : 12;
	const categoryId = Number(url.searchParams.get('kat')) || null;
	const partyId = Number(url.searchParams.get('partie')) || null;
	const [{ keys, rows }, categories, parties] = await Promise.all([
		consumptionMatrix(months, { categoryId, partyId }),
		categoryOptions(),
		partyOptions(false)
	]);

	const facts = [`Verbrauch der letzten ${months} Monate`];
	if (categoryId) facts.push(`Materialart: ${categories.find((c) => c.id === categoryId)?.name ?? '?'}`);
	if (partyId) facts.push(`Partie: ${parties.find((p) => p.id === partyId)?.name ?? '?'}`);
	facts.push(rows.length === 1 ? '1 Artikel' : `${rows.length} Artikel`);

	return pdfResponse(`verbrauch-${today()}.pdf`, {
		title: 'Verbrauch je Monat',
		facts,
		landscape: true,
		tables: [
			{
				columns: [
					{ label: 'Artikel', width: 22 },
					{ label: 'Art.-Nr.', width: 9 },
					{ label: 'Inhalt', width: 7, align: 'right' },
					...keys.map((k) => ({ label: monthShort(k), width: 4.5, align: 'right' as const })),
					{ label: 'Gesamt', width: 6, align: 'right' as const }
				],
				rows: rows.map((r) => [
					r.name,
					r.articleNumber,
					r.packageSize != null ? `${r.packageSize} ${unitLabel(r.unit)}` : '',
					...keys.map((k) => r.months[k] ?? 0),
					r.total
				]),
				footer: [
					'Gesamt',
					'',
					'',
					...keys.map((k) => rows.reduce((s, r) => s + (r.months[k] ?? 0), 0)),
					rows.reduce((s, r) => s + r.total, 0)
				],
				empty: 'Kein Verbrauch im gewählten Zeitraum.'
			}
		]
	});
};
