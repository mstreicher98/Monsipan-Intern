/**
 * Rechnungen: zum abgeschlossenen Auftrag, mit derselben Nummer. Preise aus
 * dem Angebot, Mengen aus dem Summenblatt der Tagesberichte; welche Spalte zu
 * welcher Angebotsposition gehört, merkt sich der Auftrag. Eine Rechnung ist
 * offen, bis sie als bezahlt markiert wird; solange sie offen ist, lässt sie
 * sich noch ändern oder löschen.
 */
import { and, asc, desc, eq, inArray, isNull, like, lt, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { db, type Tx } from '$lib/server/db';
import { invoicePositions, invoices, offerPositions, offers, orderPositions, orders, users, type InvoiceStatus } from '$lib/server/db/schema';
import { col } from '$lib/server/db/sql';
import { getSettings } from '$lib/server/settings';
import type { SessionUser } from '$lib/server/auth';
import { addDays, isValidIsoDate, today } from '$lib/modules/stunden/week';
import { notify } from '$lib/server/notifications';
import { date as dateLabel } from '$lib/format';
import { MAX_OFFER_LINES, money, parseAmount, round2, spacedNumber } from '../offer';
import { billedLines, invoiceLines, suggestMapping, type Mapping, type PricedLine } from '../summary';
import { orderSummary } from './summary';

const creator = alias(users, 'creator');
const payer = alias(users, 'payer');

/** Netto je Rechnung, direkt in der Abfrage */
const netSum = sql<number>`(select coalesce(sum(round(${col(invoicePositions.quantity)} * ${col(invoicePositions.unitPrice)}, 2)), 0) from ${invoicePositions} where ${col(invoicePositions.invoiceId)} = ${col(invoices.id)} and ${col(invoicePositions.kind)} = 'position')`.mapWith(
	Number
);

export interface InvoiceFilter {
	q?: string;
	/** „offen", „bezahlt" oder leer für alle */
	status?: string;
}

export async function listInvoices(filter: InvoiceFilter = {}, limit = 300) {
	const where: (SQL | undefined)[] = [];
	if (filter.status === 'offen' || filter.status === 'bezahlt') where.push(eq(invoices.status, filter.status));
	if (filter.q?.trim()) {
		const q = `%${filter.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		where.push(or(like(invoices.number, q), like(invoices.title, q), like(invoices.customerName, q), like(invoices.location, q), like(invoices.projectNumber, q)));
	}
	return db
		.select({
			id: invoices.id,
			number: invoices.number,
			date: invoices.date,
			dueDate: invoices.dueDate,
			title: invoices.title,
			customerName: invoices.customerName,
			customerCity: invoices.customerCity,
			status: invoices.status,
			paidOn: invoices.paidOn,
			vatRate: invoices.vatRate,
			reverseCharge: invoices.reverseCharge,
			net: netSum
		})
		.from(invoices)
		.where(and(...where))
		// Offene nach Fälligkeit, bezahlte nach Datum
		.orderBy(sql`case ${invoices.status} when 'offen' then 0 else 1 end`, sql`case ${invoices.status} when 'offen' then ${invoices.dueDate} end`, desc(invoices.date), desc(invoices.id))
		.limit(limit)
		.all();
}

export async function countInvoices(day = today()) {
	const row = await db
		.select({
			open: sql<number>`sum(case when ${invoices.status} = 'offen' then 1 else 0 end)`.mapWith(Number),
			paid: sql<number>`sum(case when ${invoices.status} = 'bezahlt' then 1 else 0 end)`.mapWith(Number),
			overdue: sql<number>`sum(case when ${invoices.status} = 'offen' and ${invoices.dueDate} < ${day} then 1 else 0 end)`.mapWith(Number),
			all: sql<number>`count(*)`.mapWith(Number)
		})
		.from(invoices)
		.get();
	return { open: row?.open ?? 0, paid: row?.paid ?? 0, overdue: row?.overdue ?? 0, all: row?.all ?? 0 };
}

/** Abgeschlossene Aufträge ohne Rechnung – die nächsten zum Abrechnen */
export function ordersToInvoice() {
	return db
		.select({ id: orders.id, number: orders.number, title: orders.title, customerName: orders.customerName, location: orders.location, statusAt: orders.statusAt })
		.from(orders)
		.leftJoin(invoices, eq(invoices.orderId, orders.id))
		.where(and(eq(orders.status, 'abgeschlossen'), isNull(invoices.id)))
		.orderBy(asc(orders.statusAt))
		.limit(100)
		.all();
}

export function invoiceForOrder(orderId: number) {
	return db.select({ id: invoices.id, number: invoices.number, status: invoices.status }).from(invoices).where(eq(invoices.orderId, orderId)).get();
}

/** Rechnungsstand je Auftrag – für die Liste der Aufträge */
export async function invoiceStates(orderIds: number[]): Promise<Record<number, InvoiceStatus>> {
	if (!orderIds.length) return {};
	const rows = await db
		.select({ orderId: invoices.orderId, status: invoices.status })
		.from(invoices)
		.where(inArray(invoices.orderId, orderIds))
		.all();
	return Object.fromEntries(rows.filter((r) => r.orderId != null).map((r) => [r.orderId!, r.status]));
}

/* ------------------------------------------------------------ Entwurf */

/**
 * Alles für eine neue Rechnung zum Auftrag: Positionen mit Preisen aus dem
 * Angebot (ohne Angebot die des Auftrags, ohne Preise), das Summenblatt, die
 * vorgeschlagene Zuordnung und die Vorgaben für Kopf und Texte.
 */
export async function invoiceDraft(orderId: number) {
	const order = await db.select().from(orders).where(eq(orders.id, orderId)).get();
	if (!order) return null;
	const offer = order.offerId ? await db.select().from(offers).where(eq(offers.id, order.offerId)).get() : undefined;
	const lines: PricedLine[] = offer
		? await db
				.select({
					id: offerPositions.id,
					kind: offerPositions.kind,
					text: offerPositions.text,
					quantity: offerPositions.quantity,
					unit: offerPositions.unit,
					unitPrice: offerPositions.unitPrice
				})
				.from(offerPositions)
				.where(eq(offerPositions.offerId, offer.id))
				.orderBy(asc(offerPositions.sortOrder), asc(offerPositions.id))
				.all()
		: (
				await db
					.select({ id: orderPositions.id, kind: orderPositions.kind, text: orderPositions.text, quantity: orderPositions.quantity, unit: orderPositions.unit })
					.from(orderPositions)
					.where(eq(orderPositions.orderId, orderId))
					.orderBy(asc(orderPositions.sortOrder), asc(orderPositions.id))
					.all()
			).map((l) => ({ ...l, unitPrice: null }));
	const [summary, settings] = await Promise.all([orderSummary(orderId), getSettings()]);
	const date = today();
	return {
		order: {
			id: order.id,
			number: order.number,
			title: order.title,
			status: order.status,
			partyId: order.partyId,
			offerId: order.offerId,
			offerNumber: offer?.number ?? null
		},
		lines,
		summary,
		mapping: suggestMapping(summary.columns, lines, order.invoiceMapping),
		head: {
			date,
			dueDate: addDays(date, settings.invoicePaymentDays),
			serviceFrom: summary.from ?? '',
			serviceTo: summary.to ?? '',
			projectNumber: order.projectNumber,
			title: order.title,
			location: order.location,
			customerName: offer?.customerName ?? order.customerName,
			customerAddition: offer?.customerAddition ?? order.customerAddition,
			customerStreet: offer?.customerStreet ?? order.customerStreet,
			customerZip: offer?.customerZip ?? order.customerZip,
			customerCity: offer?.customerCity ?? order.customerCity,
			customerUid: offer?.customerUid ?? '',
			intro: settings.invoiceIntro,
			closing: settings.invoiceClosing,
			vatRate: offer?.vatRate ?? 20,
			reverseCharge: false
		},
		paymentDays: settings.invoicePaymentDays
	};
}

export type InvoiceDraft = NonNullable<Awaited<ReturnType<typeof invoiceDraft>>>;

/** Die vorgeschlagenen Zeilen zum Entwurf – Mengen aus der Zuordnung */
export function draftLines(draft: InvoiceDraft, mapping: Mapping = draft.mapping) {
	return invoiceLines(draft.lines, draft.summary.columns, mapping);
}

/* ------------------------------------------------------------ Speichern */

export interface SaveInvoice {
	head: {
		date: string;
		dueDate: string;
		serviceFrom: string | null;
		serviceTo: string | null;
		title: string;
		location: string;
		projectNumber: string;
		customerName: string;
		customerAddition: string;
		customerStreet: string;
		customerZip: string;
		customerCity: string;
		customerUid: string;
		intro: string;
		closing: string;
		vatRate: number;
		reverseCharge: boolean;
	};
	lines: { number: string; kind: 'position' | 'titel'; text: string; quantity: number | null; unit: string; unitPrice: number | null }[];
}

/**
 * Formular auslesen – Zeilen wie beim Angebot als z.<Nr>.art/text/menge/
 * einheit/preis. Gibt die Daten oder eine Meldung zurück.
 */
export function readInvoice(form: FormData): SaveInvoice | { message: string } {
	const s = (k: string) => String(form.get(k) ?? '');
	const date = s('datum');
	if (!isValidIsoDate(date)) return { message: 'Das Rechnungsdatum ist ungültig.' };
	const dueDate = s('faellig');
	if (!isValidIsoDate(dueDate)) return { message: 'Das Datum „zahlbar bis" ist ungültig.' };
	if (dueDate < date) return { message: '„Zahlbar bis" liegt vor dem Rechnungsdatum.' };
	const from = s('von').trim();
	const to = s('bis').trim();
	if ((from && !isValidIsoDate(from)) || (to && !isValidIsoDate(to))) return { message: 'Der Leistungszeitraum ist ungültig.' };
	if (from && to && to < from) return { message: 'Der Leistungszeitraum endet vor seinem Beginn.' };
	const vat = parseAmount(s('ust'));
	if (vat == null || vat < 0 || vat > 100) return { message: 'Die Umsatzsteuer stimmt nicht.' };

	const indexes = new Set<number>();
	for (const key of form.keys()) {
		const m = /^z\.(\d+)\.art$/.exec(key);
		if (m) indexes.add(Number(m[1]));
	}
	const lines: SaveInvoice['lines'] = [];
	for (const [n, i] of [...indexes].sort((a, b) => a - b).entries()) {
		const titel = s(`z.${i}.art`) === 'titel';
		const text = s(`z.${i}.text`).replace(/\r\n/g, '\n').trim();
		const number = s(`z.${i}.nr`).trim().slice(0, 12);
		if (titel) {
			lines.push({ number, kind: 'titel', text, quantity: null, unit: '', unitPrice: null });
			continue;
		}
		const rawQty = s(`z.${i}.menge`).trim();
		const rawPrice = s(`z.${i}.preis`).trim();
		const quantity = parseAmount(rawQty);
		const unitPrice = parseAmount(rawPrice);
		if (rawQty && quantity == null) return { message: `Die Menge in Zeile ${n + 1} ist keine Zahl.` };
		if (rawPrice && unitPrice == null) return { message: `Der Einheitspreis in Zeile ${n + 1} ist keine Zahl.` };
		if (quantity && unitPrice == null) return { message: `In Zeile ${n + 1} fehlt der Einheitspreis.` };
		lines.push({
			number,
			kind: 'position',
			text,
			quantity: quantity == null ? null : Math.round(quantity * 1000) / 1000,
			unit: s(`z.${i}.einheit`).trim(),
			unitPrice: unitPrice == null ? null : Math.round(unitPrice * 10000) / 10000
		});
	}
	const billed = billedLines(lines).slice(0, MAX_OFFER_LINES);
	if (!billed.some((l) => l.kind === 'position')) return { message: 'Die Rechnung hat keine Position mit Menge.' };
	const reverseCharge = form.get('reverse') === 'on';
	const uid = s('k_uid').replace(/\s+/g, '').toUpperCase().slice(0, 30);
	if (reverseCharge && !uid) return { message: 'Für den Übergang der Steuerschuld braucht es die UID-Nummer des Kunden.' };
	const name = s('k_name').trim();
	if (!name) return { message: 'Bitte den Kunden eintragen.' };

	return {
		head: {
			date,
			dueDate,
			serviceFrom: from || null,
			serviceTo: to || null,
			title: s('titel').trim().slice(0, 300),
			location: s('ort').trim().slice(0, 300),
			projectNumber: s('projekt').trim().slice(0, 30),
			customerName: name.slice(0, 160),
			customerAddition: s('k_zusatz').trim().slice(0, 160),
			customerStreet: s('k_strasse').trim().slice(0, 160),
			customerZip: s('k_plz').trim().slice(0, 12),
			customerCity: s('k_ort').trim().slice(0, 120),
			customerUid: uid,
			intro: s('einleitung').replace(/\r\n/g, '\n').trimEnd().slice(0, 3000),
			closing: s('schluss').replace(/\r\n/g, '\n').trimEnd().slice(0, 5000),
			vatRate: Math.round(vat * 100) / 100,
			reverseCharge
		},
		lines: billed
	};
}

/** Zuordnung aus dem Formular: m.<Schlüssel> = Positions-ID oder „nein" */
export function readMapping(form: FormData, keys: string[]): Record<string, number | null> {
	const out: Record<string, number | null> = {};
	for (const key of keys) {
		const v = String(form.get(`m.${key}`) ?? '');
		if (v === 'nein') out[key] = null;
		else if (/^\d+$/.test(v)) out[key] = Number(v);
	}
	return out;
}

async function writeLines(tx: Tx, invoiceId: number, lines: SaveInvoice['lines']) {
	await tx.delete(invoicePositions).where(eq(invoicePositions.invoiceId, invoiceId));
	for (const [i, l] of lines.entries()) {
		await tx.insert(invoicePositions).values({
			invoiceId,
			sortOrder: i,
			number: l.number,
			kind: l.kind,
			text: l.text.slice(0, 4000),
			quantity: l.kind === 'titel' ? null : l.quantity,
			unit: l.kind === 'titel' ? '' : l.unit.slice(0, 20),
			unitPrice: l.kind === 'titel' ? null : l.unitPrice
		});
	}
}

/**
 * Rechnung anlegen – mit der Nummer des Auftrags. Die Zuordnung der Spalten
 * merkt sich der Auftrag. Gibt die ID zurück oder eine Meldung.
 */
export async function createInvoice(user: SessionUser, orderId: number, data: SaveInvoice, mapping: Record<string, number | null>): Promise<number | { message: string }> {
	return db.transaction(async (tx) => {
		const order = await tx.select().from(orders).where(eq(orders.id, orderId)).get();
		if (!order) return { message: 'Den Auftrag gibt es nicht mehr.' };
		if (order.status !== 'abgeschlossen') return { message: 'Eine Rechnung gibt es erst, wenn der Auftrag abgeschlossen ist.' };
		const taken = await tx
			.select({ id: invoices.id })
			.from(invoices)
			.where(or(eq(invoices.orderId, orderId), eq(invoices.number, order.number)))
			.get();
		if (taken) return { message: `Die Rechnung ${order.number} gibt es schon.` };
		const offer = order.offerId ? await tx.select({ customerId: offers.customerId }).from(offers).where(eq(offers.id, order.offerId)).get() : undefined;
		const row = await tx
			.insert(invoices)
			.values({
				number: order.number,
				orderId,
				offerId: order.offerId,
				customerId: offer?.customerId ?? null,
				...data.head,
				status: 'offen',
				createdBy: user.id,
				updatedAt: new Date()
			})
			.returning({ id: invoices.id })
			.get();
		await writeLines(tx, row.id, data.lines);
		await tx
			.update(orders)
			.set({ invoiceMapping: { ...(order.invoiceMapping ?? {}), ...mapping }, updatedAt: new Date() })
			.where(eq(orders.id, orderId));
		return row.id;
	});
}

/** Offene Rechnung ändern – bezahlte bleiben, wie sie sind */
export async function saveInvoice(id: number, data: SaveInvoice): Promise<boolean> {
	return db.transaction(async (tx) => {
		const done = await tx
			.update(invoices)
			// Neues Zahlungsziel: „überfällig" gilt dann wieder neu
			.set({ ...data.head, overdueNotifiedAt: null, updatedAt: new Date() })
			.where(and(eq(invoices.id, id), eq(invoices.status, 'offen')))
			.returning({ id: invoices.id });
		if (!done.length) return false;
		await writeLines(tx, id, data.lines);
		return true;
	});
}

export async function invoiceDetail(id: number) {
	if (!Number.isInteger(id)) return null;
	const invoice = await db
		.select({
			id: invoices.id,
			number: invoices.number,
			orderId: invoices.orderId,
			orderStatus: orders.status,
			offerId: invoices.offerId,
			date: invoices.date,
			serviceFrom: invoices.serviceFrom,
			serviceTo: invoices.serviceTo,
			dueDate: invoices.dueDate,
			projectNumber: invoices.projectNumber,
			title: invoices.title,
			location: invoices.location,
			customerName: invoices.customerName,
			customerAddition: invoices.customerAddition,
			customerStreet: invoices.customerStreet,
			customerZip: invoices.customerZip,
			customerCity: invoices.customerCity,
			customerUid: invoices.customerUid,
			intro: invoices.intro,
			closing: invoices.closing,
			vatRate: invoices.vatRate,
			reverseCharge: invoices.reverseCharge,
			status: invoices.status,
			paidOn: invoices.paidOn,
			paidByFirst: payer.firstName,
			paidByLast: payer.lastName,
			createdAt: invoices.createdAt,
			creatorFirst: creator.firstName,
			creatorLast: creator.lastName
		})
		.from(invoices)
		.leftJoin(orders, eq(orders.id, invoices.orderId))
		.leftJoin(creator, eq(creator.id, invoices.createdBy))
		.leftJoin(payer, eq(payer.id, invoices.paidBy))
		.where(eq(invoices.id, id))
		.get();
	if (!invoice) return null;
	const lines = await db
		.select({
			id: invoicePositions.id,
			number: invoicePositions.number,
			kind: invoicePositions.kind,
			text: invoicePositions.text,
			quantity: invoicePositions.quantity,
			unit: invoicePositions.unit,
			unitPrice: invoicePositions.unitPrice
		})
		.from(invoicePositions)
		.where(eq(invoicePositions.invoiceId, id))
		.orderBy(asc(invoicePositions.sortOrder), asc(invoicePositions.id))
		.all();
	return { ...invoice, lines };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof invoiceDetail>>>;

export async function setInvoicePaid(id: number, paidOn: string, userId: number) {
	await db
		.update(invoices)
		.set({ status: 'bezahlt', paidOn, paidBy: userId, updatedAt: new Date() })
		.where(eq(invoices.id, id));
}

export async function setInvoiceOpen(id: number) {
	await db
		.update(invoices)
		.set({ status: 'offen', paidOn: null, paidBy: null, overdueNotifiedAt: null, updatedAt: new Date() })
		.where(eq(invoices.id, id));
}

/** Brutto einer Rechnung aus dem Netto der Abfrage */
export const grossOf = (i: { net: number; vatRate: number; reverseCharge: boolean }) => round2(i.net * (1 + (i.reverseCharge ? 0 : i.vatRate) / 100));

/** Am Tag nach „zahlbar bis" melden – einmal je Rechnung, solange sie offen ist */
export async function notifyOverdueInvoices(day = today()) {
	const due = await db
		.select({
			id: invoices.id,
			number: invoices.number,
			customerName: invoices.customerName,
			dueDate: invoices.dueDate,
			vatRate: invoices.vatRate,
			reverseCharge: invoices.reverseCharge,
			net: netSum
		})
		.from(invoices)
		.where(and(eq(invoices.status, 'offen'), lt(invoices.dueDate, day), isNull(invoices.overdueNotifiedAt)))
		.all();
	for (const i of due) {
		await db.update(invoices).set({ overdueNotifiedAt: new Date() }).where(eq(invoices.id, i.id));
		notify({
			event: 'rechnung.ueberfaellig',
			title: `Rechnung ${spacedNumber(i.number)} überfällig`,
			body: [i.customerName, money(grossOf(i)), `zahlbar bis ${dateLabel(i.dueDate)}`].filter(Boolean).join(' · '),
			url: `/rechnungen/${i.id}`
		});
	}
}

/** Nur offene Rechnungen lassen sich löschen */
export async function deleteInvoice(id: number): Promise<boolean> {
	const done = await db
		.delete(invoices)
		.where(and(eq(invoices.id, id), eq(invoices.status, 'offen')))
		.returning({ id: invoices.id });
	return done.length > 0;
}
