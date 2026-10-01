import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { findRal } from '$lib/ral';
import { generatePassword, hashPassword } from '../auth';
import { refreshAllSearchTexts, refreshSearchText, syncCodes } from '$lib/modules/lager/server/products';
import { db } from './index';
import { categories, colors, locations, movements, parties, products, settings, stock, users } from './schema';

const count = async (table: typeof users | typeof locations | typeof products | typeof categories) =>
	Number((await db.select({ n: sql<number>`count(*)` }).from(table).get())?.n ?? 0);

export async function bootstrap() {
	// Grund- und Demodaten nur bei einer brandneuen Installation – nach „Alles zurücksetzen“
	// bleibt die Datenbank bewusst leer, auch nach einem Neustart
	if ((await count(users)) === 0) {
		await createInitialAdmin();
		if ((await count(locations)) === 0 && (await count(categories)) === 0) {
			await seedLocations();
			await seedCatalog();
		}
		if (env.DEMO_DATA === 'true' && (await count(products)) === 0) await seedDemo();
	}
	await refreshSearchTextsIfOutdated();
}

async function createInitialAdmin() {
	const username = (env.INITIAL_ADMIN_USERNAME || 'admin').toLowerCase();
	const fromEnv = env.INITIAL_ADMIN_PASSWORD;
	const password = fromEnv || (dev ? 'admin1234' : generatePassword(14));
	await db.insert(users).values({
		username,
		email: env.INITIAL_ADMIN_EMAIL?.toLowerCase() || null,
		firstName: 'Admin',
		lastName: '',
		role: 'admin',
		// Der erste Admin ist Inhaber: nur er darf später Admins löschen oder herabstufen
		owner: true,
		passwordHash: await hashPassword(password),
		mustChangePassword: !dev
	});
	const line = '─'.repeat(58);
	console.info(
		`\n${line}\n  Erster Admin-Zugang angelegt\n  Benutzername: ${username}\n  Passwort:     ${fromEnv ? '(aus INITIAL_ADMIN_PASSWORD)' : password}\n  ${dev ? '' : 'Beim ersten Login muss das Passwort geändert werden.'}\n${line}\n`
	);
}

export const DEFAULT_CATEGORIES = [
	'Kaltplastik',
	'Heißplastik',
	'Farbe',
	'Markierungsband',
	'Glasperlen',
	'Härter',
	'Primer',
	'Reiniger & Verdünnung',
	'Sonstiges'
];

/** Verkehrsfarben nach RAL; Transparent hat keine RAL-Nummer */
export const DEFAULT_COLORS: [string, string | null][] = [
	['Weiß', '9016'],
	['Gelb', '1023'],
	['Rot', '3020'],
	['Blau', '5017'],
	['Grün', '6024'],
	['Orange', '2009'],
	['Grau', '7042'],
	['Schwarz', '9017'],
	['Transparent', null]
];

async function seedLocations() {
	const locs = ['Halle 1', 'Halle 2', 'WAP', 'Gas Kammerl', 'ADR Schrank 1–4'];
	for (const [i, name] of locs.entries()) await db.insert(locations).values({ name, sortOrder: i });
}

/** Standard-Materialarten und RAL-Verkehrsfarben (auch nach dem Zurücksetzen wählbar) */
export async function seedCatalog() {
	for (const [i, name] of DEFAULT_CATEGORIES.entries()) await db.insert(categories).values({ name, sortOrder: i });
	for (const [i, [name, ral]] of DEFAULT_COLORS.entries()) {
		await db.insert(colors).values({ name, ral, hex: findRal(ral)?.hex ?? '#D6DCE0', sortOrder: i });
	}
}

/** Suchtexte neu aufbauen, wenn sich ihr Aufbau geändert hat (z. B. RAL-Nummern dazu) */
const SEARCH_TEXT_VERSION = '2';

