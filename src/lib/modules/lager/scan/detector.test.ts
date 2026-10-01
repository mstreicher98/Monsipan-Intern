import { describe, expect, it } from 'vitest';
import { altCodeChar, WedgeDetector, type KeyInput, type ScanEnd, type SequenceReport } from './detector';
import { strokeVariants } from './layout';

/** Tasten eines US-Layouts: Zeichen → [code, shift] */
const US: Record<string, [string, boolean]> = {
	' ': ['Space', false],
	':': ['Semicolon', true],
	';': ['Semicolon', false],
	'|': ['Backslash', true],
	'.': ['Period', false],
	',': ['Comma', false],
	'-': ['Minus', false],
	'=': ['Equal', false],
	'/': ['Slash', false],
	'(': ['Digit9', true],
	')': ['Digit0', true]
};

function usKey(ch: string): { key: string; code: string; shift: boolean } {
	if (/[a-z]/.test(ch)) return { key: ch, code: `Key${ch.toUpperCase()}`, shift: false };
	if (/[A-Z]/.test(ch)) return { key: ch, code: `Key${ch}`, shift: true };
	if (/\d/.test(ch)) return { key: ch, code: `Digit${ch}`, shift: false };
	const [code, shift] = US[ch];
	return { key: ch, code, shift };
}

function setup(opts: { capture?: boolean } = {}) {
	let now = 0;
	let timers: { at: number; fn: () => void; id: number }[] = [];
	let nextId = 0;
	const scans: { text: string; variants: string[]; end: ScanEnd }[] = [];
	const reports: SequenceReport[] = [];

	const detector = new WedgeDetector({
		canCapture: () => opts.capture ?? true,
		onScan: (strokes, _stats, end) => {
			const variants = strokeVariants(strokes);
			scans.push({ text: variants[0], variants, end });
		},
		onReport: (r) => reports.push(r),
		setTimer: (fn, ms) => {
			const t = { at: now + ms, fn, id: ++nextId };
			timers.push(t);
			return t.id;
		},
		clearTimer: (h) => {
			timers = timers.filter((t) => t.id !== h);
		}
	});

	function advance(to: number) {
		for (;;) {
			const due = timers.filter((t) => t.at <= to).sort((a, b) => a.at - b.at)[0];
			if (!due) break;
			timers = timers.filter((t) => t !== due);
			now = due.at;
			due.fn();
		}
		now = Math.max(now, to);
	}

	let t = 1000;
	function press(k: Partial<KeyInput> & { key: string }, gap = 5, type: KeyInput['type'] = 'down'): boolean {
		t += gap;
		advance(t);
		return detector.handle({ type, code: '', shift: false, ctrl: false, alt: false, meta: false, altGr: false, repeat: false, time: t, ...k });
	}
	/** Tippt Text wie ein Scanner im US-Layout; gap(i) = Abstand vor Zeichen i */
	function type(text: string, gap: (i: number) => number = () => 5) {
		[...text].forEach((ch, i) => {
			const k = usKey(ch);
			if (k.shift) press({ key: 'Shift', code: 'ShiftLeft', shift: true }, 0);
			press({ ...k }, gap(i));
		});
	}
	const enter = (gap = 5) => press({ key: 'Enter', code: 'Enter' }, gap);
	const flush = () => advance(t + 60_000);

	return { press, type, enter, flush, scans, reports };
}

