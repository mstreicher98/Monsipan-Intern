/**
 * Handschrift auf Formularen (Tagesbericht, Stundenzettel): Striche liegen in
 * den Koordinaten der PDF-Seite (Punkte, A4 = 595 × 842), damit sie in der
 * Ansicht, im Ausdruck und im PDF genau an derselben Stelle stehen.
 *
 * Gespeichert je Seite (0, 1, …) als Liste von Strichen: Farbe, Breite und die
 * Punkte als flache Liste [x0, y0, x1, y1, …].
 */

export interface InkStroke {
	/** Farbe, eine aus INK_COLORS */
	c: string;
	/** Strichbreite in Punkt */
	w: number;
	/** Punkte als [x0, y0, x1, y1, …] in Punkt, eine Nachkommastelle */
	p: number[];
}

/** Seite (als Text, „0", „1", …) → Striche */
export type InkPages = Record<string, InkStroke[]>;

export const INK_COLORS = {
	blau: '#1f3f99',
	schwarz: '#1d2127'
} as const;

export const INK_WIDTH = 0.9;

/** Grenzen, damit niemand Megabytes in die Datenbank schreibt */
const MAX_PAGES = 20;
const MAX_STROKES = 3000;
const MAX_POINTS = 4000;
const MAX_TOTAL_POINTS = 200_000;
/** A4 in Punkt, mit etwas Spielraum über den Rand */
const PAGE_W = 600;
const PAGE_H = 850;

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Geglätteter Pfad durch die Punkte: Quadratkurven über die Mittelpunkte –
 * sieht aus wie mit dem Kugelschreiber geschrieben, nicht wie ein Polygonzug.
 */
export function strokePath(p: number[]): string {
	const n = p.length / 2;
	if (n === 0) return '';
	const f = (v: number) => String(round(v));
	if (n === 1) return `M${f(p[0])} ${f(p[1])}L${f(p[0] + 0.3)} ${f(p[1])}`;
	if (n === 2) return `M${f(p[0])} ${f(p[1])}L${f(p[2])} ${f(p[3])}`;
	let d = `M${f(p[0])} ${f(p[1])}`;
	for (let i = 1; i < n - 1; i++) {
		const x = p[i * 2];
		const y = p[i * 2 + 1];
		const mx = (x + p[i * 2 + 2]) / 2;
		const my = (y + p[i * 2 + 3]) / 2;
		d += `Q${f(x)} ${f(y)} ${f(mx)} ${f(my)}`;
	}
	d += `L${f(p[(n - 1) * 2])} ${f(p[(n - 1) * 2 + 1])}`;
	return d;
}

/** Gibt es auf irgendeiner Seite Handschrift? */
export function hasInk(ink: InkPages | null | undefined): boolean {
	return !!ink && Object.values(ink).some((s) => s.length > 0);
}

/**
 * Liegt Handschrift in diesem Rechteck? Damit blendet das PDF getippte Werte
 * aus, wo schon von Hand geschrieben steht – nichts erscheint doppelt. Der
 * Rand zählt nicht mit, damit ein Strich über die Linie nicht die Nachbarzelle trifft.
 */
export function inkInRect(strokes: InkStroke[] | undefined, x: number, y: number, w: number, h: number, inset = 1.5): boolean {
	if (!strokes?.length) return false;
	const x1 = x + inset;
	const y1 = y + inset;
	const x2 = x + w - inset;
	const y2 = y + h - inset;
	for (const s of strokes) {
		for (let i = 0; i < s.p.length; i += 2) {
			const px = s.p[i];
			const py = s.p[i + 1];
			if (px >= x1 && px <= x2 && py >= y1 && py <= y2) return true;
		}
	}
	return false;
}

/** Abstand eines Punkts zu einem Strich – für den Radierer */
export function distanceToStroke(s: InkStroke, x: number, y: number): number {
	let best = Infinity;
	const p = s.p;
	if (p.length === 2) return Math.hypot(p[0] - x, p[1] - y);
	for (let i = 0; i + 3 < p.length; i += 2) {
		const ax = p[i];
		const ay = p[i + 1];
		const bx = p[i + 2];
		const by = p[i + 3];
		const dx = bx - ax;
		const dy = by - ay;
		const len = dx * dx + dy * dy;
		const t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
		best = Math.min(best, Math.hypot(ax + t * dx - x, ay + t * dy - y));
	}
	return best;
}

/** Was vom Gerät kommt, prüfen und bereinigen – sonst null */
export function parseInk(raw: unknown): InkPages | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const colors = new Set<string>(Object.values(INK_COLORS));
	const out: InkPages = {};
	let total = 0;
	const entries = Object.entries(raw as Record<string, unknown>);
	if (entries.length > MAX_PAGES) return null;
	for (const [page, list] of entries) {
		if (!/^\d{1,2}$/.test(page) || !Array.isArray(list) || list.length > MAX_STROKES) return null;
		const strokes: InkStroke[] = [];
		for (const s of list) {
			if (!s || typeof s !== 'object') return null;
			const { c, w, p } = s as Partial<InkStroke>;
			if (typeof c !== 'string' || !colors.has(c)) return null;
			if (typeof w !== 'number' || !(w >= 0.3 && w <= 4)) return null;
			if (!Array.isArray(p) || p.length < 2 || p.length % 2 || p.length > MAX_POINTS * 2) return null;
			const pts: number[] = [];
			for (let i = 0; i < p.length; i += 2) {
				const x = p[i];
				const y = p[i + 1];
				if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
				if (x < -10 || x > PAGE_W || y < -10 || y > PAGE_H) return null;
				pts.push(round(x), round(y));
			}
			total += pts.length / 2;
			if (total > MAX_TOTAL_POINTS) return null;
			strokes.push({ c, w: round(w), p: pts });
		}
		if (strokes.length) out[page] = strokes;
	}
	return out;
}
