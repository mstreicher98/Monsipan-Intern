/**
 * Tabellen des Bereichs Lager: Lagerorte, Stammdaten der Artikel, Bestand
 * und Buchungen. Verweise gehen nur nach core (Benutzer, Partien).
 */
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt } from './common';
import { parties, users } from './core';

export const locations = sqliteTable('locations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	description: text('description').notNull().default(''),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: createdAt()
});

/** Materialart, z. B. Kaltplastik, Farbe, Verdünnung, Tape */
export const categories = sqliteTable('categories', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const colors = sqliteTable('colors', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	/** RAL-Classic-Nummer, z. B. "6024" – optional, Farbmuster dann aus der RAL-Tabelle */
	ral: text('ral'),
	hex: text('hex').notNull().default('#9AA0A6'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	sortOrder: integer('sort_order').notNull().default(0)
});

export const products = sqliteTable(
	'products',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		articleNumber: text('article_number'),
		categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
		colorId: integer('color_id').references(() => colors.id, { onDelete: 'set null' }),
		manufacturer: text('manufacturer').notNull().default(''),
		/** Inhalt je Stück/Gebinde, z. B. 15 (kg) */
		packageSize: real('package_size'),
		unit: text('unit').notNull().default('stk'),
		minStock: integer('min_stock'),
		targetStock: integer('target_stock'),
		notes: text('notes').notNull().default(''),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		lowStockNotifiedAt: integer('low_stock_notified_at', { mode: 'timestamp_ms' }),
		/** Kleingeschriebener, umlautgefalteter Suchtext (Name, Nummern, Codes, Materialart, Farbe) */
		searchText: text('search_text').notNull().default(''),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [index('products_name_idx').on(t.name), index('products_article_idx').on(t.articleNumber)]
);

/**
 * Alle scanbaren Codes eines Artikels (EAN, Artikelnummer, weitere).
 * Eine Nummer darf zu mehreren Artikeln gehören – manche Lieferanten drucken
 * auf verschiedene Produkte dieselbe Nummer. Beim Scannen fragt die App dann,
 * welcher Artikel gemeint ist.
 */
export const productCodes = sqliteTable(
	'product_codes',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		code: text('code').notNull(),
		normalized: text('normalized').notNull(),
		kind: text('kind', { enum: ['ean', 'artikel', 'sonstige'] }).notNull().default('sonstige'),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('product_codes_product_normalized_idx').on(t.productId, t.normalized),
		index('product_codes_normalized_idx').on(t.normalized),
		index('product_codes_product_idx').on(t.productId)
	]
);

/**
 * Materialbeschreibungen, Sicherheitsdatenblätter usw. als PDF.
 * Die Datei liegt unter /data/dokumente/<sha256>.pdf – gleiche Dateien nur einmal.
 */
export const DOCUMENT_KINDS = ['materialbeschreibung', 'sicherheitsdatenblatt', 'sonstiges'] as const;

export const productDocuments = sqliteTable(
	'product_documents',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		kind: text('kind', { enum: DOCUMENT_KINDS }).notNull().default('materialbeschreibung'),
		title: text('title').notNull(),
		/** Ursprünglicher Dateiname, für den Download */
		fileName: text('file_name').notNull(),
		sha256: text('sha256').notNull(),
		size: integer('size').notNull(),
		uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt()
	},
	(t) => [index('product_documents_product_idx').on(t.productId)]
);

export const stock = sqliteTable(
	'stock',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		locationId: integer('location_id')
			.notNull()
			.references(() => locations.id, { onDelete: 'restrict' }),
		quantity: integer('quantity').notNull().default(0),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [primaryKey({ columns: [t.productId, t.locationId] }), index('stock_location_idx').on(t.locationId)]
);

export const MOVEMENT_TYPES = ['IN', 'OUT', 'TRANSFER', 'RETURN', 'INVENTORY'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const movements = sqliteTable(
	'movements',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Gemeinsame Kennung aller Zeilen einer Buchung (z. B. Massen-Scan) */
		batchId: text('batch_id').notNull(),
		type: text('type', { enum: MOVEMENT_TYPES }).notNull(),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'restrict' }),
		/** Immer positiv; bei Inventur der Betrag der Differenz */
		quantity: integer('quantity').notNull(),
		fromLocationId: integer('from_location_id').references(() => locations.id),
		toLocationId: integer('to_location_id').references(() => locations.id),
		partyId: integer('party_id').references(() => parties.id),
		/** Ausgabe an / Rückgabe von einer Person statt einer Partie (Benutzer ohne Partie) */
		recipientUserId: integer('recipient_user_id').references(() => users.id),
		/** Inventur: gezählter Bestand und Bestand davor */
		countedQuantity: integer('counted_quantity'),
		previousQuantity: integer('previous_quantity'),
		note: text('note').notNull().default(''),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id),
		createdAt: createdAt(),
		cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
		cancelledBy: integer('cancelled_by').references(() => users.id),
		cancelReason: text('cancel_reason'),
		/** Diese Buchung ersetzt eine stornierte (Korrektur) */
		correctionOf: integer('correction_of')
	},
	(t) => [
		index('movements_product_idx').on(t.productId, t.createdAt),
		index('movements_created_idx').on(t.createdAt),
		index('movements_batch_idx').on(t.batchId)
	]
);

export type Product = typeof products.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Movement = typeof movements.$inferSelect;
