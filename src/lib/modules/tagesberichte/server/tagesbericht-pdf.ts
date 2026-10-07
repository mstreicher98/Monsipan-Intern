/**
 * Der Tagesbericht als PDF – gezeichnet wie der Vordruck aus dem Block:
 * Briefkopf, Titel mit Datum und Nummer, das Kästchen „Bundesstraße Nr.",
 * die Tabelle mit acht LB-Spalten und 33 Zeilen, darunter Materialblock,
 * Einheitssumme, Gesamtmenge, Tagesleistung, LV-Position und die beiden
 * Unterschriftszeilen. Mehr Positionen oder Zeilen gehen auf weitere Blätter.
 *
 * Spaltenanteile und Höhen sind vom Original abgemessen (wie in der Druckansicht).
 *
 * Handschrift vom Tablet liegt in den Koordinaten dieser Seiten. Sie wird zuletzt
 * obenauf gezeichnet; wo in einem Feld von Hand geschrieben steht, fällt der
 * getippte Wert weg – sonst stünde er doppelt da.
 */
import { bufferResponse, drawInk, startPdf } from '$lib/server/pdf';
import { inkInRect, type InkStroke } from '$lib/ink';
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
import { columnSums, LETTERHEAD, quantityLabel, reportDateLabel, SHEET_MATERIAL_ROWS, sheets, sumLabel } from '../sheet';
import type { ReportDetail } from './reports';
import { spacedNumber } from '$lib/modules/auftraege/offer';

const MM = 72 / 25.4;
const INK = '#1d2127';
const MUTED = '#5c626b';

/**
 * Spaltenanteile: Material, Kenn-Nr., Filmdicke, Beschriftung, acht LB-Spalten.
 * Die Kenn-Nr. ist breiter als auf dem Vordruck (der Artikelname steht drin),
 * die Filmdicke dafür schmaler.
 */
const WEIGHTS = [8.13, 12.24, 7.24, 20.36, ...Array(8).fill(6.5)];

// Etwas höher als in der Druckansicht: das PDF hat schmalere Ränder als der Browserdruck
const HEAD_H = 35.5 * MM;
const TABLE_HEAD_H = 19 * MM;
const ROW_H = 5.1 * MM;
const FOOT_H = 7.4 * MM;

const LABELS = ['Gesamtmenge', 'Tagesleistung', 'LV-Position Nr.'];

/** Oberlänge der Schrift: so weit liegt die Grundlinie unter dem y, das pdfkit bekommt */
const ASCENT = 0.905;

