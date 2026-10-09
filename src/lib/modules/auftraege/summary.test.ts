import { describe, expect, it } from 'vitest';
import { billedLines, columnKey, invoiceLines, suggestMapping, summarize, unitFamily, type PricedLine, type SummaryReportInput } from './summary';

const report = (over: Partial<SummaryReportInput>): SummaryReportInput => ({
	id: 1,
	number: '1',
	date: '2026-10-05',
	dateTo: null,
	site: 'B 17',
	partyName: 'Partie 1',
	status: 'geprueft',
	positions: [],
	rows: [],
	...over
});

describe('summarize', () => {
	const sum = summarize([
		report({
			id: 2,
			number: '12',
			date: '2026-10-06',
			dateTo: '2026-10-08',
			positions: [
				{ lbPos: '01.02.01', unit: 'm' },
				{ lbPos: '01.05', unit: 'm²' }
			],
			rows: [{ quantities: [100, 4] }, { quantities: [50.5, null] }],
			materials: [{ material: 'Weiß', code: 'K-12', filmThickness: '0,6' }]
		}),
		report({
			id: 1,
			number: '11',
			positions: [{ lbPos: ' 01.02.01 ', unit: 'M' }],
			rows: [{ quantities: [20] }],
			materials: [{ material: 'weiß', code: 'k-12', filmThickness: '0,6' }]
		}),
		// In Arbeit: steht dabei, zählt aber nicht
		report({ id: 3, number: '13', status: 'entwurf', date: '2026-10-09', positions: [{ lbPos: '01.02.01', unit: 'm' }], rows: [{ quantities: [999] }] })
	]);

	it('zählt je LB-Position und Einheit zusammen', () => {
		// Geschrieben wird die Spalte wie im ersten Bericht – „M" statt „m"
		expect(sum.columns).toEqual([
			{ key: '01.02.01|m', lbPos: '01.02.01', unit: 'M', total: 170.5 },
			{ key: '01.05|m²', lbPos: '01.05', unit: 'm²', total: 4 }
		]);
	});

	it('nimmt nur geprüfte und abgeschlossene Berichte in die Summe', () => {
		expect(sum.counted).toBe(2);
		expect(sum.reports.map((r) => [r.number, r.counted])).toEqual([
			['11', true],
			['12', true],
			['13', false]
		]);
		expect(sum.reports[2].values['01.02.01|m']).toBe(999);
	});

	it('liefert Zeitraum und Material ohne Doppelte', () => {
		expect([sum.from, sum.to]).toEqual(['2026-10-05', '2026-10-08']);
		expect(sum.materials).toHaveLength(1);
	});

	it('sortiert LB-Positionen nach Zahlen, nicht nach Text', () => {
		const s = summarize([report({ positions: [{ lbPos: '01.10', unit: 'm' }, { lbPos: '01.9', unit: 'm' }], rows: [{ quantities: [1, 1] }] })]);
		expect(s.columns.map((c) => c.lbPos)).toEqual(['01.9', '01.10']);
	});

	it('ohne Berichte bleibt alles leer', () => {
		expect(summarize([])).toEqual({ columns: [], reports: [], from: null, to: null, materials: [], counted: 0 });
	});
});

describe('Zuordnung und Rechnungszeilen', () => {
	const lines: PricedLine[] = [
		{ id: 10, kind: 'titel', text: 'Markierung', quantity: null, unit: '', unitPrice: null },
		{ id: 11, kind: 'position', text: 'Leitlinie 15 cm weiß, LB 01.02.01', quantity: 200, unit: 'lfd. m', unitPrice: 1.2 },
		{ id: 12, kind: 'position', text: 'Sperrflächen', quantity: 10, unit: 'm²', unitPrice: 14 },
		{ id: 13, kind: 'position', text: 'Pfeile', quantity: 5, unit: 'm²', unitPrice: 20 },
		{ id: 14, kind: 'titel', text: 'Sonstiges', quantity: null, unit: '', unitPrice: null },
		{ id: 15, kind: 'position', text: 'Baustelleneinrichtung', quantity: 1, unit: 'Pauschal', unitPrice: 350 },
		{ id: 16, kind: 'position', text: 'Regie', quantity: 4, unit: 'h', unitPrice: 55 }
	];
	const columns = [
		{ key: columnKey('01.02.01', 'm'), lbPos: '01.02.01', unit: 'm', total: 170.5 },
		{ key: columnKey('01.05', 'm²'), lbPos: '01.05', unit: 'm²', total: 4 }
	];

	it('schlägt über LB-Position im Text und eindeutige Einheit vor', () => {
		// m² passt auf zwei Positionen – da muss jemand wählen
		expect(suggestMapping(columns, lines, null)).toEqual({ '01.02.01|m': 11, '01.05|m²': undefined });
	});

	it('nimmt die gemerkte Zuordnung, auch „nicht abrechnen"', () => {
		expect(suggestMapping(columns, lines, { '01.02.01|m': null, '01.05|m²': 13 })).toEqual({ '01.02.01|m': null, '01.05|m²': 13 });
		// Eine gemerkte Position, die es nicht mehr gibt, zählt nicht
		expect(suggestMapping(columns, lines, { '01.05|m²': 99 })['01.05|m²']).toBeUndefined();
	});

	it('setzt Mengen aus den Berichten, Pauschalen aus dem Angebot', () => {
		const out = invoiceLines(lines, columns, { '01.02.01|m': 11, '01.05|m²': 12 });
		expect(out.map((l) => l.quantity)).toEqual([null, 170.5, 4, null, null, 1, null]);
		expect(out[1].source).toBe('01.02.01 (m)');
		expect(out[1].unitPrice).toBe(1.2);
	});

	it('lässt leere Positionen und Überschriften ohne Inhalt weg', () => {
		const out = billedLines(invoiceLines(lines, columns, { '01.02.01|m': 11 }));
		expect(out.map((l) => l.text)).toEqual(['Markierung', 'Leitlinie 15 cm weiß, LB 01.02.01', 'Sonstiges', 'Baustelleneinrichtung']);
	});

	it('kennt gleichbedeutende Einheiten', () => {
		expect(unitFamily('lfd. m')).toBe('m');
		expect(unitFamily('M2')).toBe('m²');
		expect(unitFamily('Pauschal')).toBe('pauschal');
		expect(unitFamily('h')).toBe('h');
	});
});
