import { error, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import { openSheet, weekOverview } from '$lib/modules/stunden/server/timesheets';
import { isValidIsoDate, mondayOf, today } from '$lib/modules/stunden/week';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
	const param = url.searchParams.get('woche') ?? '';
	const weekStart = mondayOf(isValidIsoDate(param) ? param : today());
	return {
		weekStart,
		rows: await weekOverview(user, weekStart),
		canCreate: can(user.role, 'stunden.erfassen'),
		canCheck: can(user.role, 'stunden.pruefen')
	};
};

export const actions: Actions = {
	/** Woche für einen Mitarbeiter öffnen – legt den Zettel an, wenn es ihn noch nicht gibt */
	open: async ({ request, locals }) => {
		const user = requireUser(locals);
		const form = await request.formData();
		const userId = Number(form.get('userId'));
		const weekStart = String(form.get('weekStart') ?? '');
		const month = String(form.get('monat') ?? '');
		if (!Number.isInteger(userId) || !isValidIsoDate(weekStart)) error(400, 'Ungültige Angaben');

		const allowed = await weekOverview(user, weekStart);
		const row = allowed.find((r) => r.user.id === userId && r.month === month);
		if (!row) error(403, 'Für diese Person darfst du keine Stunden erfassen.');
		if (!row.sheetId && !can(user.role, 'stunden.erfassen')) error(403, 'Dafür fehlt dir die Berechtigung.');

		const id = row.sheetId ?? (await openSheet(userId, weekStart, month, user.id));
		redirect(303, `/stundenzettel/${id}`);
	}
};
