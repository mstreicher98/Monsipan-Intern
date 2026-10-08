/**
 * Rollen und Rechte.
 *
 * Jeder Bereich hat dieselben Arten von Rechten: Sehen, Erstellen, Bearbeiten,
 * Status (bereichseigene Schritte wie Freigeben oder Prüfen) und Löschen.
 * Wo es um Partien geht, gibt es Sehen (und teils Bearbeiten und Löschen) in
 * Stufen: eigene Partie bzw. in Arbeit – oder alle. Bei Stundenzetteln kommt
 * beim Sehen noch „Nur eigene" davor: nur der Zettel der Person selbst.
 *
 * Im Code stehen die Standardrechte (DEFAULT_PERMISSIONS). Was tatsächlich gilt,
 * verwaltet der Admin unter Verwaltung → Berechtigungen; diese Matrix liegt in der
 * Datenbank und wird beim Start in `current` geladen – auf dem Server wie im
 * Browser. `can()` bleibt dadurch eine einfache, synchrone Abfrage.
 */
export const ROLES = ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'partiefuehrer', 'arbeiter', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
	admin: 'Admin',
	geschaeftsfuehrer: 'Geschäftsführer',
	bauleiter: 'Bauleiter',
	buchhaltung: 'Buchhaltung/Sekretariat',
	partiefuehrer: 'Partieführer',
	arbeiter: 'Arbeiter',
	viewer: 'Nur ansehen'
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
	admin: 'Alles, inklusive Benutzer, Berechtigungen und Einstellungen',
	geschaeftsfuehrer: 'Sieht und prüft alles – Lager, Stunden, Tagesberichte, Angebote, Aufträge; Benutzer und Einstellungen bleiben beim Admin',
	bauleiter: 'Buchen, Inventur, Korrekturen, Artikel und Stammdaten pflegen, Stunden, Tagesberichte, Angebote und Aufträge',
	buchhaltung: 'Stundenzettel und Tagesberichte prüfen, Angebote und Aufträge schreiben, Stammdaten pflegen – ohne Lagerbuchungen',
	partiefuehrer: 'Bestand und Bewegungen ansehen, buchen, Stundenzettel, Tagesberichte und Aufträge der eigenen Partie',
	arbeiter: 'Bestand ansehen, ein- und ausbuchen, umlagern – ohne Einblick in Bewegungen',
	viewer: 'Alles ansehen außer Stammdaten, Benutzer und Einstellungen – ohne Änderungen'
};

/** Diese Rollen gehören immer zu einer Partie; sie ist beim Buchen vorausgewählt. */
export const PARTY_ROLES: readonly Role[] = ['partiefuehrer', 'arbeiter'];

/** Diese Rollen können zusätzlich einer Partie angehören, müssen aber nicht */
export const OPTIONAL_PARTY_ROLES: readonly Role[] = ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'];

export function needsParty(role: Role | undefined | null): boolean {
	return !!role && PARTY_ROLES.includes(role);
}

/** Darf (oder muss) diese Rolle eine Partie haben? */
export function mayHaveParty(role: Role | undefined | null): boolean {
	return !!role && (PARTY_ROLES.includes(role) || OPTIONAL_PARTY_ROLES.includes(role));
}

const ALL: Role[] = [...ROLES];
const LEITUNG: Role[] = ['admin', 'geschaeftsfuehrer', 'bauleiter'];
const BUERO: Role[] = ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'];

/**
 * Standardrechte. Ein neuer Bereich ergänzt nur seinen eigenen Block; fehlende
 * Einträge werden beim Start aus dieser Tabelle in die Datenbank übernommen.
 * Der Geschäftsführer hat von Haus aus alles, was Bauleitung oder Buchhaltung haben.
 */
