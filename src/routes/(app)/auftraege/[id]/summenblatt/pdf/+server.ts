import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { mayViewOrder, orderDetail } from '$lib/modules/auftraege/server/orders';
import { orderSummary } from '$lib/modules/auftraege/server/summary';
import { summaryPdf } from '$lib/modules/auftraege/server/pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requirePermission(locals, 'tagesberichte.sehen');
	const order = await orderDetail(Number(params.id));
	if (!order || !mayViewOrder(user, order)) error(404, 'Auftrag nicht gefunden');
	return summaryPdf(order, await orderSummary(order.id));
};
