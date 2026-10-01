import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { columnSums, mayView, reportDetail } from '$lib/modules/tagesberichte/server/reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const report = await reportDetail(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	return { report, sums: columnSums(report.rows) };
};