export const DEFAULT_PERMISSIONS = {
	// Lager
	'lager.bestand.sehen': ALL,
	'lager.bestand.buchen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer', 'arbeiter'],
	'lager.bestand.inventur': LEITUNG,
	'lager.bewegungen.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'partiefuehrer', 'viewer'],
	'lager.bewegungen.bearbeiten': LEITUNG,
	'lager.artikel.sehen': ALL,
	'lager.artikel.erstellen': LEITUNG,
	'lager.artikel.bearbeiten': LEITUNG,
	'lager.artikel.loeschen': LEITUNG,
	'lager.berichte.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],
	'lager.warnungen.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],

	// Stundenzettel – sehen in drei Stufen: nur den eigenen, die eigene Partie, alle
	'stunden.eigene.sehen': ALL,
	'stunden.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'partiefuehrer'],
	'stunden.alle.sehen': BUERO,
	'stunden.erstellen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'stunden.bearbeiten': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'stunden.alle.bearbeiten': LEITUNG,
	'stunden.freigeben': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'stunden.pruefen': BUERO,
	'stunden.pruefung.zuruecknehmen': BUERO,
	'stunden.oeffnen.freigegeben': BUERO,
	'stunden.oeffnen.geprueft': BUERO,
	'stunden.aushilfe': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'stunden.loeschen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],

	// Tagesberichte – „sehen" heißt: die der eigenen Partie und die selbst angelegten
	'tagesberichte.sehen': ALL,
	'tagesberichte.alle.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],
	'tagesberichte.erstellen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'tagesberichte.bearbeiten': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'tagesberichte.freigeben': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'tagesberichte.pruefen': BUERO,
	'tagesberichte.pruefung.zuruecknehmen': BUERO,
	'tagesberichte.oeffnen.freigegeben': BUERO,
	'tagesberichte.oeffnen.geprueft': BUERO,
	'tagesberichte.oeffnen.abgeschlossen': ['admin', 'geschaeftsfuehrer'],
	'tagesberichte.kundenlink': BUERO,
	'tagesberichte.loeschen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],

	// Angebote – Preise sieht nur, wer Angebote sehen darf
	'angebote.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],
	'angebote.erstellen': BUERO,
	'angebote.bearbeiten': BUERO,
	'angebote.freigeben': LEITUNG,
	'angebote.oeffnen.angenommen': ['admin', 'geschaeftsfuehrer'],
	'angebote.loeschen.entwurf': BUERO,
	'angebote.loeschen': ['admin', 'geschaeftsfuehrer'],

	// Aufträge – „sehen" heißt: die der eigenen Partie
	'auftraege.sehen': ALL,
	'auftraege.alle.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],
	'auftraege.erstellen': BUERO,
	'auftraege.bearbeiten': BUERO,
	'auftraege.status': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'auftraege.status.zuruecksetzen': BUERO,
	'auftraege.loeschen.neu': BUERO,
	'auftraege.loeschen': ['admin', 'geschaeftsfuehrer'],

	// Kunden
	'kunden.sehen': BUERO,
	'kunden.erstellen': BUERO,
	'kunden.bearbeiten': BUERO,
	'kunden.loeschen': BUERO,

	// Verwaltung
	'stammdaten.sehen': BUERO,
	'stammdaten.erstellen': BUERO,
	'stammdaten.bearbeiten': BUERO,
	'stammdaten.loeschen': BUERO,
	'benutzer.sehen': ['admin'],
	'benutzer.erstellen': ['admin'],
	'benutzer.bearbeiten': ['admin'],
	'benutzer.loeschen': ['admin'],
	'berechtigungen.sehen': ['admin'],
	'berechtigungen.bearbeiten': ['admin'],
	'einstellungen.sehen': ['admin'],
	'einstellungen.bearbeiten': ['admin']
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof DEFAULT_PERMISSIONS;

export const PERMISSIONS = Object.keys(DEFAULT_PERMISSIONS) as Permission[];

/**
 * Sehen, Bearbeiten und Löschen gibt es einfach (ja/nein) oder in Stufen:
 * `own` (eigene Partie bzw. nur in Arbeit) und `all` (alle), bei Bedarf
 * darunter noch `self` (nur das, was die Person selbst betrifft).
 */
