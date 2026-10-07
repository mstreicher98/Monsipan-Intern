import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, mayWork, reportAccess } from '$lib/modules/tagesberichte/server/reports';
import { addPhoto } from '$lib/modules/tagesberichte/server/photos';
import { PhotoError } from '$lib/modules/tagesberichte/photos';
import type { RequestHandler } from './$types';

/**
 * Foto hinzufügen – das Gerät schickt es schon verkleinert, mit Vorschau.
 * Fotos ändern nichts, was der Kunde unterschreibt: Sie gehen, solange am
 * Bericht gearbeitet wird, auch nach seiner Unterschrift vor Ort.
 */
export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireUser(locals);
	const report = await reportAccess(Number(params.id));
	if (!report) error(404, 'Tagesbericht nicht gefunden');
	if (!mayView(user, report)) error(403, 'Diesen Tagesbericht darfst du nicht ansehen.');
	if (!mayWork(user, report)) error(403, 'Fotos kann nur hinzufügen, wer den Bericht gerade bearbeiten darf.');
	const form = await request.formData().catch(() => null);
	const photo = form?.get('foto');
	const thumb = form?.get('vorschau');
	if (!(photo instanceof File)) error(400, 'Es kam kein Foto an.');
	try {
		return json(await addPhoto(report.id, user.id, photo, thumb instanceof File ? thumb : photo), { status: 201 });
	} catch (err) {
		if (err instanceof PhotoError) error(400, err.message);
		throw err;
	}
};
