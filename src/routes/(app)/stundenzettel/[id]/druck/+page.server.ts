import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, sheetDetail, totals } from '$lib/modules/stunden/server/timesheets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const sheet = await sheetDetail(Number(params.id));
	if (!sheet) error(404, 'Stundenzettel nicht gefunden');
	if (!mayView(user, sheet)) error(403, 'Diesen Stundenzettel darfst du nicht ansehen.');
	return { sheet, totals: totals(sheet.days) };
};
