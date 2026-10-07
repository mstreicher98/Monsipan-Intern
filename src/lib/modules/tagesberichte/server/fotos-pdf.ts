/**
 * Fotos zum Tagesbericht als PDF – zum Herunterladen und Drucken, nur intern.
 * Je Seite zwei Fotos untereinander, ein einzelnes Foto bekommt die ganze
 * Seite. Darüber stehen Nummer, Datum und Baustelle des Berichts.
 */
import fs from 'node:fs';
import { dateTime } from '$lib/format';
import { bufferResponse, startPdf } from '$lib/server/pdf';
import { reportDateLabel } from '../sheet';
import { photoFile } from './photos';

const INK = '#1d2127';
const MUTED = '#5c626b';
/** Rand rundum – pdfkit selbst bekommt einen kleineren, sonst bricht Text nahe am Rand auf eine neue Seite um */
const EDGE = 36;

interface Report {
	id: number;
	number: string;
	date: string;
	dateTo: string | null;
	road: string;
	site: string;
}
interface Photo {
	id: number;
	sha256: string;
	/** Nummer im Bericht: Foto 1, 2, … */
	number: number;
	createdBy: string | null;
	createdAt: Date;
}

export function photosTitle(report: { number: string }) {
	return `Fotos zum Tagesbericht${report.number ? ` Nr. ${report.number}` : ''}`;
}

export function photosFacts(report: Report) {
	return [`vom ${reportDateLabel(report.date, report.dateTo)}`, report.site && `Baustelle: ${report.site}`, report.road && `Bundesstraße ${report.road}`].filter(
		(v): v is string => !!v
	);
}

export async function photosPdf(report: Report, photos: Photo[]): Promise<Response> {
	const title = photosTitle(report);
	const { doc, finish } = startPdf({ title, margin: 8 });
	const left = EDGE;
	const right = doc.page.width - EDGE;
	const width = right - left;
	const perPage = photos.length === 1 ? 1 : 2;
	const pages = Math.ceil(photos.length / perPage);
	const facts = photosFacts(report).join(' · ');

	for (let p = 0; p < pages; p++) {
		if (p > 0) doc.addPage();

		// Kopf
		doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text(title, left, EDGE, { width: width - 90, lineBreak: false, ellipsis: true });
		if (pages > 1) {
			doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`Seite ${p + 1} von ${pages}`, right - 90, EDGE + 3, { width: 90, align: 'right', lineBreak: false });
		}
		doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(facts, left, EDGE + 20, { width, lineBreak: false, ellipsis: true });
		const headBottom = EDGE + 37;
		doc.moveTo(left, headBottom).lineTo(right, headBottom).lineWidth(0.6).strokeColor(INK).stroke();

		// Fotos, darunter je eine Zeile: Nummer, wer, wann
		const gap = 16;
		const caption = 15;
		const slotTop = headBottom + 12;
		const slotH = (doc.page.height - EDGE - slotTop - gap * (perPage - 1)) / perPage;
		for (let s = 0; s < perPage; s++) {
			const photo = photos[p * perPage + s];
			if (!photo) break;
			const y = slotTop + s * (slotH + gap);
			const imageH = slotH - caption;
			const file = photoFile(photo.sha256);
			if (fs.existsSync(file)) {
				doc.image(file, left, y, { fit: [width, imageH], align: 'center', valign: 'center' });
			} else {
				doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('Die Bilddatei fehlt.', left, y + imageH / 2 - 5, { width, align: 'center', lineBreak: false });
			}
			const line = [`Foto ${photo.number}`, photo.createdBy, dateTime(photo.createdAt)].filter(Boolean).join(' · ');
			doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(line, left, y + imageH + 4, { width, align: 'center', lineBreak: false });
		}
	}

	const buffer = await finish();
	const which = photos.length === 1 ? `foto-${photos[0].number}` : 'fotos';
	return bufferResponse(`tagesbericht-${report.number || report.id}-${which}.pdf`.replace(/[^\w.-]/g, '_'), buffer);
}
