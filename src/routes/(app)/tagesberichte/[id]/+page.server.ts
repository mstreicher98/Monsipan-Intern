import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import {
	columnSums,
	deleteReport,
	mayEdit,
	mayView,
	QUANTITY_KEYS,
	recentPlaces,
	reportDetail,
	saveReport,
	setReportStatus,
	type QuantityKey
} from '$lib/modules/tagesberichte/server/reports';
import { REPORT_COLUMNS, REPORT_MATERIALS } from '$lib/server/db/schema';
import { isValidIsoDate } from '$lib/modules/stunden/week';
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
	return {
		report,
		sums: columnSums(report.rows),
		places: await recentPlaces(),
		editable: mayEdit(user, report),
		canClose: can(user.role, 'tagesberichte.abschliessen')
	};
};

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const { user, report } = await open(Number(params.id), locals);
		if (!mayEdit(user, report)) return fail(403, { message: 'Dieser Bericht ist nicht (mehr) änderbar.' });
		const form = await request.formData();

		const date = String(form.get('datum') ?? '');
		if (!isValidIsoDate(date)) return fail(400, { message: 'Das Datum ist ungültig.' });

		const positions = Array.from({ length: REPORT_COLUMNS }, (_, i) => ({
			idx: i + 1,
			lbPos: String(form.get(`lbpos.${i + 1}`) ?? ''),
			unit: String(form.get(`einheit.${i + 1}`) ?? '')
		}));

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
				const quantities = Object.fromEntries(
					QUANTITY_KEYS.map((k, n) => [k, String(form.get(`zeile.${i}.q${n + 1}`) ?? '')])
				) as Record<QuantityKey, string>;
				return { id: Number.isInteger(id) ? id : null, label: String(form.get(`zeile.${i}.text`) ?? ''), quantities };
			});

		const materials = REPORT_MATERIALS.map((kind) => ({
			kind,
			code: String(form.get(`material.${kind}.nr`) ?? ''),
			filmThickness: String(form.get(`material.${kind}.dicke`) ?? '')
		}));

		await saveReport(report.id, {
			head: {
				number: String(form.get('nummer') ?? ''),
				date,
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
		});
		return { saved: true };
	},

	close: async ({ params, locals }) => {
		const { user, report } = await open(Number(params.id), locals);
		if (!can(user.role, 'tagesberichte.abschliessen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		await setReportStatus(report.id, 'abgeschlossen', user.id);
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
