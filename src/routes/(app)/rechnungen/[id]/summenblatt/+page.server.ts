import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { invoiceDetail } from '$lib/modules/auftraege/server/invoices';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePermission(locals, 'rechnungen.sehen');
	const invoice = await invoiceDetail(Number(params.id));
	if (!invoice) error(404, 'Rechnung nicht gefunden');
	return { id: invoice.id, number: invoice.number, kind: invoice.kind };
};
