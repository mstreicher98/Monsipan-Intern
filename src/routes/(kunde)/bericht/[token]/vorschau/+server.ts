import { error } from '@sveltejs/kit';
import { reportByToken } from '$lib/modules/tagesberichte/server/reports';
import { tagesberichtPdf } from '$lib/modules/tagesberichte/server/tagesbericht-pdf';
import type { RequestHandler } from './$types';

/**
 * Der Bericht für die Ansicht auf der Seite des Kunden – auch vor seiner
 * Unterschrift, damit er sieht, was er unterschreibt (mit Handschrift vom Tablet).
 * Ohne interne Angaben; zum Herunterladen gibt es weiterhin erst nach der Unterschrift das PDF.
 */
export const GET: RequestHandler = async ({ params }) => {
	const report = await reportByToken(params.token);
	if (!report) error(404, 'Diesen Bericht gibt es nicht – bitte den Link prüfen.');
	if (report.status !== 'geprueft' && report.status !== 'abgeschlossen') error(404, 'Dieser Bericht wird gerade überarbeitet.');
	const response = await tagesberichtPdf(report, { forCustomer: true });
	response.headers.set('content-disposition', 'inline');
	response.headers.set('x-robots-tag', 'noindex, nofollow');
	return response;
};
