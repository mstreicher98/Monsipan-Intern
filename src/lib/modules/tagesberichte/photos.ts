/**
 * Fotos zum Tagesbericht – nur intern, nicht im PDF und nicht beim Kunden.
 *
 * Am Gerät werden sie vor dem Hochladen verkleinert (JPEG, lange Seite höchstens
 * PHOTO_EDGE Pixel), dazu kommt eine kleine Vorschau fürs Raster. Das spart
 * Datenvolumen auf der Baustelle und Platz am Server.
 */

export const MAX_PHOTOS = 60;
/** Lange Seite des gespeicherten Fotos bzw. der Vorschau, in Pixeln */
export const PHOTO_EDGE = 2400;
export const THUMB_EDGE = 480;
/** Obergrenzen je Datei am Server */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_THUMB_BYTES = 1024 * 1024;

export class PhotoError extends Error {}

/**
 * Breite und Höhe aus dem Kopf eines JPEG – zugleich die Prüfung, dass es
 * wirklich eines ist. null, wenn die Datei kein lesbares JPEG ist.
 */
export function jpegSize(buf: Uint8Array): { width: number; height: number } | null {
	if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
	const u16 = (at: number) => (buf[at] << 8) | buf[at + 1];
	let i = 2;
	while (i + 9 < buf.length) {
		if (buf[i] !== 0xff) return null;
		const marker = buf[i + 1];
		// Füllbytes und Marker ohne Länge überspringen
		if (marker === 0xff) {
			i++;
			continue;
		}
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
			i += 2;
			continue;
		}
		// Bildkopf (SOF0–SOF15, außer DHT, JPG und DAC): Höhe, dann Breite
		if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
			const height = u16(i + 5);
			const width = u16(i + 7);
			return width && height ? { width, height } : null;
		}
		i += 2 + u16(i + 2);
	}
	return null;
}

type Source = CanvasImageSource & { width: number; height: number };

/** Bild am Gerät auf JPEG verkleinern – so, wie die Kamera es gedreht hat (EXIF) */
export async function shrinkPhoto(file: File): Promise<{ photo: Blob; thumb: Blob }> {
	const { source, release } = await decode(file);
	try {
		return { photo: await toJpeg(source, PHOTO_EDGE, 0.85), thumb: await toJpeg(source, THUMB_EDGE, 0.75) };
	} finally {
		release();
	}
}

async function decode(file: File): Promise<{ source: Source; release: () => void }> {
	try {
		const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
		return { source: bitmap, release: () => bitmap.close() };
	} catch {
		// Ältere Browser: über ein Bild-Element – das dreht nach EXIF ebenfalls richtig
		const url = URL.createObjectURL(file);
		try {
			const img = new Image();
			img.src = url;
			await img.decode();
			const source = Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight });
			return { source, release: () => URL.revokeObjectURL(url) };
		} catch {
			URL.revokeObjectURL(url);
			throw new PhotoError(`„${file.name}" lässt sich nicht öffnen – bitte ein JPG- oder PNG-Bild wählen.`);
		}
	}
}

async function toJpeg(source: Source, edge: number, quality: number): Promise<Blob> {
	const scale = Math.min(1, edge / Math.max(source.width, source.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(source.width * scale));
	canvas.height = Math.max(1, Math.round(source.height * scale));
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new PhotoError('Das Bild konnte nicht verkleinert werden.');
	// Durchsichtige Stellen (PNG) werden weiß statt schwarz
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
	if (!blob) throw new PhotoError('Das Bild konnte nicht verkleinert werden.');
	return blob;
}