async function refreshSearchTextsIfOutdated() {
	const row = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'searchTextVersion')).get();
	if (row?.value === JSON.stringify(SEARCH_TEXT_VERSION)) return;
	await refreshAllSearchTexts();
	const value = JSON.stringify(SEARCH_TEXT_VERSION);
	await db.insert(settings).values({ key: 'searchTextVersion', value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/* ------------------------------------------------------------ Demodaten */

function prng(seed: number) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

interface DemoProduct {
	name: string;
	article?: string;
	codes?: { code: string; kind: 'ean' | 'sonstige' }[];
	manufacturer: string;
	category: string;
	color?: string;
	size: number;
	unit: string;
	min: number;
	target: number;
	/** Verbrauch in Stück pro Woche */
	usage: number;
	home: string;
}

const DEMO_PRODUCTS: DemoProduct[] = [
	{
		name: 'WASCHMITTEL ACETON',
		article: '366655',
		codes: [{ code: '9002445052683', kind: 'ean' }],
		manufacturer: 'Kansai Helios',
		category: 'Reiniger & Verdünnung',
		size: 30,
		unit: 'l',
		min: 3,
		target: 8,
		usage: 1.2,
		home: 'Gas Kammerl'
	},
	{
		name: 'REMO 2000 GELB KALTPLASTIK',
		article: '52298204',
		codes: [{ code: '9002445022150', kind: 'ean' }],
		manufacturer: 'Kansai Helios',
		category: 'Kaltplastik',
		color: 'Gelb',
		size: 10,
		unit: 'kg',
		min: 10,
		target: 30,
		usage: 4,
		home: 'Halle 1'
	},
	{
		name: 'REMO 2000 RADWEG GRÜN R6024 KALTPLASTIK',
		article: '52718305',
		codes: [{ code: '9002445985684', kind: 'ean' }],
		manufacturer: 'Kansai Helios',
		category: 'Kaltplastik',
		color: 'Grün',
		size: 15,
		unit: 'kg',
		min: 8,
		target: 24,
		usage: 2.5,
		home: 'Halle 1'
	},
	{
		name: '3M STAMARK 654 MARKIERUNGSBAND 150 MM',
		article: '7100010577',
		codes: [
			{ code: '53134375304967', kind: 'ean' },
			{ code: 'FS910022375', kind: 'sonstige' }
		],
		manufacturer: '3M',
		category: 'Markierungsband',
		size: 100,
		unit: 'm',
		min: 4,
		target: 12,
		usage: 1.5,
		home: 'Halle 2'
	},
	{ name: 'KALTPLASTIK WEISS (Demo)', manufacturer: 'Demo', category: 'Kaltplastik', color: 'Weiß', size: 25, unit: 'kg', min: 12, target: 40, usage: 6, home: 'Halle 1' },
	{ name: 'KALTPLASTIK ROT (Demo)', manufacturer: 'Demo', category: 'Kaltplastik', color: 'Rot', size: 25, unit: 'kg', min: 4, target: 12, usage: 1, home: 'Halle 1' },
	{ name: 'HÄRTER BPO PULVER (Demo)', manufacturer: 'Demo', category: 'Härter', size: 0.5, unit: 'kg', min: 20, target: 60, usage: 8, home: 'Halle 2' },
	{ name: 'GLASPERLEN NACHSTREUMITTEL (Demo)', manufacturer: 'Demo', category: 'Glasperlen', size: 25, unit: 'kg', min: 10, target: 30, usage: 4, home: 'WAP' },
	{ name: 'STRASSENMARKIERUNGSFARBE WEISS (Demo)', manufacturer: 'Demo', category: 'Farbe', color: 'Weiß', size: 25, unit: 'kg', min: 6, target: 20, usage: 2, home: 'Halle 2' },
	{ name: 'PRIMER BETON (Demo)', manufacturer: 'Demo', category: 'Primer', size: 10, unit: 'l', min: 2, target: 6, usage: 0.6, home: 'ADR Schrank 1–4' },
	{ name: 'VERDÜNNUNG (Demo)', manufacturer: 'Demo', category: 'Reiniger & Verdünnung', size: 10, unit: 'l', min: 3, target: 10, usage: 1, home: 'ADR Schrank 1–4' },
	{ name: 'MARKIERUNGSBAND GELB 100 MM (Demo)', manufacturer: 'Demo', category: 'Markierungsband', color: 'Gelb', size: 50, unit: 'm', min: 5, target: 15, usage: 1.2, home: 'Halle 2' }
];

async function seedDemo() {
	console.info('[seed] Lege Demodaten an …');
	const rand = prng(20260918);
	const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];

	const catRows = await db.select().from(categories).all();
	const colorRows = await db.select().from(colors).all();
	const locRows = await db.select().from(locations).all();
	const locId = (name: string) => locRows.find((l) => l.name === name)!.id;

	const partyIds: number[] = [];
	for (const name of ['Partie Nord', 'Partie Süd', 'Partie Wien', 'Werkstatt']) {
		partyIds.push((await db.insert(parties).values({ name, kind: 'gruppe' }).returning().get()).id);
	}

	const demoPw = await hashPassword('demo1234');
	const lager = await db
		.insert(users)
		.values({ username: 'bauleiter', firstName: 'Bernd', lastName: 'Bauleiter', role: 'bauleiter', passwordHash: demoPw })
		.returning()
		.get();
	const fahrer = await db
		.insert(users)
		.values({ username: 'partie', firstName: 'Petra', lastName: 'Partieführer', role: 'partiefuehrer', partyId: partyIds[0], passwordHash: demoPw })
		.returning()
		.get();
	await db
		.insert(users)
		.values({ username: 'arbeiter', firstName: 'Anton', lastName: 'Arbeiter', role: 'arbeiter', partyId: partyIds[0], passwordHash: demoPw });
	await db.insert(users).values({ username: 'buero', firstName: 'Bea', lastName: 'Büro', role: 'viewer', passwordHash: demoPw });

	const DAY = 86_400_000;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const start = today.getTime() - 182 * DAY;

	type Mv = typeof movements.$inferInsert;
	const moves: Mv[] = [];
	const stockMap = new Map<string, number>();
	const key = (p: number, l: number) => `${p}:${l}`;
	const qty = (p: number, l: number) => stockMap.get(key(p, l)) ?? 0;
	const add = (p: number, l: number, d: number) => stockMap.set(key(p, l), qty(p, l) + d);
	const at = (day: number) => new Date(start + day * DAY + (6 + rand() * 10) * 3_600_000);

	const created: { id: number; d: DemoProduct }[] = [];
	for (const d of DEMO_PRODUCTS) {
		const p = await db
			.insert(products)
			.values({
				name: d.name,
				articleNumber: d.article ?? null,
				manufacturer: d.manufacturer,
				categoryId: catRows.find((c) => c.name === d.category)?.id ?? null,
				colorId: d.color ? (colorRows.find((c) => c.name === d.color)?.id ?? null) : null,
				packageSize: d.size,
				unit: d.unit,
				minStock: d.min,
				targetStock: d.target
			})
			.returning()
			.get();
		await db.transaction((tx) => syncCodes(tx, p.id, d.article ?? null, d.codes ?? []));
		await refreshSearchText(db, p.id);
		created.push({ id: p.id, d });
	}

	for (const { id, d } of created) {
		const home = locId(d.home);
		const pending: { day: number; q: number }[] = [];
		const first = Math.round(d.target * 1.2);
		moves.push({ batchId: randomUUID(), type: 'IN', productId: id, quantity: first, toLocationId: home, userId: lager.id, createdAt: at(0) });
		add(id, home, first);
		for (let day = 1; day < 182; day++) {
			const wd = new Date(start + day * DAY).getDay();
			if (wd === 0 || wd === 6) continue;
			for (const o of pending.filter((o) => o.day === day)) {
				moves.push({ batchId: randomUUID(), type: 'IN', productId: id, quantity: o.q, toLocationId: home, userId: lager.id, note: 'Lieferung', createdAt: at(day) });
				add(id, home, o.q);
			}
			const season = 0.6 + 0.8 * Math.sin(((day + 40) / 182) * Math.PI);
			if (rand() < (d.usage * season) / 5) {
				const q = 1 + Math.floor(rand() * Math.min(3, Math.max(1, d.usage)));
				const from = qty(id, home) >= q ? home : [...stockMap.entries()].find(([k, v]) => k.startsWith(`${id}:`) && v >= q)?.[0];
				const fromId = typeof from === 'number' ? from : from ? Number(from.split(':')[1]) : null;
				if (fromId) {
					const booker = pick([fahrer.id, lager.id, fahrer.id]);
					// Der Bauleiter gehört zu keiner Partie – er bucht meist auf sich selbst
					const toSelf = booker === lager.id && rand() < 0.7;
					moves.push({ batchId: randomUUID(), type: 'OUT', productId: id, quantity: q, fromLocationId: fromId, partyId: toSelf ? null : pick(partyIds), recipientUserId: toSelf ? booker : null, userId: booker, createdAt: at(day) });
					add(id, fromId, -q);
					if (rand() < 0.06) {
						moves.push({ batchId: randomUUID(), type: 'RETURN', productId: id, quantity: 1, toLocationId: home, partyId: pick(partyIds), userId: fahrer.id, createdAt: at(day + 1) });
						add(id, home, 1);
					}
				}
			}
			if (rand() < 0.012 && qty(id, home) > 4) {
				const other = pick(locRows.filter((l) => l.id !== home)).id;
				moves.push({ batchId: randomUUID(), type: 'TRANSFER', productId: id, quantity: 2, fromLocationId: home, toLocationId: other, userId: lager.id, createdAt: at(day) });
				add(id, home, -2);
				add(id, other, 2);
			}
			const total = [...stockMap.entries()].filter(([k]) => k.startsWith(`${id}:`)).reduce((s, [, v]) => s + v, 0);
			if (total <= d.min && !pending.some((o) => o.day > day) && day < 170) {
				pending.push({ day: day + 3 + Math.floor(rand() * 4), q: d.target - total });
			}
		}
	}

	// Zwei Artikel sichtbar unter Mindestbestand bringen
	for (const name of ['WASCHMITTEL ACETON', 'REMO 2000 RADWEG GRÜN R6024 KALTPLASTIK']) {
		const { id, d } = created.find((c) => c.d.name === name)!;
		const home = locId(d.home);
		const total = [...stockMap.entries()].filter(([k]) => k.startsWith(`${id}:`)).reduce((s, [, v]) => s + v, 0);
		const target = Math.max(0, d.min - 1);
		const take = Math.min(qty(id, home), total - target);
		if (take > 0) {
			moves.push({ batchId: randomUUID(), type: 'OUT', productId: id, quantity: take, fromLocationId: home, partyId: partyIds[0], userId: fahrer.id, createdAt: new Date(Date.now() - 2 * 3_600_000) });
			add(id, home, -take);
		}
	}

	moves.sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
	for (let i = 0; i < moves.length; i += 200) await db.insert(movements).values(moves.slice(i, i + 200));
	for (const [k, v] of stockMap) {
		if (v === 0) continue;
		const [productId, locationId] = k.split(':').map(Number);
		await db.insert(stock).values({ productId, locationId, quantity: v, updatedAt: new Date() });
	}
	console.info(`[seed] ${created.length} Artikel, ${moves.length} Bewegungen, Demo-Benutzer bauleiter/partie/arbeiter/buero (Passwort demo1234)`);
}
