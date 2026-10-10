import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requirePermission } from '$lib/server/guard';
import { deleteInvoice, invoiceDetail, setInvoiceOpen, setInvoicePaid } from '$lib/modules/auftraege/server/invoices';
import { isValidIsoDate, today } from '$lib/modules/stunden/week';
import { notifyInvoice } from '$lib/modules/auftraege/server/notify';
import type { Actions, PageServerLoad } from './$types';

async function open(id: number, locals: App.Locals) {
	const user = requirePermission(locals, 'rechnungen.sehen');
	const invoice = await invoiceDetail(id);
	if (!invoice) error(404, 'Rechnung nicht gefunden');
	return { user, invoice };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user, invoice } = await open(Number(params.id), locals);
	const isOpen = invoice.status === 'offen';
	return {
		invoice,
		today: today(),
		canEdit: isOpen && can(user.role, 'rechnungen.bearbeiten'),
		canPay: can(user.role, 'rechnungen.bezahlt'),
		canDelete: isOpen && can(user.role, 'rechnungen.loeschen'),
		canSeeOrder: !!invoice.orderId && can(user.role, 'auftraege.sehen'),
		canSeeReports: can(user.role, 'tagesberichte.sehen')
	};
};

export const actions: Actions = {
	paid: async ({ params, request, locals }) => {
		const { user, invoice } = await open(Number(params.id), locals);
		if (!can(user.role, 'rechnungen.bezahlt')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		const on = String((await request.formData()).get('am') ?? '');
		if (!isValidIsoDate(on)) return fail(400, { message: 'Bitte das Datum der Zahlung eintragen.' });
		if (on > today()) return fail(400, { message: 'Das Zahlungsdatum liegt in der Zukunft.' });
		await setInvoicePaid(invoice.id, on, user.id);
		if (invoice.status !== 'bezahlt') notifyInvoice('rechnung.bezahlt', invoice.id, user.id);
		return { paid: true };
	},

	open: async ({ params, locals }) => {
		const { user, invoice } = await open(Number(params.id), locals);
		if (!can(user.role, 'rechnungen.bezahlt')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		await setInvoiceOpen(invoice.id);
		return { reopened: true };
	},

	delete: async ({ params, locals }) => {
		const { user, invoice } = await open(Number(params.id), locals);
		if (!can(user.role, 'rechnungen.loeschen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		if (!(await deleteInvoice(invoice.id))) return fail(400, { message: 'Bezahlte Rechnungen lassen sich nicht löschen.' });
		redirect(303, invoice.orderId && can(user.role, 'auftraege.sehen') ? `/auftraege/${invoice.orderId}` : '/rechnungen');
	}
};
