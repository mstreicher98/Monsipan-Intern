import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, sheetDetail, totals } from '$lib/modules/stunden/server/timesheets';
import { hoursLabel, isoWeek, WEEKDAY_LABELS, weekLabel } from '$lib/modules/stunden/week';
import { pdfResponse } from '$lib/server/pdf';
import { fullName } from '$lib/format';
import type { RequestHandler } from './$types';

const STATUS: Record<string, string> = { entwurf: 'In Arbeit', freigegeben: 'Freigegeben', geprueft: 'Geprüft' };

const COLUMNS = [
	{ key: 'normalHours', label: 'Norm-Std.', total: 'normal' },
	{ key: 'overtime50', label: 'ÜS 50 %', total: 'o50' },
	{ key: 'overtime100', label: 'ÜS 100 %', total: 'o100' },
	{ key: 'vacationHours', label: 'Urlaub', total: 'vacation' },
	{ key: 'holidayHours', label: 'Feiertag', total: 'holiday' },
	{ key: 'rainHours', label: 'Regen', total: 'rain' },
	{ key: 'sickHours', label: 'Efzg', total: 'sick' }
] as const;

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const sheet = await sheetDetail(Number(params.id));
	if (!sheet) error(404, 'Stundenzettel nicht gefunden');
	if (!mayView(user, sheet)) error(403, 'Diesen Stundenzettel darfst du nicht ansehen.');
	const t = totals(sheet.days);
	const { year, week } = isoWeek(sheet.weekStart);

	return pdfResponse(`lohnzettel-${sheet.username}-${year}-kw${String(week).padStart(2, '0')}.pdf`, {
		title: `Lohnzettel ${fullName(sheet)}`,
		facts: [weekLabel(sheet.weekStart), sheet.partyName ?? 'Ohne Partie', STATUS[sheet.status]],
		landscape: true,
		tables: [
			{
				columns: [
					{ label: 'Tag', width: 6 },
					{ label: 'Kostenstelle', width: 10 },
					{ label: 'Baustelle / Tätigkeit', width: 26 },
					{ label: 'Zeit von/bis', width: 10, align: 'center' },
					...COLUMNS.map((c) => ({ label: c.label, width: 6.5, align: 'right' as const })),
					{ label: 'Summe', width: 6.5, align: 'right' as const }
				],
				rows: sheet.days.map((d, i) => [
					WEEKDAY_LABELS[i],
					d.costCenter,
					d.site,
					d.fromTime && d.toTime ? `${d.fromTime}–${d.toTime}` : d.fromTime,
					...COLUMNS.map((c) => hoursLabel(d[c.key])),
					hoursLabel(COLUMNS.reduce((s, c) => s + Number(d[c.key] ?? 0), 0))
				]),
				footer: ['Gesamt', '', '', '', ...COLUMNS.map((c) => hoursLabel(t[c.total])), hoursLabel(t.total)]
			}
		],
		pairs: [
			{ label: 'Auslöse Tage', value: hoursLabel(sheet.allowanceDays) },
			{ label: 'Auslöse Betrag', value: sheet.allowanceAmount != null ? `${hoursLabel(sheet.allowanceAmount)} €` : '' },
			{ label: 'VAZ', value: [sheet.vaz, sheet.vazPercent != null ? `${hoursLabel(sheet.vazPercent)} %` : ''].filter(Boolean).join(' · ') }
		],
		note: sheet.note || null,
		footnote: 'Freiwillige Leistungen über KV begründen keinen Rechtsanspruch!',
		signatures: ['Unterschrift Vorarbeiter', 'überprüft']
	});
};
