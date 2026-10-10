/**
 * Name der Anwendung an einer Stelle. Steht im Seitentitel, in Mails und in
 * der Prüfung beim Wiederherstellen einer Sicherung.
 */
export const APP_NAME = 'Monsipan Portal';

/** Seitentitel: "Bestand – Monsipan Portal", ohne Seitenname nur der Name */
export function pageTitle(page?: string | null): string {
	const name = page?.trim();
	return name ? `${name} – ${APP_NAME}` : APP_NAME;
}
