import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { can, ROLES, type Role } from '$lib/permissions';
import { isNotificationEvent } from '$lib/notifications';
import { db } from '$lib/server/db';
import { pushSubscriptions, users } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { notificationSettings, resetNotificationSettings, saveNotificationSettings } from '$lib/server/notifications';
import { pushStatus } from '$lib/server/push';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = requirePermission(locals, 'benachrichtigungen.sehen');
	const [settings, people, devices] = await Promise.all([
		notificationSettings(),
		db
			.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, role: users.role })
			.from(users)
			.where(and(eq(users.active, true), isNull(users.deletedAt)))
			.orderBy(asc(users.firstName), asc(users.lastName))
			.all(),
		db
			.select({ kind: pushSubscriptions.kind, n: sql<number>`count(*)`.mapWith(Number) })
			.from(pushSubscriptions)
			.groupBy(pushSubscriptions.kind)
			.all()
	]);
	return {
		settings,
		people,
		push: {
			appReady: pushStatus().app,
			webDevices: devices.find((d) => d.kind === 'web')?.n ?? 0,
			appDevices: devices.find((d) => d.kind === 'fcm')?.n ?? 0
		},
		canEdit: can(user.role, 'benachrichtigungen.bearbeiten')
	};
};

const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'benachrichtigungen.bearbeiten');
		const form = await request.formData();
		const roles = new Set<string>();
		for (const v of form.getAll('rolle').map(String)) {
			const [event, role] = v.split('|');
			if (isNotificationEvent(event) && isRole(role)) roles.add(`${event}|${role}`);
		}
		const people = new Set<string>();
		for (const v of form.getAll('person').map(String)) {
			const [event, id] = v.split('|');
			if (isNotificationEvent(event) && /^\d+$/.test(id)) people.add(`${event}|${id}`);
		}
		await saveNotificationSettings(roles, people);
		return { saved: true };
	},

	reset: async ({ locals }) => {
		requirePermission(locals, 'benachrichtigungen.bearbeiten');
		await resetNotificationSettings();
		return { reset: true };
	}
};
