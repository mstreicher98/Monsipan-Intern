/**
 * Erkennt Handscanner an der Tastatur („Keyboard Wedge“) – ohne DOM, damit es testbar bleibt.
 *
 * Scanner tippen sehr schnell. Über Bluetooth kommen die Zeichen aber oft stoßweise
 * mit kurzen Pausen dazwischen. Entscheidend ist daher der typische (mittlere)
 * Zeichenabstand, nicht der längste. Außerdem werden verstanden:
 *  - Enter mitten im Code (mehrzeilige DataMatrix) und CR+LF als Abschluss,
 *  - Gruppentrenner (Strg+]) und andere Steuerzeichen, die Scanner als Strg-Kombination schicken,
 *  - tote Tasten (´ und ^ am deutschen Layout, wenn der Scanner auf US steht),
 *  - Alt+Ziffernblock-Codes (Umlaute im „Alt-Modus“ unter Windows),
 *  - Scanner ohne Enter am Ende (Abschluss nach einer kurzen Pause).
 */
import type { KeyStroke } from './layout';

export interface KeyInput {
	type: 'down' | 'up';
	key: string;
	code: string;
	shift: boolean;
	ctrl: boolean;
	alt: boolean;
	meta: boolean;
	altGr: boolean;
	repeat: boolean;
	/** Zeitpunkt in ms (performance.now) */
	time: number;
}

export const WEDGE_TIMING = {
	/** Typischer Zeichenabstand eines Scanners – Menschen tippen deutlich langsamer */
	maxMedianGap: 50,
	/** Längere Pause beendet die Eingabe; kürzere Bluetooth-Aussetzer werden überbrückt */
	endPause: 600,
	/** Nach Enter kurz warten, ob noch eine Zeile folgt */
	settle: 150,
	/** Strg-Kombinationen gehören nur so kurz nach dem letzten Zeichen zum Scan */
	ctrlWindow: 150,
	minLength: 4,
	/** Ohne Enter am Ende braucht es mehr Zeichen, um sicher zu sein */
	minLengthNoSuffix: 8
};

export type ScanEnd = 'enter' | 'tab' | 'pause';

export interface SequenceStats {
	/** Anzahl Zeichen */
	chars: number;
	durationMs: number;
	medianGapMs: number;
	maxGapMs: number;
}

export type Verdict = 'scan' | 'zu-kurz' | 'zu-langsam' | 'textfeld' | 'abgebrochen' | 'ohne-abschluss';

export interface SequenceReport {
	verdict: Verdict;
	end: ScanEnd | 'abbruch';
	stats: SequenceStats;
	strokes: KeyStroke[];
	/** Rohe Tastenereignisse, nur wenn die Diagnose sie anfordert */
	events: KeyInput[];
	/** z. B. welche Taste die Eingabe abgebrochen hat */
	note?: string;
}

export interface DetectorOptions {
	/** Darf ein Scan gerade abgefangen werden? Sonst landet er als Text im fokussierten Feld. */
	canCapture: () => boolean;
	/** Erste Taste einer neuen Eingabe – z. B. um den Feldinhalt zu merken */
	onStart?: () => void;
	onScan: (strokes: KeyStroke[], stats: SequenceStats, end: ScanEnd) => void;
	onReport?: (report: SequenceReport) => void;
	recordEvents?: () => boolean;
	setTimer?: (fn: () => void, ms: number) => unknown;
	clearTimer?: (handle: unknown) => void;
}

const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'CapsLock', 'NumLock', 'Fn']);
const PRINTABLE_CODE =
	/^(Key[A-Z]|Digit\d|Numpad(\d|Add|Subtract|Multiply|Divide|Decimal|Comma)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|IntlBackslash|IntlRo|IntlYen|Space)$/;

/** Codepage 850 (Windows-Konsole Westeuropa), Zeichen 128–255 – für Alt-Codes ohne führende Null */
const CP850_HIGH = [
	'ÇüéâäàåçêëèïîìÄÅ',
	'ÉæÆôöòûùÿÖÜø£Ø×ƒ',
	'áíóúñÑªº¿®¬½¼¡«»',
	'░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐',
	'└┴┬├─┼ãÃ╚╔╩╦╠═╬¤',
	'ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀',
	'ÓßÔÒõÕµþÞÚÛÙýÝ¯´',
	'\u00AD±‗¾¶§÷¸°¨·¹³²■\u00A0'
].join('');

let cp1252: TextDecoder | null = null;

/**
 * Alt+Ziffernblock unter Windows: mit führender 0 Windows-1252 (Alt+0220 = Ü),
 * sonst Codepage 850 (Alt+154 = Ü). Werte unter 32 sind Steuerzeichen (Alt+029 = GS).
 */
