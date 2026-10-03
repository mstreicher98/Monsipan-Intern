/**
 * Tagesberichte: anlegen, lesen, speichern, abschließen (mit Unterschrift).
 *
 * Wer kein Recht auf „alle sehen" hat, sieht die Berichte der eigenen Partie
 * und die selbst angelegten.
 */
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { can } from '$lib/permissions';
import { db } from '$lib/server/db';
import {
	categories,
	colors,
	dailyReportMaterials,
	dailyReportPositions,
	dailyReportRows,
	dailyReports,
	parties,
	products,
	users
} from '$lib/server/db/schema';
import type { SessionUser } from '$lib/server/auth';
import { MAX_MATERIALS, MAX_POSITIONS } from '../sheet';

/** Zeilen, die ein neuer Bericht gleich mitbringt */
const START_ROWS = 10;

/** Wer abgeschlossen und unterschrieben hat */
const closer = alias(users, 'closer');

/** Nur eigene bzw. Partie-Berichte, wenn das Recht auf alle fehlt */
function scope(user: SessionUser) {
	if (can(user.role, 'tagesberichte.alle.sehen')) return undefined;
	const own = eq(dailyReports.createdBy, user.id);
	return user.partyId ? or(own, eq(dailyReports.partyId, user.partyId)) : own;
}

export interface ReportFilter {
	q?: string;
	from?: string;
	to?: string;
}

