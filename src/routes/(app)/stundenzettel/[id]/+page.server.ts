import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import {
	deleteSheet,
	mayEdit,
	mayView,
	recentSites,
	saveSheet,
	setStatus,
	sheetDetail,
	totals,
	type DayInput
} from '$lib/modules/stunden/server/timesheets';
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

/** Die sieben Tageszeilen aus dem Formular lesen */
function readDays(form: FormData, dates: string[]): DayInput[] {
	const value = (name: string, date: string) => String(form.get(`${name}.${date}`) ?? '');
	return dates.map((date) => ({
		date,
		costCenter: value('kostenstelle', date),
		site: value('baustelle', date),
		fromTime: value('von', date),
		toTime: value('bis', date),
		normalHours: value('norm', date),
		overtime50: value('ue50', date),
		overtime100: value('ue100', date),
		vacationHours: value('urlaub', date),
		holidayHours: value('feiertag', date),
		rainHours: value('regen', date),
		sickHours: value('efzg', date)
	}));
}

export const actions: Actions = {
	save: async ({ params, request, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		if (!mayEdit(user, sheet)) return fail(403, { message: 'Diese Woche ist nicht (mehr) änderbar.' });
		const form = await request.formData();
		await saveSheet(
			sheet.id,
			{
				allowanceDays: String(form.get('ausloeseTage') ?? ''),
				allowanceAmount: String(form.get('ausloeseBetrag') ?? ''),
				vaz: String(form.get('vaz') ?? ''),
				vazPercent: String(form.get('vazProzent') ?? ''),
				note: String(form.get('notiz') ?? '')
			},
			readDays(
				form,
				sheet.days.map((d) => d.date)
			)
		);
		return { saved: true };
	},

	release: async ({ params, locals }) => {
		const { user, sheet } = await load_(Number(params.id), locals);
		if (!can(user.role, 'stunden.freigeben') || !mayEdit(user, sheet)) {
			return fail(403, { message: 'Freigeben darf nur, wer die Woche auch erfassen darf.' });
		}
		await setStatus(sheet.id, 'freigegeben', user.id);
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
		const own = sheet.status === 'freigegeben' && can(user.role, 'stunden.freigeben');
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