export function altCodeChar(digits: string): string {
	if (!/^\d+$/.test(digits)) return '';
	const n = Number(digits) % 256;
	if (n === 0) return '';
	if (n < 128) return String.fromCharCode(n);
	if (digits.startsWith('0')) {
		cp1252 ??= new TextDecoder('windows-1252');
		return cp1252.decode(new Uint8Array([n]));
	}
	return CP850_HIGH[n - 128];
}

/** Steuerzeichen, die Scanner als Strg-Kombination tippen (Strg+] = GS) */
export function controlChar(code: string, shift: boolean): string | null {
	const letter = /^Key([A-Z])$/.exec(code);
	if (letter) return String.fromCharCode(letter[1].charCodeAt(0) - 64);
	switch (code) {
		case 'BracketLeft':
			return '\x1b';
		case 'Backslash':
		case 'IntlBackslash':
			return '\x1c';
		case 'BracketRight':
			return '\x1d';
		case 'Digit6':
			return shift ? '\x1e' : null;
		case 'Minus':
			return shift ? '\x1f' : null;
		default:
			return null;
	}
}

function median(values: number[]): number {
	if (!values.length) return 0;
	const s = [...values].sort((a, b) => a - b);
	const m = s.length >> 1;
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const BREAK_CHARS = new Set(['\n', '\t']);

export class WedgeDetector {
	#opts: DetectorOptions;
	#strokes: KeyStroke[] = [];
	/** Zeitpunkte aller Tasten (ohne reine Umschalttasten) */
	#times: number[] = [];
	#events: KeyInput[] = [];
	#altDigits: string | null = null;
	/** Enter empfangen – kurz warten, ob der Code weitergeht */
	#settle: unknown = null;
	#settleEnd: ScanEnd = 'enter';
	#pause: unknown = null;

	constructor(opts: DetectorOptions) {
		this.#opts = opts;
	}

	#set(fn: () => void, ms: number) {
		return (this.#opts.setTimer ?? ((f, t) => setTimeout(f, t)))(fn, ms);
	}
	#clear(handle: unknown) {
		if (handle === null) return;
		(this.#opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>)))(handle);
	}

	/** Verarbeitet eine Taste. true = der Browser soll sie nicht selbst ausführen. */
	handle(e: KeyInput): boolean {
		if (this.#opts.recordEvents?.() && this.#events.length < 1000) this.#events.push(e);

		if (e.type === 'up') {
			if (e.key === 'Alt' && this.#altDigits !== null) {
				const ch = altCodeChar(this.#altDigits);
				this.#altDigits = null;
				if (ch) this.#strokes.push({ key: '', code: '', shift: false, altGr: false, char: ch });
			}
			return false;
		}
		if (e.repeat) return false;

		const { key, code } = e;
		if (MODIFIERS.has(key)) {
			if (key === 'Alt' && !e.ctrl) this.#altDigits = '';
			return false;
		}

		// Alt gedrückt + Ziffernblock: Zeichen per Code
		if (this.#altDigits !== null) {
			const digit = e.alt && !e.ctrl ? /^Numpad(\d)$/.exec(code) : null;
			if (digit) {
				this.#mark(e.time);
				this.#altDigits += digit[1];
				return false;
			}
			this.#altDigits = null;
		}

		if (key === 'Enter') return this.#lineBreak(e.time, '\n', 'enter');
		if (key === 'Tab') return this.#lineBreak(e.time, '\t', 'tab');

		if ((e.ctrl && !e.altGr) || e.meta) {
			const ctl = e.ctrl && !e.meta ? controlChar(code, e.shift) : null;
			if (ctl !== null && this.#midScan(e.time)) {
				if (ctl === '\r' || ctl === '\n') return this.#lineBreak(e.time, '\n', 'enter');
				if (ctl === '\t') return this.#lineBreak(e.time, '\t', 'tab');
				this.#mark(e.time);
				this.#strokes.push({ key: '', code, shift: e.shift, altGr: false, char: ctl });
				return true;
			}
			this.#abort(`Tastenkürzel ${e.meta ? 'Meta' : 'Strg'}+${key}`);
			return false;
		}

		if (key.length !== 1 && key !== 'Dead' && !PRINTABLE_CODE.test(code)) {
			this.#abort(`Taste ${key || code || 'unbekannt'}`);
			return false;
		}

		this.#mark(e.time);
		this.#strokes.push({
			key: key === 'Dead' ? '' : key,
			code,
			shift: e.shift,
			// macOS: Wahltaste wirkt wie AltGr
			altGr: e.altGr || (e.alt && !e.ctrl)
		});
		return false;
	}

	dispose() {
		this.#reset();
	}

	/** Lange Pause seit der letzten Taste: vorherige Eingabe abschließen (falls der Timer gedrosselt war) */
	#closeStale(time: number) {
		const last = this.#times.at(-1);
		if (last === undefined || time - last <= WEDGE_TIMING.endPause) return;
		const current = this.#events.pop();
		this.#finish('pause');
		if (current) this.#events.push(current);
	}

	#mark(time: number) {
		this.#closeStale(time);
		if (this.#settle !== null) {
			// Es geht weiter: das Enter war ein Zeilenumbruch im Code
			this.#clear(this.#settle);
			this.#settle = null;
		}
		if (!this.#times.length && !this.#strokes.length) this.#opts.onStart?.();
		this.#times.push(time);
		this.#clear(this.#pause);
		this.#pause = this.#set(() => this.#finish('pause'), WEDGE_TIMING.endPause);
	}

	#isFast(): boolean {
		return this.#times.length >= 2 && this.#medianGap() <= WEDGE_TIMING.maxMedianGap;
	}

	#gaps(): number[] {
		const t = this.#times;
		return t.slice(1).map((v, i) => v - t[i]);
	}

	#medianGap(): number {
		return median(this.#gaps());
	}

	#midScan(time: number): boolean {
		const last = this.#times.at(-1);
		return this.#strokes.length >= 2 && last !== undefined && time - last <= WEDGE_TIMING.ctrlWindow && this.#isFast();
	}

	#contentLength(): number {
		return this.#strokes.filter((s) => !(s.char && BREAK_CHARS.has(s.char))).length;
	}

	#lineBreak(time: number, ch: string, end: ScanEnd): boolean {
		const stroke: KeyStroke = { key: '', code: '', shift: false, altGr: false, char: ch };
		if (this.#settle !== null) {
			// CR+LF oder mehrere Zeilenenden direkt hintereinander
			this.#clear(this.#settle);
			this.#strokes.push(stroke);
			this.#settle = this.#set(() => this.#finish('enter'), WEDGE_TIMING.settle);
			return true;
		}
		this.#closeStale(time);

		const n = this.#contentLength();
		if (n === 0) return false;
		if (n < WEDGE_TIMING.minLength || !this.#isFast()) {
			this.#report(n < WEDGE_TIMING.minLength ? 'zu-kurz' : 'zu-langsam', end);
			this.#reset();
			return false;
		}
		if (!this.#opts.canCapture()) {
			this.#report('textfeld', end);
			this.#reset();
			return false;
		}
		this.#strokes.push(stroke);
		this.#settleEnd = end;
		this.#clear(this.#pause);
		this.#pause = null;
		this.#settle = this.#set(() => this.#finish('enter'), WEDGE_TIMING.settle);
		return true;
	}

	#finish(pauseEnd: ScanEnd) {
		const captured = this.#settle !== null;
		const end = captured ? this.#settleEnd : pauseEnd;
		const strokes = [...this.#strokes];
		while (strokes.length && BREAK_CHARS.has(strokes.at(-1)!.char ?? '')) strokes.pop();
		while (strokes.length && BREAK_CHARS.has(strokes[0].char ?? '')) strokes.shift();

		if (!strokes.length) {
			this.#reset();
			return;
		}
		if (!captured) {
			// Kein Enter: nur eindeutig schnelle, lange Folgen gelten als Scan
			const verdict: Verdict =
				strokes.length < WEDGE_TIMING.minLengthNoSuffix
					? 'ohne-abschluss'
					: !this.#isFast()
						? 'zu-langsam'
						: !this.#opts.canCapture()
							? 'textfeld'
							: 'scan';
			if (verdict !== 'scan') {
				if (strokes.length >= 2) this.#report(verdict, 'pause');
				this.#reset();
				return;
			}
		}
		const stats = this.#stats(strokes);
		const events = this.#events;
		this.#reset();
		this.#opts.onScan(strokes, stats, end);
		this.#opts.onReport?.({ verdict: 'scan', end, stats, strokes, events });
	}

	#abort(note: string) {
		if (this.#settle !== null) {
			// Scan war schon abgeschlossen – nicht verwerfen
			this.#finish('enter');
			return;
		}
		if (this.#contentLength() >= 2) this.#report('abgebrochen', 'abbruch', note);
		this.#reset();
	}

	#stats(strokes: KeyStroke[]): SequenceStats {
		const gaps = this.#gaps();
		const t = this.#times;
		const r = (v: number) => Math.round(v * 10) / 10;
		return {
			chars: strokes.filter((s) => !(s.char && BREAK_CHARS.has(s.char))).length,
			durationMs: t.length ? r(t[t.length - 1] - t[0]) : 0,
			medianGapMs: r(median(gaps)),
			maxGapMs: r(gaps.length ? Math.max(...gaps) : 0)
		};
	}

	#report(verdict: Verdict, end: ScanEnd | 'abbruch', note?: string) {
		if (!this.#opts.onReport) return;
		const strokes = [...this.#strokes];
		this.#opts.onReport({ verdict, end, stats: this.#stats(strokes), strokes, events: this.#events, note });
	}

	#reset() {
		this.#clear(this.#settle);
		this.#clear(this.#pause);
		this.#settle = null;
		this.#pause = null;
		this.#strokes = [];
		this.#times = [];
		this.#events = [];
		this.#altDigits = null;
	}
}
