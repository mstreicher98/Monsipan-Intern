import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { invoiceDetail } from '$lib/modules/auftraege/server/invoices';
import { summarySheet } from '$lib/modules/auftraege/server/summary';
import { summaryPdf } from '$lib/modules/auftraege/server/pdf';
import type { RequestHandler } from './$types';

/** Summenblatt nur mit den Tagesberichten dieser Rechnung – „zu Rechnung Nr." ausgefüllt */
export const GET: RequestHandler = async ({ params, locals }) => {
	requirePermission(locals, 'rechnungen.sehen');
	const invoice = await invoiceDetail(Number(params.id));
	if (!invoice) error(404, 'Rechnung nicht gefunden');
	return summaryPdf(await summarySheet(invoice.orderId, invoice));
};
