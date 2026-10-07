import { error } from '@sveltejs/kit';
import { offerByToken } from '$lib/modules/auftraege/server/offers';
import { offerPdf } from '$lib/modules/auftraege/server/pdf';
import type { RequestHandler } from './$types';

/** PDF für den Kunden – solange das Angebot nicht gerade überarbeitet wird */
export const GET: RequestHandler = async ({ params, url }) => {
	const offer = await offerByToken(params.token);
	if (!offer) error(404, 'Dieses Angebot gibt es nicht – bitte den Link prüfen.');
	if (offer.status === 'entwurf') error(404, 'Dieses Angebot wird gerade überarbeitet.');
	const response = await offerPdf(offer, { forCustomer: true });
	// ?ansehen: im Browser zeigen statt herunterladen (Vorschau auf der Seite)
	if (url.searchParams.has('ansehen')) {
		const headers = new Headers(response.headers);
		headers.set('content-disposition', (headers.get('content-disposition') ?? '').replace(/^attachment/, 'inline'));
		headers.set('x-robots-tag', 'noindex, nofollow');
		return new Response(response.body, { status: response.status, headers });
	}
	return response;
};
