/**
 * PDF-Dokumente am Artikel (und als Unterlagen an Aufträgen). Die Datenbank kennt nur Titel, Art und Prüfsumme;
 * die Dateien liegen unter /data/dokumente/<sha256>.pdf. Gleiche Dateien liegen
 * nur einmal da, auch wenn sie an mehreren Artikeln hängen.
 *
 * Wird ein Dokument gelöscht (oder alles zurückgesetzt), bleibt die Datei noch
 * eine Weile liegen: So findet eine eingespielte Sicherung ihre PDFs wieder.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { asc, eq, sql } from 'drizzle-orm';
import { MAX_DOCUMENT_BYTES } from '$lib/documents';
import { DATA_DIR, db } from './db';
import { orderDocuments, productDocuments, users } from './db/schema';

export const DOC_DIR = path.join(DATA_DIR, 'dokumente');

/** So lange bleiben nicht mehr verwendete Dateien liegen */
export const KEEP_UNUSED_DAYS = 90;

const PDF_MAGIC = '%PDF-';
const SHA_FILE = /^([0-9a-f]{64})\.pdf$/;

export class DocumentError extends Error {}

export const documentFile = (sha256: string) => path.join(DOC_DIR, `${sha256}.pdf`);

/**
 * Hochgeladene Datei prüfen und ablegen – gestreamt, mit Prüfsumme und
 * Größengrenze. Gibt Prüfsumme und Größe zurück.
 */
export async function storeDocument(upload: File): Promise<{ sha256: string; size: number }> {
	if (upload.size === 0) throw new DocumentError('Die Datei ist leer.');
	if (upload.size > MAX_DOCUMENT_BYTES) {
		throw new DocumentError(`Die Datei ist zu groß – erlaubt sind ${MAX_DOCUMENT_BYTES / 1024 / 1024} MB.`);
	}
	fs.mkdirSync(DOC_DIR, { recursive: true });
	const temp = path.join(DOC_DIR, `upload-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}.tmp`);

	const hash = crypto.createHash('sha256');
	let size = 0;
	let head = Buffer.alloc(0);
	const tap = new Transform({
		transform(chunk: Buffer, _enc, done) {
			size += chunk.length;
			if (size > MAX_DOCUMENT_BYTES) return done(new DocumentError('Die Datei ist zu groß.'));
			if (head.length < 1024) head = Buffer.concat([head, chunk]).subarray(0, 1024);
			hash.update(chunk);
			done(null, chunk);
		}
	});

	try {
		await pipeline(Readable.fromWeb(upload.stream() as Parameters<typeof Readable.fromWeb>[0]), tap, fs.createWriteStream(temp));
		// Die Kennung darf laut PDF-Norm in den ersten 1024 Bytes stehen
		if (!head.toString('latin1').includes(PDF_MAGIC)) throw new DocumentError('Das ist keine PDF-Datei.');
		const sha256 = hash.digest('hex');
		const target = documentFile(sha256);
		if (fs.existsSync(target)) fs.rmSync(temp, { force: true });
		else fs.renameSync(temp, target);
		touch(target);
		return { sha256, size };
	} catch (err) {
		fs.rmSync(temp, { force: true });
		throw err;
	}
}

function touch(file: string) {
	const now = new Date();
	try {
		fs.utimesSync(file, now, now);
	} catch {
		/* unkritisch */
	}
}

/** Dokumente eines Artikels, neueste zuerst innerhalb der Art */
export function listDocuments(productId: number) {
	return db
		.select({
			id: productDocuments.id,
			kind: productDocuments.kind,
			title: productDocuments.title,
			fileName: productDocuments.fileName,
			size: productDocuments.size,
			createdAt: productDocuments.createdAt,
			uploadedBy: sql<string | null>`nullif(trim(coalesce(${users.firstName}, '') || ' ' || coalesce(${users.lastName}, '')), '')`
		})
		.from(productDocuments)
		.leftJoin(users, eq(users.id, productDocuments.uploadedBy))
		.where(eq(productDocuments.productId, productId))
		.orderBy(asc(productDocuments.kind), asc(productDocuments.title))
		.all();
}

/**
 * Aufräumen, einmal am Tag: Dateien, die ein Dokument benutzt, gelten als
 * frisch (Änderungszeit = heute). Dateien, die seit KEEP_UNUSED_DAYS niemand
 * mehr benutzt, werden gelöscht. Abgebrochene Uploads nach einem Tag.
 */
export async function tidyDocuments(now = new Date()): Promise<{ removed: number }> {
	// Benutzt sind die PDFs an Artikeln und an Aufträgen
	const [products, orders] = await Promise.all([
		db.select({ sha: productDocuments.sha256 }).from(productDocuments).all(),
		db.select({ sha: orderDocuments.sha256 }).from(orderDocuments).all()
	]);
	return tidyFolder(DOC_DIR, SHA_FILE, new Set([...products, ...orders].map((r) => r.sha)), now);
}

/**
 * Ordner mit Dateien nach Prüfsumme aufräumen (auch für die Fotos der
 * Tagesberichte): `pattern` liefert in Gruppe 1 die Prüfsumme aus dem Dateinamen.
 */
export function tidyFolder(dir: string, pattern: RegExp, used: Set<string>, now = new Date()): { removed: number } {
	if (!fs.existsSync(dir)) return { removed: 0 };
	const unusedSince = now.getTime() - KEEP_UNUSED_DAYS * 86_400_000;
	const staleUpload = now.getTime() - 86_400_000;
	let removed = 0;
	for (const name of fs.readdirSync(dir)) {
		const file = path.join(dir, name);
		try {
			const match = pattern.exec(name);
			if (!match) {
				if (name.endsWith('.tmp') && fs.statSync(file).mtimeMs < staleUpload) fs.rmSync(file, { force: true });
				continue;
			}
			if (used.has(match[1])) {
				fs.utimesSync(file, now, now);
			} else if (fs.statSync(file).mtimeMs < unusedSince) {
				fs.rmSync(file, { force: true });
				removed++;
			}
		} catch {
			/* einzelne Datei nicht lesbar – nächstes Mal wieder */
		}
	}
	return { removed };
}
