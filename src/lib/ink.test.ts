import { describe, expect, it } from 'vitest';
import { distanceToStroke, hasInk, INK_COLORS, inkInRect, parseInk, strokePath } from './ink';

const stroke = (p: number[]) => ({ c: INK_COLORS.blau, w: 0.9, p });

describe('parseInk', () => {
	it('nimmt gültige Striche und rundet auf eine Nachkommastelle', () => {
		expect(parseInk({ 0: [stroke([10.123, 20.987, 30, 40])] })).toEqual({ 0: [stroke([10.1, 21, 30, 40])] });
	});

	it('lässt leere Seiten weg', () => {
		expect(parseInk({ 0: [], 1: [stroke([1, 2])] })).toEqual({ 1: [stroke([1, 2])] });
	});

	it('lehnt Unsinn ab', () => {
		expect(parseInk(null)).toBeNull();
		expect(parseInk([])).toBeNull();
		expect(parseInk({ abc: [] })).toBeNull();
		expect(parseInk({ 0: [{ c: '#ff0000', w: 0.9, p: [1, 2] }] })).toBeNull(); // fremde Farbe
		expect(parseInk({ 0: [{ c: INK_COLORS.blau, w: 50, p: [1, 2] }] })).toBeNull(); // zu dick
		expect(parseInk({ 0: [stroke([1, 2, 3])] })).toBeNull(); // ungerade Punktliste
		expect(parseInk({ 0: [stroke([1, 2, 5000, 4])] })).toBeNull(); // weit außerhalb der Seite
		expect(parseInk({ 0: [stroke([1, Number.NaN])] })).toBeNull();
	});
});

describe('inkInRect', () => {
	const strokes = [stroke([100, 100, 110, 105])];

	it('findet Handschrift im Feld', () => {
		expect(inkInRect(strokes, 95, 95, 20, 20)).toBe(true);
	});

	it('übersieht Striche knapp über dem Rand', () => {
		// Punkt (100|100) liegt nur 1 pt im Feld – der Rand zählt nicht mit
		expect(inkInRect(strokes, 99, 99, 0.5, 0.5)).toBe(false);
		expect(inkInRect(strokes, 200, 200, 20, 20)).toBe(false);
		expect(inkInRect(undefined, 0, 0, 500, 500)).toBe(false);
	});
});

describe('strokePath und distanceToStroke', () => {
	it('glättet mit Kurven und endet am letzten Punkt', () => {
		const d = strokePath([0, 0, 10, 0, 20, 10, 30, 10]);
		expect(d.startsWith('M0 0Q10 0 15 5')).toBe(true);
		expect(d.endsWith('L30 10')).toBe(true);
		expect(strokePath([5, 5])).toBe('M5 5L5.3 5');
	});

	it('misst den Abstand zur Strecke', () => {
		const s = stroke([0, 0, 10, 0]);
		expect(distanceToStroke(s, 5, 3)).toBeCloseTo(3);
		expect(distanceToStroke(s, 13, 4)).toBeCloseTo(5);
	});

	it('erkennt Handschrift', () => {
		expect(hasInk(null)).toBe(false);
		expect(hasInk({ 0: [] })).toBe(false);
		expect(hasInk({ 1: [stroke([1, 1])] })).toBe(true);
	});
});
