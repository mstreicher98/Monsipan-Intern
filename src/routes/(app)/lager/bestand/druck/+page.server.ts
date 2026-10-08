import { stockPrintData } from '$lib/modules/lager/server/print';
import { requirePermission } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, depends, locals }) => {
	requirePermission(locals, 'lager.bestand.sehen');
	depends('app:stock');
	return stockPrintData(url);
};
