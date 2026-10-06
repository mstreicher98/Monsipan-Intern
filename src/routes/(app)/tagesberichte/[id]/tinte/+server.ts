import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { parseInk } from '$lib/ink';
import { mayEdit, mayView, reportDetail, saveReportInk } from '$lib/modules/tagesberichte/server/reports';
import type { RequestHandler } from './$types';

/** Handschrift speichern – die Ansicht schickt nach jedem Strich den ganzen Stand */
export const PUT: RequestHandler = async ({ params, request, locals }) => {
	const user = requireUser(locals);
	const report = await reportDetail(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	if (!mayEdit(user, report)) error(403, 'Dieser Bericht ist nicht (mehr) änderbar.');
	const ink = parseInk(await request.json().catch(() => null));
	if (!ink) error(400, 'Die Handschrift konnte nicht gelesen werden.');
	await saveReportInk(report.id, ink);
	return json({ ok: true });
};
