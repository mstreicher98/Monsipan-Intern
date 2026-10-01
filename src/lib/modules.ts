/**
 * Die Bereiche von Monsipan Intern an einer Stelle: Reihenfolge, Beschriftung,
 * Symbol, Einstiegsseite und nötiges Recht. Navigation und Übersicht bauen sich
 * daraus auf – ein neuer Bereich braucht nur einen Eintrag hier.
 *
 * `status: 'geplant'` heißt: noch nicht gebaut, taucht nirgends auf. Sobald der
 * Bereich fertig ist, wird daraus 'aktiv'.
 */
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import HardHat from '@lucide/svelte/icons/hard-hat';
import CalendarDays from '@lucide/svelte/icons/calendar-days';
import Users from '@lucide/svelte/icons/users';
import Clock from '@lucide/svelte/icons/clock';
import NotebookPen from '@lucide/svelte/icons/notebook-pen';
import Boxes from '@lucide/svelte/icons/boxes';
import ScanLine from '@lucide/svelte/icons/scan-line';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import ClipboardList from '@lucide/svelte/icons/clipboard-list';
import ChartColumn from '@lucide/svelte/icons/chart-column';
import ChartPie from '@lucide/svelte/icons/chart-pie';
import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
import FolderOpen from '@lucide/svelte/icons/folder-open';
import UserCog from '@lucide/svelte/icons/user-cog';
import Settings from '@lucide/svelte/icons/settings';
import Database from '@lucide/svelte/icons/database';
import type { Component } from 'svelte';
import { can, type Permission, type Role } from './permissions';

export interface NavItem {
	href: string;
	label: string;
	icon: Component;
	permission?: Permission;
	badge?: 'lowStock';
}

/** Grobe Gliederung für die Seitenleiste, sobald mehrere Bereiche aktiv sind */
export type ModuleGroup = 'betrieb' | 'material' | 'ablage' | 'verwaltung';

export interface AppModule {
	key: string;
	label: string;
	icon: Component;
	/** Einstiegsseite des Bereichs */
	href: string;
	group: ModuleGroup;
	status: 'aktiv' | 'geplant';
	/** Recht für den ganzen Bereich; ohne Angabe entscheiden die Unterseiten */
	permission?: Permission;
	/** Eine Zeile für die Karte auf der Übersicht */
	hint?: string;
	items: NavItem[];
}

export const MODULES: AppModule[] = [
	{ key: 'dashboard', label: 'Übersicht', icon: LayoutDashboard, href: '/', group: 'betrieb', status: 'aktiv', items: [] },
	{ key: 'auftraege', label: 'Aufträge', icon: HardHat, href: '/auftraege', group: 'betrieb', status: 'geplant', items: [] },
	{ key: 'planung', label: 'Planung', icon: CalendarDays, href: '/planung', group: 'betrieb', status: 'geplant', items: [] },
	{ key: 'partien', label: 'Partien', icon: Users, href: '/partien', group: 'betrieb', status: 'geplant', items: [] },
	{ key: 'stunden', label: 'Stundenzettel', icon: Clock, href: '/stundenzettel', group: 'betrieb', status: 'geplant', items: [] },
	{ key: 'tagesberichte', label: 'Tagesberichte', icon: NotebookPen, href: '/tagesberichte', group: 'betrieb', status: 'geplant', items: [] },
	{
		key: 'lager',
		label: 'Lager',
		icon: Boxes,
		href: '/lager/bestand',
		group: 'material',
		status: 'aktiv',
		hint: 'Bestand, Buchen, Bestellliste',
		items: [
			{ href: '/lager/bestand', label: 'Bestand', icon: Boxes },
			{ href: '/lager/buchen', label: 'Buchen', icon: ScanLine, permission: 'lager.stock.book' },
			{ href: '/lager/bewegungen', label: 'Bewegungen', icon: ArrowLeftRight, permission: 'lager.movements.view' },
			{ href: '/lager/bestellliste', label: 'Bestellliste', icon: ClipboardList, permission: 'lager.reports.view', badge: 'lowStock' },
			{ href: '/lager/berichte', label: 'Berichte', icon: ChartColumn, permission: 'lager.reports.view' }
		]
	},
	{ key: 'bestellungen', label: 'Bestellungen', icon: ShoppingCart, href: '/bestellungen', group: 'material', status: 'geplant', items: [] },
	{ key: 'dokumente', label: 'Dokumente', icon: FolderOpen, href: '/dokumente', group: 'ablage', status: 'geplant', items: [] },
	{ key: 'auswertungen', label: 'Auswertungen', icon: ChartPie, href: '/auswertungen', group: 'ablage', status: 'geplant', items: [] },
	{
		key: 'benutzer',
		label: 'Benutzer',
		icon: UserCog,
		href: '/verwaltung/benutzer',
		group: 'verwaltung',
		status: 'aktiv',
		permission: 'verwaltung.users.manage',
		hint: 'Zugänge, Rollen und Partien',
		items: []
	},
	{
		key: 'administration',
		label: 'Administration',
		icon: Settings,
		href: '/verwaltung',
		group: 'verwaltung',
		status: 'aktiv',
		hint: 'Stammdaten, Einstellungen, Sicherungen',
		items: [
			{ href: '/verwaltung/stammdaten', label: 'Stammdaten', icon: Database, permission: 'verwaltung.masterdata.manage' },
			{ href: '/verwaltung/einstellungen', label: 'Einstellungen', icon: Settings, permission: 'verwaltung.settings.manage' }
		]
	}
];

export const GROUP_LABELS: Record<ModuleGroup, string> = {
	betrieb: 'Betrieb',
	material: 'Material',
	ablage: 'Ablage',
	verwaltung: 'Verwaltung'
};

export function moduleByKey(key: string): AppModule | undefined {
	return MODULES.find((m) => m.key === key);
}
