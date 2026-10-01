import { and, desc, eq, gte, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db } from '$lib/server/db';
import { categories, colors, locations, movements, parties, products, users, type MovementType } from '$lib/server/db/schema';

const fromLoc = alias(locations, 'from_loc');
const toLoc = alias(locations, 'to_loc');
const canceller = alias(users, 'canceller');
const recipient = alias(users, 'recipient');

export interface MovementFilter {
	from?: Date | null;
	to?: Date | null;
	types?: MovementType[];
	locationId?: number | null;
	partyId?: number | null;
	userId?: number | null;
	productId?: number | null;
	includeCancelled?: boolean;
	/** Artikel-Freitextsuche (bereits als Bedingung auf products) */
	productCondition?: SQL;
}

export function movementConditions(f: MovementFilter): SQL | undefined {
	const c: (SQL | undefined)[] = [];
	if (f.from) c.push(gte(movements.createdAt, f.from));
	if (f.to) c.push(lt(movements.createdAt, f.to));
	if (f.types?.length) c.push(inArray(movements.type, f.types));
	if (f.locationId)
		c.push(sql`(${movements.fromLocationId} = ${f.locationId} OR ${movements.toLocationId} = ${f.locationId})`);
	if (f.partyId) c.push(eq(movements.partyId, f.partyId));
	if (f.userId) c.push(eq(movements.userId, f.userId));
	if (f.productId) c.push(eq(movements.productId, f.productId));
	if (f.productCondition) c.push(inArray(movements.productId, db.select({ id: products.id }).from(products).where(f.productCondition)));
	if (!f.includeCancelled) c.push(isNull(movements.cancelledAt));
	return c.length ? and(...c) : undefined;
}

export async function listMovements(f: MovementFilter, limit = 50, offset = 0) {
	return db
		.select({
			id: movements.id,
			batchId: movements.batchId,
			type: movements.type,
			quantity: movements.quantity,
			countedQuantity: movements.countedQuantity,
			previousQuantity: movements.previousQuantity,
			note: movements.note,
			createdAt: movements.createdAt,
			cancelledAt: movements.cancelledAt,
			cancelReason: movements.cancelReason,
			correctionOf: movements.correctionOf,
			productId: movements.productId,
			productName: products.name,
			articleNumber: products.articleNumber,
			packageSize: products.packageSize,
			unit: products.unit,
			categoryName: categories.name,
			colorHex: colors.hex,
			fromLocationId: movements.fromLocationId,
			fromLocation: fromLoc.name,
			toLocationId: movements.toLocationId,
			toLocation: toLoc.name,
			partyId: movements.partyId,
			partyName: parties.name,
			recipientUserId: movements.recipientUserId,
			recipientName: sql<string | null>`nullif(trim(coalesce(${recipient.firstName}, '') || ' ' || coalesce(${recipient.lastName}, '')), '')`,
			recipientUsername: recipient.username,
			userId: movements.userId,
			userFirst: users.firstName,
			userLast: users.lastName,
			username: users.username,
			cancelledByName: sql<string | null>`trim(${canceller.firstName} || ' ' || ${canceller.lastName})`
		})
		.from(movements)
		.innerJoin(products, eq(products.id, movements.productId))
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.leftJoin(colors, eq(colors.id, products.colorId))
		.leftJoin(fromLoc, eq(fromLoc.id, movements.fromLocationId))
		.leftJoin(toLoc, eq(toLoc.id, movements.toLocationId))
		.leftJoin(parties, eq(parties.id, movements.partyId))
		.leftJoin(recipient, eq(recipient.id, movements.recipientUserId))
		.innerJoin(users, eq(users.id, movements.userId))
		.leftJoin(canceller, eq(canceller.id, movements.cancelledBy))
		.where(movementConditions(f))
		.orderBy(desc(movements.createdAt), desc(movements.id))
		.limit(limit)
		.offset(offset)
		.all();
}

export type MovementRow = Awaited<ReturnType<typeof listMovements>>[number];

export async function countMovements(f: MovementFilter) {
	const row = await db.select({ n: sql<number>`count(*)` }).from(movements).where(movementConditions(f)).get();
	return Number(row?.n ?? 0);
}

