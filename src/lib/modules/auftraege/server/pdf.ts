/**
 * Angebot und Auftrag als PDF – im Aufbau der Angebote aus dem Büro:
 * Briefkopf, Anschrift links, Angebotsdaten rechts, Überschrift mit Nummer
 * und BV, Einleitung, Positionen (Nr., Bezeichnung, Menge, Einheit, EP, GP),
 * Summen, Schlusstext und unten Anschrift, Bankverbindung und Kontakt.
 *
 * Der Auftrag sieht gleich aus, aber ohne Preise und ohne die Texte für den
 * Kunden – dafür mit Partie, Ansprechpartner und Hinweis.
 */
import { dateTime } from '$lib/format';
import { bufferResponse, drawLogo, startPdf } from '$lib/server/pdf';
import { getSettings } from '$lib/server/settings';
import { letterheadPath } from '$lib/server/letterhead';
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
import { LETTERHEAD, reportDateLabel } from '$lib/modules/tagesberichte/sheet';
import {
	addressLines,
	invoiceTotals,
	lineNumbers,
	lineTotal,
	money,
	offerTotals,
	priceLabel,
	quantityLabel,
	REVERSE_CHARGE_NOTE,
	spacedNumber
} from '../offer';
import type { OrderSummary } from '../summary';
import type { InvoiceDetail } from './invoices';
import type { OfferDetail } from './offers';
import type { OrderDetail } from './orders';

const MM = 72 / 25.4;
const INK = '#1d2127';
const MUTED = '#5c626b';
const LINE = '#b9bdc3';

const LEFT = 25 * MM;
const RIGHT = 190 * MM;
const WIDTH = RIGHT - LEFT;
/** Ab hier beginnt die Fußzeile – darunter wird nichts mehr gesetzt */
const FOOTER_TOP = 297 * MM - 30 * MM;

const isoDate = (iso: string) => {
	const [y, m, d] = iso.split('-');
	return `${d}.${m}.${y}`;
};

type Doc = PDFKit.PDFDocument;

/** Briefkopf: das hochgeladene Bild oder – ohne Bild – aus Text gesetzt */
function letterhead(doc: Doc, image: string | null) {
	const top = 10 * MM;
	if (image) {
		doc.image(image, LEFT, top, { fit: [WIDTH, 34 * MM], align: 'center', valign: 'center' });
		return;
	}
	// Logo mittig, darunter Firma und Anschrift
	const logoW = 85 * MM;
	const y = top + drawLogo(doc, (doc.page.width - logoW) / 2, top, logoW) + 5;
	const center = (t: string, yy: number, size: number, bold = false) => {
		doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(INK);
		doc.text(t, LEFT, yy, { width: WIDTH, align: 'center', lineBreak: false });
	};
	center('BAUTENSCHUTZ GESELLSCHAFT M. B. H.', y, 6.5, true);
	center('Bodenmarkierungen', y + 9, 9, true);
	center(`${LETTERHEAD.lines[1]}, ${LETTERHEAD.lines[2]}`, y + 21, 6.5);
	center(LETTERHEAD.lines[3], y + 29, 6.5);
}

/** Anschrift links, Angaben rechts – gibt die Unterkante zurück */
function addressAndFacts(doc: Doc, address: string[], facts: [string, string][]): number {
	const top = 52 * MM;
	doc.font('Helvetica').fontSize(10).fillColor(INK);
	let y = top;
	for (const l of address) {
		doc.text(l, LEFT, y, { width: 90 * MM, lineBreak: false, ellipsis: true });
		y += 13;
	}
	let fy = top + 4 * MM;
	for (const [label, value] of facts) {
		doc.font('Helvetica').fontSize(8.5).fillColor(INK).text(label, 122 * MM, fy, { width: 40 * MM, lineBreak: false });
		doc.text(value, 162 * MM, fy, { width: RIGHT - 162 * MM, lineBreak: false, ellipsis: true });
		fy += 11.5;
	}
	return Math.max(y, fy);
}

/** Signatur (SVG-Pfad aus dem 600×200-Feld) in ein Kästchen setzen */
function signature(doc: Doc, path: string, x: number, y: number, w: number, h: number) {
	const scale = Math.min(w / SIGNATURE_WIDTH, h / SIGNATURE_HEIGHT);
	doc.save();
	doc.translate(x + (w - SIGNATURE_WIDTH * scale) / 2, y + (h - SIGNATURE_HEIGHT * scale) / 2);
	doc.scale(scale);
	doc.path(path).lineWidth(4).lineCap('round').lineJoin('round').strokeColor(INK).stroke();
	doc.restore();
}

