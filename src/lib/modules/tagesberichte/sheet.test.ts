import { describe, expect, it } from 'vitest';
import { columnSums, quantityLabel, reportDateLabel, rowsPerSheet, SHEET_COLUMNS, SHEET_ROWS, sheets, sumLabel } from './sheet';

const pos = (n: number) => Array.from({ length: n }, (_, i) => ({ lbPos: String(i + 1) }));
const row = (label: string, quantities: (number | null)[] = []) => ({ label, quantities });

describe('sheets', () => {
	it('füllt ein Blatt auf acht Spalten und 33 Zeilen auf', () => {
		const [blatt, ...rest] = sheets(pos(2), [row('A', [1, 2]), row('', [])]);
		expect(rest).toHaveLength(0);
		expect(blatt.columns).toHaveLength(SHEET_COLUMNS);
		expect(blatt.columns.slice(2).every((c) => c === null)).toBe(true);
		expect(blatt.rows).toHaveLength(SHEET_ROWS);
		// Leere Zeilen kommen nicht aufs Blatt
		expect(blatt.rows.filter(Boolean)).toHaveLength(1);
		expect(blatt).toMatchObject({ number: 1, count: 1 });
	});

	it('gibt auch ohne Positionen und Zeilen ein leeres Blatt', () => {
		const result = sheets([], []);
		expect(result).toHaveLength(1);
		expect(result[0].columns.every((c) => c === null)).toBe(true);
	});

	it('verteilt mehr als acht Positionen auf weitere Blätter', () => {
		const rows = [row('Leitlinie', [1, null, null, null, null, null, null, null, null, 5]), row('', [null, null, null, null, null, null, null, null, 7])];
		const result = sheets(pos(10), rows);
		expect(result).toHaveLength(2);
		expect(result[1].columns[0]).toEqual({ position: { lbPos: '9' }, index: 8 });
		// Blatt 2: die beschriftete Zeile und die mit einer Menge in Spalte 9
		expect(result[1].rows.filter(Boolean)).toHaveLength(2);
		// Blatt 1: die Zeile ohne Text und ohne Menge in den Spalten 1–8 fällt weg
		expect(result[0].rows.filter(Boolean)).toHaveLength(1);
		expect(result.map((s) => `${s.number}/${s.count}`)).toEqual(['1/2', '2/2']);
	});

	it('bricht nach 33 Zeilen auf ein neues Blatt um', () => {
		const rows = Array.from({ length: 40 }, (_, i) => row(`Zeile ${i + 1}`));
		const result = sheets(pos(1), rows);
		expect(result).toHaveLength(2);
		expect(result[1].rows[0]?.label).toBe('Zeile 34');
	});

	it('nimmt Zeilen weg, wenn der Materialblock länger wird', () => {
		expect(rowsPerSheet(0)).toBe(SHEET_ROWS);
		expect(rowsPerSheet(3)).toBe(SHEET_ROWS);
		expect(rowsPerSheet(4)).toBe(SHEET_ROWS - 2);
		expect(sheets(pos(1), [], 5)[0].rows).toHaveLength(SHEET_ROWS - 3);
	});
});

describe('Summen und Mengen', () => {
	it('summiert je Position und übergeht leere Felder', () => {
		expect(columnSums([row('', [1.5, null]), row('', [2]), row('', [])], 3)).toEqual([3.5, 0, 0]);
	});

	it('schreibt Mengen mit Komma, leere und 0-Summen bleiben leer', () => {
		expect(quantityLabel(12.3456)).toBe('12,346');
		expect(quantityLabel(null)).toBe('');
		expect(quantityLabel(0)).toBe('0');
		expect(sumLabel(0)).toBe('');
		expect(sumLabel(4.5)).toBe('4,5');
	});
});

describe('reportDateLabel', () => {
	it('schreibt einen Tag wie bisher', () => {
		expect(reportDateLabel('2026-10-07')).toBe('07.10.2026');
		expect(reportDateLabel('2026-10-07', null)).toBe('07.10.2026');
		expect(reportDateLabel('2026-10-07', '2026-10-07')).toBe('07.10.2026');
	});

	it('fasst mehrere Tage zusammen', () => {
		expect(reportDateLabel('2026-10-07', '2026-10-09')).toBe('07.10. bis 09.10.2026');
		expect(reportDateLabel('2026-12-29', '2027-01-02')).toBe('29.12.2026 bis 02.01.2027');
	});
});
