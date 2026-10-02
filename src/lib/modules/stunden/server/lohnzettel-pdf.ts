/**
 * Der Lohnzettel als PDF – gezeichnet wie der Durchschlag aus dem Block:
 * Kopf mit Name und Lohnwoche, das Raster mit sieben Tagen (je eine Zeile für
 * den Tag und eine schmale für „Zeit von/bis"), die Summenzeile, Auslöse und
 * die beiden Unterschriftszeilen.
 *
 * Die Spaltenbreiten und Zeilenhöhen sind vom Original abgemessen.
 */
import { bufferResponse, startPdf } from '$lib/server/pdf';
import { fullName } from '$lib/format';
import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '../signature';
import { hoursLabel, isoWeek, monthLabel, monthsOfWeek, timeRangeLabel, WEEKDAY_LABELS, weekdayIndex, weekDays } from '../week';
import type { SheetDetail } from './timesheets';
import { totals } from './timesheets';

/** Spaltenanteile wie auf dem Formular (Summe 100) */
const COLUMNS = [
	{ key: 'tag', weight: 5.74 },
	{ key: 'kst', weight: 7.96 },
	{ key: 'site', weight: 39.2 },
	{ key: 'normalHours', weight: 5.09, label: 'Norm-\nStd.' },
	{ key: 'overtime50', weight: 5.33, label: '50 %', group: 'Überstunden' },
	{ key: 'overtime100', weight: 5.33, label: '100 %', group: 'Überstunden' },
	{ key: 'vacationHours', weight: 6.56, label: 'Urlaubs-\nstd.' },
	{ key: 'holidayHours', weight: 7.14, label: 'Feiertags-\nstd.' },
	{ key: 'rainHours', weight: 6.81, label: 'Regen-\nStd.' },
	{ key: 'sickHours', weight: 5.74, label: 'Efzg' },
	{ key: 'rest', weight: 5.09 }
] as const;

/** Die Stundenspalten in der Reihenfolge des Formulars */
const HOURS = COLUMNS.filter((c) => 'label' in c) as unknown as {
	key: 'normalHours' | 'overtime50' | 'overtime100' | 'vacationHours' | 'holidayHours' | 'rainHours' | 'sickHours';
	label: string;
	group?: string;
}[];

const TOTAL_KEY = {
	normalHours: 'normal',
	overtime50: 'o50',
	overtime100: 'o100',
	vacationHours: 'vacation',
	holidayHours: 'holiday',
	rainHours: 'rain',
	sickHours: 'sick'
} as const;

const HEAD_H = 26;
const DAY_H = 38;
const TIME_H = 16;
const SUM_H = 22;

const date = (iso: string) => {
	const [y, m, d] = iso.split('-');
	return `${d}.${m}.${y}`;
};

