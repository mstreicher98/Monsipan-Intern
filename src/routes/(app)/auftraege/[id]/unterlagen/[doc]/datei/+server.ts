import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guard';
import { documentFile } from '$lib/server/documents';
import { getOrderDocument, mayViewOrder, orderDetail } from '$lib/modules/auftraege/server/orders';
import type { RequestHandler } from './$types';

/** PDF zum Auftrag – zum Anzeigen oder mit ?download zum Speichern; nur wer den Auftrag sieht */
export const GET: RequestHandler = async ({ params, url, locals, request }) => {
	const user = requireUser(locals);
	const order = await orderDetail(Number(params.id));
	if (!order || !mayViewOrder(user, order)) error(404, 'Auftrag nicht gefunden');
	const doc = await getOrderDocument(order.id, Number(params.doc));
	if (!doc) error(404, 'Unterlage nicht gefunden');

	const file = documentFile(doc.sha256);
	if (!fs.existsSync(file)) error(410, 'Die Datei zu dieser Unterlage ist nicht mehr vorhanden.');

	// Der Inhalt ändert sich nie – die Prüfsumme taugt als ETag
	const etag = `"${doc.sha256}"`;
	const headers: Record<string, string> = { etag, 'cache-control': 'private, max-age=86400' };
	if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

	const ascii = doc.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	const disposition = url.searchParams.has('download') ? 'attachment' : 'inline';
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			...headers,
			'content-type': 'application/pdf',
			'content-length': String(fs.statSync(file).size),
			'content-disposition': `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`
		}
	});
};
