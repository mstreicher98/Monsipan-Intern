import { error, fail, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import { ORDER_STATUS, type OrderStatus } from '$lib/server/db/schema';
import {
	activeParties,
	deleteOrder,
	mayViewOrder,
	maySetOrderStatus,
	orderDetail,
	setOrderStatus,
	updateOrder
} from '$lib/modules/auftraege/server/orders';
import type { Actions, PageServerLoad } from './$types';

async function open(id: number, locals: App.Locals) {
	const user = requireUser(locals);
	const order = await orderDetail(id);
	// Fremde Aufträge gibt es für die Partie nicht – auch nicht als „verboten"
	if (!order || !mayViewOrder(user, order)) error(404, 'Auftrag nicht gefunden');
	return { user, order };
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const { user, order } = await open(Number(params.id), locals);
	const canManage = can(user.role, 'auftraege.erstellen');
	return {
		order,
		canStatus: maySetOrderStatus(user, order),
		canManage,
		canSeeOffer: can(user.role, 'angebote.sehen') && order.offerId != null,
		parties: canManage ? await activeParties() : []
	};
};

export const actions: Actions = {
	/** Partie: in Arbeit bzw. abgeschlossen – zurück auf „erstellt" nur das Büro */
	status: async ({ params, request, locals }) => {
		const { user, order } = await open(Number(params.id), locals);
		if (!maySetOrderStatus(user, order)) return fail(403, { message: 'Den Stand setzt die Partie, der der Auftrag gehört.' });
		const status = String((await request.formData()).get('status') ?? '') as OrderStatus;
		if (!ORDER_STATUS.includes(status)) return fail(400, { message: 'Unbekannter Stand' });
		if (status === 'erstellt' && !can(user.role, 'auftraege.erstellen')) return fail(403, { message: 'Zurücksetzen kann nur das Büro.' });
		await setOrderStatus(order.id, status, user.id);
		return { status };
	},

	update: async ({ params, request, locals }) => {
		const { user, order } = await open(Number(params.id), locals);
		if (!can(user.role, 'auftraege.erstellen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		const form = await request.formData();
		const partyId = Number(form.get('partie'));
		if (!Number.isInteger(partyId) || partyId <= 0) return fail(400, { message: 'Bitte eine Partie wählen.' });
		await updateOrder(order.id, { partyId, note: String(form.get('hinweis') ?? '').trim() });
		return { updated: true };
	},

	delete: async ({ params, locals }) => {
		const { user, order } = await open(Number(params.id), locals);
		if (!can(user.role, 'auftraege.erstellen')) return fail(403, { message: 'Dafür fehlt dir die Berechtigung.' });
		if (!(await deleteOrder(order.id))) return fail(400, { message: 'Gelöscht werden kann nur ein Auftrag, an dem noch nicht gearbeitet wird.' });
		redirect(303, order.offerId ? `/angebote/${order.offerId}` : '/auftraege');
	}
};
