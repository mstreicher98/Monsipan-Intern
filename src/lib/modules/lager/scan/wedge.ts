/**
 * Handscanner („Keyboard Wedge“) im Browser: Tastatur abhören, Scans an den
 * passenden Empfänger verteilen. Die eigentliche Erkennung steckt in detector.ts.
 */
import { WedgeDetector, type KeyInput, type SequenceReport, type SequenceStats } from './detector';
import { strokeReadings, type Layout } from './layout';

export interface WedgeScan {
	/** Mögliche Lesarten (Betriebssystem, US-, DE-Layout) */
	variants: string[];
	source: 'wedge' | 'camera' | 'manual';
	/** Nur Handscanner: welche Layouts hinter jeder Lesart stecken */
	layouts?: Layout[][];
	stats?: SequenceStats;
}

type Handler = (scan: WedgeScan) => void;

/** Wer einen Scan bekommt: fokussiertes Feld vor Seite vor globalem Standard */
export const SCAN_PRIORITY = { global: 0, page: 10, field: 20 } as const;

const handlers: { fn: Handler; priority: number; seq: number }[] = [];
let seq = 0;

/**
 * Registriert einen Empfänger für Scans. Es gewinnt die höchste Priorität,
 * bei Gleichstand der zuletzt registrierte.
 */
export function onScan(handler: Handler, priority: number = SCAN_PRIORITY.page): () => void {
	const entry = { fn: handler, priority, seq: ++seq };
	handlers.push(entry);
	return () => {
		const i = handlers.indexOf(entry);
		if (i >= 0) handlers.splice(i, 1);
	};
}

export function emitScan(scan: WedgeScan) {
	let best: (typeof handlers)[number] | undefined;
	for (const h of handlers) if (!best || h.priority > best.priority || (h.priority === best.priority && h.seq > best.seq)) best = h;
	best?.fn(scan);
}

const reportListeners = new Set<(r: SequenceReport) => void>();

/** Jede erkannte oder verworfene Tasteneingabe mitlesen (Seite „Scanner testen“) */
export function onScanReport(fn: (r: SequenceReport) => void): () => void {
	reportListeners.add(fn);
	return () => reportListeners.delete(fn);
}

type FormField = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function isEditable(el: Element | null): boolean {
	if (!el || !(el instanceof HTMLElement)) return false;
	if (el.isContentEditable) return true;
	if (el instanceof HTMLTextAreaElement) return true;
	if (el instanceof HTMLSelectElement) return true;
	if (el instanceof HTMLInputElement) {
		return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type);
	}
	return false;
}

/**
 * Scans abfangen, außer der Fokus steht in einem normalen Eingabefeld – dort
 * landet der Code als Text (z. B. Artikelnummer im Formular). Seiten mit eigenem
 * Scan-Empfänger (Buchen) bekommen Scans aber auch aus Mengen- und Notizfeldern,
 * damit nie ein Code in der Menge landet. Felder mit data-scan-text sind ausgenommen.
 */
function canCapture(): boolean {
	const el = document.activeElement;
	if (!isEditable(el)) return true;
	if (el!.closest('[data-scan-target]')) return true;
	if (el!.closest('[data-scan-text]')) return false;
	return handlers.some((h) => h.priority >= SCAN_PRIORITY.page);
}

/** Vom Scanner ins Feld getippte Zeichen wieder entfernen */
function restore(field: FormField, value: string) {
	if (!field.isConnected || field.value === value) return;
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
	if (field instanceof HTMLSelectElement) field.dispatchEvent(new Event('change', { bubbles: true }));
}

export function installWedgeListener(): () => void {
	let snapshot: { field: FormField; value: string } | null = null;

	const detector = new WedgeDetector({
		canCapture,
		onStart() {
			const el = document.activeElement;
			const isField = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
			snapshot = isField ? { field: el, value: el.value } : null;
		},
		onScan(strokes, stats) {
			if (snapshot) restore(snapshot.field, snapshot.value);
			snapshot = null;
			const readings = strokeReadings(strokes);
			if (!readings.length) return;
			emitScan({ variants: readings.map((r) => r.text), layouts: readings.map((r) => r.layouts), source: 'wedge', stats });
		},
		onReport(report) {
			for (const fn of reportListeners) fn(report);
		},
		recordEvents: () => reportListeners.size > 0
	});

	const input = (e: KeyboardEvent, type: KeyInput['type']): KeyInput => ({
		type,
		key: e.key ?? '',
		code: e.code ?? '',
		shift: e.shiftKey,
		ctrl: e.ctrlKey,
		alt: e.altKey,
		meta: e.metaKey,
		altGr: Boolean(e.getModifierState?.('AltGraph')) || (e.ctrlKey && e.altKey),
		repeat: e.repeat,
		time: performance.now()
	});

	const onKeyDown = (e: KeyboardEvent) => {
		if (e.isComposing) return;
		if (detector.handle(input(e, 'down'))) {
			e.preventDefault();
			e.stopPropagation();
		}
	};
	const onKeyUp = (e: KeyboardEvent) => {
		if (e.key === 'Alt') detector.handle(input(e, 'up'));
	};

	window.addEventListener('keydown', onKeyDown, true);
	window.addEventListener('keyup', onKeyUp, true);
	return () => {
		window.removeEventListener('keydown', onKeyDown, true);
		window.removeEventListener('keyup', onKeyUp, true);
		detector.dispose();
	};
}
