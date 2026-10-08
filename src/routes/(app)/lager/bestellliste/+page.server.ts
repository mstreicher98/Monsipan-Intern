import { requirePermission } from '$lib/server/guard';
import { orderList } from '$lib/modules/lager/server/order-list';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:stock');
	requirePermission(locals, 'lager.berichte.sehen');
	return { items: await orderList() };
};