export async function listReports(user: SessionUser, filter: ReportFilter = {}, limit = 100) {
	const where = [scope(user)];
	if (filter.from) where.push(sql`${dailyReports.date} >= ${filter.from}`);
	if (filter.to) where.push(sql`${dailyReports.date} <= ${filter.to}`);
	if (filter.q?.trim()) {
		const q = `%${filter.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		where.push(
			or(
				like(dailyReports.number, q),
				like(dailyReports.road, q),
				like(dailyReports.site, q),
				like(dailyReports.lvPosition, q)
			)
		);
	}
	return db
		.select({
			id: dailyReports.id,
			number: dailyReports.number,
			date: dailyReports.date,
			road: dailyReports.road,
			site: dailyReports.site,
			status: dailyReports.status,
			dailyOutput: dailyReports.dailyOutput,
			partyName: parties.name,
			authorFirst: users.firstName,
			authorLast: users.lastName
		})
		.from(dailyReports)
		.leftJoin(parties, eq(parties.id, dailyReports.partyId))
		.leftJoin(users, eq(users.id, dailyReports.createdBy))
		.where(and(...where.filter(Boolean)))
		.orderBy(desc(dailyReports.date), desc(dailyReports.id))
		.limit(limit)
		.all();
}

/** Nächste freie Nummer vorschlagen: höchste rein numerische Nummer plus eins */
export async function nextNumber(): Promise<string> {
	const rows = await db.select({ number: dailyReports.number }).from(dailyReports).all();
	const max = rows.reduce((m, r) => {
		const n = Number(r.number);
		return Number.isInteger(n) && n > m ? n : m;
	}, 0);
	return String(max + 1);
}

export async function createReport(user: SessionUser, data: { date: string; number: string; road: string; site: string }) {
	return db.transaction(async (tx) => {
		const row = await tx
			.insert(dailyReports)
			.values({
				date: data.date,
				number: data.number.slice(0, 40),
				road: data.road.slice(0, 120),
				site: data.site.slice(0, 200),
				partyId: user.partyId,
				createdBy: user.id,
				updatedAt: new Date()
			})
			.returning({ id: dailyReports.id })
			.get();
		// Eine LB-Position zum Start – weitere kommen nach Bedarf dazu
		await tx.insert(dailyReportPositions).values({ reportId: row.id, idx: 1 });
		for (let i = 0; i < START_ROWS; i++) await tx.insert(dailyReportRows).values({ reportId: row.id, sortOrder: i });
		return row.id;
	});
}

export async function reportDetail(id: number) {
	const report = await db
		.select({
			id: dailyReports.id,
			number: dailyReports.number,
			date: dailyReports.date,
			road: dailyReports.road,
			site: dailyReports.site,
			costCenter: dailyReports.costCenter,
			dailyOutput: dailyReports.dailyOutput,
			lvPosition: dailyReports.lvPosition,
			note: dailyReports.note,
			status: dailyReports.status,
			partyId: dailyReports.partyId,
			partyName: parties.name,
			createdBy: dailyReports.createdBy,
			closedAt: dailyReports.closedAt,
			closeSignature: dailyReports.closeSignature,
			closedByFirst: closer.firstName,
			closedByLast: closer.lastName,
			authorFirst: users.firstName,
			authorLast: users.lastName
		})
		.from(dailyReports)
		.leftJoin(parties, eq(parties.id, dailyReports.partyId))
		.leftJoin(users, eq(users.id, dailyReports.createdBy))
		.leftJoin(closer, eq(closer.id, dailyReports.closedBy))
		.where(eq(dailyReports.id, id))
		.get();
	if (!report) return null;

	const [positions, rows, materials] = await Promise.all([
		db
			.select({
				idx: dailyReportPositions.idx,
				lbPos: dailyReportPositions.lbPos,
				unit: dailyReportPositions.unit,
				totalQuantity: dailyReportPositions.totalQuantity
			})
			.from(dailyReportPositions)
			.where(eq(dailyReportPositions.reportId, id))
			.orderBy(asc(dailyReportPositions.idx))
			.all(),
		db
			.select({ id: dailyReportRows.id, label: dailyReportRows.label, quantities: dailyReportRows.quantities })
			.from(dailyReportRows)
			.where(eq(dailyReportRows.reportId, id))
			.orderBy(asc(dailyReportRows.sortOrder), asc(dailyReportRows.id))
			.all(),
		db
			.select({
				productId: dailyReportMaterials.productId,
				productName: products.name,
				material: dailyReportMaterials.material,
				code: dailyReportMaterials.code,
				filmThickness: dailyReportMaterials.filmThickness
			})
			.from(dailyReportMaterials)
			.leftJoin(products, eq(products.id, dailyReportMaterials.productId))
			.where(eq(dailyReportMaterials.reportId, id))
			.orderBy(asc(dailyReportMaterials.sortOrder), asc(dailyReportMaterials.id))
			.all()
	]);
	return { ...report, positions, rows, materials };
}

export type ReportDetail = NonNullable<Awaited<ReturnType<typeof reportDetail>>>;

const num = (v: unknown) => {
	const s = String(v ?? '').trim().replace(',', '.');
	if (!s) return null;
	const n = Number(s);
	return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
};

export interface SaveReport {
	head: {
		number: string;
		date: string;
		road: string;
		site: string;
		costCenter: string;
		dailyOutput: string;
		lvPosition: string;
		note: string;
	};
	/** In der Reihenfolge der Spalten; die Mengen der Zeilen stehen in derselben Reihenfolge */
	positions: { lbPos: string; unit: string; totalQuantity: string }[];
	rows: { id: number | null; label: string; quantities: string[] }[];
	materials: { productId: number | null; material: string; code: string; filmThickness: string }[];
}

export async function saveReport(id: number, data: SaveReport) {
	await db.transaction(async (tx) => {
		await tx
			.update(dailyReports)
			.set({
				number: data.head.number.slice(0, 40),
				date: data.head.date,
				road: data.head.road.slice(0, 120),
				site: data.head.site.slice(0, 200),
				costCenter: data.head.costCenter.slice(0, 60),
				dailyOutput: data.head.dailyOutput.slice(0, 200),
				lvPosition: data.head.lvPosition.slice(0, 200),
				note: data.head.note.slice(0, 2000),
				updatedAt: new Date()
			})
			.where(eq(dailyReports.id, id));

		// Positionen werden neu geschrieben – ihre Reihenfolge ist zugleich die der Mengen
		const positions = data.positions.slice(0, MAX_POSITIONS);
		await tx.delete(dailyReportPositions).where(eq(dailyReportPositions.reportId, id));
		for (const [i, p] of positions.entries()) {
			await tx.insert(dailyReportPositions).values({
				reportId: id,
				idx: i + 1,
				lbPos: p.lbPos.slice(0, 40),
				unit: p.unit.slice(0, 20),
				totalQuantity: num(p.totalQuantity)
			});
		}

		const keep: number[] = [];
		let order = 0;
		for (const r of data.rows) {
			const quantities = positions.map((_, i) => num(r.quantities[i]));
			const empty = !r.label.trim() && quantities.every((q) => q == null);
			if (empty && r.id == null) continue;
			const values = { label: r.label.slice(0, 200), sortOrder: order++, quantities };
			if (r.id == null) {
				const created = await tx
					.insert(dailyReportRows)
					.values({ reportId: id, ...values })
					.returning({ id: dailyReportRows.id })
					.get();
				keep.push(created.id);
			} else {
				await tx.update(dailyReportRows).set(values).where(and(eq(dailyReportRows.id, r.id), eq(dailyReportRows.reportId, id)));
				keep.push(r.id);
			}
		}
		// Zeilen, die im Formular nicht mehr vorkommen, sind gelöscht worden
		const existing = await tx.select({ id: dailyReportRows.id }).from(dailyReportRows).where(eq(dailyReportRows.reportId, id)).all();
		const gone = existing.filter((e) => !keep.includes(e.id)).map((e) => e.id);
		if (gone.length) await tx.delete(dailyReportRows).where(inArray(dailyReportRows.id, gone));

		// Materialblock ebenso neu; leere Zeilen fallen weg
		const materials = data.materials
			.filter((m) => m.productId != null || m.material.trim() || m.code.trim() || num(m.filmThickness) != null)
			.slice(0, MAX_MATERIALS);
		const wanted = materials.map((m) => m.productId).filter((p): p is number => p != null);
		const known = new Set(
			wanted.length
				? (await tx.select({ id: products.id }).from(products).where(inArray(products.id, wanted)).all()).map((p) => p.id)
				: []
		);
		await tx.delete(dailyReportMaterials).where(eq(dailyReportMaterials.reportId, id));
		for (const [i, m] of materials.entries()) {
			await tx.insert(dailyReportMaterials).values({
				reportId: id,
				sortOrder: i,
				productId: m.productId != null && known.has(m.productId) ? m.productId : null,
				material: m.material.slice(0, 60),
				code: m.code.slice(0, 120),
				filmThickness: num(m.filmThickness)
			});
		}
	});
}

/** Abschließen nimmt die Unterschrift mit, Wieder öffnen verwirft sie */
export async function setReportStatus(id: number, status: 'entwurf' | 'abgeschlossen', userId: number, signature: string | null = null) {
	await db
		.update(dailyReports)
		.set(
			status === 'abgeschlossen'
				? { status, closedBy: userId, closedAt: new Date(), closeSignature: signature, updatedAt: new Date() }
				: { status, closedBy: null, closedAt: null, closeSignature: null, updatedAt: new Date() }
		)
		.where(eq(dailyReports.id, id));
}

export async function deleteReport(id: number) {
	await db.delete(dailyReports).where(eq(dailyReports.id, id));
}

export function mayView(user: SessionUser, report: { createdBy: number | null; partyId: number | null }): boolean {
	if (can(user.role, 'tagesberichte.alle.sehen')) return true;
	if (report.createdBy === user.id) return true;
	return !!user.partyId && user.partyId === report.partyId;
}

export function mayEdit(user: SessionUser, report: { createdBy: number | null; partyId: number | null; status: string }): boolean {
	if (report.status === 'abgeschlossen') return can(user.role, 'tagesberichte.abschliessen');
	return can(user.role, 'tagesberichte.erfassen') && mayView(user, report);
}

/**
 * Artikel für den Materialblock: alle aktiven, mit Farbe und Materialart.
 * Daraus kommen Material (die Farbe) und Kenn-Nr. (der Artikelname).
 */
export async function materialProducts() {
	return db
		.select({
			id: products.id,
			name: products.name,
			articleNumber: products.articleNumber,
			colorName: colors.name,
			categoryName: categories.name
		})
		.from(products)
		.leftJoin(colors, eq(colors.id, products.colorId))
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.where(eq(products.active, true))
		.orderBy(asc(sql`coalesce(${categories.sortOrder}, 9999)`), asc(categories.name), asc(products.name))
		.all();
}

/** Zuletzt verwendete Straßen und Baustellen als Vorschläge */
export async function recentPlaces(): Promise<{ roads: string[]; sites: string[] }> {
	const rows = await db
		.select({ road: dailyReports.road, site: dailyReports.site })
		.from(dailyReports)
		.orderBy(desc(dailyReports.date))
		.limit(200)
		.all();
	const uniq = (list: string[]) => [...new Set(list.filter((v) => v.trim()))].slice(0, 50);
	return { roads: uniq(rows.map((r) => r.road)), sites: uniq(rows.map((r) => r.site)) };
}
