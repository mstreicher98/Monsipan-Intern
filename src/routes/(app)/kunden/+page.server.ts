import { fail } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import {
	createCustomer,
	customerProblem,
	deleteCustomer,
	getCustomer,
	listCustomers,
	readCustomer,
	setCustomerActive,
	updateCustomer
} from '$lib/modules/auftraege/server/customers';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'kunden.sehen');
	const filter = { q: url.searchParams.get('q') ?? '', all: url.searchParams.get('alle') === '1' };
	return { customers: await listCustomers(filter), filter };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const form = await request.formData();
		const id = Number(form.get('id'));
		// Ändern und Anlegen sind getrennte Rechte
		requirePermission(locals, Number.isInteger(id) && id > 0 ? 'kunden.bearbeiten' : 'kunden.erstellen');
		const data = readCustomer(form);
		const problem = customerProblem(data);
		if (problem) return fail(400, { message: problem });
		if (Number.isInteger(id) && id > 0) {
			if (!(await getCustomer(id))) return fail(404, { message: 'Diesen Kunden gibt es nicht mehr.' });
			await updateCustomer(id, data);
			return { saved: id };
		}
		return { saved: await createCustomer(data), created: true };
	},

	active: async ({ request, locals }) => {
		requirePermission(locals, 'kunden.bearbeiten');
		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Unbekannter Kunde' });
		await setCustomerActive(id, form.get('active') === '1');
		return { toggled: id };
	},

	delete: async ({ request, locals }) => {
		requirePermission(locals, 'kunden.loeschen');
		const id = Number((await request.formData()).get('id'));
		if (!Number.isInteger(id)) return fail(400, { message: 'Unbekannter Kunde' });
		if (!(await deleteCustomer(id))) {
			return fail(400, { message: 'Dieser Kunde steht schon in Angeboten – statt zu löschen bitte ausblenden.' });
		}
		return { deleted: id };
	}
};
