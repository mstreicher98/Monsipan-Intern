import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { offerDetail } from '$lib/modules/auftraege/server/offers';
import { offerPdf } from '$lib/modules/auftraege/server/pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	requirePermission(locals, 'angebote.sehen');
	const offer = await offerDetail(Number(params.id));
	if (!offer) error(404, 'Angebot nicht gefunden');
	return offerPdf(offer);
};
