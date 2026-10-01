/**
 * Tagesberichte wie das Papierformular: Kopf mit Nummer, Datum und Straße,
 * bis zu acht LB-Positionen mit Einheit, darunter Zeilen mit Ortsbezeichnung
 * und Mengen je Position, dazu der Materialblock (gelb, weiß, Reflexkörper).
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt } from './common';
import { parties, users } from './core';

export const REPORT_STATUS = ['entwurf', 'abgeschlossen'] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];

/** Zeile im Materialblock unten links */
export const REPORT_MATERIALS = ['gelb', 'weiss', 'reflex'] as const;
export type ReportMaterial = (typeof REPORT_MATERIALS)[number];

/** Anzahl der Mengenspalten – wie viele LB-Positionen auf einen Bericht passen */
export const REPORT_COLUMNS = 8;

export const dailyReports = sqliteTable(
	'daily_reports',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Nummer vom Block, frei eintragbar – beim Anlegen wird die nächste vorgeschlagen */
		number: text('number').notNull().default(''),
		/** Tag des Berichts als "JJJJ-MM-TT" */
		date: text('date').notNull(),
		/** Bundesstraße Nr. aus dem Kästchen rechts oben */
		road: text('road').notNull().default(''),
		/** Baustelle und Kostenstelle; später kommt hier der Auftrag dazu */
		site: text('site').notNull().default(''),
		costCenter: text('cost_center').notNull().default(''),
		/** Tagesleistung und LV-Position aus den letzten beiden Zeilen der Tabelle */
		dailyOutput: text('daily_output').notNull().default(''),
		lvPosition: text('lv_position').notNull().default(''),
		note: text('note').notNull().default(''),
		status: text('status', { enum: REPORT_STATUS }).notNull().default('entwurf'),
		partyId: integer('party_id').references(() => parties.id, { onDelete: 'set null' }),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
		closedBy: integer('closed_by').references(() => users.id, { onDelete: 'set null' }),
		closedAt: integer('closed_at', { mode: 'timestamp_ms' }),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [index('daily_reports_date_idx').on(t.date), index('daily_reports_party_idx').on(t.partyId)]
);

/** Kopf einer Mengenspalte: LB-Position und Einheit */
export const dailyReportPositions = sqliteTable(
	'daily_report_positions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		reportId: integer('report_id')
			.notNull()
			.references(() => dailyReports.id, { onDelete: 'cascade' }),
		/** Spalte 1 bis 8 */
		idx: integer('idx').notNull(),
		lbPos: text('lb_pos').notNull().default(''),
		unit: text('unit').notNull().default('')
	},
	(t) => [uniqueIndex('daily_report_positions_idx').on(t.reportId, t.idx)]
);

/** Eine Zeile der Tabelle: Ortsbezeichnung und die Mengen je Spalte */
export const dailyReportRows = sqliteTable(
	'daily_report_rows',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		reportId: integer('report_id')
			.notNull()
			.references(() => dailyReports.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0),
		label: text('label').notNull().default(''),
		q1: real('q1'),
		q2: real('q2'),
		q3: real('q3'),
		q4: real('q4'),
		q5: real('q5'),
		q6: real('q6'),
		q7: real('q7'),
		q8: real('q8')
	},
	(t) => [index('daily_report_rows_report_idx').on(t.reportId, t.sortOrder)]
);

export const dailyReportMaterials = sqliteTable(
	'daily_report_materials',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		reportId: integer('report_id')
			.notNull()
			.references(() => dailyReports.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: REPORT_MATERIALS }).notNull(),
		/** Kenn-Nr. des Materials */
		code: text('code').notNull().default(''),
		/** Filmdicke in mm */
		filmThickness: real('film_thickness')
	},
	(t) => [uniqueIndex('daily_report_materials_kind_idx').on(t.reportId, t.kind)]
);

export type DailyReport = typeof dailyReports.$inferSelect;
export type DailyReportRow = typeof dailyReportRows.$inferSelect;
