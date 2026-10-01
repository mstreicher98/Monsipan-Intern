/**
 * Stundenzettel: lesen, anlegen, speichern, freigeben, prüfen.
 *
 * Wer was darf, hängt an zwei Dingen: dem Recht (stunden.*) und der Partie.
 * Ein Partieführer erfasst für seine Partie, Bauleitung und Buchhaltung sehen
 * alle. Den eigenen Zettel darf jeder ansehen.
 */
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { can, type Role } from '$lib/permissions';
import { db, type Tx } from '$lib/server/db';
import { col } from '$lib/server/db/sql';
import { parties, timesheetDays, timesheets, users } from '$lib/server/db/schema';
import type { SessionUser } from '$lib/server/auth';
import { mondayOf, parseHours, parseTime, weekDays, type WEEKDAY_LABELS } from '../week';

export type { WEEKDAY_LABELS };

export interface Staff {
	id: number;
	firstName: string;
	lastName: string;
	username: string;
	role: Role;
	partyId: number | null;
	partyName: string | null;
}

const activeUser = and(eq(users.active, true), isNull(users.deletedAt));

/** Mitarbeiter, deren Zettel diese Person sehen darf */
export async function staffFor(user: SessionUser): Promise<Staff[]> {
	const fields = {
		id: users.id,
		firstName: users.firstName,
		lastName: users.lastName,
		username: users.username,
		role: users.role,
		partyId: users.partyId,
		partyName: parties.name
	};
	const base = db.select(fields).from(users).leftJoin(parties, eq(parties.id, users.partyId));

	if (can(user.role, 'stunden.alle.sehen')) {
		return base.where(activeUser).orderBy(asc(users.lastName), asc(users.firstName)).all();
	}
	if (can(user.role, 'stunden.erfassen') && user.partyId) {
		return base
			.where(and(activeUser, eq(users.partyId, user.partyId)))
			.orderBy(asc(users.lastName), asc(users.firstName))
			.all();
	}
	return base.where(eq(users.id, user.id)).all();
}

export interface WeekRow {
	user: Staff;
	sheetId: number | null;
	status: 'entwurf' | 'freigegeben' | 'geprueft' | null;
	total: number;
	allowanceDays: number | null;
}

/** Übersicht einer Woche für die erlaubten Mitarbeiter */
export async function weekOverview(user: SessionUser, weekStart: string): Promise<WeekRow[]> {
	const staff = await staffFor(user);
	if (!staff.length) return [];
	const ids = staff.map((s) => s.id);
	const sheets = await db
		.select({
			id: timesheets.id,
			userId: timesheets.userId,
			status: timesheets.status,
			allowanceDays: timesheets.allowanceDays,
			// Spalten mit Tabellennamen: in der Unterabfrage zeigt ein nacktes "id" sonst auf timesheet_days
			total: sql<number>`coalesce((
				select sum(${col(timesheetDays.normalHours)} + ${col(timesheetDays.overtime50)} + ${col(timesheetDays.overtime100)}
					+ ${col(timesheetDays.vacationHours)} + ${col(timesheetDays.holidayHours)} + ${col(timesheetDays.rainHours)}
					+ ${col(timesheetDays.sickHours)})
				from ${timesheetDays} where ${col(timesheetDays.timesheetId)} = ${col(timesheets.id)}), 0)`
		})
		.from(timesheets)
		.where(and(eq(timesheets.weekStart, weekStart), inArray(timesheets.userId, ids)))
		.all();

	return staff.map((s) => {
		const sheet = sheets.find((x) => x.userId === s.id);
		return {
			user: s,
			sheetId: sheet?.id ?? null,
			status: sheet?.status ?? null,
			total: Number(sheet?.total ?? 0),
			allowanceDays: sheet?.allowanceDays ?? null
		};
	});
}

/** Zettel samt Tagen; legt ihn an, wenn er noch nicht existiert */
export async function openSheet(userId: number, weekStart: string, createdBy: number): Promise<number> {
	const monday = mondayOf(weekStart);
	const existing = await db
		.select({ id: timesheets.id })
		.from(timesheets)
		.where(and(eq(timesheets.userId, userId), eq(timesheets.weekStart, monday)))
		.get();
	if (existing) return existing.id;

	return db.transaction(async (tx) => {
		const row = await tx
			.insert(timesheets)
			.values({ userId, weekStart: monday, createdBy, updatedAt: new Date() })
			.returning({ id: timesheets.id })
			.get();
		await createDays(tx, row.id, monday);
		return row.id;
	});
}

async function createDays(tx: Tx, timesheetId: number, weekStart: string) {
	for (const date of weekDays(weekStart)) {
		await tx.insert(timesheetDays).values({ timesheetId, date }).onConflictDoNothing();
	}
}

