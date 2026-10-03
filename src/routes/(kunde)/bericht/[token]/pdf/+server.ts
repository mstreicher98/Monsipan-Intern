import { error } from '@sveltejs/kit';
import { reportByToken } from '$lib/modules/tagesberichte/server/reports';
import { tagesberichtPdf } from '$lib/modules/tagesberichte/server/tagesbericht-pdf';
import type { RequestHandler } from './$types';

/** Der fertige Bericht für den Kunden – erst nach seiner Unterschrift, ohne interne Angaben */
export const GET: RequestHandler = async ({ params }) => {
	const report = await reportByToken(params.token);
	if (!report) error(404, 'Diesen Bericht gibt es nicht – bitte den Link prüfen.');
	if (report.status !== 'abgeschlossen') error(404, 'Das PDF gibt es, sobald der Bericht unterschrieben ist.');
	const response = await tagesberichtPdf(report, { forCustomer: true });
	response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};
