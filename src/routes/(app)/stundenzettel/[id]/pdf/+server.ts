import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, sheetDetail } from '$lib/modules/stunden/server/timesheets';
import { lohnzettelPdf } from '$lib/modules/stunden/server/lohnzettel-pdf';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const user = requireUser(locals);
	const sheet = await sheetDetail(Number(params.id));
	if (!sheet) error(404, 'Stundenzettel nicht gefunden');
	if (!mayView(user, sheet)) error(403, 'Diesen Stundenzettel darfst du nicht ansehen.');
	// ?tinte=0: ohne Handschrift – Hintergrund der Handschrift-Ansicht
	return lohnzettelPdf(sheet, { ink: url.searchParams.get('tinte') !== '0' });
};