/** Monatsschlüssel "YYYY-MM" in lokaler Zeit (Server-TZ = Europe/Vienna) */
const monthExpr = sql<string>`strftime('%Y-%m', ${movements.createdAt} / 1000, 'unixepoch', 'localtime')`;

export function monthKeys(months: number, end = new Date()): string[] {
	const keys: string[] = [];
	for (let i = months - 1; i >= 0; i--) {
		const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
		keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
	}
	return keys;
}

export function monthStart(key: string): Date {
	const [y, m] = key.split('-').map(Number);
	return new Date(y, m - 1, 1);
}

/** Verbrauch = Ausgaben minus Rückgaben, je Monat (Stück) */
export async function consumptionByMonth(months: number, filter: { productId?: number; categoryId?: number | null; partyId?: number | null } = {}) {
	const keys = monthKeys(months);
	const since = monthStart(keys[0]);
	const conds: (SQL | undefined)[] = [
		isNull(movements.cancelledAt),
		inArray(movements.type, ['OUT', 'RETURN']),
		gte(movements.createdAt, since)
	];
	if (filter.productId) conds.push(eq(movements.productId, filter.productId));
	if (filter.partyId) conds.push(eq(movements.partyId, filter.partyId));
	const q = db
		.select({
			month: monthExpr,
			qty: sql<number>`sum(case when ${movements.type} = 'OUT' then ${movements.quantity} else -${movements.quantity} end)`
		})
		.from(movements);
	const rows = filter.categoryId
		? await q
				.innerJoin(products, eq(products.id, movements.productId))
				.where(and(...conds, eq(products.categoryId, filter.categoryId)))
				.groupBy(monthExpr)
				.all()
		: await q.where(and(...conds)).groupBy(monthExpr).all();
	const map = new Map(rows.map((r) => [r.month, Number(r.qty)]));
	return keys.map((k) => ({ month: k, qty: Math.max(0, map.get(k) ?? 0) }));
}

/** Verbrauch je Artikel und Monat (für die Berichtstabelle) */
export async function consumptionMatrix(months: number, filter: { categoryId?: number | null; partyId?: number | null } = {}) {
	const keys = monthKeys(months);
	const since = monthStart(keys[0]);
	const conds: (SQL | undefined)[] = [
		isNull(movements.cancelledAt),
		inArray(movements.type, ['OUT', 'RETURN']),
		gte(movements.createdAt, since)
	];
	if (filter.categoryId) conds.push(eq(products.categoryId, filter.categoryId));
	if (filter.partyId) conds.push(eq(movements.partyId, filter.partyId));
	const rows = await db
		.select({
			productId: movements.productId,
			name: products.name,
			articleNumber: products.articleNumber,
			packageSize: products.packageSize,
			unit: products.unit,
			categoryName: categories.name,
			colorHex: colors.hex,
			month: monthExpr,
			qty: sql<number>`sum(case when ${movements.type} = 'OUT' then ${movements.quantity} else -${movements.quantity} end)`
		})
		.from(movements)
		.innerJoin(products, eq(products.id, movements.productId))
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.leftJoin(colors, eq(colors.id, products.colorId))
		.where(and(...conds))
		.groupBy(movements.productId, monthExpr)
		.all();

	const byProduct = new Map<
		number,
		{ productId: number; name: string; articleNumber: string | null; packageSize: number | null; unit: string; categoryName: string | null; colorHex: string | null; months: Record<string, number>; total: number }
	>();
	for (const r of rows) {
		let p = byProduct.get(r.productId);
		if (!p) {
			p = { productId: r.productId, name: r.name, articleNumber: r.articleNumber, packageSize: r.packageSize, unit: r.unit, categoryName: r.categoryName, colorHex: r.colorHex, months: {}, total: 0 };
			byProduct.set(r.productId, p);
		}
		const q = Math.max(0, Number(r.qty));
		p.months[r.month] = q;
		p.total += q;
	}
	return { keys, rows: [...byProduct.values()].sort((a, b) => b.total - a.total) };
}
