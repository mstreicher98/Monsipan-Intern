/**
 * Kleinigkeiten, die nur in der Android-App greifen.
 *
 * Die App zeichnet von Rand zu Rand, die Seite liegt also auch unter der
 * Statusleiste. Den nötigen Abstand holt sich das Layout über
 * `env(safe-area-inset-*)`; hier wird nur die Schrift- und Symbolfarbe der
 * System-Leisten zur hellen oder dunklen Darstellung passend gesetzt.
 */
interface SystemBarsPlugin {
	setStyle(options: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }): Promise<void>;
}

function systemBars(): SystemBarsPlugin | null {
	const cap = (window as { Capacitor?: { Plugins?: { SystemBars?: SystemBarsPlugin } } }).Capacitor;
	return cap?.Plugins?.SystemBars ?? null;
}

/** Läuft die Seite in der Android-App? */
export const inNativeApp = () => typeof window !== 'undefined' && 'Capacitor' in window;

/** App-eigenes Plugin (NativePlugin.java) – fehlt in älteren App-Versionen */
interface MonsipanNativePlugin {
	print(options: { title: string }): Promise<void>;
	savePdf(options: { name: string; data: string }): Promise<{ opened: boolean }>;
}

export function nativePlugin(): MonsipanNativePlugin | null {
	if (typeof window === 'undefined') return null;
	const cap = (window as { Capacitor?: { Plugins?: { MonsipanNative?: MonsipanNativePlugin } } }).Capacitor;
	return cap?.Plugins?.MonsipanNative ?? null;
}

/**
 * Drucken: im Browser wie gewohnt, in der App über den Android-Druckdienst –
 * window.print() tut in der WebView nichts. Gibt false zurück, wenn es in
 * dieser Umgebung nicht geht (ältere App ohne Plugin).
 */
export function printPage(): boolean {
	const plugin = nativePlugin();
	if (plugin) {
		plugin.print({ title: document.title }).catch(() => {});
		return true;
	}
	if (inNativeApp()) return false;
	window.print();
	return true;
}

/**
 * Systemleisten an die Darstellung anpassen und bei jedem Wechsel nachziehen.
 * Gibt die Aufräumfunktion zurück; außerhalb der App passiert nichts.
 */
export function syncSystemBars(): () => void {
	const bars = systemBars();
	if (!bars) return () => {};

	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const apply = () => {
		const chosen = document.documentElement.getAttribute('data-theme');
		const dark = chosen ? chosen === 'dark' : media.matches;
		// DARK = helle Symbole auf dunklem Grund
		bars.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {});
	};

	apply();
	media.addEventListener('change', apply);
	const observer = new MutationObserver(apply);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

	return () => {
		media.removeEventListener('change', apply);
		observer.disconnect();
	};
}
