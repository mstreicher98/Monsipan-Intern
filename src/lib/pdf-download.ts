/**
 * PDFs am Handy speichern. Am Computer reicht ein normaler Download-Link;
 * am Handy klappt das nicht überall:
 *
 * - In der Android-App laufen Download-Links ins Leere – dort legt das
 *   App-Plugin das PDF in „Downloads" ab und öffnet es.
 * - Am iPhone/iPad (Safari und vom Home-Bildschirm) landet ein Download
 *   versteckt oder gar nicht – dort kommt das Teilen-Menü mit
 *   „In Dateien sichern" und „Drucken".
 */
import { inNativeApp, nativePlugin } from './native';

export const isIOS = () =>
	typeof navigator !== 'undefined' &&
	(/iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

/** Braucht dieses Gerät Hilfe? Sonst lädt der Browser das PDF über den Link selbst. */
export const needsPdfHelp = () => inNativeApp() || isIOS();

/** Dateiname aus dem Content-Disposition-Kopf */
function filenameFrom(header: string | null): string | null {
	const m = header?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
	return m ? decodeURIComponent(m[1]) : null;
}

export async function fetchPdf(url: string): Promise<File> {
	const res = await fetch(url, { credentials: 'same-origin' });
	const type = res.headers.get('content-type') ?? '';
	if (!res.ok || !type.includes('pdf')) throw new Error('Das PDF konnte nicht erstellt werden.');
	const name = filenameFrom(res.headers.get('content-disposition')) ?? 'dokument.pdf';
	return new File([await res.blob()], name, { type: 'application/pdf' });
}

function toBase64(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(file);
	});
}

/**
 * Was mit dem PDF passiert ist. "needs-tap": Das Teilen-Menü braucht einen
 * frischen Fingertipp, weil das Erstellen zu lange gedauert hat.
 */
export type PdfOutcome = 'saved' | 'shared' | 'downloaded' | 'cancelled' | 'needs-tap';

export async function deliverPdf(file: File): Promise<PdfOutcome> {
	const plugin = nativePlugin();
	if (plugin) {
		await plugin.savePdf({ name: file.name, data: await toBase64(file) });
		return 'saved';
	}
	if (inNativeApp()) throw new Error('Diese App-Version kann noch keine PDFs speichern – bitte die App aktualisieren.');

	if (navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: file.name });
			return 'shared';
		} catch (e) {
			const name = (e as { name?: string }).name;
			if (name === 'AbortError') return 'cancelled';
			if (name === 'NotAllowedError') return 'needs-tap';
			throw e;
		}
	}

	// Sonst als Datei herunterladen
	const href = URL.createObjectURL(file);
	const a = document.createElement('a');
	a.href = href;
	a.download = file.name;
	document.body.append(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(href), 60_000);
	return 'downloaded';
}
