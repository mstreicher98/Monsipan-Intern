import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { parseInk } from '$lib/ink';
import { mayEdit, mayView, saveSheetInk, sheetDetail } from '$lib/modules/stunden/server/timesheets';
import type { RequestHandler } from './$types';

/** Handschrift speichern – die Ansicht schickt nach jedem Strich den ganzen Stand */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = requireUser(locals);
	const sheet = await sheetDetail(Number(params.id));
	if (!sheet) error(404, 'Stundenzettel nicht gefunden');
	if (!mayView(user, sheet)) error(403, 'Diesen Stundenzettel darfst du nicht ansehen.');
	if (!mayEdit(user, sheet)) error(403, 'Diese Woche ist nicht (mehr) änderbar.');
	const ink = parseInk(await request.json().catch(() => null));
	if (!ink) error(400, 'Die Handschrift konnte nicht gelesen werden.');
	await saveSheetInk(sheet.id, ink);
	return json({ ok: true });
};
