/**
 * Der Tagesbericht auf Papier: Aufteilung auf Blätter im Aufbau des Vordrucks
 * aus dem Block. Ein Blatt hat acht LB-Spalten und 33 Zeilen – mehr Positionen
 * oder Zeilen gehen auf weitere Blätter. Druckansicht und PDF teilen gleich auf.
 */

/** LB-Spalten je Blatt, wie auf dem Vordruck */
export const SHEET_COLUMNS = 8;
/** Zeilen „Ortsbezeichnungen und Markierungsarten" je Blatt */
export const SHEET_ROWS = 33;
/** Der Materialblock hat auf dem Vordruck drei Zeilen (früher gelb, weiß, Reflexk.) */
export const SHEET_MATERIAL_ROWS = 3;
/** Obergrenzen, damit ein Bericht nicht ins Uferlose wächst */
export const MAX_POSITIONS = 40;
export const MAX_MATERIALS = 12;

/** Briefkopf links oben, wie auf dem Vordruck */
export const LETTERHEAD = {
	brand: 'MONSIPAN',
	lines: ['Bautenschutz Gesellschaft m. b. H.', '2320 Schwechat, Himbergerstraße 76', 'Tel. 01/706 2006, Fax 01/706 1998', 'office@monsipan.com']
};

export interface SheetRow {
	label: string;
	quantities: (number | null)[];
}

export interface Sheet<P, R> {
	/** Spalten dieses Blatts, auf acht aufgefüllt; null = leere Spalte wie auf dem Vordruck */
	columns: ({ position: P; index: number } | null)[];
	/** Zeilen dieses Blatts, mit leeren Zeilen (null) bis zum Fuß aufgefüllt */
	rows: (R | null)[];
	number: number;
	count: number;
}

const filled = (v: number | null | undefined) => v != null && Number.isFinite(v);

/**
 * Hat der Materialblock mehr als drei Zeilen, wird der Fuß höher – dafür
 * passen weniger Zeilen auf das Blatt (eine Fußzeile ist anderthalb Zeilen hoch).
 */
export function rowsPerSheet(materials: number): number {
	const extra = Math.max(0, Math.min(materials, MAX_MATERIALS) - SHEET_MATERIAL_ROWS);
	return SHEET_ROWS - Math.ceil(extra * 1.5);
}

/**
 * Bericht auf Blätter verteilen: zuerst je acht Positionen, darin je so viele
 * Zeilen, wie auf ein Blatt passen. Auf ein Blatt kommen nur Zeilen mit
 * Ortsbezeichnung oder einer Menge in seinen Spalten.
 */
export function sheets<P, R extends SheetRow>(positions: P[], rows: R[], materials = 0): Sheet<P, R>[] {
	const perSheet = rowsPerSheet(materials);
	const groups: { columns: Sheet<P, R>['columns']; rows: (R | null)[] }[] = [];
	const columnChunks = Math.max(1, Math.ceil(positions.length / SHEET_COLUMNS));

	for (let c = 0; c < columnChunks; c++) {
		const indexes = Array.from({ length: SHEET_COLUMNS }, (_, i) => c * SHEET_COLUMNS + i);
		const columns = indexes.map((index) => (index < positions.length ? { position: positions[index], index } : null));
		const used = rows.filter((r) => r.label.trim() || indexes.some((i) => filled(r.quantities[i])));
		const rowChunks = Math.max(1, Math.ceil(used.length / perSheet));
		for (let r = 0; r < rowChunks; r++) {
			const part: (R | null)[] = used.slice(r * perSheet, (r + 1) * perSheet);
			while (part.length < perSheet) part.push(null);
			groups.push({ columns, rows: part });
		}
	}
	return groups.map((g, i) => ({ ...g, number: i + 1, count: groups.length }));
}

/** Summe je Position über alle Zeilen */
export function columnSums(rows: SheetRow[], positions: number): number[] {
	return Array.from({ length: positions }, (_, i) => rows.reduce((s, r) => s + (filled(r.quantities[i]) ? (r.quantities[i] as number) : 0), 0));
}

/** Menge wie im Formular: Komma, höchstens drei Nachkommastellen; leer, wenn nichts eingetragen ist */
export function quantityLabel(v: number | null | undefined): string {
	if (!filled(v)) return '';
	return String(Math.round((v as number) * 1000) / 1000).replace('.', ',');
}

/** Summen: 0 bleibt leer, wie eine nicht ausgefüllte Zelle */
export function sumLabel(v: number): string {
	return v ? quantityLabel(v) : '';
}

/**
 * Datum wie auf dem Vordruck hinter „vom": „07.10.2026", über mehrere Tage
 * „07.10. bis 09.10.2026" (über den Jahreswechsel mit beiden Jahren).
 */
export function reportDateLabel(from: string, to?: string | null): string {
	const [y, m, d] = from.split('-');
	if (!to || to <= from) return `${d}.${m}.${y}`;
	const [y2, m2, d2] = to.split('-');
	return y === y2 ? `${d}.${m}. bis ${d2}.${m2}.${y2}` : `${d}.${m}.${y} bis ${d2}.${m2}.${y2}`;
}

/** Filmdicke für die Liste: eine reine Zahl bekommt „mm", Text bleibt wie eingetragen */
export function filmLabel(v: string): string {
	const t = v.trim();
	return /^\d+(?:[.,]\d+)?$/.test(t) ? `${t} mm` : t;
}

/**
 * Was beim Artikel aus dem Lager als „Material" eingetragen wird: die Farbe,
 * ohne Farbe die Materialart (z. B. Glasperlen).
 */
export function productMaterial(p: { colorName: string | null; categoryName: string | null }): string {
	return p.colorName ?? p.categoryName ?? '';
}
