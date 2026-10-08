import { requirePermission } from '$lib/server/guard';
import { movementsPrintData } from '$lib/modules/lager/server/print';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, depends, locals }) => {
	depends('app:stock');
	requirePermission(locals, 'lager.bewegungen.sehen');
	return movementsPrintData(url);
};
