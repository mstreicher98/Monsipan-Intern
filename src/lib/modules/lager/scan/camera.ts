/**
 * Kamera-Scanner. Nutzt die eingebaute BarcodeDetector-API (Android/Chrome),
 * sonst zxing-wasm (iPhone, Firefox). Die WASM-Datei kommt vom eigenen Server
 * und wird erst geladen, wenn jemand die Kamera öffnet.
 */
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export const SCAN_FORMATS = [
	'data_matrix',
	'ean_13',
	'ean_8',
	'upc_a',
	'upc_e',
	'code_128',
	'code_39',
	'itf',
	'qr_code'
] as const;

export interface Detector {
	detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}

let detectorPromise: Promise<Detector> | null = null;

type NativeCtor = {
	new (opts: { formats: string[] }): Detector;
	getSupportedFormats(): Promise<string[]>;
};

export function getDetector(): Promise<Detector> {
	detectorPromise ??= (async () => {
		const Native = (globalThis as unknown as { BarcodeDetector?: NativeCtor }).BarcodeDetector;
		if (Native) {
			try {
				const supported = await Native.getSupportedFormats();
				if (supported.includes('data_matrix') && supported.includes('ean_13')) {
					return new Native({ formats: SCAN_FORMATS.filter((f) => supported.includes(f)) });
				}
			} catch {
				/* auf zxing ausweichen */
			}
		}
		const { BarcodeDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
		prepareZXingModule({
			overrides: {
				locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path)
			},
			fireImmediately: true
		});
		return new BarcodeDetector({ formats: [...SCAN_FORMATS] }) as unknown as Detector;
	})();
	return detectorPromise;
}

export async function openCamera(): Promise<MediaStream> {
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new Error(
			window.isSecureContext
				? 'Dieser Browser unterstützt keinen Kamerazugriff.'
				: 'Die Kamera funktioniert nur über eine sichere Verbindung (https).'
		);
	}
	try {
		return await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				facingMode: { ideal: 'environment' },
				width: { ideal: 1920 },
				height: { ideal: 1080 }
			}
		});
	} catch (err) {
		const name = (err as DOMException)?.name;
		if (name === 'NotAllowedError' || name === 'SecurityError')
			throw new Error('Kamerazugriff wurde abgelehnt. Bitte in den Browser-Einstellungen für diese Seite erlauben.');
		if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new Error('Keine Kamera gefunden.');
		if (name === 'NotReadableError') throw new Error('Die Kamera wird gerade von einer anderen App verwendet.');
		throw new Error('Kamera konnte nicht gestartet werden.');
	}
}

export function torchSupported(stream: MediaStream): boolean {
	const track = stream.getVideoTracks()[0];
	const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
	return Boolean(caps?.torch);
}

export async function setTorch(stream: MediaStream, on: boolean) {
	const track = stream.getVideoTracks()[0];
	await track?.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}