export async function tagesberichtPdf(
	report: ReportDetail,
	/** ink: false – Handschrift nicht zeichnen (Hintergrund der Handschrift-Ansicht) */
	{ forCustomer = false, ink = true }: { forCustomer?: boolean; ink?: boolean } = {}
): Promise<Response> {
	// Kleiner Rand: pdfkit bricht sonst Text nahe am unteren Rand auf eine neue Seite um
	const { doc, finish } = startPdf({ title: `Tagesbericht ${report.number}`.trim(), margin: 8 });

	const left = 30;
	const right = doc.page.width - 30;
	const width = right - left;
	const xs: number[] = [];
	let acc = left;
	for (const w of WEIGHTS) {
		xs.push(acc);
		acc += (w / 100) * width;
	}
	xs.push(right);

	const line = (x1: number, y1: number, x2: number, y2: number, w = 0.7) =>
		doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(w).strokeColor(INK).stroke();

	/**
	 * Text in einer Zelle, senkrecht mittig. Passt er nicht, wird die Schrift
	 * kleiner (bis minSize), danach wird abgeschnitten.
	 */
	const cell = (
		text: string,
		x: number,
		y: number,
		w: number,
		h: number,
		opts: { size?: number; minSize?: number; align?: 'left' | 'center' | 'right'; bold?: boolean; pad?: number; label?: boolean } = {}
	) => {
		if (!text) return;
		// Werte (keine festen Beschriftungen) entfallen, wo von Hand geschrieben wurde
		if (!opts.label && inkInRect(pageInk, x, y, w, h)) return;
		const pad = opts.pad ?? 2.5;
		const room = w - 2 * pad;
		doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica');
		let size = opts.size ?? 8.5;
		doc.fontSize(size);
		const min = opts.minSize ?? size;
		if (doc.widthOfString(text) > room && min < size) size = Math.max(min, (size * room) / doc.widthOfString(text));
		doc
			.fontSize(size)
			.fillColor(INK)
			.text(text, x + pad, y + (h - size * 0.72) / 2 - size * 0.12, { width: room, align: opts.align ?? 'left', lineBreak: false, ellipsis: true });
	};

	/**
	 * Mehrzeiliger Text in einer Zelle (z. B. der Artikelname als Kenn-Nr.):
	 * die größte Schrift, bei der alles hineinpasst, senkrecht mittig.
	 */
	const wrapCell = (text: string, x: number, y: number, w: number, h: number, maxSize: number, minSize: number) => {
		if (!text || inkInRect(pageInk, x, y, w, h)) return;
		const pad = 2.5;
		const room = w - 2 * pad;
		doc.font('Helvetica').fillColor(INK);
		let size = maxSize;
		const height = () => doc.fontSize(size).heightOfString(text, { width: room, lineGap: -0.6 });
		while (size > minSize && height() > h - 2) size -= 0.25;
		const used = Math.min(height(), h - 2);
		// Was selbst in kleinster Schrift nicht passt, schneidet die Zelle ab
		// (pdfkits eigene Kürzung setzt das „…" mitten in den Text)
		doc.save();
		doc.rect(x, y, w, h).clip();
		doc.fontSize(size).text(text, x + pad, y + (h - used) / 2, { width: room, lineGap: -0.6 });
		doc.restore();
	};

	/** Handschrift der Seite, die gerade gezeichnet wird */
	let pageInk: InkStroke[] | undefined;

	const blaetter = sheets(report.positions, report.rows, report.materials.length);
	const sums = columnSums(report.rows, report.positions.length);
	const materialRows = Array.from({ length: Math.max(SHEET_MATERIAL_ROWS, report.materials.length) }, (_, i) => report.materials[i] ?? null);
	// Auftragsnummer für alle, Kostenstelle und Notiz sind intern – im PDF für den Kunden fehlen sie
	const extra = [report.orderNumber && `Auftrag Nr. ${spacedNumber(report.orderNumber)}`, !forCustomer && report.costCenter && `Kostenstelle: ${report.costCenter}`]
		.filter(Boolean)
		.join(' · ');

	for (const [n, blatt] of blaetter.entries()) {
		if (n > 0) doc.addPage();
		pageInk = report.ink?.[String(n)];
		const top = 28;

		/* ------------------------------------------------------- Briefkopf */
		const briefW = 0.348 * width;
		const briefH = 20 * MM;
		doc.font('Helvetica').fontSize(12.5).fillColor(INK).text(LETTERHEAD.brand, left, top + 1, { characterSpacing: 7.6, lineBreak: false });
		LETTERHEAD.lines.forEach((l, i) => {
			doc.font('Helvetica').fontSize(8.5).text(l, left, top + 18 + i * 9.6, { lineBreak: false });
		});
		line(left + briefW, top - 2, left + briefW, top + briefH);
		line(left, top + briefH, left + briefW, top + briefH);

		/* ------------------------------------------------- Titel, vom, Nr. */
		const titleX = left + 0.386 * width;
		doc.font('Helvetica').fontSize(25).text('Tagesbericht', titleX, top - 3, { lineBreak: false });

		const vomY = top + 14.5 * MM;
		doc.fontSize(9.5).text('vom', titleX, vomY + 2, { lineBreak: false });
		const vomStart = titleX + doc.widthOfString('vom') + 5;
		const vomEnd = titleX + 0.33 * width;
		line(vomStart, vomY + 12, vomEnd, vomY + 12);
		cell(reportDateLabel(report.date, report.dateTo), vomStart, vomY - 1, vomEnd - vomStart, 12, { size: 10.5, minSize: 8, align: 'center', pad: 0 });

		const nrX = right - 0.18 * width;
		const nrY = top + 5 * MM;
		doc.font('Helvetica').fontSize(19).fillColor(INK).text('Nr.', nrX, nrY, { lineBreak: false });
		const nrStart = nrX + doc.widthOfString('Nr.') + 5;
		line(nrStart, nrY + 17, right, nrY + 17);
		cell(report.number, nrStart, nrY + 1, right - nrStart, 15, { size: 13, minSize: 8, align: 'center', pad: 0 });

		// Kästchen „Bundesstraße Nr."
		const boxW = 0.132 * width;
		const boxX = right - boxW;

		// Baustelle steht nicht auf dem Vordruck – sie kommt groß unter den Briefkopf, mit
		// einer Linie wie bei „vom", damit man sie am Tablet auch von Hand eintragen kann
		const siteY = top + 21.5 * MM;
		const siteH = 7 * MM;
		const siteBase = siteY + siteH * 0.74;
		doc.font('Helvetica').fontSize(10).fillColor(INK).text('Baustelle:', left, siteBase - 10 * ASCENT, { lineBreak: false });
		const siteX = left + doc.widthOfString('Baustelle:') + 5;
		const siteW = boxX - 10 - siteX;
		line(siteX, siteBase + 2.5, siteX + siteW, siteBase + 2.5);
		if (report.site && !inkInRect(pageInk, siteX, siteY, siteW, siteH)) {
			doc.font('Helvetica-Bold').fontSize(14);
			const size = Math.max(9, Math.min(14, (14 * (siteW - 4)) / doc.widthOfString(report.site)));
			doc.fontSize(size).text(report.site, siteX + 2, siteBase - size * ASCENT, { width: siteW - 4, lineBreak: false, ellipsis: true });
		}

		// Auftrag, Kostenstelle (nur intern) und Blattnummer klein darunter
		const blattText = blatt.count > 1 ? `Blatt ${blatt.number} von ${blatt.count}` : '';
		if (extra || blattText) {
			const y = top + 30.3 * MM;
			doc.font('Helvetica').fontSize(8.5).fillColor(INK);
			if (extra) doc.text(extra, left, y, { width: 0.6 * width, lineBreak: false, ellipsis: true });
			if (blattText) {
				const x = extra ? left + Math.min(0.6 * width, doc.widthOfString(extra)) + 10 : left;
				doc.font('Helvetica-Bold').text(blattText, x, y, { lineBreak: false });
			}
		}
		const boxY = top + 21.8 * MM;
		const boxH = 12.5 * MM;
		doc.rect(boxX, boxY, boxW, boxH).lineWidth(0.8).strokeColor(INK).stroke();
		doc.font('Helvetica').fontSize(6.5).fillColor(INK).text('Bundesstraße Nr.', boxX, boxY + 2.5, { width: boxW, align: 'center', lineBreak: false });
		cell(report.road, boxX, boxY + 9, boxW, boxH - 9, { size: 11, minSize: 6.5, align: 'center', bold: true, pad: 2 });

		/* --------------------------------------------------------- Tabelle */
		const tableTop = top + HEAD_H;
		const headBottom = tableTop + TABLE_HEAD_H;
		const lbX = xs[4];

		doc.font('Helvetica').fontSize(12.5).fillColor(INK).text('Ortsbezeichnungen und\nMarkierungsarten', left, tableTop + TABLE_HEAD_H / 2 - 13, {
			width: lbX - left,
			align: 'center',
			lineGap: 1
		});

		for (const [c, col] of blatt.columns.entries()) {
			const x = xs[4 + c];
			const w = xs[5 + c] - x;
			const inset = w * 0.06;
			const h = TABLE_HEAD_H;
			doc.font('Helvetica').fontSize(6.5).fillColor(INK).text('LB-Pos.', x, tableTop + h * 0.04 + 1, { width: w, align: 'center', lineBreak: false });
			cell(col?.position.lbPos ?? '', x, tableTop + h * 0.14, w, h * 0.2, { size: 9, minSize: 6, align: 'center', bold: true, pad: inset });
			line(x + inset, tableTop + h * 0.36, x + w - inset, tableTop + h * 0.36, 0.5);
			line(x + inset, tableTop + h * 0.36 + 3.1, x + w - inset, tableTop + h * 0.36 + 3.1, 0.5);
			doc.font('Helvetica').fontSize(6.5).fillColor(INK).text('Einheit', x, tableTop + h * 0.47 + 1, { width: w, align: 'center', lineBreak: false });
			cell(col?.position.unit ?? '', x, tableTop + h * 0.6, w, h * 0.24, { size: 9, minSize: 6, align: 'center', pad: inset });
			line(x + inset, tableTop + h * 0.88, x + w - inset, tableTop + h * 0.88, 0.5);
		}

		// Zeilen
		let y = headBottom;
		for (const row of blatt.rows) {
			if (row) {
				cell(row.label, left, y, lbX - left, ROW_H, { size: 8.5, minSize: 6, pad: 3 });
				for (const [c, col] of blatt.columns.entries()) {
					if (!col) continue;
					cell(quantityLabel(row.quantities[col.index]), xs[4 + c], y, xs[5 + c] - xs[4 + c], ROW_H, { size: 8.5, minSize: 6, align: 'center' });
				}
			}
			y += ROW_H;
			line(left, y, right, y, 0.5);
		}
		const bodyBottom = y;

		// Fuß: Kopf des Materialblocks mit Einheitssumme, dann je Materialzeile eine Zeile
		doc.font('Helvetica').fontSize(6.5).fillColor(INK);
		doc.text('Material', xs[0], y + FOOT_H / 2 - 3, { width: xs[1] - xs[0], align: 'center', lineBreak: false });
		doc.text('Kenn-Nr.', xs[1], y + FOOT_H / 2 - 3, { width: xs[2] - xs[1], align: 'center', lineBreak: false });
		doc.text('Filmdicke\nin mm', xs[2], y + FOOT_H / 2 - 7, { width: xs[3] - xs[2], align: 'center', lineGap: -0.5 });
		cell('Einheitssumme', xs[3], y, xs[4] - xs[3], FOOT_H, { size: 12.5, minSize: 9, align: 'right', pad: 5, label: true });
		for (const [c, col] of blatt.columns.entries()) {
			if (col) cell(sumLabel(sums[col.index]), xs[4 + c], y, xs[5 + c] - xs[4 + c], FOOT_H, { size: 9, minSize: 6, align: 'center', bold: true });
		}
		y += FOOT_H;
		line(left, y, right, y, 0.5);

		for (const [i, m] of materialRows.entries()) {
			if (m) {
				cell(m.material, xs[0], y, xs[1] - xs[0], FOOT_H, { size: 8, minSize: 6 });
				wrapCell(m.code, xs[1], y, xs[2] - xs[1], FOOT_H, 8, 4.5);
				wrapCell(m.filmThickness, xs[2], y, xs[3] - xs[2], FOOT_H, 8, 4.5);
			}
			cell(LABELS[i] ?? '', xs[3], y, xs[4] - xs[3], FOOT_H, { size: 12.5, minSize: 9, align: 'right', pad: 5, label: true });
			if (i === 0) {
				for (const [c, col] of blatt.columns.entries()) {
					if (col) cell(quantityLabel(col.position.totalQuantity), xs[4 + c], y, xs[5 + c] - xs[4 + c], FOOT_H, { size: 9, minSize: 6, align: 'center', bold: true });
				}
			} else if (i === 1) {
				cell(report.dailyOutput, lbX, y, right - lbX, FOOT_H, { size: 9.5, minSize: 7, pad: 6 });
			} else if (i === 2) {
				cell(report.lvPosition, lbX, y, right - lbX, FOOT_H, { size: 9.5, minSize: 7, pad: 6 });
			}
			y += FOOT_H;
			if (i < materialRows.length - 1) line(left, y, right, y, 0.5);
		}
		const tableBottom = y;

		// Senkrechte Linien: im Kopf und in den Zeilen nur die LB-Spalten, im Fuß alle;
		// Tagesleistung und LV-Position gehen über alle LB-Spalten
		for (let c = 1; c < xs.length - 1; c++) {
			const x = xs[c];
			if (c < 4) line(x, bodyBottom, x, tableBottom, 0.5);
			else if (c === 4) line(x, tableTop, x, tableBottom, 0.5);
			else line(x, tableTop, x, bodyBottom + 2 * FOOT_H, 0.5);
		}
		line(left, headBottom, right, headBottom, 1);
		doc.rect(left, tableTop, width, tableBottom - tableTop).lineWidth(1.1).strokeColor(INK).stroke();

		/* ------------------------------------------------ Notiz, Unterschriften */
		// Die Unterschriftslinien stehen wie auf dem Vordruck unten am Blatt
		const signW = 0.324 * width;
		const signY = doc.page.height - 40;
		const noteRoom = signY - 11 * MM - 4 - (tableBottom + 4);
		if (!forCustomer && report.note && noteRoom > 9) {
			doc
				.font('Helvetica')
				.fontSize(8)
				.fillColor(INK)
				.text(`Notiz: ${report.note.replace(/\s+/g, ' ')}`, left, tableBottom + 4, { width, height: Math.min(20, noteRoom), ellipsis: true });
		}

		line(left, signY, left + signW, signY);
		line(right - signW, signY, right, signY);
		doc.font('Helvetica').fontSize(7).fillColor(INK);
		doc.text('Für den Auftragnehmer', left, signY + 2, { width: signW, align: 'center', lineBreak: false });
		doc.text('Für den Auftraggeber', right - signW, signY + 2, { width: signW, align: 'center', lineBreak: false });

		/** Unterschrift über der Linie ab x, darunter Name und Datum – der Pfad liegt im 600×200-Feld */
		const signature = (path: string | null, x: number, who: string, at: Date | null) => {
			if (!path || !at) return;
			const boxH = 11 * MM;
			const scale = Math.min(signW / SIGNATURE_WIDTH, boxH / SIGNATURE_HEIGHT);
			doc.save();
			doc.translate(x + (signW - SIGNATURE_WIDTH * scale) / 2, signY - boxH - 1);
			doc.scale(scale);
			doc.path(path).lineWidth(4).lineCap('round').lineJoin('round').strokeColor(INK).stroke();
			doc.restore();
			const when = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(at);
			doc
				.font('Helvetica')
				.fontSize(6.5)
				.fillColor(MUTED)
				.text([who, when].filter(Boolean).join(', '), x, signY + 11, { width: signW, align: 'center', lineBreak: false });
			doc.fillColor(INK);
		};
		signature(report.releaseSignature, left, [report.releasedByFirst, report.releasedByLast].filter(Boolean).join(' '), report.releasedAt);
		signature(report.customerSignature, right - signW, report.customerName ?? '', report.customerSignedAt);

		// Handschrift zuletzt, damit sie über allem liegt
		if (ink) drawInk(doc, pageInk);
	}

	const buffer = await finish();
	return bufferResponse(`tagesbericht-${report.number || report.id}-${report.date}.pdf`, buffer);
}
