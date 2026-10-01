/**
 * Handscanner tippen wie eine Tastatur. Ist der Scanner auf ein anderes
 * Layout eingestellt als der PC (US ↔ Deutsch QWERTZ), kommen y/z und
 * Sonderzeichen wie ":" oder "|" falsch an. Wir zeichnen daher die
 * physischen Tasten (KeyboardEvent.code) mit und rekonstruieren den Text
 * zusätzlich in beiden Layouts. Der Parser wählt dann die plausibelste Lesart.
 */

export interface KeyStroke {
	key: string;
	code: string;
	shift: boolean;
	altGr: boolean;
	/** Fest vorgegebenes Zeichen (Steuerzeichen, Alt-Code, Zeilenumbruch) – gilt in jedem Layout */
	char?: string;
}

export type Layout = 'os' | 'us' | 'de';

type Table = Record<string, string>;

const US_BASE: Table = {
	Backquote: '`',
	Minus: '-',
	Equal: '=',
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	Semicolon: ';',
	Quote: "'",
	Comma: ',',
	Period: '.',
	Slash: '/',
	Space: ' ',
	IntlBackslash: '\\',
	NumpadDecimal: '.'
};
const US_SHIFT: Table = {
	Backquote: '~',
	Digit1: '!',
	Digit2: '@',
	Digit3: '#',
	Digit4: '$',
	Digit5: '%',
	Digit6: '^',
	Digit7: '&',
	Digit8: '*',
	Digit9: '(',
	Digit0: ')',
	Minus: '_',
	Equal: '+',
	BracketLeft: '{',
	BracketRight: '}',
	Backslash: '|',
	Semicolon: ':',
	Quote: '"',
	Comma: '<',
	Period: '>',
	Slash: '?',
	IntlBackslash: '|',
	Space: ' '
};
const DE_BASE: Table = {
	Backquote: '^',
	Minus: 'ß',
	Equal: '´',
	BracketLeft: 'ü',
	BracketRight: '+',
	Backslash: '#',
	Semicolon: 'ö',
	Quote: 'ä',
	Comma: ',',
	Period: '.',
	Slash: '-',
	Space: ' ',
	IntlBackslash: '<',
	NumpadDecimal: ','
};
const DE_SHIFT: Table = {
	Backquote: '°',
	Digit1: '!',
	Digit2: '"',
	Digit3: '§',
	Digit4: '$',
	Digit5: '%',
	Digit6: '&',
	Digit7: '/',
	Digit8: '(',
	Digit9: ')',
	Digit0: '=',
	Minus: '?',
	Equal: '`',
	BracketLeft: 'Ü',
	BracketRight: '*',
	Backslash: "'",
	Semicolon: 'Ö',
	Quote: 'Ä',
	Comma: ';',
	Period: ':',
	Slash: '_',
	IntlBackslash: '>',
	Space: ' '
};
const DE_ALTGR: Table = {
	KeyQ: '@',
	KeyE: '€',
	KeyM: 'µ',
	Digit2: '²',
	Digit3: '³',
	Digit7: '{',
	Digit8: '[',
	Digit9: ']',
	Digit0: '}',
	Minus: '\\',
	BracketRight: '~',
	IntlBackslash: '|'
};
const NUMPAD: Table = {
	NumpadAdd: '+',
	NumpadSubtract: '-',
	NumpadMultiply: '*',
	NumpadDivide: '/'
};

function charFor(stroke: KeyStroke, layout: 'us' | 'de'): string {
	if (stroke.char !== undefined) return stroke.char;
	const { code, shift, altGr } = stroke;
	if (layout === 'de' && altGr) return DE_ALTGR[code] ?? '';
	const letter = /^Key([A-Z])$/.exec(code);
	if (letter) {
		let ch = letter[1];
		if (layout === 'de') ch = ch === 'Y' ? 'Z' : ch === 'Z' ? 'Y' : ch;
		return shift ? ch : ch.toLowerCase();
	}
	const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
	if (digit && !(shift && code.startsWith('Digit'))) return digit[1];
	if (NUMPAD[code]) return NUMPAD[code];
	const table = layout === 'us' ? (shift ? US_SHIFT : US_BASE) : shift ? DE_SHIFT : DE_BASE;
	return table[code] ?? (stroke.key.length === 1 ? stroke.key : '');
}

export function strokesToText(strokes: KeyStroke[], layout: Layout): string {
	if (layout === 'os') return strokes.map((s) => s.char ?? (s.key.length === 1 ? s.key : '')).join('');
	return strokes.map((s) => charFor(s, layout)).join('');
}

export interface Reading {
	text: string;
	/** Alle Layouts, die genau diesen Text ergeben */
	layouts: Layout[];
}

/** Betriebssystem-Lesart zuerst, dann die beiden rekonstruierten Layouts (ohne Doppelte) */
export function strokeReadings(strokes: KeyStroke[]): Reading[] {
	const out: Reading[] = [];
	for (const layout of ['os', 'us', 'de'] as const) {
		const text = strokesToText(strokes, layout).trim();
		if (!text) continue;
		const same = out.find((r) => r.text === text);
		if (same) same.layouts.push(layout);
		else out.push({ text, layouts: [layout] });
	}
	return out;
}

export function strokeVariants(strokes: KeyStroke[]): string[] {
	return strokeReadings(strokes).map((r) => r.text);
}
