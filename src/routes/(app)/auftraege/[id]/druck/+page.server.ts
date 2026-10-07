import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayViewOrder, orderDetail } from '$lib/modules/auftraege/server/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const order = await orderDetail(Number(params.id));
	if (!order || !mayViewOrder(user, order)) error(404, 'Auftrag nicht gefunden');
	return { id: order.id, number: order.number };
};
