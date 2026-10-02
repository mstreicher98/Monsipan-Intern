import { stockPrintData } from '$lib/modules/lager/server/print';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, depends }) => {
	depends('app:stock');
	return stockPrintData(url);
};
