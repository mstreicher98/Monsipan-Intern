/**
 * Wochenrechnung für die Stundenzettel. Eine Lohnwoche läuft von Montag bis
 * Sonntag; gespeichert wird immer der Montag als "JJJJ-MM-TT". Gerechnet wird
 * mit UTC-Mitternacht, damit Sommerzeit nichts verschiebt.
 */
export const WEEKDAY_LABELS = ['Mon.', 'Die.', 'Mitt.', 'Donn.', 'Frei.', 'Sam.', 'Sonn.'] as const;

const DAY = 86_400_000;

export function isoDate(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function toUtc(iso: string): Date {
	const [y, m, d] = iso.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

export function isValidIsoDate(iso: string): boolean {
	return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(toUtc(iso).getTime()) && isoDate(toUtc(iso)) === iso;
}

export function addDays(iso: string, days: number): string {
	return isoDate(new Date(toUtc(iso).getTime() + days * DAY));
}

/** Montag der Woche, in der dieses Datum liegt */
export function mondayOf(iso: string): string {
	const d = toUtc(iso);
	const weekday = (d.getUTCDay() + 6) % 7; // Montag = 0
	return isoDate(new Date(d.getTime() - weekday * DAY));
}

export function today(): string {
	return isoDate(new Date());
}

/** Die sieben Tage einer Woche, beginnend beim Montag */
export function weekDays(weekStart: string): string[] {
	return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Kalenderwoche nach ISO 8601 */
export function isoWeek(iso: string): { year: number; week: number } {
	const d = toUtc(iso);
	const weekday = (d.getUTCDay() + 6) % 7;
	const thursday = new Date(d.getTime() + (3 - weekday) * DAY);
	const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
	const firstWeekday = (firstThursday.getUTCDay() + 6) % 7;
	const firstMonday = new Date(firstThursday.getTime() - firstWeekday * DAY);
	return { year: thursday.getUTCFullYear(), week: Math.round((thursday.getTime() - firstMonday.getTime()) / (7 * DAY)) + 1 };
}

const fmt = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
const fmtFull = new Intl.DateTimeFormat('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

export function dayLabel(iso: string): string {
	return fmtFull.format(toUtc(iso));
}

/** "KW 40 · 29.09.–05.10.2026" */
export function weekLabel(weekStart: string): string {
	const { week } = isoWeek(weekStart);
	const end = addDays(weekStart, 6);
	return `KW ${week} · ${fmt.format(toUtc(weekStart))}–${fmtFull.format(toUtc(end))}`;
}

/** Stunden deutsch: 8,5 statt 8.5 – leere Werte bleiben leer */
export function hoursLabel(value: number | null | undefined): string {
	if (value == null || value === 0) return '';
	return String(Math.round(value * 100) / 100).replace('.', ',');
}

/** "8,5" oder "8:30" als Zahl lesen; alles andere wird 0 */
export function parseHours(input: string | null | undefined): number {
	const s = String(input ?? '').trim();
	if (!s) return 0;
	const colon = s.match(/^(\d{1,2}):(\d{1,2})$/);
	if (colon) return Number(colon[1]) + Number(colon[2]) / 60;
	const n = Number(s.replace(',', '.'));
	if (!Number.isFinite(n) || n < 0) return 0;
	return Math.min(24, Math.round(n * 100) / 100);
}

/** Uhrzeit "7:30" oder "0730" auf "07:30" bringen; ungültiges wird leer */
export function parseTime(input: string | null | undefined): string {
	const s = String(input ?? '').trim();
	if (!s) return '';
	const m = s.match(/^(\d{1,2})[:.]?(\d{2})$/);
	if (!m) return '';
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h > 23 || min > 59) return '';
	return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
