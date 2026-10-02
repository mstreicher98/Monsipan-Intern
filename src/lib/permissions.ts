/**
 * Rollen und Rechte.
 *
 * Im Code stehen die Standardrechte (DEFAULT_PERMISSIONS). Was tatsächlich gilt,
 * verwaltet der Admin unter Benutzer → Berechtigungen; diese Matrix liegt in der
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
	geschaeftsfuehrer: 'Sieht und prüft alles – Lager, Stunden, Tagesberichte, Berichte; Benutzer und Einstellungen bleiben beim Admin',
	bauleiter: 'Buchen, Inventur, Korrekturen, Artikel und Stammdaten pflegen, Berichte, Stunden und Tagesberichte',
	buchhaltung: 'Stundenzettel prüfen, Tagesberichte und Auswertungen einsehen, Stammdaten pflegen – ohne Lagerbuchungen',
	partiefuehrer: 'Bestand und Bewegungen ansehen, buchen, Stundenzettel und Tagesberichte der eigenen Partie',
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

/**
 * Standardrechte je Bereich. Ein neuer Bereich ergänzt nur seinen eigenen Block;
 * fehlende Einträge werden beim Start aus dieser Tabelle in die Datenbank übernommen.
 * Der Geschäftsführer hat von Haus aus alles, was Bauleitung oder Buchhaltung haben.
 */
export const DEFAULT_PERMISSIONS = {
	// Lager
	'lager.stock.book': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer', 'arbeiter'],
	'lager.stock.inventory': ['admin', 'geschaeftsfuehrer', 'bauleiter'],
	'lager.movements.view': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'partiefuehrer', 'viewer'],
	'lager.movements.correct': ['admin', 'geschaeftsfuehrer', 'bauleiter'],
	'lager.products.manage': ['admin', 'geschaeftsfuehrer', 'bauleiter'],
	'lager.reports.view': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],
	'lager.alerts.view': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],

	// Stundenzettel
	'stunden.erfassen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'stunden.freigeben': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'stunden.pruefen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'],
	// Status zurücksetzen – die Unterschriften verfallen dabei
	'stunden.oeffnen.freigegeben': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'],
	'stunden.oeffnen.geprueft': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'],
	'stunden.pruefung.zuruecknehmen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'],
	// Ohne diese beiden Rechte sieht und bearbeitet man nur die eigene Partie
	'stunden.alle.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'],
	'stunden.alle.bearbeiten': ['admin', 'geschaeftsfuehrer', 'bauleiter'],
	// Arbeiter einer anderen Partie für eine Woche übernehmen
	'stunden.aushilfe': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],

	// Tagesberichte
	'tagesberichte.erfassen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'partiefuehrer'],
	'tagesberichte.abschliessen': ['admin', 'geschaeftsfuehrer', 'bauleiter'],
	'tagesberichte.alle.sehen': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung', 'viewer'],

	// Verwaltung
	'verwaltung.masterdata.manage': ['admin', 'geschaeftsfuehrer', 'bauleiter', 'buchhaltung'],
	'verwaltung.users.manage': ['admin'],
	'verwaltung.permissions.manage': ['admin'],
	'verwaltung.settings.manage': ['admin']
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof DEFAULT_PERMISSIONS;

export const PERMISSIONS = Object.keys(DEFAULT_PERMISSIONS) as Permission[];

/** Beschriftung in der Rechteverwaltung, nach Bereichen gruppiert */
export const PERMISSION_GROUPS: { title: string; items: { key: Permission; label: string; hint?: string }[] }[] = [
	{
		title: 'Lager',
		items: [
			{ key: 'lager.stock.book', label: 'Buchen', hint: 'Ein-, Aus- und Umbuchen, Rückgaben' },
			{ key: 'lager.stock.inventory', label: 'Inventur' },
			{ key: 'lager.movements.view', label: 'Bewegungen ansehen' },
			{ key: 'lager.movements.correct', label: 'Buchungen korrigieren', hint: 'Stornieren und neu buchen' },
			{ key: 'lager.products.manage', label: 'Artikel pflegen', hint: 'Anlegen, ändern, Codes und PDFs' },
			{ key: 'lager.reports.view', label: 'Berichte und Bestellliste' },
			{ key: 'lager.alerts.view', label: 'Warnungen sehen', hint: 'Hinweis auf Mindestbestand' }
		]
	},
	{
		title: 'Stundenzettel',
		items: [
			{ key: 'stunden.erfassen', label: 'Erfassen', hint: 'Wochen der eigenen Partie ausfüllen' },
			{ key: 'stunden.freigeben', label: 'Freigeben', hint: 'Woche unterschreiben und einreichen' },
			{ key: 'stunden.pruefen', label: 'Prüfen', hint: 'Geprüft-Haken setzen, Auslöse bestätigen' },
			{
				key: 'stunden.oeffnen.freigegeben',
				label: 'Freigegebene wieder öffnen',
				hint: 'Woche wieder änderbar machen – die Unterschrift der Freigabe verfällt'
			},
			{
				key: 'stunden.oeffnen.geprueft',
				label: 'Geprüfte wieder öffnen',
				hint: 'Woche wieder änderbar machen – beide Unterschriften verfallen'
			},
			{
				key: 'stunden.pruefung.zuruecknehmen',
				label: 'Zurück auf freigegeben',
				hint: 'Prüfung zurücknehmen – die Freigabe samt Unterschrift bleibt'
			},
			{ key: 'stunden.alle.sehen', label: 'Andere Partien ansehen', hint: 'Zettel aller Partien lesen' },
			{ key: 'stunden.alle.bearbeiten', label: 'Andere Partien bearbeiten', hint: 'Zettel aller Partien ausfüllen und freigeben' },
			{
				key: 'stunden.aushilfe',
				label: 'Aushilfen übernehmen',
				hint: 'Arbeiter einer anderen Partie für eine Woche übernehmen und seinen Zettel schreiben'
			}
		]
	},
	{
		title: 'Tagesberichte',
		items: [
			{ key: 'tagesberichte.erfassen', label: 'Erfassen' },
			{ key: 'tagesberichte.abschliessen', label: 'Abschließen', hint: 'Bericht festschreiben' },
			{ key: 'tagesberichte.alle.sehen', label: 'Alle sehen' }
		]
	},
	{
		title: 'Verwaltung',
		items: [
			{ key: 'verwaltung.masterdata.manage', label: 'Stammdaten pflegen' },
			{ key: 'verwaltung.users.manage', label: 'Benutzer verwalten' },
			{ key: 'verwaltung.permissions.manage', label: 'Berechtigungen ändern' },
			{ key: 'verwaltung.settings.manage', label: 'Einstellungen' }
		]
	}
];

/**
 * Rechte, die dem Admin nicht genommen werden können – sonst sperrt sich die
 * Firma aus der Benutzer- und Rechteverwaltung aus.
 */
export const LOCKED: { role: Role; permission: Permission }[] = [
	{ role: 'admin', permission: 'verwaltung.users.manage' },
	{ role: 'admin', permission: 'verwaltung.permissions.manage' },
	{ role: 'admin', permission: 'verwaltung.settings.manage' }
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
