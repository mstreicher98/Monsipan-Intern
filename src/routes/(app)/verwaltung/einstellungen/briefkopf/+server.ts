import fs from 'node:fs';
import { error } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/guard';
import { letterheadPath } from '$lib/server/letterhead';
import { getSettings } from '$lib/server/settings';
import type { RequestHandler } from './$types';

/** Vorschau des Briefkopfs in den Einstellungen */
export const GET: RequestHandler = async ({ locals }) => {
	requirePermission(locals, 'einstellungen.sehen');
	const file = letterheadPath((await getSettings()).letterheadFile);
	if (!file) error(404, 'Kein Briefkopf hinterlegt');
	return new Response(await fs.promises.readFile(file), {
		headers: { 'content-type': file.endsWith('.png') ? 'image/png' : 'image/jpeg', 'cache-control': 'no-store' }
	});
};
