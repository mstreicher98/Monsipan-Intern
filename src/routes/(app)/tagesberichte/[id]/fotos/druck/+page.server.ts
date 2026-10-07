import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, reportAccess } from '$lib/modules/tagesberichte/server/reports';
import { listPhotos } from '$lib/modules/tagesberichte/server/photos';
import { photosFacts, photosTitle } from '$lib/modules/tagesberichte/server/fotos-pdf';
import type { PageServerLoad } from './$types';

/** Druckansicht der Fotos – alle, mit ?foto=<id> nur dieses eine */
export const load: PageServerLoad = async ({ params, locals, url }) => {
	const user = requireUser(locals);
	const report = await reportAccess(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	const only = url.searchParams.get('foto');
	const photos = (await listPhotos(report.id)).map((p, i) => ({ ...p, number: i + 1 })).filter((p) => only === null || p.id === Number(only));
	if (!photos.length) error(404, 'Zu diesem Bericht gibt es keine Fotos.');
	return { id: report.id, title: photosTitle(report), facts: photosFacts(report), photos, only };
};
