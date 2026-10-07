import { fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requirePermission } from '$lib/server/guard';
import { listCustomers } from '$lib/modules/auftraege/server/customers';
import { createOffer, listOffers, numberTaken, suggestNumbers } from '$lib/modules/auftraege/server/offers';
import { isValidIsoDate, today } from '$lib/modules/stunden/week';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals, 'angebote.sehen');
	const filter = { q: url.searchParams.get('q') ?? '', status: url.searchParams.get('status') ?? '' };
	const canCreate = can(user.role, 'angebote.erstellen');
	const [offers, customers, numbers] = await Promise.all([
		listOffers(filter),
		canCreate ? listCustomers() : Promise.resolve([]),
		canCreate ? suggestNumbers() : Promise.resolve(null)
	]);
	return {
		offers,
		filter,
		canCreate,
		customers: customers.map((c) => ({ id: c.id, name: c.name, city: c.city })),
		suggestion: numbers ? { ...numbers, date: today() } : null
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const user = requirePermission(locals, 'angebote.erstellen');
		const form = await request.formData();
		const number = String(form.get('nummer') ?? '').trim();
		const date = String(form.get('datum') ?? '');
		const customer = Number(form.get('kunde'));
		if (!number) return fail(400, { message: 'Bitte die Angebotsnummer eintragen.' });
		if (await numberTaken(number)) return fail(400, { message: `Die Angebotsnummer ${number} gibt es schon.` });
		if (!isValidIsoDate(date)) return fail(400, { message: 'Das Datum ist ungültig.' });
		const id = await createOffer(user, {
			number,
			projectNumber: String(form.get('projekt') ?? '').trim(),
			date,
			title: String(form.get('titel') ?? '').trim(),
			customerId: Number.isInteger(customer) && customer > 0 ? customer : null
		});
		redirect(303, `/angebote/${id}`);
	}
};