export async function sheetDetail(id: number) {
	const sheet = await db
		.select({
			id: timesheets.id,
			userId: timesheets.userId,
			weekStart: timesheets.weekStart,
			status: timesheets.status,
			allowanceDays: timesheets.allowanceDays,
			allowanceAmount: timesheets.allowanceAmount,
			vaz: timesheets.vaz,
			vazPercent: timesheets.vazPercent,
			note: timesheets.note,
			releasedAt: timesheets.releasedAt,
			checkedAt: timesheets.checkedAt,
			firstName: users.firstName,
			lastName: users.lastName,
			username: users.username,
			partyId: users.partyId,
			partyName: parties.name
		})
		.from(timesheets)
		.innerJoin(users, eq(users.id, timesheets.userId))
		.leftJoin(parties, eq(parties.id, users.partyId))
		.where(eq(timesheets.id, id))
		.get();
	if (!sheet) return null;

	const days = await db.select().from(timesheetDays).where(eq(timesheetDays.timesheetId, id)).orderBy(asc(timesheetDays.date)).all();
	// Falls eine Woche älter ist als eine Änderung am Aufbau: fehlende Tage ergänzen
	if (days.length < 7) {
		await db.transaction((tx) => createDays(tx, id, sheet.weekStart));
		return sheetDetail(id);
	}
	return { ...sheet, days };
}

export type SheetDetail = NonNullable<Awaited<ReturnType<typeof sheetDetail>>>;

export interface DayInput {
	date: string;
	costCenter: string;
	site: string;
	fromTime: string;
	toTime: string;
	normalHours: string;
	overtime50: string;
	overtime100: string;
	vacationHours: string;
	holidayHours: string;
	rainHours: string;
	sickHours: string;
}

export interface HeadInput {
	allowanceDays: string;
	allowanceAmount: string;
	vaz: string;
	vazPercent: string;
	note: string;
}

const num = (v: string) => {
	const n = Number(String(v ?? '').replace(',', '.'));
	return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export async function saveSheet(id: number, head: HeadInput, days: DayInput[]) {
	await db.transaction(async (tx) => {
		await tx
			.update(timesheets)
			.set({
				allowanceDays: num(head.allowanceDays),
				allowanceAmount: num(head.allowanceAmount),
				vaz: String(head.vaz ?? '').slice(0, 60),
				vazPercent: num(head.vazPercent),
				note: String(head.note ?? '').slice(0, 2000),
				updatedAt: new Date()
			})
			.where(eq(timesheets.id, id));

		for (const d of days) {
			await tx
				.update(timesheetDays)
				.set({
					costCenter: String(d.costCenter ?? '').slice(0, 60),
					site: String(d.site ?? '').slice(0, 200),
					fromTime: parseTime(d.fromTime),
					toTime: parseTime(d.toTime),
					normalHours: parseHours(d.normalHours),
					overtime50: parseHours(d.overtime50),
					overtime100: parseHours(d.overtime100),
					vacationHours: parseHours(d.vacationHours),
					holidayHours: parseHours(d.holidayHours),
					rainHours: parseHours(d.rainHours),
					sickHours: parseHours(d.sickHours)
				})
				.where(and(eq(timesheetDays.timesheetId, id), eq(timesheetDays.date, d.date)));
		}
	});
}

export async function setStatus(id: number, status: 'entwurf' | 'freigegeben' | 'geprueft', userId: number) {
	const now = new Date();
	const set: Record<string, unknown> = { status, updatedAt: now };
	if (status === 'freigegeben') {
		set.releasedBy = userId;
		set.releasedAt = now;
		set.checkedBy = null;
		set.checkedAt = null;
	} else if (status === 'geprueft') {
		set.checkedBy = userId;
		set.checkedAt = now;
	} else {
		set.releasedBy = null;
		set.releasedAt = null;
		set.checkedBy = null;
		set.checkedAt = null;
	}
	await db.update(timesheets).set(set).where(eq(timesheets.id, id));
}

export async function deleteSheet(id: number) {
	await db.delete(timesheets).where(eq(timesheets.id, id));
}

/** Darf diese Person den Zettel öffnen? */
export function mayView(user: SessionUser, sheet: { userId: number; partyId: number | null }): boolean {
	if (sheet.userId === user.id) return true;
	if (can(user.role, 'stunden.alle.sehen')) return true;
	return can(user.role, 'stunden.erfassen') && !!user.partyId && user.partyId === sheet.partyId;
}

/** Darf diese Person Zeilen ändern? Geprüfte Wochen sind zu. */
export function mayEdit(user: SessionUser, sheet: { userId: number; partyId: number | null; status: string }): boolean {
	if (sheet.status === 'geprueft') return false;
	if (sheet.status === 'freigegeben') return can(user.role, 'stunden.pruefen');
	if (!can(user.role, 'stunden.erfassen')) return false;
	if (can(user.role, 'stunden.alle.sehen')) return true;
	return !!user.partyId && user.partyId === sheet.partyId;
}

/** Zuletzt verwendete Baustellen als Vorschlagsliste (später kommen hier Aufträge her) */
export async function recentSites(limit = 50): Promise<string[]> {
	const rows = await db
		.selectDistinct({ site: timesheetDays.site })
		.from(timesheetDays)
		.where(sql`${timesheetDays.site} <> ''`)
		.orderBy(sql`${timesheetDays.date} desc`)
		.limit(limit)
		.all();
	return rows.map((r) => r.site);
}

export function totals(days: { [k: string]: unknown }[]) {
	const sum = (key: string) => days.reduce((s, d) => s + Number(d[key] ?? 0), 0);
	const normal = sum('normalHours');
	const o50 = sum('overtime50');
	const o100 = sum('overtime100');
	const vacation = sum('vacationHours');
	const holiday = sum('holidayHours');
	const rain = sum('rainHours');
	const sick = sum('sickHours');
	return { normal, o50, o100, vacation, holiday, rain, sick, total: normal + o50 + o100 + vacation + holiday + rain + sick };
}
