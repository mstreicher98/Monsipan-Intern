import { describe, expect, it } from 'vitest';
import { addDays, hoursLabel, isoWeek, mondayOf, parseHours, parseTime, weekDays, weekLabel } from './week';

describe('Lohnwoche', () => {
	it('findet den Montag der Woche', () => {
		expect(mondayOf('2026-10-02')).toBe('2026-09-28'); // Freitag
		expect(mondayOf('2026-09-28')).toBe('2026-09-28'); // Montag selbst
		expect(mondayOf('2026-10-04')).toBe('2026-09-28'); // Sonntag gehört noch dazu
	});

	it('zählt Tage auch über Monats- und Jahreswechsel', () => {
		expect(addDays('2026-12-28', 6)).toBe('2027-01-03');
		expect(weekDays('2026-12-28').at(-1)).toBe('2027-01-03');
	});

	it('rechnet die Kalenderwoche nach ISO', () => {
		expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
		expect(isoWeek('2026-09-28').week).toBe(40);
		// 1. Jänner 2027 ist ein Freitag und gehört noch zur KW 53 von 2026
		expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 });
	});

	it('beschriftet die Woche für den Kopf des Zettels', () => {
		expect(weekLabel('2026-09-28')).toBe('KW 40 · 28.09.–04.10.2026');
	});

	it('liest Stunden deutsch und als Uhrzeit', () => {
		expect(parseHours('8,5')).toBe(8.5);
		expect(parseHours('8.5')).toBe(8.5);
		expect(parseHours('8:30')).toBe(8.5);
		expect(parseHours('')).toBe(0);
		expect(parseHours('abc')).toBe(0);
		expect(parseHours('-3')).toBe(0);
		expect(parseHours('99')).toBe(24);
		expect(hoursLabel(8.5)).toBe('8,5');
		expect(hoursLabel(0)).toBe('');
	});

	it('bringt Uhrzeiten in eine Form', () => {
		expect(parseTime('7:30')).toBe('07:30');
		expect(parseTime('0730')).toBe('07:30');
		expect(parseTime('16.00')).toBe('16:00');
		expect(parseTime('25:00')).toBe('');
		expect(parseTime('')).toBe('');
	});
});