export interface PermissionLevel {
	self?: Permission;
	own?: Permission;
	all: Permission;
	/** Beschriftung der untersten Stufe, z. B. „Nur eigene" */
	selfLabel?: string;
	/** Beschriftung der mittleren Stufe, z. B. „Eigene Partie" oder „In Arbeit" */
	ownLabel?: string;
	hint?: string;
}

/** Ein Bereich in der Rechteverwaltung: eine Zeile je Gruppe */
export interface PermissionArea {
	key: string;
	title: string;
	section: string;
	hint?: string;
	view: PermissionLevel;
	create?: { key: Permission; label?: string; hint?: string };
	edit?: PermissionLevel & { label?: string };
	status?: { key: Permission; label: string; hint?: string }[];
	remove?: PermissionLevel;
}

const PARTY = 'Eigene Partie';

/** Alle Bereiche mit ihren Rechten, in der Reihenfolge der Seite */
export const PERMISSION_AREAS: PermissionArea[] = [
	{
		key: 'lager.bestand',
		title: 'Bestand',
		section: 'Lager',
		view: { all: 'lager.bestand.sehen', hint: 'Bestandsliste' },
		create: { key: 'lager.bestand.buchen', label: 'Buchen', hint: 'Ein-, Aus- und Umbuchen, Rückgaben' },
		status: [{ key: 'lager.bestand.inventur', label: 'Inventur', hint: 'Gezählte Mengen buchen' }]
	},
	{
		key: 'lager.bewegungen',
		title: 'Bewegungen',
		section: 'Lager',
		view: { all: 'lager.bewegungen.sehen', hint: 'Liste und Verlauf am Artikel' },
		edit: { all: 'lager.bewegungen.bearbeiten', label: 'Korrigieren', hint: 'Stornieren und neu buchen' }
	},
	{
		key: 'lager.artikel',
		title: 'Artikel',
		section: 'Lager',
		view: { all: 'lager.artikel.sehen' },
		create: { key: 'lager.artikel.erstellen' },
		edit: { all: 'lager.artikel.bearbeiten', hint: 'Auch Codes und PDFs' },
		remove: { all: 'lager.artikel.loeschen' }
	},
	{
		key: 'lager.berichte',
		title: 'Berichte und Bestellliste',
		section: 'Lager',
		view: { all: 'lager.berichte.sehen', hint: 'Auch Exporte' }
	},
	{
		key: 'lager.warnungen',
		title: 'Warnungen',
		section: 'Lager',
		hint: 'Hinweis auf den Mindestbestand',
		view: { all: 'lager.warnungen.sehen' }
	},
	{
		key: 'stunden',
		title: 'Stundenzettel',
		section: 'Dokumentation',
		view: { self: 'stunden.eigene.sehen', own: 'stunden.sehen', all: 'stunden.alle.sehen', selfLabel: 'Nur eigene', ownLabel: PARTY },
		create: { key: 'stunden.erstellen', hint: 'Woche anlegen' },
		edit: { own: 'stunden.bearbeiten', all: 'stunden.alle.bearbeiten', ownLabel: PARTY },
		status: [
			{ key: 'stunden.freigeben', label: 'Freigeben', hint: 'Woche unterschreiben und einreichen' },
			{ key: 'stunden.pruefen', label: 'Prüfen', hint: 'Geprüft-Haken setzen, Auslöse bestätigen' },
			{ key: 'stunden.pruefung.zuruecknehmen', label: 'Prüfung zurücknehmen', hint: 'Die Freigabe samt Unterschrift bleibt' },
			{ key: 'stunden.oeffnen.freigegeben', label: 'Freigegebene öffnen', hint: 'Die Unterschrift der Freigabe verfällt' },
			{ key: 'stunden.oeffnen.geprueft', label: 'Geprüfte öffnen', hint: 'Beide Unterschriften verfallen' },
			{ key: 'stunden.aushilfe', label: 'Aushilfe übernehmen', hint: 'Arbeiter einer anderen Partie für eine Woche' }
		],
		remove: { all: 'stunden.loeschen', hint: 'Wochen in Arbeit' }
	},
	{
		key: 'tagesberichte',
		title: 'Tagesberichte',
		section: 'Dokumentation',
		view: { own: 'tagesberichte.sehen', all: 'tagesberichte.alle.sehen', ownLabel: PARTY, hint: 'Eigene Partie: auch die selbst angelegten' },
		create: { key: 'tagesberichte.erstellen' },
		edit: { all: 'tagesberichte.bearbeiten', hint: 'In Arbeit, auch Handschrift und Fotos' },
		status: [
			{ key: 'tagesberichte.freigeben', label: 'Freigeben', hint: 'Für den Auftragnehmer unterschreiben' },
			{ key: 'tagesberichte.pruefen', label: 'Prüfen', hint: 'Vorher noch korrigieren' },
			{ key: 'tagesberichte.kundenlink', label: 'Link an den Kunden', hint: 'Kopieren, teilen oder mailen' },
			{ key: 'tagesberichte.pruefung.zuruecknehmen', label: 'Prüfung zurücknehmen' },
			{ key: 'tagesberichte.oeffnen.freigegeben', label: 'Freigegebene öffnen' },
			{ key: 'tagesberichte.oeffnen.geprueft', label: 'Geprüfte öffnen' },
			{ key: 'tagesberichte.oeffnen.abgeschlossen', label: 'Vom Kunden unterschriebene öffnen' }
		],
		remove: { all: 'tagesberichte.loeschen', hint: 'Berichte in Arbeit' }
	},
	{
		key: 'angebote',
		title: 'Angebote',
		section: 'Aufträge/Angebote',
		view: { all: 'angebote.sehen', hint: 'Mit Preisen' },
		create: { key: 'angebote.erstellen' },
		edit: { all: 'angebote.bearbeiten', hint: 'In Arbeit, auch überarbeiten' },
		status: [
			{ key: 'angebote.freigeben', label: 'Freigeben', hint: 'Und den Link an den Kunden schicken' },
			{ key: 'angebote.oeffnen.angenommen', label: 'Angenommene öffnen', hint: 'Nur ohne Auftrag – die Annahme verfällt' }
		],
		remove: { own: 'angebote.loeschen.entwurf', all: 'angebote.loeschen', ownLabel: 'In Arbeit' }
	},
	{
		key: 'auftraege',
		title: 'Aufträge',
		section: 'Aufträge/Angebote',
		view: { own: 'auftraege.sehen', all: 'auftraege.alle.sehen', ownLabel: PARTY },
		create: { key: 'auftraege.erstellen', hint: 'Aus angenommenen Angeboten' },
		edit: { all: 'auftraege.bearbeiten', hint: 'Partie, Ausführungsort, Hinweis, Unterlagen' },
		status: [
			{ key: 'auftraege.status', label: 'In Arbeit / abgeschlossen', hint: 'Bei den Aufträgen, die man sieht' },
			{ key: 'auftraege.status.zuruecksetzen', label: 'Zurück auf „Auftrag erstellt"' }
		],
		remove: { own: 'auftraege.loeschen.neu', all: 'auftraege.loeschen', ownLabel: 'Nur neue', hint: 'Neu: noch nicht begonnen' }
	},
	{
		key: 'kunden',
		title: 'Kunden',
		section: 'Aufträge/Angebote',
		view: { all: 'kunden.sehen' },
		create: { key: 'kunden.erstellen', hint: 'Auch direkt aus dem Angebot' },
		edit: { all: 'kunden.bearbeiten', hint: 'Auch ausblenden' },
		remove: { all: 'kunden.loeschen', hint: 'Nur ohne Angebote' }
	},
	{
		key: 'stammdaten',
		title: 'Stammdaten',
		section: 'Verwaltung',
		hint: 'Lagerorte, Materialarten, Farben, Partien',
		view: { all: 'stammdaten.sehen' },
		create: { key: 'stammdaten.erstellen' },
		edit: { all: 'stammdaten.bearbeiten', hint: 'Auch aktiv/inaktiv und Reihenfolge' },
		remove: { all: 'stammdaten.loeschen' }
	},
	{
		key: 'benutzer',
		title: 'Benutzer',
		section: 'Verwaltung',
		view: { all: 'benutzer.sehen' },
		create: { key: 'benutzer.erstellen', hint: 'Auch einladen' },
		edit: { all: 'benutzer.bearbeiten', hint: 'Auch Passwort zurücksetzen' },
		remove: { all: 'benutzer.loeschen' }
	},
	{
		key: 'berechtigungen',
		title: 'Berechtigungen',
		section: 'Verwaltung',
		view: { all: 'berechtigungen.sehen' },
		edit: { all: 'berechtigungen.bearbeiten' }
	},
	{
		key: 'einstellungen',
		title: 'Einstellungen',
		section: 'Verwaltung',
		hint: 'E-Mail, Sicherungen, Vorlagen für Angebote',
		view: { all: 'einstellungen.sehen' },
		edit: { all: 'einstellungen.bearbeiten', hint: 'Auch Sicherungen laden und einspielen' }
	}
];

