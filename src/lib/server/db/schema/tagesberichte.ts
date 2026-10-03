/**
 * Tagesberichte wie das Papierformular: Kopf mit Nummer, Datum und Straße,
 * beliebig viele LB-Positionen mit Einheit, darunter Zeilen mit Ortsbezeichnung
 * und Mengen je Position, dazu der Materialblock (Material, Kenn-Nr., Filmdicke).
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt } from './common';
import { parties, users } from './core';
import { products } from './lager';

export const REPORT_STATUS = ['entwurf', 'abgeschlossen'] as const;
export type ReportStatus = (typeof REPORT_STATUS)[number];

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
		/** Unterschrift beim Abschließen (SVG-Pfad) – steht im Ausdruck bei „Für den Auftragnehmer" */
		closeSignature: text('close_signature'),
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
		/** Reihenfolge der Spalte, ab 1 */
		idx: integer('idx').notNull(),
		lbPos: text('lb_pos').notNull().default(''),
		unit: text('unit').notNull().default(''),
		/** Gesamtmenge – wird von Hand eingetragen */
		totalQuantity: real('total_quantity')
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
		/** Mengen je LB-Position, in der Reihenfolge der Spalten */
		quantities: text('quantities', { mode: 'json' }).$type<(number | null)[]>().notNull().default([])
	},
	(t) => [index('daily_report_rows_report_idx').on(t.reportId, t.sortOrder)]
);

/** Eine Zeile im Materialblock unten links */
export const dailyReportMaterials = sqliteTable(
	'daily_report_materials',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		reportId: integer('report_id')
			.notNull()
			.references(() => dailyReports.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0),
		/** Artikel aus dem Lager, aus dem Material und Kenn-Nr. übernommen wurden */
		productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
		/** Material bzw. Farbe, z. B. „Weiß" */
		material: text('material').notNull().default(''),
		/** Kenn-Nr. – beim Artikel aus dem Lager dessen Name */
		code: text('code').notNull().default(''),
		/** Filmdicke in mm */
		filmThickness: real('film_thickness')
	},
	(t) => [index('daily_report_materials_report_idx').on(t.reportId, t.sortOrder)]
);

export type DailyReport = typeof dailyReports.$inferSelect;
export type DailyReportRow = typeof dailyReportRows.$inferSelect;
