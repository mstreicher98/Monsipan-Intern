import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { mayView, mayWork, reportAccess } from '$lib/modules/tagesberichte/server/reports';
import { deletePhoto, getPhoto, photoFile } from '$lib/modules/tagesberichte/server/photos';
import type { RequestHandler } from './$types';

async function open(params: { id: string; foto: string }, locals: App.Locals) {
	const user = requireUser(locals);
	const report = await reportAccess(Number(params.id));
	if (!report || !mayView(user, report)) error(404, 'Foto nicht gefunden');
	return { user, report };
}

/** Foto bzw. mit ?vorschau seine kleine Fassung – unveränderlich, darf lange im Zwischenspeicher bleiben */
export const GET: RequestHandler = async ({ params, locals, url }) => {
	const { report } = await open(params, locals);
	const photo = await getPhoto(report.id, Number(params.foto));
	if (!photo) error(404, 'Foto nicht gefunden');
	const file = photoFile(url.searchParams.has('vorschau') ? photo.thumbSha256 : photo.sha256);
	const stat = await fs.promises.stat(file).catch(() => null);
	if (!stat) error(404, 'Die Bilddatei fehlt.');
	const name = `tagesbericht-${report.number || report.id}-foto-${photo.id}.jpg`;
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': 'image/jpeg',
			'content-length': String(stat.size),
			'content-disposition': `inline; filename="${name.replace(/[^\w.-]/g, '_')}"`,
			'cache-control': 'private, max-age=31536000, immutable'
		}
	});
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user, report } = await open(params, locals);
	if (!mayWork(user, report)) error(403, 'Fotos löschen kann nur, wer den Bericht gerade bearbeiten darf.');
	await deletePhoto(report.id, Number(params.foto));
	return new Response(null, { status: 204 });
};
