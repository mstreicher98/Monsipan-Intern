import { emitScan, onScan, SCAN_PRIORITY } from './wedge';

export type CameraMode = 'single' | 'continuous';

export interface ScanFlash {
	id: number;
	ok: boolean;
	label: string;
}

/** Globaler Zustand der Kamera-Ansicht */
class ScannerState {
	open = $state(false);
	mode = $state<CameraMode>('single');
	title = $state('Code scannen');
	flash = $state<ScanFlash | null>(null);
	count = $state(0);
	#flashId = 0;
	#pending: { resolve: (v: string[] | null) => void; off: () => void } | null = null;

	openCamera(opts: { mode?: CameraMode; title?: string } = {}) {
		this.mode = opts.mode ?? 'single';
		this.title = opts.title ?? (this.mode === 'continuous' ? 'Artikel scannen' : 'Code scannen');
		this.flash = null;
		this.count = 0;
		this.open = true;
	}

	close() {
		this.open = false;
		if (this.#pending) {
			const p = this.#pending;
			this.#pending = null;
			p.off();
			p.resolve(null);
		}
	}

	/**
	 * Einmal scannen (Kamera oder Handscanner) und das Ergebnis direkt zurückgeben,
	 * z. B. um einen Code in ein Formularfeld zu übernehmen.
	 */
	captureOnce(title = 'Code scannen'): Promise<string[] | null> {
		this.close();
		return new Promise((resolve) => {
			const off = onScan((scan) => {
				if (this.#pending?.resolve !== resolve) return;
				this.#pending = null;
				off();
				this.open = false;
				resolve(scan.variants);
			}, SCAN_PRIORITY.field + 10);
			this.#pending = { resolve, off };
			this.openCamera({ mode: 'single', title });
		});
	}

	/** Von der Kamera erkannter Code */
	detected(text: string) {
		if (this.mode === 'single' && !this.#pending) this.open = false;
		emitScan({ variants: [text], source: 'camera' });
	}

	/** Rückmeldung in der Kamera-Ansicht (z. B. Artikelname) */
	report(ok: boolean, label: string) {
		if (ok) this.count++;
		this.flash = { id: ++this.#flashId, ok, label };
	}
}

export const scanner = new ScannerState();
