import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { getOrderDocument, mayViewOrder, orderDetail } from '$lib/modules/auftraege/server/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const order = await orderDetail(Number(params.id));
	if (!order || !mayViewOrder(user, order)) error(404, 'Auftrag nicht gefunden');
	const document = await getOrderDocument(order.id, Number(params.doc));
	if (!document) error(404, 'Unterlage nicht gefunden');
	return {
		order: { id: order.id, number: order.number, title: order.title },
		document: { id: document.id, title: document.title, fileName: document.fileName, size: document.size }
	};
};
