import fs from 'node:fs';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { productDocuments } from '$lib/server/db/schema';
import { documentFile } from '$lib/server/documents';
import { requirePermission } from '$lib/server/guard';
import type { RequestHandler } from './$types';

/** PDF ausliefern – zum Anzeigen (Standard) oder mit ?download zum Speichern. Wer Artikel sehen darf. */
export const GET: RequestHandler = async ({ params, url, locals, request }) => {
	requirePermission(locals, 'lager.artikel.sehen');
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Dokument nicht gefunden');
	const doc = await db.select().from(productDocuments).where(eq(productDocuments.id, id)).get();
	if (!doc) error(404, 'Dokument nicht gefunden');

	const file = documentFile(doc.sha256);
	if (!fs.existsSync(file)) error(410, 'Die Datei zu diesem Dokument ist nicht mehr vorhanden.');

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
