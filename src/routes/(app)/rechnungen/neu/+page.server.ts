import { error, fail, redirect } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { mayViewOrder } from '$lib/modules/auftraege/server/orders';
import { createInvoice, draftLines, invoiceDraft, invoiceForOrder, readInvoice, readMapping } from '$lib/modules/auftraege/server/invoices';
import type { Actions, PageServerLoad } from './$types';

/** Auftrag laden und prüfen: sichtbar, abgeschlossen, noch ohne Rechnung */
async function open(url: URL, locals: App.Locals) {
	const user = requirePermission(locals, 'rechnungen.erstellen');
	const orderId = Number(url.searchParams.get('auftrag'));
	if (!Number.isInteger(orderId) || orderId <= 0) redirect(303, '/rechnungen');
	const existing = await invoiceForOrder(orderId);
	if (existing) redirect(303, `/rechnungen/${existing.id}`);
	const draft = await invoiceDraft(orderId);
	if (!draft || !mayViewOrder(user, draft.order)) error(404, 'Auftrag nicht gefunden');
	if (draft.order.status !== 'abgeschlossen') error(400, 'Eine Rechnung gibt es erst, wenn der Auftrag abgeschlossen ist.');
	return { user, draft };
}

export const load: PageServerLoad = async ({ url, locals }) => {
	const { draft } = await open(url, locals);
	return {
		order: draft.order,
		head: draft.head,
		paymentDays: draft.paymentDays,
		summary: { from: draft.summary.from, to: draft.summary.to, counted: draft.summary.counted, pending: draft.summary.reports.length - draft.summary.counted },
		mapping: { columns: draft.summary.columns, priced: draft.lines, initial: draft.mapping },
		lines: draftLines(draft),
		hasPrices: draft.lines.some((l) => l.unitPrice != null)
	};
};

export const actions: Actions = {
	default: async ({ url, request, locals }) => {
		const { user, draft } = await open(url, locals);
		const form = await request.formData();
		const data = readInvoice(form);
		if ('message' in data) return fail(400, { message: data.message });
		const mapping = readMapping(
			form,
			draft.summary.columns.map((c) => c.key)
		);
		const result = await createInvoice(user, draft.order.id, data, mapping);
		if (typeof result !== 'number') return fail(400, { message: result.message });
		redirect(303, `/rechnungen/${result}`);
	}
};
