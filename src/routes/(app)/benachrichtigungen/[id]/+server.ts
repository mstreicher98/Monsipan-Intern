/** Eine Benachrichtigung öffnen: als gelesen markieren und zur Stelle weiter */
import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { getNotification, markRead } from '$lib/server/notifications';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const user = requireUser(locals);
	const id = Number(params.id);
	const n = Number.isInteger(id) ? await getNotification(user.id, id) : undefined;
	// Fremde oder alte Einträge: einfach zur Liste
	if (!n) redirect(303, '/benachrichtigungen');
	if (!n.readAt) await markRead(user.id, n.id);
	redirect(303, n.url.startsWith('/') ? n.url : '/');
};