interface Column {
	label: string;
	x: number;
	w: number;
	align?: 'left' | 'right';
}

interface Row {
	kind: 'position' | 'titel';
	nr: string;
	text: string;
	cells: string[];
}

/**
 * Positionstabelle mit Kopf. Reicht der Platz nicht, geht es auf der nächsten
 * Seite weiter – mit Kopf. Gibt die Unterkante zurück.
 */
function table(doc: Doc, y: number, columns: Column[], rows: Row[], continued: string): number {
	const textCol = columns[1];
	const head = (yy: number) => {
		doc.font('Helvetica').fontSize(8).fillColor(MUTED);
		for (const c of columns) doc.text(c.label, c.x, yy, { width: c.w, align: c.align ?? 'left', lineBreak: false });
		doc
			.moveTo(LEFT, yy + 12)
			.lineTo(RIGHT, yy + 12)
			.lineWidth(0.8)
			.strokeColor(INK)
			.stroke();
		return yy + 18;
	};
	y = head(y);
	for (const row of rows) {
		const titel = row.kind === 'titel';
		doc.font('Helvetica-Bold').fontSize(titel ? 10.5 : 9.5);
		const textW = titel ? RIGHT - textCol.x : textCol.w;
		const height = Math.max(12, doc.heightOfString(row.text || ' ', { width: textW, lineGap: 1 })) + (titel ? 10 : 8);
		if (y + height > FOOTER_TOP - 6 * MM) {
			doc.addPage();
			doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(continued, LEFT, 15 * MM, { width: WIDTH, lineBreak: false });
			y = head(23 * MM);
		}
		const top = y + (titel ? 6 : 2);
		doc.font(titel ? 'Helvetica-Bold' : 'Helvetica').fontSize(titel ? 10.5 : 9).fillColor(INK);
		doc.text(row.nr, columns[0].x, top + (titel ? 0 : 0.5), { width: columns[0].w, lineBreak: false });
		doc.font('Helvetica-Bold').fontSize(titel ? 10.5 : 9.5).text(row.text, textCol.x, top, { width: textW, lineGap: 1 });
		if (!titel) {
			doc.font('Helvetica').fontSize(9.5);
			columns.slice(2).forEach((c, i) => {
				doc.text(row.cells[i] ?? '', c.x, top, { width: c.w, align: c.align ?? 'left', lineBreak: false });
			});
		}
		y += height;
		if (!titel) {
			doc
				.moveTo(LEFT, y - 3)
				.lineTo(RIGHT, y - 3)
				.lineWidth(0.4)
				.strokeColor(LINE)
				.stroke();
		}
	}
	return y;
}

/** Freier Text über die ganze Breite – bricht bei Bedarf auf die nächste Seite um */
function paragraph(doc: Doc, text: string, y: number, size = 9.5): number {
	if (!text.trim()) return y;
	doc.font('Helvetica').fontSize(size).fillColor(INK);
	for (const part of text.split('\n')) {
		const h = doc.heightOfString(part || ' ', { width: WIDTH, lineGap: 1.5 });
		if (y + h > FOOTER_TOP - 4 * MM) {
			doc.addPage();
			y = 20 * MM;
		}
		doc.text(part || ' ', LEFT, y, { width: WIDTH, lineGap: 1.5 });
		y += h;
	}
	return y;
}

