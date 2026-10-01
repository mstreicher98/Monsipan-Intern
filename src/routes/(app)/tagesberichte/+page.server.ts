import { error, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import { createReport, listReports, nextNumber, recentPlaces } from '$lib/modules/tagesberichte/server/reports';
import { isValidIsoDate, today } from '$lib/modules/stunden/week';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals);
	const filter = {
		q: url.searchParams.get('q') ?? '',
		from: url.searchParams.get('von') ?? '',
		to: url.searchParams.get('bis') ?? ''
	};
	const [reports, places, number] = await Promise.all([listReports(user, filter), recentPlaces(), nextNumber()]);
	return {
		reports,
		filter,
		places,
		suggestion: { number, date: today() },
		canCreate: can(user.role, 'tagesberichte.erfassen')
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = requireUser(locals);
		if (!can(user.role, 'tagesberichte.erfassen')) error(403, 'Dafür fehlt dir die Berechtigung.');
		const form = await request.formData();
		const date = String(form.get('datum') ?? '');
		if (!isValidIsoDate(date)) error(400, 'Ungültiges Datum');
		const id = await createReport(user, {
			date,
			number: String(form.get('nummer') ?? ''),
			road: String(form.get('strasse') ?? ''),
			site: String(form.get('baustelle') ?? '')
		});
		redirect(303, `/tagesberichte/${id}`);
	}
};