/** Alle Rechte eines Bereichs außer „Sehen" */
export function areaActions(area: PermissionArea): Permission[] {
	return [
		area.create?.key,
		area.edit?.own,
		area.edit?.all,
		...(area.status ?? []).map((s) => s.key),
		area.remove?.own,
		area.remove?.all
	].filter((p): p is Permission => !!p);
}

/**
 * Was zusammengehört, ergänzen: Wer in einem Bereich etwas darf, darf ihn auch
 * sehen (die Stufe „eigene Partie"); jede Stufe schließt die darunter ein.
 */
export function withImplied(allowed: Set<string>): Set<string> {
	const out = new Set(allowed);
	for (const role of ROLES) {
		const has = (p: Permission | undefined) => !!p && out.has(`${role}|${p}`);
		const add = (p: Permission | undefined) => p && out.add(`${role}|${p}`);
		for (const area of PERMISSION_AREAS) {
			if (areaActions(area).some(has)) add(area.view.own ?? area.view.all);
			for (const level of [area.view, area.edit, area.remove]) {
				if (level?.own && has(level.all)) add(level.own);
				if (level?.self && has(level.own ?? level.all)) add(level.self);
			}
		}
	}
	return out;
}

/**
 * Rechte, die dem Admin nicht genommen werden können – sonst sperrt sich die
 * Firma aus der Benutzer- und Rechteverwaltung aus.
 */