/** Summen rechtsbündig unter der Tabelle: Beschriftung, Betrag, die letzte fett */
function sumsBlock(doc: Doc, y: number, sums: [string, string, boolean][]): number {
	if (y + 30 * MM > FOOTER_TOP - 4 * MM) {
		doc.addPage();
		y = 20 * MM;
	}
	y += 4 * MM;
	const sumX = 118 * MM;
	for (const [label, value, strong] of sums) {
		doc.font(strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(strong ? 11.5 : 9.5).fillColor(INK);
		doc.text(label, sumX, y, { width: 40 * MM, lineBreak: false });
		doc.text(value, sumX + 40 * MM, y, { width: RIGHT - sumX - 40 * MM, align: 'right', lineBreak: false });
		y += strong ? 17 : 15;
		doc
			.moveTo(sumX, y - 4)
			.lineTo(RIGHT, y - 4)
			.lineWidth(strong ? 1 : 0.4)
			.strokeColor(strong ? INK : LINE)
			.stroke();
	}
	return y;
}

/** „Ausführungsort: …" – Beschriftung fett, der Text bricht bei Bedarf um */
function labeled(doc: Doc, label: string, value: string, y: number): number {
	if (!value.trim()) return y;
	doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${label}: `, LEFT, y, { width: WIDTH, continued: true, lineGap: 1.5 });
	doc.font('Helvetica').text(value, { lineGap: 1.5 });
	return doc.y + 3 * MM;
}

/** Auf jede Seite: Fußzeile mit drei Spalten (nur Angebot) und „Seite x von y" */
function finishPages(doc: Doc, footer: [string, string][] | null) {
	const range = doc.bufferedPageRange();
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		if (footer) {
			doc
				.moveTo(LEFT, FOOTER_TOP)
				.lineTo(RIGHT, FOOTER_TOP)
				.lineWidth(0.6)
				.strokeColor(INK)
				.stroke();
			const colW = WIDTH / 3;
			footer.forEach(([title, body], c) => {
				const x = LEFT + c * colW;
				doc.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(title, x, FOOTER_TOP + 5, { width: colW - 8, lineBreak: false });
				let y = FOOTER_TOP + 16;
				doc.font('Helvetica').fontSize(7.5).fillColor(INK);
				for (const l of body.split('\n').slice(0, 6)) {
					doc.text(l, x, y, { width: colW - 8, lineBreak: false, ellipsis: true });
					y += 9.5;
				}
			});
		}
		if (range.count > 1) {
			doc
				.font('Helvetica')
				.fontSize(7.5)
				.fillColor(MUTED)
				.text(`Seite ${i - range.start + 1} von ${range.count}`, LEFT, FOOTER_TOP - 11, { width: WIDTH, align: 'right', lineBreak: false });
		}
	}
}

/* ------------------------------------------------------------- Angebot */

export async function offerPdf(offer: OfferDetail, { forCustomer = false } = {}): Promise<Response> {
	const settings = await getSettings();
	const title = `Angebot Nr. ${spacedNumber(offer.number)}`;
	const { doc, finish } = startPdf({ title, margin: 8, bufferPages: true });

	letterhead(doc, letterheadPath(settings.letterheadFile));
	if (!forCustomer && offer.status === 'entwurf') {
		doc.font('Helvetica-Bold').fontSize(9).fillColor('#b42318').text('ENTWURF – nicht freigegeben', LEFT, 10 * MM, { width: WIDTH, align: 'right', lineBreak: false });
	}

	let y = addressAndFacts(doc, addressLines({ name: offer.customerName, addition: offer.customerAddition, street: offer.customerStreet, zip: offer.customerZip, city: offer.customerCity }), [
		['Angebotsdatum:', isoDate(offer.date)],
		['Kunden UID-Nummer:', offer.customerUid],
		['Projektnummer:', offer.projectNumber],
		['Angebotsnummer:', offer.number]
	]);

	y += 12 * MM;
	doc.font('Helvetica-Bold').fontSize(14).fillColor(INK);
	const heading = `${title}${offer.title ? ` / BV: ${offer.title}` : ''}`;
	doc.text(heading, LEFT, y, { width: WIDTH, lineGap: 2 });
	y += doc.heightOfString(heading, { width: WIDTH, lineGap: 2 }) + 5 * MM;
	y = labeled(doc, 'Ausführungsort', offer.location, y);
	y += 1 * MM;

	y = paragraph(doc, offer.intro, y, 10) + 5 * MM;

	const numbers = lineNumbers(offer.lines);
	const rows: Row[] = offer.lines.map((l, i) => ({
		kind: l.kind,
		nr: numbers[i],
		text: l.text,
		cells: [quantityLabel(l.quantity), l.unit, priceLabel(l.unitPrice), money(lineTotal(l))]
	}));
	y = table(
		doc,
		y,
		[
			{ label: 'Nr.', x: LEFT, w: 12 * MM },
			{ label: 'Bezeichnung', x: LEFT + 12 * MM, w: 74 * MM },
			{ label: 'Menge', x: 111 * MM, w: 16 * MM, align: 'right' },
			{ label: 'Einheit', x: 130 * MM, w: 18 * MM },
			{ label: 'EP', x: 148 * MM, w: 19 * MM, align: 'right' },
			{ label: 'GP', x: 168 * MM, w: RIGHT - 168 * MM, align: 'right' }
		],
		rows,
		`${title} – Fortsetzung`
	);

	const totals = offerTotals(offer.lines, offer.vatRate);
	y = sumsBlock(doc, y, [
		['Gesamt Netto', money(totals.net), false],
		[`${String(offer.vatRate).replace('.', ',')} % Umsatzsteuer`, money(totals.vat), false],
		['Gesamtbetrag', money(totals.gross), true]
	]);

	y = paragraph(doc, offer.closing, y + 6 * MM);

	// Angenommen: Name, Tag und Unterschrift des Kunden
	if (offer.acceptedAt && offer.acceptedSignature) {
		if (y + 30 * MM > FOOTER_TOP - 4 * MM) {
			doc.addPage();
			y = 20 * MM;
		}
		y += 8 * MM;
		const boxW = 65 * MM;
		signature(doc, offer.acceptedSignature, LEFT, y, boxW, 16 * MM);
		y += 17 * MM;
		doc
			.moveTo(LEFT, y)
			.lineTo(LEFT + boxW, y)
			.lineWidth(0.6)
			.strokeColor(INK)
			.stroke();
		doc
			.font('Helvetica')
			.fontSize(8)
			.fillColor(MUTED)
			.text(`Angenommen für den Auftraggeber: ${offer.acceptedName ?? ''}, ${dateTime(offer.acceptedAt)}`, LEFT, y + 3, { width: WIDTH, lineBreak: false });
	}

	finishPages(doc, [
		['Anschrift', settings.offerFooterAddress],
		['Bankverbindung', settings.offerFooterBank],
		['Kontakt', settings.offerFooterContact]
	]);
	const buffer = await finish();
	return bufferResponse(`angebot-${offer.number}.pdf`.replace(/[^\w.-]/g, '_'), buffer);
}

/* ------------------------------------------------------------- Auftrag */

export async function orderPdf(order: OrderDetail): Promise<Response> {
	const settings = await getSettings();
	const title = `Auftrag Nr. ${spacedNumber(order.number)}`;
	const { doc, finish } = startPdf({ title, margin: 8, bufferPages: true });

	letterhead(doc, letterheadPath(settings.letterheadFile));
	const created = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);
	let y = addressAndFacts(doc, addressLines({ name: order.customerName, addition: order.customerAddition, street: order.customerStreet, zip: order.customerZip, city: order.customerCity }), [
		['Auftragsdatum:', new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(created)],
		['Projektnummer:', order.projectNumber],
		['Auftragsnummer:', order.number],
		['Partie:', order.partyName ?? '–']
	]);

	y += 12 * MM;
	doc.font('Helvetica-Bold').fontSize(14).fillColor(INK);
	const heading = `${title}${order.title ? ` / BV: ${order.title}` : ''}`;
	doc.text(heading, LEFT, y, { width: WIDTH, lineGap: 2 });
	y += doc.heightOfString(heading, { width: WIDTH, lineGap: 2 }) + 5 * MM;
	y = labeled(doc, 'Ausführungsort', order.location, y);

	const contact = [order.customerContact && `Ansprechpartner: ${order.customerContact}`, order.customerPhone && `Tel. ${order.customerPhone}`].filter(Boolean).join(' · ');
	if (contact) y = paragraph(doc, contact, y, 9.5) + 4 * MM;

	const numbers = lineNumbers(order.lines);
	y = table(
		doc,
		y,
		[
			{ label: 'Nr.', x: LEFT, w: 12 * MM },
			{ label: 'Bezeichnung', x: LEFT + 12 * MM, w: 112 * MM },
			{ label: 'Menge', x: 150 * MM, w: 18 * MM, align: 'right' },
			{ label: 'Einheit', x: 172 * MM, w: RIGHT - 172 * MM }
		],
		order.lines.map((l, i) => ({ kind: l.kind, nr: numbers[i], text: l.text, cells: [quantityLabel(l.quantity), l.unit] })),
		`${title} – Fortsetzung`
	);

	if (order.note.trim()) {
		y += 6 * MM;
		doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Hinweis für die Partie', LEFT, y, { lineBreak: false });
		y = paragraph(doc, order.note, y + 15);
	}

	// Pläne und andere Unterlagen gibt es in der App – hier nur, welche dazugehören
	if (order.documents.length) {
		y += 5 * MM;
		y = labeled(doc, 'Unterlagen in der App', order.documents.map((d) => d.title).join(', '), y);
	}

	finishPages(doc, null);
	const buffer = await finish();
	return bufferResponse(`auftrag-${order.number}.pdf`.replace(/[^\w.-]/g, '_'), buffer);
}

/* ------------------------------------------------------------ Rechnung */

/** Positionstabelle wie im Angebot: Nr., Bezeichnung, Menge, Einheit, EP, GP */
const PRICED_COLUMNS: Column[] = [
	{ label: 'Nr.', x: LEFT, w: 12 * MM },
	{ label: 'Bezeichnung', x: LEFT + 12 * MM, w: 74 * MM },
	{ label: 'Menge', x: 111 * MM, w: 16 * MM, align: 'right' },
	{ label: 'Einheit', x: 130 * MM, w: 18 * MM },
	{ label: 'EP', x: 148 * MM, w: 19 * MM, align: 'right' },
	{ label: 'GP', x: 168 * MM, w: RIGHT - 168 * MM, align: 'right' }
];

export async function invoicePdf(invoice: InvoiceDetail): Promise<Response> {
	const settings = await getSettings();
	const title = `Rechnung Nr. ${spacedNumber(invoice.number)}`;
	const { doc, finish } = startPdf({ title, margin: 8, bufferPages: true });

	letterhead(doc, letterheadPath(settings.letterheadFile));
	let y = addressAndFacts(
		doc,
		addressLines({ name: invoice.customerName, addition: invoice.customerAddition, street: invoice.customerStreet, zip: invoice.customerZip, city: invoice.customerCity }),
		[
			['Rechnungsdatum:', isoDate(invoice.date)],
			['Kunden UID-Nummer:', invoice.customerUid],
			['Projektnummer:', invoice.projectNumber],
			['Rechnungsnummer:', invoice.number],
			['Zahlbar bis:', isoDate(invoice.dueDate)]
		]
	);

	y += 12 * MM;
	doc.font('Helvetica-Bold').fontSize(14).fillColor(INK);
	const heading = `${title}${invoice.title ? ` / BV: ${invoice.title}` : ''}`;
	doc.text(heading, LEFT, y, { width: WIDTH, lineGap: 2 });
	y += doc.heightOfString(heading, { width: WIDTH, lineGap: 2 }) + 5 * MM;
	y = labeled(doc, 'Ausführungsort', invoice.location, y);
	if (invoice.serviceFrom) y = labeled(doc, 'Leistungszeitraum', reportDateLabel(invoice.serviceFrom, invoice.serviceTo), y);
	y += 1 * MM;

	y = paragraph(doc, invoice.intro, y, 10) + 5 * MM;

	// Nummern wie im Angebot – ältere Zeilen ohne Nummer werden durchgezählt
	const numbers = lineNumbers(invoice.lines);
	y = table(
		doc,
		y,
		PRICED_COLUMNS,
		invoice.lines.map((l, i) => ({
			kind: l.kind,
			nr: l.number || numbers[i],
			text: l.text,
			cells: [quantityLabel(l.quantity), l.unit, priceLabel(l.unitPrice), money(lineTotal(l))]
		})),
		`${title} – Fortsetzung`
	);

	const totals = invoiceTotals(invoice.lines, invoice.vatRate, invoice.reverseCharge);
	y = sumsBlock(
		doc,
		y,
		invoice.reverseCharge
			? [
					['Gesamt Netto', money(totals.net), false],
					['Gesamtbetrag', money(totals.gross), true]
				]
			: [
					['Gesamt Netto', money(totals.net), false],
					[`${String(invoice.vatRate).replace('.', ',')} % Umsatzsteuer`, money(totals.vat), false],
					['Gesamtbetrag', money(totals.gross), true]
				]
	);

	y += 6 * MM;
	if (invoice.reverseCharge) {
		y = paragraph(doc, `${REVERSE_CHARGE_NOTE}\nUID-Nummer des Leistungsempfängers: ${invoice.customerUid}`, y) + 3 * MM;
	}
	if (y + 14 > FOOTER_TOP - 4 * MM) {
		doc.addPage();
		y = 20 * MM;
	}
	doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`Zahlbar bis ${isoDate(invoice.dueDate)} ohne Abzug.`, LEFT, y, { width: WIDTH, lineBreak: false });
	y += 16;
	paragraph(doc, invoice.closing, y + 3 * MM);

	finishPages(doc, [
		['Anschrift', settings.offerFooterAddress],
		['Bankverbindung', settings.offerFooterBank],
		['Kontakt', settings.offerFooterContact]
	]);
	const buffer = await finish();
	return bufferResponse(`rechnung-${invoice.number}.pdf`.replace(/[^\w.-]/g, '_'), buffer);
}

/* ---------------------------------------------------------- Summenblatt */

const REPORT_STATUS_LABEL: Record<string, string> = {
	entwurf: 'in Arbeit',
	freigegeben: 'freigegeben, noch nicht geprüft',
	geprueft: 'geprüft',
	abgeschlossen: 'vom Kunden unterschrieben'
};

/**
 * Summenblatt im Querformat: je zählendem Tagesbericht eine Zeile, je
 * Mengenspalte (LB-Position und Einheit) eine Spalte, unten die Summe. Bei
 * vielen Spalten geht es in einem weiteren Block mit den übrigen weiter.
 */
export async function summaryPdf(
	order: { number: string; title: string; location: string; customerName: string; customerCity: string; partyName: string | null },
	summary: OrderSummary
): Promise<Response> {
	const title = `Summenblatt Auftrag Nr. ${spacedNumber(order.number)}`;
	const { doc, finish } = startPdf({ title, landscape: true, margin: 8, bufferPages: true });
	const L = 12 * MM;
	const R = 285 * MM;
	const W = R - L;
	const BOTTOM = 192 * MM;

	// Kopf: Titel links, Logo rechts
	doc.font('Helvetica-Bold').fontSize(16).fillColor(INK).text(title, L, 12 * MM, { width: W - 60 * MM, lineBreak: false, ellipsis: true });
	drawLogo(doc, R - 50 * MM, 9 * MM, 50 * MM);

	let y = 23 * MM;
	const fact = (label: string, value: string) => {
		if (!value.trim()) return;
		doc.font('Helvetica-Bold').fontSize(9.5).fillColor(INK).text(`${label}: `, L, y, { width: W, continued: true });
		doc.font('Helvetica').text(value, { width: W });
		y = doc.y + 1.5;
	};
	fact('BV', order.title);
	fact('Ausführungsort', order.location);
	fact('Kunde', [order.customerName, order.customerCity].filter(Boolean).join(', '));
	fact('Partie', order.partyName ?? '');
	fact('Zeitraum', summary.from ? reportDateLabel(summary.from, summary.to) : '');
	y += 3 * MM;

	const counted = summary.reports.filter((r) => r.counted);
	const fixed: Column[] = [
		{ label: 'Bericht', x: L, w: 16 * MM },
		{ label: 'Datum', x: L + 16 * MM, w: 32 * MM },
		{ label: 'Baustelle', x: L + 48 * MM, w: 48 * MM }
	];
	const qtyStart = L + 96 * MM;
	const perBlock = Math.max(1, Math.floor((R - qtyStart) / (20 * MM)));
	const blocks: (typeof summary.columns)[] = [];
	for (let i = 0; i < summary.columns.length; i += perBlock) blocks.push(summary.columns.slice(i, i + perBlock));
	if (!blocks.length) blocks.push([]);

	const rowH = 15;
	for (const [b, cols] of blocks.entries()) {
		const colW = cols.length ? Math.min(32 * MM, (R - qtyStart) / cols.length) : 0;
		const head = () => {
			if (blocks.length > 1) {
				doc
					.font('Helvetica')
					.fontSize(8)
					.fillColor(MUTED)
					.text(`Spalten ${b * perBlock + 1}–${b * perBlock + cols.length} von ${summary.columns.length}`, L, y, { width: W, lineBreak: false });
				y += 11;
			}
			doc.font('Helvetica').fontSize(8).fillColor(MUTED);
			for (const c of fixed) doc.text(c.label, c.x, y + 9, { width: c.w, lineBreak: false });
			cols.forEach((c, i) => {
				const x = qtyStart + i * colW;
				doc
					.font('Helvetica-Bold')
					.fontSize(8.5)
					.fillColor(INK)
					.text(c.lbPos || 'ohne LB-Pos.', x, y, { width: colW - 2, align: 'right', lineBreak: false, ellipsis: true });
				doc
					.font('Helvetica')
					.fontSize(8)
					.fillColor(MUTED)
					.text(c.unit || '–', x, y + 10, { width: colW - 2, align: 'right', lineBreak: false, ellipsis: true });
			});
			y += 22;
			doc.moveTo(L, y).lineTo(R, y).lineWidth(0.8).strokeColor(INK).stroke();
			y += 4;
		};
		if (y + 60 > BOTTOM) {
			doc.addPage();
			y = 14 * MM;
		}
		head();
		for (const r of counted) {
			if (y + rowH > BOTTOM - 20) {
				doc.addPage();
				y = 14 * MM;
				doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`${title} – Fortsetzung`, L, y, { width: W, lineBreak: false });
				y += 14;
				head();
			}
			doc.font('Helvetica').fontSize(9).fillColor(INK);
			doc.text(r.number || '–', fixed[0].x, y + 2, { width: fixed[0].w, lineBreak: false });
			doc.text(reportDateLabel(r.date, r.dateTo), fixed[1].x, y + 2, { width: fixed[1].w, lineBreak: false, ellipsis: true });
			doc.text([r.site, r.partyName].filter(Boolean).join(' · '), fixed[2].x, y + 2, { width: fixed[2].w - 3, lineBreak: false, ellipsis: true });
			cols.forEach((c, i) => {
				const v = r.values[c.key];
				doc.text(v ? quantityLabel(v) : '', qtyStart + i * colW, y + 2, { width: colW - 2, align: 'right', lineBreak: false });
			});
			y += rowH;
			doc.moveTo(L, y).lineTo(R, y).lineWidth(0.4).strokeColor(LINE).stroke();
		}
		// Summe
		y += 3;
		doc
			.font('Helvetica-Bold')
			.fontSize(9.5)
			.fillColor(INK)
			.text(`Summe aus ${counted.length} ${counted.length === 1 ? 'Bericht' : 'Berichten'}`, L, y + 2, { width: 96 * MM, lineBreak: false });
		cols.forEach((c, i) => {
			doc.text(quantityLabel(c.total), qtyStart + i * colW, y + 2, { width: colW - 2, align: 'right', lineBreak: false });
		});
		y += rowH + 2;
		doc.moveTo(L, y).lineTo(R, y).lineWidth(1).strokeColor(INK).stroke();
		y += 8 * MM;
	}

	const note = (label: string, value: string) => {
		if (!value) return;
		doc.font('Helvetica-Bold').fontSize(9);
		const h = doc.heightOfString(`${label}: ${value}`, { width: W });
		if (y + h > BOTTOM) {
			doc.addPage();
			y = 14 * MM;
		}
		doc.fillColor(INK).text(`${label}: `, L, y, { width: W, continued: true });
		doc.font('Helvetica').text(value, { width: W });
		y = doc.y + 2 * MM;
	};
	note('Material', summary.materials.map((m) => [m.material, m.code, m.filmThickness && `Filmdicke ${m.filmThickness}`].filter(Boolean).join(' · ')).join('; '));
	note(
		'Nicht enthalten',
		summary.reports
			.filter((r) => !r.counted)
			.map((r) => `Nr. ${r.number || '–'} vom ${reportDateLabel(r.date, r.dateTo)} (${REPORT_STATUS_LABEL[r.status] ?? r.status})`)
			.join('; ')
	);

	const range = doc.bufferedPageRange();
	const stamp = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
	for (let i = range.start; i < range.start + range.count; i++) {
		doc.switchToPage(i);
		doc
			.font('Helvetica')
			.fontSize(7.5)
			.fillColor(MUTED)
			.text(`Erstellt am ${stamp} · es zählen geprüfte und vom Kunden unterschriebene Tagesberichte`, L, 198 * MM, { width: W / 2 + 40 * MM, lineBreak: false });
		if (range.count > 1) doc.text(`Seite ${i - range.start + 1} von ${range.count}`, L + W / 2, 198 * MM, { width: W / 2, align: 'right', lineBreak: false });
	}
	const buffer = await finish();
	return bufferResponse(`summenblatt-${order.number}.pdf`.replace(/[^\w.-]/g, '_'), buffer);
}
