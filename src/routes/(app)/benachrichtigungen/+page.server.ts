import { requireUser } from '$lib/server/guard';
import { listNotifications, markRead } from '$lib/server/notifications';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, depends }) => {
	depends('app:notifications');
	const user = requireUser(locals);
	return { items: await listNotifications(user.id) };
};

export const actions: Actions = {
	allRead: async ({ locals }) => {
		const user = requireUser(locals);
		await markRead(user.id);
		return { done: true };
	}
};
