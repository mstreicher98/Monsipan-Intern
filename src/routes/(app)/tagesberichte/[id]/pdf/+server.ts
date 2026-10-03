import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, reportDetail } from '$lib/modules/tagesberichte/server/reports';
import { tagesberichtPdf } from '$lib/modules/tagesberichte/server/tagesbericht-pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const report = await reportDetail(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	return tagesberichtPdf(report);
};
