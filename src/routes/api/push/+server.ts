/**
 * Geräte für Push an- und abmelden. GET liefert, was das Gerät dafür braucht:
 * den öffentlichen Schlüssel für Web-Push und ob Push in der App eingerichtet ist.
 */
import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { pushStatus, removeSubscription, saveSubscription, vapidKeys } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
	requireUser(locals);
	const { publicKey } = await vapidKeys();
	return json({ vapidPublicKey: publicKey, ...(await pushStatus()) });
};

const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
	if (body?.kind === 'web') {
		const endpoint = text(body.endpoint, 2000);
		const p256dh = text(body.p256dh, 200);
		const auth = text(body.auth, 100);
		if (!endpoint || !/^https:\/\//.test(endpoint) || !p256dh || !auth) error(400, 'Ungültige Anmeldung');
		await saveSubscription(user.id, { kind: 'web', endpoint, p256dh, auth }, request.headers.get('user-agent'));
	} else if (body?.kind === 'fcm') {
		const token = text(body.token, 4096);
		if (!token) error(400, 'Ungültige Anmeldung');
		await saveSubscription(user.id, { kind: 'fcm', token }, request.headers.get('user-agent'));
	} else {
		error(400, 'Ungültige Anmeldung');
	}
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const user = requireUser(locals);
	const body = (await request.json().catch(() => null)) as { endpoint?: unknown } | null;
	const endpoint = text(body?.endpoint, 4096);
	if (endpoint) await removeSubscription(user.id, endpoint);
	return json({ ok: true });
};
