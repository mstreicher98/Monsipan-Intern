/**
 * Tagesberichte: anlegen, lesen, speichern, abschließen.
 *
 * Wer kein Recht auf „alle sehen" hat, sieht die Berichte der eigenen Partie
 * und die selbst angelegten.
 */
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import { can } from '$lib/permissions';
import { db, type Tx } from '$lib/server/db';
import {
	dailyReportMaterials,
	dailyReportPositions,
	dailyReportRows,
	dailyReports,
	parties,
	REPORT_COLUMNS,
	REPORT_MATERIALS,
	users
} from '$lib/server/db/schema';
import type { SessionUser } from '$lib/server/auth';

/** Zeilen, die ein neuer Bericht gleich mitbringt */
const START_ROWS = 10;

export const QUANTITY_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const;
export type QuantityKey = (typeof QUANTITY_KEYS)[number];

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
		for (let i = 1; i <= REPORT_COLUMNS; i++) await tx.insert(dailyReportPositions).values({ reportId: row.id, idx: i });
		for (let i = 0; i < START_ROWS; i++) await tx.insert(dailyReportRows).values({ reportId: row.id, sortOrder: i });
		for (const kind of REPORT_MATERIALS) await tx.insert(dailyReportMaterials).values({ reportId: row.id, kind });
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
			authorFirst: users.firstName,
			authorLast: users.lastName
		})
		.from(dailyReports)
		.leftJoin(parties, eq(parties.id, dailyReports.partyId))
		.leftJoin(users, eq(users.id, dailyReports.createdBy))
		.where(eq(dailyReports.id, id))
		.get();
	if (!report) return null;

	const [positions, rows, materials] = await Promise.all([
		db.select().from(dailyReportPositions).where(eq(dailyReportPositions.reportId, id)).orderBy(asc(dailyReportPositions.idx)).all(),
		db.select().from(dailyReportRows).where(eq(dailyReportRows.reportId, id)).orderBy(asc(dailyReportRows.sortOrder), asc(dailyReportRows.id)).all(),
		db.select().from(dailyReportMaterials).where(eq(dailyReportMaterials.reportId, id)).all()
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
	positions: { idx: number; lbPos: string; unit: string }[];
	rows: { id: number | null; label: string; quantities: Record<QuantityKey, string> }[];
	materials: { kind: string; code: string; filmThickness: string }[];
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

		for (const p of data.positions) {
			await tx
				.update(dailyReportPositions)
				.set({ lbPos: p.lbPos.slice(0, 40), unit: p.unit.slice(0, 20) })
				.where(and(eq(dailyReportPositions.reportId, id), eq(dailyReportPositions.idx, p.idx)));
		}

		const keep: number[] = [];
		let order = 0;
		for (const r of data.rows) {
			const empty = !r.label.trim() && QUANTITY_KEYS.every((k) => !String(r.quantities[k] ?? '').trim());
			if (empty && r.id == null) continue;
			const values = {
				label: r.label.slice(0, 200),
				sortOrder: order++,
				...Object.fromEntries(QUANTITY_KEYS.map((k) => [k, num(r.quantities[k])]))
			};
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

		for (const m of data.materials) {
			await tx
				.update(dailyReportMaterials)
				.set({ code: m.code.slice(0, 60), filmThickness: num(m.filmThickness) })
				.where(and(eq(dailyReportMaterials.reportId, id), eq(dailyReportMaterials.kind, m.kind as 'gelb' | 'weiss' | 'reflex')));
		}
	});
}

export async function setReportStatus(id: number, status: 'entwurf' | 'abgeschlossen', userId: number) {
	await db
		.update(dailyReports)
		.set(
			status === 'abgeschlossen'
				? { status, closedBy: userId, closedAt: new Date(), updatedAt: new Date() }
				: { status, closedBy: null, closedAt: null, updatedAt: new Date() }
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

/** Summe je Mengenspalte */
export function columnSums(rows: Record<string, unknown>[]): Record<QuantityKey, number> {
	const out = {} as Record<QuantityKey, number>;
	for (const k of QUANTITY_KEYS) out[k] = rows.reduce((s, r) => s + Number(r[k] ?? 0), 0);
	return out;
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
