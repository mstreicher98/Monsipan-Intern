import { describe, expect, it } from 'vitest';
import { isValidSignature, strokesToPath } from './signature';
import { normalizeRanges, rangeHours, timeRangeLabel, workedHours } from './week';

describe('Unterschrift', () => {
	it('macht aus Strichen einen SVG-Pfad', () => {
		const path = strokesToPath([
			[
				{ x: 10, y: 20 },
				{ x: 30.26, y: 40 }
			],
			[{ x: 100, y: 100 }]
		]);
		expect(path).toBe('M10 20L30.3 40M100 100L100.5 100');
		expect(isValidSignature(path)).toBe(true);
	});

	it('lässt nur Bewegungs- und Linienbefehle zu', () => {
		expect(isValidSignature('')).toBe(false);
		expect(isValidSignature(null)).toBe(false);
		expect(isValidSignature('M10 20L30 40')).toBe(true);
		expect(isValidSignature('M10 20"/><script>')).toBe(false);
		expect(isValidSignature('M10 20 C1 2 3 4 5 6')).toBe(false);
		expect(isValidSignature('M1 1' + 'L2 2'.repeat(20000))).toBe(false);
	});
});

describe('Arbeitszeit aus Zeiträumen Beginn – Ende', () => {
	const r = (from: string, to: string) => ({ from, to });

	it('zählt einen Zeitraum', () => {
		expect(workedHours([r('07:00', '15:00')])).toBe(8);
		expect(workedHours([r('7:00', '1545')])).toBe(8.75);
	});

	it('zählt beliebig viele Zeiträume zusammen', () => {
		expect(workedHours([r('06:30', '12:00'), r('12:30', '17:30')])).toBe(10.5);
		expect(workedHours([r('06:00', '09:00'), r('10:00', '12:00'), r('13:00', '16:30')])).toBe(8.5);
	});

	it('rechnet über Mitternacht', () => {
		expect(rangeHours(r('18:00', '04:00'))).toBe(10);
		expect(workedHours([r('07:00', '13:00'), r('18:00', '04:00')])).toBe(16);
	});

	it('rechnet nichts, solange ein Zeitraum unvollständig ist', () => {
		expect(workedHours([])).toBeNull();
		expect(workedHours([r('', '15:00')])).toBeNull();
		expect(workedHours([r('07:00', '12:00'), r('13:00', '')])).toBeNull();
		expect(workedHours([r('07:00', '07:00')])).toBeNull();
		// Ganz leere Zeilen stören nicht
		expect(workedHours([r('07:00', '15:00'), r('', '')])).toBe(8);
	});

	it('säubert die Eingaben', () => {
		expect(normalizeRanges([r('7.30', '1600'), r('', ''), r('xx', '12:00')])).toEqual([r('07:30', '16:00'), r('', '12:00')]);
	});

	it('beschriftet die Zeiten für Ausdruck und PDF', () => {
		expect(timeRangeLabel([r('06:30', '12:00'), r('12:30', '17:30')])).toBe('06:30 – 12:00, 12:30 – 17:30');
		expect(timeRangeLabel([r('18:00', '04:00')])).toBe('18:00 – 04:00');
		expect(timeRangeLabel([])).toBe('');
	});
});
