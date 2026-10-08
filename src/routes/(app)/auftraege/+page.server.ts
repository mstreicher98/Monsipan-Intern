import { can } from '$lib/permissions';
import { requirePermission } from '$lib/server/guard';
import { activeParties, listOrders } from '$lib/modules/auftraege/server/orders';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requirePermission(locals, 'auftraege.sehen');
	const all = can(user.role, 'auftraege.alle.sehen');
	const party = Number(url.searchParams.get('partie'));
	const filter = {
		q: url.searchParams.get('q') ?? '',
		// Ohne Auswahl zuerst die offenen – erledigte sind einen Klick entfernt
		status: url.searchParams.get('status') ?? 'offen',
		partyId: all && Number.isInteger(party) && party > 0 ? party : null
	};
	return {
		orders: await listOrders(user, filter),
		filter,
		all,
		parties: all ? await activeParties() : [],
		hasParty: !!user.partyId
	};
};