export const LOCKED: { role: Role; permission: Permission }[] = [
	{ role: 'admin', permission: 'benutzer.sehen' },
	{ role: 'admin', permission: 'benutzer.bearbeiten' },
	{ role: 'admin', permission: 'berechtigungen.sehen' },
	{ role: 'admin', permission: 'berechtigungen.bearbeiten' },
	{ role: 'admin', permission: 'einstellungen.sehen' },
	{ role: 'admin', permission: 'einstellungen.bearbeiten' }
];

export function isLocked(role: Role, permission: Permission): boolean {
	return LOCKED.some((l) => l.role === role && l.permission === permission);
}

export type PermissionMatrix = Record<string, Role[]>;

function defaults(): PermissionMatrix {
	return Object.fromEntries(Object.entries(DEFAULT_PERMISSIONS).map(([k, v]) => [k, [...v]]));
}

let current: PermissionMatrix = defaults();

/** Gültige Matrix setzen (Server beim Start, Browser beim Laden der Seite) */
export function setPermissionMatrix(matrix: PermissionMatrix | null | undefined) {
	current = matrix && Object.keys(matrix).length ? matrix : defaults();
	for (const { role, permission } of LOCKED) {
		const roles = current[permission] ?? (current[permission] = []);
		if (!roles.includes(role)) roles.push(role);
	}
}

export function permissionMatrix(): PermissionMatrix {
	return current;
}

export function can(role: Role | undefined | null, permission: Permission): boolean {
	if (!role) return false;
	return (current[permission] ?? []).includes(role);
}
