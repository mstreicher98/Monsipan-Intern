import { fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requirePermission } from '$lib/server/guard';
import { countInquiries, createInquiry, inquiryProblem, listInquiries, matchCustomer, readInquiry } from '$lib/modules/auftraege/server/inquiries';
import { isValidIsoDate, today } from '$lib/modules/stunden/week';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals, 'anfragen.sehen');
	const filter = { q: url.searchParams.get('q') ?? '', state: url.searchParams.get('stand') === 'erledigt' ? 'erledigt' : 'offen' };
	const [inquiries, counts] = await Promise.all([listInquiries(filter), countInquiries()]);
	return { inquiries, counts, filter, canCreate: can(user.role, 'anfragen.erstellen'), today: today() };
};

export const actions: Actions = {
	/** E-Mail einfügen – der passende Kunde wird über die Adresse gesucht */
	create: async ({ request, locals }) => {
		const user = requirePermission(locals, 'anfragen.erstellen');
		const data = readInquiry(await request.formData());
		if (!isValidIsoDate(data.receivedOn)) data.receivedOn = today();
		const problem = inquiryProblem(data);
		if (problem) return fail(400, { message: problem });
		data.customerId ??= await matchCustomer(data.senderEmail);
		const id = await createInquiry(user, data);
		redirect(303, `/anfragen/${id}`);
	}
};
