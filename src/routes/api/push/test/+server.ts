/** Test-Benachrichtigung an die eigenen Geräte – nur Push, kein Eintrag unter der Glocke */
import { json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { deviceCount, pushTo } from '$lib/server/push';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals }) => {
	const user = requireUser(locals);
	const devices = await deviceCount(user.id);
	if (devices) {
		await pushTo([{ userId: user.id, payload: { title: 'Test von Monsipan Intern', body: 'Push kommt auf diesem Gerät an.', url: '/benachrichtigungen', tag: 'test' } }]);
	}
	return json({ devices });
};
