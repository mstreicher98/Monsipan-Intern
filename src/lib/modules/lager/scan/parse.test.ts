import { describe, expect, it } from 'vitest';
import { strokesToText, strokeVariants, type KeyStroke } from './layout';
import { allCandidates, isValidGtin, normalizeCode, numberForms, parseScan, pickBestParse } from './parse';

describe('GTIN', () => {
	it('prüft Prüfziffern der Etiketten aus dem Lager', () => {
		expect(isValidGtin('9002445052683')).toBe(true); // Waschmittel Aceton
		expect(isValidGtin('9002445022150')).toBe(true); // Remo 2000 Gelb
		expect(isValidGtin('9002445985684')).toBe(true); // Remo 2000 Radweg Grün
		expect(isValidGtin('53134375304967')).toBe(true); // 3M Stamark (GTIN-14)
		expect(isValidGtin('9002445052684')).toBe(false);
	});

	it('kennt Materialnummern mit und ohne führende Nullen', () => {
		// Etikett: 30016618, Lieferantenliste: 000000000030016618 – derselbe Artikel
		expect(numberForms('30016618')).toEqual(['30016618', '000000000030016618']);
		expect(numberForms('000000000030016618')).toEqual(['000000000030016618', '30016618']);
		expect(numberForms('09002445022150')).toEqual(['09002445022150']);
		expect(numberForms('FS910022375')).toEqual(['FS910022375']);
	});

	it('normalisiert EAN-13 und GTIN-14 auf dieselbe Schreibweise', () => {
		expect(normalizeCode('9002445022150')).toBe('09002445022150');
		expect(normalizeCode('09002445022150')).toBe('09002445022150');
		expect(normalizeCode(' fs910022375 ')).toBe('FS910022375');
	});
});

describe('parseScan', () => {
	it('erkennt EAN-13 auch mit AIM-Präfix', () => {
		const p = parseScan(']E09002445022150');
		expect(p.format).toBe('gtin');
		expect(p.candidates).toEqual(['09002445022150']);
		expect(p.fields.ean).toBe('9002445022150');
	});

	it('liest Artikelnummern als Text', () => {
		const p = parseScan('366655');
		expect(p.format).toBe('text');
		expect(p.candidates).toEqual(['366655']);
	});

	it('zerlegt die Kansai-DataMatrix', () => {
		const p = parseScan(
			'bez:REMO 2000 GELB KALTPLASTIK|art:52298204|cha:2269196|inh:10 kg|dat:04.2025|bis:04.2026|ean:9002445022150'
		);
		expect(p.format).toBe('kv');
		expect(p.fields).toMatchObject({
			name: 'REMO 2000 GELB KALTPLASTIK',
			article: '52298204',
			batch: '2269196',
			packageSize: 10,
			unit: 'kg',
			productionDate: '2025-04',
			expiryDate: '2026-04',
			color: 'Gelb',
			category: 'Kaltplastik'
		});
		expect(p.candidates[0]).toBe('09002445022150');
		expect(p.candidates).toContain('52298204');
	});

	it('verträgt andere Trennzeichen und Kommas im Inhalt', () => {
		const p = parseScan('art>366655;cha>49997.00;inh>9,7 kg;bez>WASCHMITTEL ACETON');
		expect(p.format).toBe('kv');
		expect(p.fields.article).toBe('366655');
		expect(p.fields.batch).toBe('49997.00');
		expect(p.fields.packageSize).toBe(9.7);
		expect(p.fields.category).toBe('Reiniger & Verdünnung');
	});

	it('erkennt Farben über RAL-Nummern', () => {
		const p = parseScan('bez:REMO 2000 RADWEG R6024 KALTPLASTIK|art:52718305|inh:15 kg');
		expect(p.fields.color).toBe('Grün');
		expect(p.fields.ral).toBe('6024');
		expect(p.fields.packageSize).toBe(15);
		expect(parseScan('bez:MARKIERUNGSFARBE RAL 1023|art:1').fields.ral).toBe('1023');
		expect(parseScan('bez:REMO 2000 GELB KALTPLASTIK|art:52298204').fields.ral).toBeUndefined();
	});

	it('zerlegt GS1 mit Klammern', () => {
		const p = parseScan('(01)09002445022150(10)ABC123(17)261031');
		expect(p.format).toBe('gs1');
		expect(p.gtin).toBe('09002445022150');
		expect(p.fields.batch).toBe('ABC123');
		expect(p.fields.expiryDate).toBe('2026-10-31');
	});

	it('zerlegt GS1 mit Gruppentrenner', () => {
		const p = parseScan(']d20109002445022150' + '10ABC123' + '17261031');
		expect(p.format).toBe('gs1');
		expect(p.candidates[0]).toBe('09002445022150');
		expect(p.fields.batch).toBe('ABC123');
	});

	it('liest Code-128-Texte', () => {
		expect(parseScan('FS910022375').candidates).toEqual(['FS910022375']);
	});

	it('zerlegt das SWARCO-Palettenetikett', () => {
		// Inhalt der DataMatrix vom Etikett "SWARCOFLEX 200-800 T18 M20"
		const p = parseScan('1524603$30016618$2450240$1000,000');
		expect(p.format).toBe('swarco');
		expect(p.fields).toEqual({ reference: '1524603', article: '30016618', batch: '2450240' });
		expect(p.candidates).toEqual(['30016618']);
	});

	it('übernimmt vom SWARCO-Etikett weder Inhalt noch Hersteller', () => {
		// Die Menge gilt für die ganze Palette – Inhalt je Stück und Hersteller trägt man selbst ein
		const p = parseScan('1524603$30016618$2450240$1000,000');
		expect(p.fields.packageSize).toBeUndefined();
		expect(p.fields.unit).toBeUndefined();
		expect(p.fields.content).toBeUndefined();
		expect(p.fields).not.toHaveProperty('manufacturer');
	});

	it('findet jede SWARCO-Lieferung über die Artikelnummer', () => {
		const first = parseScan('1524603$30016618$2450240$1000,000');
		// Andere Palette, andere Charge, mit AIM-Kennung des Scanners
		const next = parseScan(']d11600111$30016618$2510077$750,500');
		expect(next.symbology).toBe(']d1');
		expect(next.candidates).toEqual(first.candidates);
		expect(next.fields.batch).toBe('2510077');
	});

	it('hält andere Texte mit Dollarzeichen nicht für SWARCO', () => {
		expect(parseScan('ABC$123$X').format).toBe('text');
		expect(parseScan('12$30016618$X').format).toBe('text');
		expect(parseScan('1524603$30016618').format).toBe('text');
	});
});

