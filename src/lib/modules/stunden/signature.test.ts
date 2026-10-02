import { describe, expect, it } from 'vitest';
import { isValidSignature, strokesToPath } from './signature';
import { timeRangeLabel, workedHours } from './week';

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

describe('Arbeitszeit aus Beginn, Pause und Ende', () => {
	it('zieht die Pause ab', () => {
		expect(workedHours('06:30', '12:00', '12:30', '17:30')).toBe(10.5);
		expect(workedHours('7:00', '12:00', '12:45', '16:00')).toBe(8.25);
	});

	it('zählt ohne vollständige Pause von Beginn bis Ende', () => {
		expect(workedHours('07:00', '', '', '15:00')).toBe(8);
		expect(workedHours('07:00', '12:00', '', '15:00')).toBe(8);
	});

	it('rechnet nichts bei fehlenden oder verdrehten Zeiten', () => {
		expect(workedHours('', '', '', '15:00')).toBeNull();
		expect(workedHours('17:00', '', '', '07:00')).toBeNull();
		// Pause außerhalb der Arbeitszeit wird ignoriert
		expect(workedHours('07:00', '18:00', '18:30', '15:00')).toBe(8);
	});

	it('beschriftet die Zeiten für Ausdruck und PDF', () => {
		expect(timeRangeLabel({ fromTime: '06:30', breakStart: '12:00', breakEnd: '12:30', toTime: '17:30' })).toBe(
			'06:30 – 12:00, 12:30 – 17:30'
		);
		expect(timeRangeLabel({ fromTime: '07:00', breakStart: '', breakEnd: '', toTime: '15:00' })).toBe('07:00 – 15:00');
		expect(timeRangeLabel({ fromTime: '', breakStart: '', breakEnd: '', toTime: '' })).toBe('');
	});
});
