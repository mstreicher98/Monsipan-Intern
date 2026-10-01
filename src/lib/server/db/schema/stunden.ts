/**
 * Stundenzettel („Lohnzettel"): je Mitarbeiter eine Woche, je Woche sieben Tage.
 * Aufbau wie das Papierformular – Kostenstelle, Baustelle, Zeit von/bis und die
 * Stundenarten Norm, Überstunden 50/100 %, Urlaub, Feiertag, Regen, Efzg.
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt } from './common';
import { users } from './core';

export const TIMESHEET_STATUS = ['entwurf', 'freigegeben', 'geprueft'] as const;
export type TimesheetStatus = (typeof TIMESHEET_STATUS)[number];

export const timesheets = sqliteTable(
	'timesheets',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Mitarbeiter, für den die Woche gilt */
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** Montag der Lohnwoche als "JJJJ-MM-TT" */
		weekStart: text('week_start').notNull(),
		status: text('status', { enum: TIMESHEET_STATUS }).notNull().default('entwurf'),
		/** Auslöse: Anzahl Tage und Betrag in Euro */
		allowanceDays: real('allowance_days'),
		allowanceAmount: real('allowance_amount'),
		/** Vereinbarte Arbeitszeit und Zuschlag in Prozent (Fuß des Formulars) */
		vaz: text('vaz').notNull().default(''),
		vazPercent: real('vaz_percent'),
		note: text('note').notNull().default(''),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
		releasedBy: integer('released_by').references(() => users.id, { onDelete: 'set null' }),
		releasedAt: integer('released_at', { mode: 'timestamp_ms' }),
		checkedBy: integer('checked_by').references(() => users.id, { onDelete: 'set null' }),
		checkedAt: integer('checked_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [
		uniqueIndex('timesheets_user_week_idx').on(t.userId, t.weekStart),
		index('timesheets_week_idx').on(t.weekStart),
		index('timesheets_status_idx').on(t.status)
	]
);

export const timesheetDays = sqliteTable(
	'timesheet_days',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		timesheetId: integer('timesheet_id')
			.notNull()
			.references(() => timesheets.id, { onDelete: 'cascade' }),
		/** Tag als "JJJJ-MM-TT" – Montag bis Sonntag der Woche */
		date: text('date').notNull(),
		costCenter: text('cost_center').notNull().default(''),
		/** Baustelle / Tätigkeit; später kommt hier der Auftrag dazu */
		site: text('site').notNull().default(''),
		fromTime: text('from_time').notNull().default(''),
		toTime: text('to_time').notNull().default(''),
		normalHours: real('normal_hours').notNull().default(0),
		overtime50: real('overtime_50').notNull().default(0),
		overtime100: real('overtime_100').notNull().default(0),
		vacationHours: real('vacation_hours').notNull().default(0),
		holidayHours: real('holiday_hours').notNull().default(0),
		rainHours: real('rain_hours').notNull().default(0),
		/** Entgeltfortzahlung (Krankenstand) */
		sickHours: real('sick_hours').notNull().default(0)
	},
	(t) => [uniqueIndex('timesheet_days_sheet_date_idx').on(t.timesheetId, t.date)]
);

export type Timesheet = typeof timesheets.$inferSelect;
export type TimesheetDay = typeof timesheetDays.$inferSelect;