/* US-Scanner an deutschem PC simulieren */
const US_REVERSE: Record<string, [string, boolean]> = {
	':': ['Semicolon', true],
	'|': ['Backslash', true],
	' ': ['Space', false],
	'.': ['Period', false],
	',': ['Comma', false],
	'>': ['Period', true],
	$: ['Digit4', true]
};

function typeOnUsScanner(text: string): KeyStroke[] {
	return [...text].map((ch) => {
		let code: string;
		let shift = false;
		if (/[a-z]/.test(ch)) code = `Key${ch.toUpperCase()}`;
		else if (/[A-Z]/.test(ch)) {
			code = `Key${ch}`;
			shift = true;
		} else if (/\d/.test(ch)) code = `Digit${ch}`;
		else [code, shift] = US_REVERSE[ch];
		const stroke: KeyStroke = { key: '', code, shift, altGr: false };
		// So interpretiert ein PC mit deutschem Layout den Tastendruck
		stroke.key = strokesToText([stroke], 'de');
		return stroke;
	});
}

describe('Tastaturlayout', () => {
	const intended = 'bez:REMO 2000 GELB KALTPLASTIK|art:52298204|inh:10 kg|ean:9002445022150';

	it('rekonstruiert den Text eines US-Scanners an einem deutschen PC', () => {
		const strokes = typeOnUsScanner(intended);
		const os = strokesToText(strokes, 'os');
		expect(os).not.toBe(intended);
		expect(os.startsWith('beyÖ')).toBe(true);
		expect(strokesToText(strokes, 'us')).toBe(intended);
	});

	it('wählt automatisch die richtige Lesart', () => {
		const variants = strokeVariants(typeOnUsScanner(intended));
		const best = pickBestParse(variants);
		expect(best?.format).toBe('kv');
		expect(best?.fields.article).toBe('52298204');
		expect(allCandidates(variants)[0]).toBe('09002445022150');
	});

	it('lässt reine Ziffern unverändert', () => {
		const variants = strokeVariants(typeOnUsScanner('9002445052683'));
		expect(variants).toEqual(['9002445052683']);
	});

	it('liest SWARCO-Etiketten auch von einem US-Scanner', () => {
		const best = pickBestParse(strokeVariants(typeOnUsScanner('1524603$30016618$2450240$1000,000')));
		expect(best?.format).toBe('swarco');
		expect(best?.candidates).toEqual(['30016618']);
	});
});
