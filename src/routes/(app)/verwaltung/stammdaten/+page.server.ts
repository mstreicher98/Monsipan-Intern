import { fail } from '@sveltejs/kit';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categories, colors, locations, movements, parties, products, stock, users } from '$lib/server/db/schema';
import { col } from '$lib/server/db/sql';
import { intOrNull, requirePermission, str } from '$lib/server/guard';
import { refreshAllSearchTexts } from '$lib/modules/lager/server/products';
import { findRal } from '$lib/ral';
import type { Actions, PageServerLoad } from './$types';

const ENTITIES = ['orte', 'partien', 'materialarten', 'farben'] as const;
type Entity = (typeof ENTITIES)[number];

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:stock');
	requirePermission(locals, 'verwaltung.masterdata.manage');
	const tab = (ENTITIES as readonly string[]).includes(url.searchParams.get('tab') ?? '') ? (url.searchParams.get('tab') as Entity) : 'orte';

	const [locs, partyRows, cats, cols] = await Promise.all([
		db
			.select({
				id: locations.id,
				name: locations.name,
				description: locations.description,
				active: locations.active,
				sortOrder: locations.sortOrder,
				units: sql<number>`coalesce((select sum(${col(stock.quantity)}) from ${stock} where ${col(stock.locationId)} = ${col(locations.id)}), 0)`.mapWith(Number),
				articles: sql<number>`(select count(*) from ${stock} where ${col(stock.locationId)} = ${col(locations.id)} and ${col(stock.quantity)} > 0)`.mapWith(Number),
				moves: sql<number>`(select count(*) from ${movements} where ${col(movements.fromLocationId)} = ${col(locations.id)} or ${col(movements.toLocationId)} = ${col(locations.id)})`.mapWith(Number)
			})
			.from(locations)
			.orderBy(asc(locations.sortOrder), asc(locations.name))
			.all(),
		db
			.select({
				id: parties.id,
				name: parties.name,
				kind: parties.kind,
				note: parties.note,
				active: parties.active,
				moves: sql<number>`(select count(*) from ${movements} where ${col(movements.partyId)} = ${col(parties.id)})`.mapWith(Number),
				members: sql<number>`(select count(*) from ${users} where ${col(users.partyId)} = ${col(parties.id)} and ${col(users.active)} = 1)`.mapWith(Number)
			})
			.from(parties)
			.orderBy(asc(parties.name))
			.all(),
		db
			.select({
				id: categories.id,
				name: categories.name,
				sortOrder: categories.sortOrder,
				products: sql<number>`(select count(*) from ${products} where ${col(products.categoryId)} = ${col(categories.id)})`.mapWith(Number)
			})
			.from(categories)
			.orderBy(asc(categories.sortOrder), asc(categories.name))
			.all(),
		db
			.select({
				id: colors.id,
				name: colors.name,
				ral: colors.ral,
				hex: colors.hex,
				sortOrder: colors.sortOrder,
				products: sql<number>`(select count(*) from ${products} where ${col(products.colorId)} = ${col(colors.id)})`.mapWith(Number)
			})
			.from(colors)
			.orderBy(asc(colors.sortOrder), asc(colors.name))
			.all()
	]);
	return { tab, locations: locs, parties: partyRows, categories: cats, colors: cols };
};

function isUniqueError(err: unknown) {
	return String((err as Error)?.message ?? '').includes('UNIQUE');
}

