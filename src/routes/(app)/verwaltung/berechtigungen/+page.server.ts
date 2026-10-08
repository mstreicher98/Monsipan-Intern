import { fail } from '@sveltejs/kit';
import { permissionMatrix, PERMISSIONS, ROLES, type Permission, type Role } from '$lib/permissions';
import { requirePermission } from '$lib/server/guard';
import { resetPermissions, savePermissions } from '$lib/server/permissions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requirePermission(locals, 'berechtigungen.sehen');
	return { matrix: permissionMatrix() };
};

const isRole = (v: string): v is Role => (ROLES as readonly string[]).includes(v);
const isPermission = (v: string): v is Permission => (PERMISSIONS as string[]).includes(v);

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'berechtigungen.bearbeiten');
		const form = await request.formData();
		const allowed = new Set<string>();
		for (const value of form.getAll('erlaubt')) {
			const [role, permission] = String(value).split('|');
			if (isRole(role) && isPermission(permission)) allowed.add(`${role}|${permission}`);
		}
		if (!allowed.size) return fail(400, { message: 'Es war nichts angehakt – sicherheitshalber nicht gespeichert.' });
		await savePermissions(allowed);
		return { saved: true };
	},

	reset: async ({ locals }) => {
		requirePermission(locals, 'berechtigungen.bearbeiten');
		await resetPermissions();
		return { reset: true };
	}
};
