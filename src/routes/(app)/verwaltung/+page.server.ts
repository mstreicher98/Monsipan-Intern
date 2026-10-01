import { error, redirect } from '@sveltejs/kit';
import { can } from '$lib/permissions';
import { requireUser } from '$lib/server/guard';
import type { PageServerLoad } from './$types';

/** Weiter zur ersten Seite, die diese Rolle in der Verwaltung sehen darf */
export const load: PageServerLoad = async ({ locals }) => {
	const user = requireUser(locals);
	if (can(user.role, 'verwaltung.masterdata.manage')) redirect(302, '/verwaltung/stammdaten');
	if (can(user.role, 'verwaltung.users.manage')) redirect(302, '/verwaltung/benutzer');
	if (can(user.role, 'verwaltung.settings.manage')) redirect(302, '/verwaltung/einstellungen');
	error(403, 'Kein Zugriff auf die Verwaltung');
};
