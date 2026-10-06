import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayEdit, mayView, sheetDetail } from '$lib/modules/stunden/server/timesheets';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const sheet = await sheetDetail(Number(params.id));
	if (!sheet) error(404, 'Stundenzettel nicht gefunden');
	if (!mayView(user, sheet)) error(403, 'Diesen Stundenzettel darfst du nicht ansehen.');
	return {
		id: sheet.id,
		firstName: sheet.firstName,
		lastName: sheet.lastName,
		weekStart: sheet.weekStart,
		month: sheet.month,
		partyName: sheet.partyName,
		status: sheet.status,
		ink: sheet.ink,
		editable: mayEdit(user, sheet)
	};
};
