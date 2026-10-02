import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import {
	deleteSheet,
	mayEdit,
	mayRecordFor,
	mayView,
	recentSites,
	saveSheet,
	setStatus,
	sheetDetail,
	totals,
	type DayInput
} from '$lib/modules/stunden/server/timesheets';
import { isValidSignature } from '$lib/modules/stunden/signature';
import type { Actions, PageServerLoad } from './$types';

async function load_(id: number, locals: App.Locals) {
	const user = requireUser(locals);
	if (!Number.isInteger(id)) error(404, 'Stundenzettel nicht gefunden');
	const sheet = await sheetDetail(id);
	if (!sheet) error(404, 'Stundenzettel nicht gefunden');
	if (!mayView(user, sheet)) error(403, 'Diesen Stundenzettel darfst du nicht ansehen.');
	return { user, sheet };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user, sheet } = await load_(Number(params.id), locals);
	return {
		sheet,
		totals: totals(sheet.days),
		sites: await recentSites(),
		editable: mayEdit(user, sheet),
		canRelease: can(user.role, 'stunden.freigeben'),
		canCheck: can(user.role, 'stunden.pruefen')
	};
};

/** Die Tageszeilen aus dem Formular lesen */
function readDays(form: FormData, dates: string[]): DayInput[] {
	const value = (name: string, date: string) => String(form.get(`${name}.${date}`) ?? '');
	return dates.map((date) => ({
		date,
		costCenter: value('kostenstelle', date),
		site: value('baustelle', date),
		fromTime: value('beginn', date),
		breakStart: value('pause', date),
		breakEnd: value('pauseende', date),
		toTime: value('ende', date),
		normalHours: value('norm', date),
		overtime50: value('ue50', date),
		overtime100: value('ue100', date),
		vacationHours: value('urlaub', date),
		holidayHours: value('feiertag', date),
		rainHours: value('regen', date),
		sickHours: value('efzg', date)
	}));
}

function readHead(form: FormData) {
	return {
		allowanceDays: String(form.get('ausloeseTage') ?? ''),
		allowanceAmount: String(form.get('ausloeseBetrag') ?? ''),
		vaz: String(form.get('vaz') ?? ''),
		vazPercent: String(form.get('vazProzent') ?? ''),
		note: String(form.get('notiz') ?? '')
	};
}

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		if (!mayEdit(user, sheet)) return fail(403, { message: 'Diese Woche ist nicht (mehr) änderbar.' });
		const form = await request.formData();
		await saveSheet(
			sheet.id,
			readHead(form),
			readDays(
				form,
				sheet.days.map((d) => d.date)
			)
		);
		return { saved: true };
	},

	/** Speichert den aktuellen Stand und gibt frei – mit Unterschrift, wenn eine mitkommt */
	release: async ({ params, request, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		if (!can(user.role, 'stunden.freigeben') || !mayEdit(user, sheet)) {
			return fail(403, { message: 'Freigeben darf nur, wer die Woche auch erfassen darf.' });
		}
		const form = await request.formData();
		const raw = form.get('ohneUnterschrift') ? '' : String(form.get('unterschrift') ?? '').trim();
		if (raw && !isValidSignature(raw)) {
			return fail(400, { message: 'Die Unterschrift konnte nicht gelesen werden – bitte neu unterschreiben.' });
		}
		// Was im Formular steht, aber noch nicht gespeichert war, geht nicht verloren
		await saveSheet(
			sheet.id,
			readHead(form),
			readDays(
				form,
				sheet.days.map((d) => d.date)
			)
		);
		await setStatus(sheet.id, 'freigegeben', user.id, raw || null);
		return { released: true };
	},

	check: async ({ params, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		if (!can(user.role, 'stunden.pruefen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		await setStatus(sheet.id, 'geprueft', user.id);
		return { checked: true };
	},

	reopen: async ({ params, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		// Selbst Freigegebenes darf zurückholen, wer die Woche auch erfassen darf
		const own = sheet.status === 'freigegeben' && can(user.role, 'stunden.freigeben') && mayRecordFor(user, sheet);
		if (!can(user.role, 'stunden.pruefen') && !own) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		await setStatus(sheet.id, 'entwurf', user.id);
		return { reopened: true };
	},

	delete: async ({ params, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		if (!mayEdit(user, sheet) || sheet.status !== 'entwurf') {
			return fail(403, { message: 'Nur Wochen in Arbeit können gelöscht werden.' });
		}
		const week = sheet.weekStart;
		await deleteSheet(sheet.id);
		redirect(303, `/stundenzettel?woche=${week}`);
	}
};
