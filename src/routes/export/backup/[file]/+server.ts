import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { BACKUP_DIR, BACKUP_FILE_RE } from '$lib/server/backup';
import { requirePermission } from '$lib/server/guard';
import type { RequestHandler } from './$types';

/** Sicherung herunterladen (nur Admin) */
export const GET: RequestHandler = async ({ params, locals }) => {
	requirePermission(locals, 'verwaltung.settings.manage');
	if (!BACKUP_FILE_RE.test(params.file)) error(404, 'Nicht gefunden');
	const file = path.join(BACKUP_DIR, params.file);
	if (!fs.existsSync(file)) error(404, 'Nicht gefunden');
	const stat = fs.statSync(file);
	return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
		headers: {
			'content-type': 'application/vnd.sqlite3',
			'content-length': String(stat.size),
			'content-disposition': `attachment; filename="${params.file}"`,
			'cache-control': 'no-store'
		}
	});
};
