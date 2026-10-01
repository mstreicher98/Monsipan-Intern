/**
 * Navigation aus der Bereichs-Registry: Seitenleiste, Handy-Leiste und „Mehr".
 * Welche Bereiche es gibt, steht in modules.ts – hier steht nur, wie sie je
 * nach Rolle gefiltert werden.
 */
import { MODULES, type AppModule, type NavItem } from './modules';
import { can, type Role } from './permissions';

export type { NavItem, AppModule };

export function visible(items: NavItem[], role: Role): NavItem[] {
	return items.filter((i) => !i.permission || can(role, i.permission));
}

/** Gebaute und für diese Rolle erlaubte Bereiche, Unterseiten schon gefiltert */
export function visibleModules(role: Role): AppModule[] {
	const out: AppModule[] = [];
	for (const m of MODULES) {
		if (m.status !== 'aktiv') continue;
		if (m.permission && !can(role, m.permission)) continue;
		const items = visible(m.items, role);
		// Ein Bereich mit Unterseiten verschwindet, wenn davon nichts erlaubt ist
		if (m.items.length && !items.length) continue;
		out.push({ ...m, items });
	}
	return out;
}

/** Alle erreichbaren Einträge am Stück – für das Menü „Mehr" am Handy */
export function allNavItems(role: Role): NavItem[] {
	const out: NavItem[] = [];
	for (const m of visibleModules(role)) {
		if (m.items.length) out.push(...m.items);
		else out.push({ href: m.href, label: m.label, icon: m.icon });
	}
	return out;
}

/** Rechter Reiter der Handy-Leiste: Bewegungen, ohne Einblick in Bewegungen stattdessen Buchen */
export function bottomRightTab(role: Role): NavItem | null {
	const lager = MODULES.find((m) => m.key === 'lager')!;
	if (can(role, 'lager.movements.view')) return lager.items.find((i) => i.href === '/lager/bewegungen')!;
	if (can(role, 'lager.stock.book')) return lager.items.find((i) => i.href === '/lager/buchen')!;
	return null;
}

export function isActive(href: string, pathname: string) {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(`${href}/`);
}
