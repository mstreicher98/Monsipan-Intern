import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayEdit, mayView, reportDetail } from '$lib/modules/tagesberichte/server/reports';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	const user = requireUser(locals);
	const report = await reportDetail(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	return {
		id: report.id,
		number: report.number,
		road: report.road,
		site: report.site,
		status: report.status,
		lockedByCustomer: !!report.customerSignature && (report.status === 'entwurf' || report.status === 'freigegeben'),
		ink: report.ink,
		editable: mayEdit(user, report)
	};
};
