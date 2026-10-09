import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { invoiceDetail } from '$lib/modules/auftraege/server/invoices';
import { invoicePdf } from '$lib/modules/auftraege/server/pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	requirePermission(locals, 'rechnungen.sehen');
	const invoice = await invoiceDetail(Number(params.id));
	if (!invoice) error(404, 'Rechnung nicht gefunden');
	return invoicePdf(invoice);
};
