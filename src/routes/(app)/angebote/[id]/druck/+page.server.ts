import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { offerDetail } from '$lib/modules/auftraege/server/offers';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePermission(locals, 'angebote.sehen');
	const offer = await offerDetail(Number(params.id));
	if (!offer) error(404, 'Angebot nicht gefunden');
	return { id: offer.id, number: offer.number };
};