export async function lohnzettelPdf(sheet: SheetDetail): Promise<Response> {
	const t = totals(sheet.days);
	const { year, week } = isoWeek(sheet.weekStart);
	const { doc, finish } = startPdf({ title: `Lohnzettel ${fullName(sheet)}` });

	const left = 36;
	const right = doc.page.width - 36;
	const width = right - left;
	const xs: number[] = [];
	let acc = left;
	for (const c of COLUMNS) {
		xs.push(acc);
		acc += (c.weight / 100) * width;
	}
	xs.push(right);
	const colX = (i: number) => xs[i];
	const colW = (i: number) => xs[i + 1] - xs[i];

	const line = (x1: number, y1: number, x2: number, y2: number, w = 0.8) =>
		doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(w).strokeColor('#1d2127').stroke();

	/** Beschriftete Linie zum Ausfüllen, wie im Kopf des Formulars */
	const filledLine = (label: string, value: string, x: number, y: number, lineTo: number, labelSize = 7) => {
		doc.font('Helvetica').fontSize(labelSize).fillColor('#1d2127').text(label, x, y + 4, { lineBreak: false });
		const start = x + doc.widthOfString(label) + 4;
		line(start, y + 13, lineTo, y + 13, 0.8);
		// Der Wert bleibt in seinem Feld, sonst rutscht er in die nächste Beschriftung
		if (value) {
			doc
				.font('Helvetica')
				.fontSize(10)
				.text(value, start + 4, y + 2, { width: Math.max(20, lineTo - start - 8), lineBreak: false, ellipsis: true });
		}
	};

	/* ------------------------------------------------------------- Kopf */
	doc.font('Helvetica-BoldOblique').fontSize(19).fillColor('#1d2127').text('MONSIPAN', left, 40, { lineBreak: false });
	doc.font('Helvetica-Bold').fontSize(13).text('LOHNZETTEL', left + 180, 44, { characterSpacing: 2.5, lineBreak: false });
	filledLine('für', fullName(sheet), left + 290, 44, right);

	// Geht die Woche über den Monatswechsel, steht hier der Monat dieses Teils
	const split = monthsOfWeek(sheet.weekStart).length > 1;
	const first = sheet.days[0]?.date ?? sheet.weekStart;
	const last = sheet.days.at(-1)?.date ?? sheet.weekStart;
	filledLine('Lohnwoche', split ? `KW ${week} · ${monthLabel(sheet.month)}` : `KW ${week} / ${year}`, left + 150, 72, left + 320, 6.5);
	filledLine('von', date(first), left + 330, 72, left + 415, 6.5);
	filledLine('bis', date(last), left + 425, 72, right, 6.5);

	/* ----------------------------------------------------------- Raster */
	const top = 104;
	let y = top;

	// Kopfzeile: "Überstunden" steht über den beiden Spalten 50 % und 100 %
	doc.font('Helvetica').fontSize(7.5).fillColor('#1d2127');
	const groupStart = xs[4];
	const groupEnd = xs[6];
	doc.text('Überstunden', groupStart, y + 3, { width: groupEnd - groupStart, align: 'center' });
	line(groupStart, y + HEAD_H / 2, groupEnd, y + HEAD_H / 2, 0.6);

	doc.text('Tag', colX(0), y + 2, { width: colW(0), align: 'center' });
	line(colX(0), y + HEAD_H / 2, colX(1), y + HEAD_H / 2, 0.6);
	doc.fontSize(6.5).text('Arbeits-\nzeit', colX(0), y + HEAD_H / 2 + 1, { width: colW(0), align: 'center', lineGap: -1 });

	doc.fontSize(7.5).text('Kosten-\nstelle', colX(1), y + 5, { width: colW(1), align: 'center', lineGap: -1 });
	doc.text('Baustelle / Tätigkeit', colX(2), y + 9, { width: colW(2), align: 'center' });
	doc.text('Norm-\nStd.', colX(3), y + 5, { width: colW(3), align: 'center', lineGap: -1 });
	doc.text('50 %', colX(4), y + HEAD_H / 2 + 3, { width: colW(4), align: 'center' });
	doc.text('100 %', colX(5), y + HEAD_H / 2 + 3, { width: colW(5), align: 'center' });
	doc.text('Urlaubs-\nstd.', colX(6), y + 5, { width: colW(6), align: 'center', lineGap: -1 });
	doc.text('Feiertags-\nstd.', colX(7), y + 5, { width: colW(7), align: 'center', lineGap: -1 });
	doc.text('Regen-\nStd.', colX(8), y + 5, { width: colW(8), align: 'center', lineGap: -1 });
	doc.text('Efzg', colX(9), y + 9, { width: colW(9), align: 'center' });

	y += HEAD_H;
	line(left, y, right, y);

	/* -------------------------------------------------------- Tageszeilen */
	// Das Raster zeigt immer alle sieben Tage; Tage des anderen Monats bleiben leer
	const byDate = new Map(sheet.days.map((d) => [d.date, d]));
	for (const date of weekDays(sheet.weekStart)) {
		const d = byDate.get(date);
		const i = weekdayIndex(date);
		const blockTop = y;

		doc.font('Helvetica').fontSize(11).text(WEEKDAY_LABELS[i], colX(0), y + DAY_H / 2 - 6, { width: colW(0), align: 'center' });
		if (d) {
			doc.fontSize(9).text(d.costCenter, colX(1) + 3, y + DAY_H / 2 - 5, { width: colW(1) - 6, lineBreak: false, ellipsis: true });
			doc.fontSize(9.5).text(d.site, colX(2) + 5, y + DAY_H / 2 - 6, { width: colW(2) - 10, lineBreak: false, ellipsis: true });

			for (const h of HOURS) {
				const idx = COLUMNS.findIndex((c) => c.key === h.key);
				doc
					.font('Helvetica')
					.fontSize(10)
					.text(hoursLabel(d[h.key]), colX(idx), y + (DAY_H + TIME_H) / 2 - 7, { width: colW(idx), align: 'center' });
			}
		}

		// Zeile "Zeit von/bis": nur links, die Stundenspalten bleiben eine hohe Zelle
		const timeTop = y + DAY_H;
		line(left, timeTop, xs[3], timeTop, 0.6);
		doc.font('Helvetica').fontSize(6.5).text('Zeit\nvon/bis', colX(0) + 3, timeTop + 2, { width: colW(0) - 6, lineGap: -1 });
		const times = d ? timeRangeLabel(d.times) : '';
		if (times) {
			// Bei vielen Zeiträumen wird die Schrift kleiner, damit alles in die Zeile passt
			const room = xs[3] - colX(1) - 8;
			doc.font('Helvetica').fontSize(9.5);
			const size = Math.max(6, Math.min(9.5, (9.5 * room) / doc.widthOfString(times)));
			doc.fontSize(size).text(times, colX(1) + 4, timeTop + 4 + (9.5 - size) / 2, { lineBreak: false, width: room, ellipsis: true });
		}

		y = timeTop + TIME_H;
		line(left, y, right, y);

		// Senkrechte Linien des Tagesblocks
		for (let c = 1; c < COLUMNS.length; c++) {
			const x = xs[c];
			// Zwischen Kostenstelle und Baustelle endet die Linie bei der Zeitzeile
			const stop = c <= 2 ? timeTop : y;
			line(x, blockTop, x, stop, 0.6);
		}
	}

	/* ------------------------------------------------------- Summenzeile */
	// Nur die Summen je Stundenart – die Gesamtsumme steht nicht noch einmal daneben
	doc.font('Helvetica').fontSize(10.5).text('Gesamtstunden', colX(2) + 8, y + 6, { lineBreak: false });
	for (const h of HOURS) {
		const idx = COLUMNS.findIndex((c) => c.key === h.key);
		doc
			.font('Helvetica-Bold')
			.fontSize(10)
			.text(hoursLabel(t[TOTAL_KEY[h.key]]), colX(idx), y + 6, { width: colW(idx), align: 'center' });
	}

	const tableBottom = y + SUM_H;
	line(left, tableBottom, right, tableBottom);
	for (let c = 3; c < COLUMNS.length; c++) line(xs[c], y, xs[c], tableBottom, 0.6);
	// Rahmen außen
	line(left, top, left, tableBottom);
	line(right, top, right, tableBottom);
	line(left, top, right, top);

	/* ------------------------------------------- VAZ, Auslöse, Unterschriften */
	// VAZ und der Prozentsatz stehen gemeinsam unter der Tabelle, nicht in ihr.
	// Keine lange Linie – nur der Prozentsatz hat sein Feld.
	doc.font('Helvetica').fontSize(9).fillColor('#1d2127').text('VAZ', left, tableBottom + 10, { lineBreak: false });
	let vazX = left + doc.widthOfString('VAZ') + 8;
	if (sheet.vaz) {
		doc.font('Helvetica').fontSize(10).text(sheet.vaz, vazX, tableBottom + 8, { width: 160, lineBreak: false, ellipsis: true });
		vazX += Math.min(160, doc.widthOfString(sheet.vaz)) + 8;
	}
	line(vazX, tableBottom + 19, vazX + 50, tableBottom + 19, 0.8);
	if (sheet.vazPercent != null) {
		doc.font('Helvetica').fontSize(10).text(hoursLabel(sheet.vazPercent), vazX, tableBottom + 8, { width: 50, align: 'center' });
	}
	doc.font('Helvetica').fontSize(9).text('%', vazX + 54, tableBottom + 10, { lineBreak: false });

	const ausloeseY = tableBottom + 58;
	doc.font('Helvetica').fontSize(10).text('Auslöse', right - 330, ausloeseY, { lineBreak: false });
	line(right - 285, ausloeseY + 11, right - 190, ausloeseY + 11);
	doc.text(hoursLabel(sheet.allowanceDays), right - 280, ausloeseY, { lineBreak: false });
	doc.text('Tage', right - 180, ausloeseY, { lineBreak: false });
	line(right - 145, ausloeseY + 11, right - 20, ausloeseY + 11);
	doc.text(hoursLabel(sheet.allowanceAmount), right - 140, ausloeseY, { lineBreak: false });
	doc.text('€', right - 12, ausloeseY, { lineBreak: false });

	const signY = tableBottom + 140;
	const signW = 130;

	/** Unterschrift über der Linie ab x, darunter Name und Datum – der Pfad liegt im 600×200-Feld */
	const signature = (path: string, x: number, first: string | null, last: string | null, at: Date | null) => {
		const boxH = 44;
		const scale = Math.min(signW / SIGNATURE_WIDTH, boxH / SIGNATURE_HEIGHT);
		doc.save();
		doc.translate(x + (signW - SIGNATURE_WIDTH * scale) / 2, signY - boxH - 2);
		doc.scale(scale);
		doc.path(path).lineWidth(4).lineCap('round').lineJoin('round').strokeColor('#1d2127').stroke();
		doc.restore();
		const who = [first, last].filter(Boolean).join(' ');
		const when = at ? new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(at) : '';
		doc
			.font('Helvetica')
			.fontSize(6.5)
			.fillColor('#5c626b')
			.text([who, when].filter(Boolean).join(', '), x, signY + 16, { width: signW, align: 'center' });
		doc.fillColor('#1d2127');
	};

	if (sheet.releaseSignature) {
		signature(sheet.releaseSignature, left, sheet.releasedByFirst, sheet.releasedByLast, sheet.releasedAt);
	}
	if (sheet.status === 'geprueft' && sheet.checkSignature) {
		signature(sheet.checkSignature, right - signW, sheet.checkedByFirst, sheet.checkedByLast, sheet.checkedAt);
	}

	line(left, signY, left + signW, signY);
	doc.font('Helvetica').fontSize(9.5).text('Unterschrift Vorarbeiter', left, signY + 4, { width: signW, align: 'center' });
	line(right - signW, signY, right, signY);
	doc.font('Helvetica').fontSize(9.5).text('überprüft', right - signW, signY + 4, { width: signW, align: 'center' });
	// Der KV-Satz steht zwischen den beiden Linien – so schmal, dass er dazwischenpasst
	doc
		.font('Helvetica-Oblique')
		.fontSize(7.4)
		.text('Freiwillige Leistungen über KV begründen keinen Rechtsanspruch!', left + signW + 8, signY + 2, {
			width: width - 2 * signW - 16,
			align: 'center',
			lineBreak: false
		});

	if (sheet.note) {
		doc.font('Helvetica').fontSize(8).fillColor('#5c626b').text(`Notiz: ${sheet.note}`, left, signY + 30, { width });
	}

	const buffer = await finish();
	const name = `lohnzettel-${sheet.username}-${year}-kw${String(week).padStart(2, '0')}${split ? `-${sheet.month}` : ''}.pdf`;
	return bufferResponse(name, buffer);
}
