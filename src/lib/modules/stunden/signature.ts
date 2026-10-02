/**
 * Unterschrift beim Freigeben: gespeichert als SVG-Pfad in einem festen
 * 600×200-Feld. Ein Pfad ist klein, bleibt in Druck und PDF scharf und lässt
 * sich leicht prüfen – erlaubt sind nur Bewegungs- und Linienbefehle.
 */
export const SIGNATURE_WIDTH = 600;
export const SIGNATURE_HEIGHT = 200;

/** Obergrenze, damit niemand Megabytes in die Datenbank schreibt */
export const MAX_SIGNATURE_LENGTH = 60_000;

export interface Point {
	x: number;
	y: number;
}

/** Striche (je eine Folge von Punkten im 600×200-Feld) zu einem SVG-Pfad */
export function strokesToPath(strokes: Point[][]): string {
	const r = (n: number) => Math.round(Math.min(Math.max(n, 0), 9999) * 10) / 10;
	return strokes
		.filter((s) => s.length)
		.map((s) => {
			// Ein einzelner Punkt wird ein kurzer Strich, sonst sähe man ihn nicht
			const pts = s.length === 1 ? [s[0], { x: s[0].x + 0.5, y: s[0].y }] : s;
			return `M${r(pts[0].x)} ${r(pts[0].y)}` + pts.slice(1).map((p) => `L${r(p.x)} ${r(p.y)}`).join('');
		})
		.join('');
}

/** Nur "M x y" und "L x y" mit Zahlen – alles andere wird abgelehnt */
export function isValidSignature(path: string | null | undefined): path is string {
	if (!path || path.length > MAX_SIGNATURE_LENGTH) return false;
	return /^(?:[ML]-?\d+(?:\.\d+)? -?\d+(?:\.\d+)?)+$/.test(path);
}