/** Partieführer und Arbeiter brauchen ihre Partie – solange welche zugeordnet sind, bleibt sie aktiv */
async function partyMembers(partyId: number): Promise<string | null> {
	const members = await db
		.select({ firstName: users.firstName, lastName: users.lastName, username: users.username })
		.from(users)
		.where(and(eq(users.partyId, partyId), eq(users.active, true)))
		.all();
	if (!members.length) return null;
	const names = members.map((m) => [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username).join(', ');
	return `Dieser Partie sind noch Benutzer zugeordnet (${names}). Bitte sie zuerst unter Benutzer einer anderen Partie zuordnen.`;
}

async function nextSort(table: typeof locations | typeof categories | typeof colors) {
	const row = await db.select({ m: sql<number>`coalesce(max(${table.sortOrder}), -1)` }).from(table).get();
	return Number(row?.m ?? -1) + 1;
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requirePermission(locals, 'verwaltung.masterdata.manage');
		const f = await request.formData();
		const entity = String(f.get('entity')) as Entity;
		const id = intOrNull(f.get('id'));
		const name = str(f.get('name'), 80);
		if (!name) return fail(400, { entity, message: 'Bitte einen Namen eingeben.' });
		try {
			switch (entity) {
				case 'orte': {
					const values = { name, description: str(f.get('description'), 200) };
					if (id) await db.update(locations).set(values).where(eq(locations.id, id));
					else await db.insert(locations).values({ ...values, sortOrder: await nextSort(locations) });
					break;
				}
				case 'partien': {
					const values = { name, kind: 'gruppe', note: str(f.get('note'), 200) } as const;
					if (id) await db.update(parties).set(values).where(eq(parties.id, id));
					else await db.insert(parties).values(values);
					break;
				}
				case 'materialarten': {
					if (id) await db.update(categories).set({ name }).where(eq(categories.id, id));
					else await db.insert(categories).values({ name, sortOrder: await nextSort(categories) });
					if (id) await refreshAllSearchTexts();
					break;
				}
				case 'farben': {
					// RAL-Nummer optional; ohne eigenes Farbmuster gilt der RAL-Farbton
					const ralInput = str(f.get('ral'), 12).replace(/^ral\s*/i, '');
					if (ralInput && !/^\d{4}$/.test(ralInput)) {
						return fail(400, { entity, message: 'Die RAL-Nummer hat vier Ziffern, z. B. 6024.' });
					}
					const ral = ralInput || null;
					const hexInput = String(f.get('hex') ?? '');
					const hex = /^#[0-9a-f]{6}$/i.test(hexInput) ? hexInput.toUpperCase() : (findRal(ral)?.hex ?? '#9AA0A6');
					if (id) await db.update(colors).set({ name, ral, hex }).where(eq(colors.id, id));
					else await db.insert(colors).values({ name, ral, hex, sortOrder: await nextSort(colors) });
					if (id) await refreshAllSearchTexts();
					break;
				}
				default:
					return fail(400, { message: 'Unbekannter Bereich' });
			}
		} catch (err) {
			if (isUniqueError(err)) return fail(400, { entity, message: `„${name}“ gibt es schon.` });
			throw err;
		}
		return { saved: entity };
	},

	toggle: async ({ request, locals }) => {
		requirePermission(locals, 'verwaltung.masterdata.manage');
		const f = await request.formData();
		const entity = String(f.get('entity')) as Entity;
		const id = intOrNull(f.get('id'));
		const active = f.get('active') === 'true';
		if (!id) return fail(400, { message: 'Eintrag fehlt' });
		if (entity === 'orte') {
			if (!active) {
				const units = await db.select({ n: sql<number>`coalesce(sum(${stock.quantity}), 0)` }).from(stock).where(eq(stock.locationId, id)).get();
				if (Number(units?.n ?? 0) > 0) {
					return fail(400, { entity, message: 'An diesem Lagerort liegt noch Ware. Bitte zuerst umlagern oder ausbuchen.' });
				}
			}
			await db.update(locations).set({ active }).where(eq(locations.id, id));
		} else if (entity === 'partien') {
			if (!active) {
				const blocked = await partyMembers(id);
				if (blocked) return fail(400, { entity, message: blocked });
			}
			await db.update(parties).set({ active }).where(eq(parties.id, id));
		}
		return { toggled: id };
	},

	delete: async ({ request, locals }) => {
		requirePermission(locals, 'verwaltung.masterdata.manage');
		const f = await request.formData();
		const entity = String(f.get('entity')) as Entity;
		const id = intOrNull(f.get('id'));
		if (!id) return fail(400, { message: 'Eintrag fehlt' });
		switch (entity) {
			case 'orte': {
				const used = await db
					.select({ n: sql<number>`count(*)` })
					.from(movements)
					.where(or(eq(movements.fromLocationId, id), eq(movements.toLocationId, id)))
					.get();
				const units = await db.select({ n: sql<number>`count(*)` }).from(stock).where(eq(stock.locationId, id)).get();
				if (Number(used?.n) > 0 || Number(units?.n) > 0) {
					return fail(400, { entity, message: 'Der Lagerort hat Buchungen und bleibt für die Historie erhalten. Deaktiviere ihn stattdessen.' });
				}
				await db.delete(locations).where(eq(locations.id, id));
				break;
			}
			case 'partien': {
				const blocked = await partyMembers(id);
				if (blocked) return fail(400, { entity, message: blocked });
				const used = await db.select({ n: sql<number>`count(*)` }).from(movements).where(eq(movements.partyId, id)).get();
				if (Number(used?.n) > 0) {
					return fail(400, { entity, message: 'Diese Partie hat Buchungen. Deaktiviere sie stattdessen.' });
				}
				await db.delete(parties).where(eq(parties.id, id));
				break;
			}
			case 'materialarten':
				await db.delete(categories).where(eq(categories.id, id));
				await refreshAllSearchTexts();
				break;
			case 'farben':
				await db.delete(colors).where(eq(colors.id, id));
				await refreshAllSearchTexts();
				break;
		}
		return { deleted: id };
	},

	move: async ({ request, locals }) => {
		requirePermission(locals, 'verwaltung.masterdata.manage');
		const f = await request.formData();
		const entity = String(f.get('entity')) as Entity;
		const id = intOrNull(f.get('id'));
		const dir = f.get('dir') === 'up' ? -1 : 1;
		const table = entity === 'orte' ? locations : entity === 'materialarten' ? categories : entity === 'farben' ? colors : null;
		if (!table || !id) return fail(400, { message: 'Nicht sortierbar' });
		const list = await db.select({ id: table.id }).from(table).orderBy(asc(table.sortOrder), asc(table.name)).all();
		const i = list.findIndex((r) => r.id === id);
		const j = i + dir;
		if (i < 0 || j < 0 || j >= list.length) return { moved: id };
		[list[i], list[j]] = [list[j], list[i]];
		await db.transaction(async (tx) => {
			for (const [idx, r] of list.entries()) await tx.update(table).set({ sortOrder: idx }).where(eq(table.id, r.id));
		});
		return { moved: id };
	}
};
