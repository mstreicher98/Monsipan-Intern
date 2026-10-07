/**
 * Briefkopf für Angebote und Aufträge als Bild (PNG oder JPG), hochgeladen
 * unter Einstellungen. Liegt unter /data/briefkopf/<sha256>.<png|jpg>; welcher
 * gilt, steht in den Einstellungen. Ohne Bild setzt das PDF den Briefkopf aus Text.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './db';

export const LETTERHEAD_DIR = path.join(DATA_DIR, 'briefkopf');
export const MAX_LETTERHEAD_BYTES = 5 * 1024 * 1024;
const NAME = /^[0-9a-f]{64}\.(png|jpg)$/;

export class LetterheadError extends Error {}

/** Pfad zur Datei – null, wenn der Name nicht passt oder die Datei fehlt */
export function letterheadPath(name: string | null | undefined): string | null {
	if (!name || !NAME.test(name)) return null;
	const file = path.join(LETTERHEAD_DIR, name);
	return fs.existsSync(file) ? file : null;
}

export async function storeLetterhead(upload: File): Promise<string> {
	if (upload.size === 0) throw new LetterheadError('Die Datei ist leer.');
	if (upload.size > MAX_LETTERHEAD_BYTES) throw new LetterheadError('Das Bild ist zu groß – erlaubt sind 5 MB.');
	const buf = Buffer.from(await upload.arrayBuffer());
	const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
	if (!png && !jpg) throw new LetterheadError('Bitte ein PNG- oder JPG-Bild wählen.');
	const name = `${crypto.createHash('sha256').update(buf).digest('hex')}.${png ? 'png' : 'jpg'}`;
	await fs.promises.mkdir(LETTERHEAD_DIR, { recursive: true });
	const target = path.join(LETTERHEAD_DIR, name);
	if (!fs.existsSync(target)) await fs.promises.writeFile(target, buf);
	return name;
}
