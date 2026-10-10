import { describe, expect, it } from 'vitest';
import { mayReceive, NOTIFICATION_EVENT_KEYS, NOTIFICATION_EVENTS, eventSections, type NotificationEventDef } from './notifications';
import { DEFAULT_PERMISSIONS, PERMISSIONS, ROLES, type Permission, type Role } from './permissions';

const defaults = (role: Role, p: Permission) => (DEFAULT_PERMISSIONS[p] as readonly Role[]).includes(role);

describe('Katalog', () => {
	it('verweist nur auf vorhandene Rechte und Gruppen', () => {
		for (const key of NOTIFICATION_EVENT_KEYS) {
			const d: NotificationEventDef = NOTIFICATION_EVENTS[key];
			expect(PERMISSIONS).toContain(d.requires);
			if (d.all) expect(PERMISSIONS).toContain(d.all);
			for (const r of d.defaults) expect(ROLES).toContain(r);
		}
	});

	it('gibt jede Vorgabe nur an Gruppen, die es auch sehen dürfen', () => {
		for (const key of NOTIFICATION_EVENT_KEYS) {
			const d: NotificationEventDef = NOTIFICATION_EVENTS[key];
			for (const r of d.defaults) expect(defaults(r, d.requires), `${key} → ${r}`).toBe(true);
		}
	});

	it('teilt alle Ereignisse in Abschnitte', () => {
		expect(eventSections().flatMap(([, e]) => e)).toEqual(NOTIFICATION_EVENT_KEYS);
	});
});

describe('mayReceive', () => {
	const pf = { id: 1, role: 'partiefuehrer' as const, partyId: 2 };
	const bl = { id: 2, role: 'bauleiter' as const, partyId: null };

	it('Partie-Ereignis: Partieführer nur für die eigene Partie', () => {
		expect(mayReceive(pf, 'auftrag.zugeordnet', 2, defaults)).toBe(true);
		expect(mayReceive(pf, 'auftrag.zugeordnet', 3, defaults)).toBe(false);
		expect(mayReceive(pf, 'auftrag.zugeordnet', null, defaults)).toBe(false);
	});

	it('wer alle sieht, bekommt es für jede Partie', () => {
		expect(mayReceive(bl, 'auftrag.zugeordnet', 3, defaults)).toBe(true);
	});

	it('ohne Recht zum Sehen kommt nichts an', () => {
		expect(mayReceive(pf, 'angebot.angenommen', null, defaults)).toBe(false);
		expect(mayReceive(bl, 'angebot.angenommen', null, defaults)).toBe(true);
	});
});
