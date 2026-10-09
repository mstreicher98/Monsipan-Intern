import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { getSettings } from '$lib/server/settings';
import { invoiceDetail, readInvoice, saveInvoice } from '$lib/modules/auftraege/server/invoices';
import type { Actions, PageServerLoad } from './$types';

/** Nur offene Rechnungen lassen sich ändern */
async function open(id: number, locals: App.Locals) {
	requirePermission(locals, 'rechnungen.bearbeiten');
	const invoice = await invoiceDetail(id);
	if (!invoice) error(404, 'Rechnung nicht gefunden');
	if (invoice.status !== 'offen') redirect(303, `/rechnungen/${invoice.id}`);
	return invoice;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const invoice = await open(Number(params.id), locals);
	const settings = await getSettings();
	return {
		invoice: { id: invoice.id, number: invoice.number, title: invoice.title },
		head: {
			date: invoice.date,
			dueDate: invoice.dueDate,
			serviceFrom: invoice.serviceFrom ?? '',
			serviceTo: invoice.serviceTo ?? '',
			title: invoice.title,
			location: invoice.location,
			projectNumber: invoice.projectNumber,
			customerName: invoice.customerName,
			customerAddition: invoice.customerAddition,
			customerStreet: invoice.customerStreet,
			customerZip: invoice.customerZip,
			customerCity: invoice.customerCity,
			customerUid: invoice.customerUid,
			intro: invoice.intro,
			closing: invoice.closing,
			vatRate: invoice.vatRate,
			reverseCharge: invoice.reverseCharge
		},
		lines: invoice.lines,
		paymentDays: settings.invoicePaymentDays
	};
};

export const actions: Actions = {
	default: async ({ params, request, locals }) => {
		const invoice = await open(Number(params.id), locals);
		const data = readInvoice(await request.formData());
		if ('message' in data) return fail(400, { message: data.message });
		if (!(await saveInvoice(invoice.id, data))) return fail(400, { message: 'Die Rechnung ist inzwischen bezahlt und lässt sich nicht mehr ändern.' });
		redirect(303, `/rechnungen/${invoice.id}`);
	}
};
