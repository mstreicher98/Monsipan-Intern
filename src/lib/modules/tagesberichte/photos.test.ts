import { describe, expect, it } from 'vitest';
import { jpegSize } from './photos';

/** Kleinstes JPEG-Gerüst: Anfang, APP0, Bildkopf mit Höhe und Breite */
function jpeg(width: number, height: number, sof = 0xc0) {
	const app0 = [0xff, 0xe0, 0x00, 0x10, ...'JFIF\0'.split('').map((c) => c.charCodeAt(0)), 1, 1, 0, 0, 1, 0, 1, 0, 0];
	const head = [0xff, sof, 0x00, 0x11, 8, height >> 8, height & 255, width >> 8, width & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
	return new Uint8Array([0xff, 0xd8, ...app0, ...head, 0xff, 0xd9]);
}

describe('jpegSize', () => {
	it('liest Breite und Höhe aus dem Bildkopf', () => {
		expect(jpegSize(jpeg(2400, 1800))).toEqual({ width: 2400, height: 1800 });
		// Progressives JPEG (SOF2)
		expect(jpegSize(jpeg(640, 480, 0xc2))).toEqual({ width: 640, height: 480 });
	});

	it('lehnt Dateien ab, die kein JPEG sind', () => {
		expect(jpegSize(new TextEncoder().encode('%PDF-1.7 ...'))).toBeNull();
		expect(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
		expect(jpegSize(jpeg(0, 100))).toBeNull();
		// Abgeschnitten mitten im Bildkopf
		expect(jpegSize(jpeg(100, 100).slice(0, 24))).toBeNull();
	});
});
