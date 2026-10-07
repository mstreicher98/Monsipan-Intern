import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, reportAccess } from '$lib/modules/tagesberichte/server/reports';
import { photosWithFiles } from '$lib/modules/tagesberichte/server/photos';
import { photosPdf } from '$lib/modules/tagesberichte/server/fotos-pdf';
import type { RequestHandler } from './$types';

/** Alle Fotos als PDF, mit ?foto=<id> nur dieses eine */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const user = requireUser(locals);
	const report = await reportAccess(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	const only = url.searchParams.get('foto');
	const photos = await photosWithFiles(report.id, only === null ? undefined : Number(only));
	if (!photos.length) error(404, 'Zu diesem Bericht gibt es keine Fotos.');
	return photosPdf(report, photos);
};
