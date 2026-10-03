import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import {
	deleteReport,
	materialProducts,
	mayEdit,
	mayView,
	recentPlaces,
	reportDetail,
	saveReport,
	setReportStatus,
	type SaveReport
} from '$lib/modules/tagesberichte/server/reports';
import { isValidIsoDate } from '$lib/modules/stunden/week';
import { isValidSignature } from '$lib/modules/stunden/signature';
import type { Actions, PageServerLoad } from './$types';

async function open(id: number, locals: App.Locals) {
	const user = requireUser(locals);
	if (!Number.isInteger(id)) error(404, 'Tagesbericht nicht gefunden');
	const report = await reportDetail(id);
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	return { user, report };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user, report } = await open(Number(params.id), locals);
	const editable = mayEdit(user, report);
	return {
		report,
		places: await recentPlaces(),
		// Die Artikelauswahl braucht nur, wer auch eintragen darf
		products: editable ? await materialProducts() : [],
		editable,
		canClose: can(user.role, 'tagesberichte.abschliessen')
	};
};

/**
 * Das Formular auslesen. Spalten, Mengen und Materialzeilen kommen je Feld in
 * der Reihenfolge der Seite – sie werden über ihre Position zusammengesetzt.
 */
function readReport(form: FormData): SaveReport {
	const all = (name: string) => form.getAll(name).map(String);
	const lbPos = all('pos.lbpos');
	const units = all('pos.einheit');
	const totals = all('pos.gesamt');
	const positions = lbPos.map((p, i) => ({ lbPos: p, unit: units[i] ?? '', totalQuantity: totals[i] ?? '' }));

	// Zeilen kommen als zeile.<laufende Nummer>.* ; "neu" statt einer ID heißt: neue Zeile
	const indexes = new Set<string>();
	for (const key of form.keys()) {
		const m = key.match(/^zeile\.([^.]+)\.id$/);
		if (m) indexes.add(m[1]);
	}
	const rows = [...indexes]
		.sort((a, b) => Number(a) - Number(b))
		.map((i) => {
			const raw = String(form.get(`zeile.${i}.id`) ?? '');
			const id = raw === 'neu' || raw === '' ? null : Number(raw);
			return {
				id: Number.isInteger(id) ? id : null,
				label: String(form.get(`zeile.${i}.text`) ?? ''),
				quantities: all(`zeile.${i}.menge`)
			};
		});

	const products = all('material.artikel');
	const names = all('material.name');
	const codes = all('material.nr');
	const thickness = all('material.dicke');
	const materials = names.map((material, i) => {
		const product = Number(products[i]);
		return {
			productId: products[i] && Number.isInteger(product) ? product : null,
			material,
			code: codes[i] ?? '',
			filmThickness: thickness[i] ?? ''
		};
	});

	return {
		head: {
			number: String(form.get('nummer') ?? ''),
			date: String(form.get('datum') ?? ''),
			road: String(form.get('strasse') ?? ''),
			site: String(form.get('baustelle') ?? ''),
			costCenter: String(form.get('kostenstelle') ?? ''),
			dailyOutput: String(form.get('tagesleistung') ?? ''),
			lvPosition: String(form.get('lvposition') ?? ''),
			note: String(form.get('notiz') ?? '')
		},
		positions,
		rows,
		materials
	};
}

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const { user, report } = await open(Number(params.id), locals);
		if (!mayEdit(user, report)) return fail(403, { message: 'Dieser Bericht ist nicht (mehr) änderbar.' });
		const data = readReport(await request.formData());
		if (!isValidIsoDate(data.head.date)) return fail(400, { message: 'Das Datum ist ungültig.' });
		await saveReport(report.id, data);
		return { saved: true };
	},

	/**
	 * Abschließen geht nur mit Unterschrift – sie steht danach im Ausdruck bei
	 * „Für den Auftragnehmer". Was im Formular steht, wird vorher gespeichert.
	 */
	close: async ({ params, request, locals }) => {
		const { user, report } = await open(Number(params.id), locals);
		if (!can(user.role, 'tagesberichte.abschliessen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		if (report.status !== 'entwurf') return fail(400, { message: 'Dieser Bericht ist bereits abgeschlossen.' });
		const form = await request.formData();
		const signature = String(form.get('unterschrift') ?? '').trim();
		if (!signature) return fail(400, { message: 'Bitte unterschreiben – ohne Unterschrift wird der Bericht nicht abgeschlossen.' });
		if (!isValidSignature(signature)) {
			return fail(400, { message: 'Die Unterschrift konnte nicht gelesen werden – bitte neu unterschreiben.' });
		}
		if (mayEdit(user, report) && form.has('datum')) {
			const data = readReport(form);
			if (!isValidIsoDate(data.head.date)) return fail(400, { message: 'Das Datum ist ungültig.' });
			await saveReport(report.id, data);
		}
		await setReportStatus(report.id, 'abgeschlossen', user.id, signature);
		return { closed: true };
	},

	reopen: async ({ params, locals }) => {
		const { user, report } = await open(Number(params.id), locals);
		if (!can(user.role, 'tagesberichte.abschliessen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		await setReportStatus(report.id, 'entwurf', user.id);
		return { reopened: true };
	},

	delete: async ({ params, locals }) => {
		const { user, report } = await open(Number(params.id), locals);
		if (report.status !== 'entwurf' || !mayEdit(user, report)) {
			return fail(403, { message: 'Nur Berichte in Arbeit können gelöscht werden.' });
		}
		await deleteReport(report.id);
		redirect(303, '/tagesberichte');
	}
};
