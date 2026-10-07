/**
 * Angebote und Aufträge: Kundenstamm, Angebote mit Positionen und Preisen,
 * daraus nach der Annahme durch den Kunden der Auftrag für eine Partie –
 * mit derselben Nummer, ohne Preise.
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createdAt } from './common';
import { parties, users } from './core';

export const customers = sqliteTable(
	'customers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Firma bzw. Name, wie er im Anschriftfeld steht */
		name: text('name').notNull(),
		/** Zweite Zeile, z. B. Abteilung („Stahl- und Anlagenbau") */
		addition: text('addition').notNull().default(''),
		street: text('street').notNull().default(''),
		zip: text('zip').notNull().default(''),
		city: text('city').notNull().default(''),
		uid: text('uid').notNull().default(''),
		email: text('email').notNull().default(''),
		phone: text('phone').notNull().default(''),
		contact: text('contact').notNull().default(''),
		note: text('note').notNull().default(''),
		active: integer('active', { mode: 'boolean' }).notNull().default(true),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [index('customers_name_idx').on(t.name)]
);

/**
 * Ablauf: in Arbeit → freigegeben (Link an den Kunden) → angenommen, oder der
 * Kunde wünscht Änderungen (aenderung) – dann wird es überarbeitet und neu
 * freigegeben. Aus einem angenommenen Angebot entsteht der Auftrag.
 */
export const OFFER_STATUS = ['entwurf', 'freigegeben', 'aenderung', 'angenommen'] as const;
export type OfferStatus = (typeof OFFER_STATUS)[number];

export const offers = sqliteTable(
	'offers',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Angebotsnummer, z. B. „26659" – der Auftrag bekommt dieselbe */
		number: text('number').notNull(),
		projectNumber: text('project_number').notNull().default(''),
		/** Angebotsdatum „JJJJ-MM-TT" */
		date: text('date').notNull(),
		/** BV – was angeboten wird, steht in der Überschrift */
		title: text('title').notNull().default(''),
		customerId: integer('customer_id').references(() => customers.id, { onDelete: 'set null' }),
		/** Anschrift, wie sie im Angebot steht – bleibt, auch wenn sich der Kundenstamm ändert */
		customerName: text('customer_name').notNull().default(''),
		customerAddition: text('customer_addition').notNull().default(''),
		customerStreet: text('customer_street').notNull().default(''),
		customerZip: text('customer_zip').notNull().default(''),
		customerCity: text('customer_city').notNull().default(''),
		customerUid: text('customer_uid').notNull().default(''),
		intro: text('intro').notNull().default(''),
		closing: text('closing').notNull().default(''),
		/** Umsatzsteuer in Prozent */
		vatRate: real('vat_rate').notNull().default(20),
		status: text('status', { enum: OFFER_STATUS }).notNull().default('entwurf'),
		releasedBy: integer('released_by').references(() => users.id, { onDelete: 'set null' }),
		releasedAt: integer('released_at', { mode: 'timestamp_ms' }),
		/** Dauerhafter Link für den Kunden (/angebot/<token>) */
		customerToken: text('customer_token'),
		customerEmail: text('customer_email'),
		customerLinkSentAt: integer('customer_link_sent_at', { mode: 'timestamp_ms' }),
		/** Letzter Änderungswunsch des Kunden – bleibt sichtbar, bis neu freigegeben wird */
		changeRequest: text('change_request'),
		changeRequestName: text('change_request_name'),
		changeRequestedAt: integer('change_requested_at', { mode: 'timestamp_ms' }),
		/** Annahme mit Name und Unterschrift (SVG-Pfad) */
		acceptedName: text('accepted_name'),
		acceptedSignature: text('accepted_signature'),
		acceptedAt: integer('accepted_at', { mode: 'timestamp_ms' }),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [
		uniqueIndex('offers_number_idx').on(t.number),
		uniqueIndex('offers_customer_token_idx').on(t.customerToken),
		index('offers_customer_idx').on(t.customerId),
		index('offers_date_idx').on(t.date)
	]
);

/** Zeile im Angebot: eine Position mit Preis oder eine Zwischenüberschrift (Titel) */
export const OFFER_LINE_KINDS = ['position', 'titel'] as const;

export const offerPositions = sqliteTable(
	'offer_positions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		offerId: integer('offer_id')
			.notNull()
			.references(() => offers.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0),
		kind: text('kind', { enum: OFFER_LINE_KINDS }).notNull().default('position'),
		text: text('text').notNull().default(''),
		quantity: real('quantity'),
		unit: text('unit').notNull().default(''),
		/** Einheitspreis netto in Euro */
		unitPrice: real('unit_price')
	},
	(t) => [index('offer_positions_offer_idx').on(t.offerId, t.sortOrder)]
);

/** Auftrag erstellt → in Arbeit → abgeschlossen; die Partie setzt die beiden letzten */
export const ORDER_STATUS = ['erstellt', 'in_arbeit', 'abgeschlossen'] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const orders = sqliteTable(
	'orders',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		/** Dieselbe Nummer wie das Angebot */
		number: text('number').notNull(),
		offerId: integer('offer_id').references(() => offers.id, { onDelete: 'set null' }),
		partyId: integer('party_id').references(() => parties.id, { onDelete: 'set null' }),
		status: text('status', { enum: ORDER_STATUS }).notNull().default('erstellt'),
		projectNumber: text('project_number').notNull().default(''),
		title: text('title').notNull().default(''),
		customerName: text('customer_name').notNull().default(''),
		customerAddition: text('customer_addition').notNull().default(''),
		customerStreet: text('customer_street').notNull().default(''),
		customerZip: text('customer_zip').notNull().default(''),
		customerCity: text('customer_city').notNull().default(''),
		/** Ansprechpartner und Telefon aus dem Kundenstamm – für die Partie vor Ort */
		customerContact: text('customer_contact').notNull().default(''),
		customerPhone: text('customer_phone').notNull().default(''),
		/** Hinweis an die Partie */
		note: text('note').notNull().default(''),
		statusBy: integer('status_by').references(() => users.id, { onDelete: 'set null' }),
		statusAt: integer('status_at', { mode: 'timestamp_ms' }),
		createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
	},
	(t) => [uniqueIndex('orders_number_idx').on(t.number), uniqueIndex('orders_offer_idx').on(t.offerId), index('orders_party_idx').on(t.partyId)]
);

/** Positionen des Auftrags – beim Erstellen aus dem Angebot übernommen, ohne Preise */
export const orderPositions = sqliteTable(
	'order_positions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		sortOrder: integer('sort_order').notNull().default(0),
		kind: text('kind', { enum: OFFER_LINE_KINDS }).notNull().default('position'),
		text: text('text').notNull().default(''),
		quantity: real('quantity'),
		unit: text('unit').notNull().default('')
	},
	(t) => [index('order_positions_order_idx').on(t.orderId, t.sortOrder)]
);

export type Customer = typeof customers.$inferSelect;