describe('Handscanner-Erkennung', () => {
	it('erkennt einen schnellen Scan mit Enter und fängt das Enter ab', () => {
		const s = setup();
		s.type('9002445022150');
		expect(s.enter()).toBe(true);
		s.flush();
		expect(s.scans).toEqual([{ text: '9002445022150', variants: ['9002445022150'], end: 'enter' }]);
	});

	it('überbrückt stoßweise Bluetooth-Übertragung mit Aussetzern', () => {
		const s = setup();
		const code = 'bez:REMO 2000 GELB KALTPLASTIK|art:52298204|inh:10 kg';
		// Pakete zu 5 Zeichen mit 90 ms Pause, einmal hängt die Verbindung 400 ms
		s.type(code, (i) => (i === 30 ? 400 : i % 5 === 0 ? 90 : 1));
		expect(s.enter(40)).toBe(true);
		s.flush();
		expect(s.scans).toHaveLength(1);
		expect(s.scans[0].text).toBe(code);
	});

	it('lässt menschliches Tippen in Ruhe', () => {
		const s = setup();
		s.type('hallo', () => 130);
		expect(s.enter(150)).toBe(false);
		s.flush();
		expect(s.scans).toHaveLength(0);
		expect(s.reports.at(-1)?.verdict).toBe('zu-langsam');
	});

	it('hält mehrzeilige Codes zusammen', () => {
		const s = setup();
		s.type('bez:REMO 2000');
		expect(s.enter()).toBe(true);
		s.type('art:52298204', (i) => (i === 0 ? 20 : 5));
		expect(s.enter()).toBe(true);
		s.flush();
		expect(s.scans).toHaveLength(1);
		expect(s.scans[0].text).toBe('bez:REMO 2000\nart:52298204');
	});

	it('nimmt CR+LF als einen Abschluss', () => {
		const s = setup();
		s.type('4006381333931');
		expect(s.enter()).toBe(true);
		expect(s.enter(3)).toBe(true);
		s.flush();
		expect(s.scans.map((x) => x.text)).toEqual(['4006381333931']);
	});

	it('übernimmt den GS1-Gruppentrenner (Strg+]) statt abzubrechen', () => {
		const s = setup();
		s.type('010401234567890110ABC123');
		s.press({ key: 'Control', code: 'ControlLeft', ctrl: true }, 2);
		expect(s.press({ key: ']', code: 'BracketRight', ctrl: true }, 2)).toBe(true);
		s.type('2112345');
		s.enter();
		s.flush();
		expect(s.scans).toHaveLength(1);
		expect(s.scans[0].text).toBe('010401234567890110ABC123\x1d2112345');
	});

	it('lässt Tastenkürzel außerhalb eines Scans durch', () => {
		const s = setup();
		s.type('ab', () => 200);
		expect(s.press({ key: 'c', code: 'KeyC', ctrl: true }, 300)).toBe(false);
		s.flush();
		expect(s.scans).toHaveLength(0);
	});

	it('verwirft tote Tasten nicht (US-Scanner am deutschen PC)', () => {
		const s = setup();
		s.type('A');
		// „=“ ist am deutschen Layout die tote Taste ´
		s.press({ key: 'Dead', code: 'Equal' });
		s.type('1234');
		s.enter();
		s.flush();
		expect(s.scans).toHaveLength(1);
		expect(s.scans[0].variants).toContain('A=1234');
	});

	it('versteht Alt+Ziffernblock-Codes für Umlaute', () => {
		const s = setup();
		s.type('RADWEG GR');
		s.press({ key: 'Alt', code: 'AltLeft', alt: true }, 3);
		for (const d of '0220') s.press({ key: d, code: `Numpad${d}`, alt: true }, 3);
		s.press({ key: 'Alt', code: 'AltLeft' }, 3, 'up');
		s.type('N');
		s.enter();
		s.flush();
		expect(s.scans[0]?.text).toBe('RADWEG GRÜN');
	});

	it('erkennt Scanner ohne Enter am Ende nach einer Pause', () => {
		const s = setup();
		s.type('9002445022150');
		s.flush();
		expect(s.scans).toEqual([{ text: '9002445022150', variants: ['9002445022150'], end: 'pause' }]);
	});

	it('wertet kurze Eingaben ohne Enter nicht als Scan', () => {
		const s = setup();
		s.type('12345');
		s.flush();
		expect(s.scans).toHaveLength(0);
		expect(s.reports.at(-1)?.verdict).toBe('ohne-abschluss');
	});

	it('lässt Scans im Textfeld, wenn die Seite sie nicht abfangen will', () => {
		const s = setup({ capture: false });
		s.type('9002445022150');
		expect(s.enter()).toBe(false);
		s.flush();
		expect(s.scans).toHaveLength(0);
		expect(s.reports.at(-1)?.verdict).toBe('textfeld');
	});

	it('trennt zwei Scans nach einer Pause sauber', () => {
		const s = setup();
		s.type('4006381333931');
		s.enter();
		s.type('9002445022150', (i) => (i === 0 ? 800 : 5));
		s.enter();
		s.flush();
		expect(s.scans.map((x) => x.text)).toEqual(['4006381333931', '9002445022150']);
	});
});

describe('Alt-Codes', () => {
	it('dekodiert Windows-1252 und Codepage 850', () => {
		expect(altCodeChar('0220')).toBe('Ü');
		expect(altCodeChar('154')).toBe('Ü');
		expect(altCodeChar('142')).toBe('Ä');
		expect(altCodeChar('225')).toBe('ß');
		expect(altCodeChar('0223')).toBe('ß');
		expect(altCodeChar('0128')).toBe('€');
		expect(altCodeChar('029')).toBe('\x1d');
		expect(altCodeChar('255')).toBe(' ');
		expect(altCodeChar('')).toBe('');
	});
});
