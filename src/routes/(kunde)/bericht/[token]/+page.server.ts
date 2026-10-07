/**
 * Tagesbericht für den Kunden: ansehen, mit Namen unterschreiben, danach als
 * PDF laden. Ohne Anmeldung – der Link selbst ist der Schlüssel (128 Bit Zufall).
 * Kostenstelle, Notiz und interne Angaben bekommt der Kunde nicht zu sehen.
 */
import { error, fail } from '@sveltejs/kit';
import { isRateLimited, registerFailure } from '$lib/server/auth';
import { customerSign, reportByToken, type ReportDetail } from '$lib/modules/tagesberichte/server/reports';
import { hasInk } from '$lib/ink';
import { isValidSignature } from '$lib/modules/stunden/signature';
import type { Actions, PageServerLoad } from './$types';

/** Nur, was auch im PDF für den Kunden steht */
function forCustomer(r: ReportDetail) {
	return {
		number: r.number,
		date: r.date,
		dateTo: r.dateTo,
		road: r.road,
		site: r.site,
		costCenter: '',
		dailyOutput: r.dailyOutput,
		lvPosition: r.lvPosition,
		note: '',
		positions: r.positions,
		rows: r.rows,
		materials: r.materials.map((m) => ({ material: m.material, code: m.code, filmThickness: m.filmThickness })),
		releaseSignature: r.releaseSignature,
		releasedAt: r.releasedAt,
		releasedByFirst: r.releasedByFirst,
		releasedByLast: r.releasedByLast,
		customerName: r.customerName,
		customerSignature: r.customerSignature,
		customerSignedAt: r.customerSignedAt
	};
}

export const load: PageServerLoad = async ({ params, setHeaders }) => {
	// Nicht in Suchmaschinen, nicht im Zwischenspeicher, kein Link im Referer
	setHeaders({ 'x-robots-tag': 'noindex, nofollow', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' });
	const report = await reportByToken(params.token);
	if (!report) error(404, 'Diesen Bericht gibt es nicht – bitte den Link prüfen.');
	const ready = report.status === 'geprueft' || report.status === 'abgeschlossen';
	return {
		token: params.token,
		number: report.number,
		ready,
		signed: report.status === 'abgeschlossen',
		// Mit Handschrift vom Tablet zeigt die Seite das Formular aus dem PDF
		hasInk: hasInk(report.ink),
		report: ready ? forCustomer(report) : null
	};
};

export const actions: Actions = {
	sign: async ({ params, request }) => {
		const key = `kunde:${params.token}`;
		if (isRateLimited(key, 10)) return fail(429, { message: 'Zu viele Versuche – bitte in einigen Minuten erneut.' });
		const report = await reportByToken(params.token);
		if (!report) error(404, 'Diesen Bericht gibt es nicht – bitte den Link prüfen.');
		if (report.status === 'abgeschlossen') return fail(400, { message: 'Dieser Bericht ist bereits unterschrieben.' });
		if (report.status !== 'geprueft') return fail(400, { message: 'Dieser Bericht wird gerade überarbeitet – bitte später erneut öffnen.' });

		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim().replace(/\s+/g, ' ');
		const signature = String(form.get('unterschrift') ?? '').trim();
		if (name.length < 2 || name.length > 120) {
			registerFailure(key);
			return fail(400, { message: 'Bitte tragen Sie Ihren Namen ein.', name });
		}
		if (!isValidSignature(signature)) {
			registerFailure(key);
			return fail(400, { message: 'Bitte unterschreiben Sie im Feld – die Unterschrift fehlt oder war nicht lesbar.', name });
		}
		if (!(await customerSign(report.id, name, signature))) {
			return fail(409, { message: 'Der Bericht wurde inzwischen geändert – bitte die Seite neu laden.', name });
		}
		return { signed: true };
	}
};
