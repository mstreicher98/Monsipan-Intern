/**
 * Aufträge: entstehen aus einem angenommenen Angebot – mit derselben Nummer,
 * Anschrift und Positionen, aber ohne Preise – und gehen an eine Partie. Die
 * Partie setzt sie auf „in Arbeit" und „abgeschlossen".
 *
 * Wer nicht alle Aufträge sehen darf, sieht die seiner Partie.
 */
import { and, asc, desc, eq, like, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { can } from '$lib/permissions';
import { db } from '$lib/server/db';
import { customers, offerPositions, offers, orderDocuments, orderPositions, orders, parties, users, type OrderStatus } from '$lib/server/db/schema';
import type { SessionUser } from '$lib/server/auth';
import { storeDocument } from '$lib/server/documents';
import { titleFromFileName } from '$lib/documents';

const creator = alias(users, 'creator');
const statusUser = alias(users, 'status_user');

function scope(user: SessionUser): SQL | undefined {
	if (can(user.role, 'auftraege.alle.sehen')) return undefined;
	// Ohne Partie gibt es nichts zu sehen
	return user.partyId ? eq(orders.partyId, user.partyId) : eq(orders.id, -1);
}

export interface OrderFilter {
	q?: string;
	status?: string;
	partyId?: number | null;
}

export async function listOrders(user: SessionUser, filter: OrderFilter = {}, limit = 200) {
	const where: (SQL | undefined)[] = [scope(user)];
	if (filter.status === 'offen') where.push(or(eq(orders.status, 'erstellt'), eq(orders.status, 'in_arbeit')));
	else if (filter.status) where.push(eq(orders.status, filter.status as OrderStatus));
	if (filter.partyId) where.push(eq(orders.partyId, filter.partyId));
	if (filter.q?.trim()) {
		const q = `%${filter.q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		where.push(
			or(like(orders.number, q), like(orders.title, q), like(orders.location, q), like(orders.customerName, q), like(orders.projectNumber, q))
		);
	}
	return db
		.select({
			id: orders.id,
			number: orders.number,
			title: orders.title,
			location: orders.location,
			customerName: orders.customerName,
			customerCity: orders.customerCity,
			status: orders.status,
			partyName: parties.name,
			createdAt: orders.createdAt,
			statusAt: orders.statusAt
		})
		.from(orders)
		.leftJoin(parties, eq(parties.id, orders.partyId))
		.where(and(...where))
		// Laufende zuerst, dann neue, erledigte zuletzt
		.orderBy(sql`case ${orders.status} when 'in_arbeit' then 0 when 'erstellt' then 1 else 2 end`, desc(orders.createdAt))
		.limit(limit)
		.all();
}

export async function orderDetail(id: number) {
	if (!Number.isInteger(id)) return null;
	const order = await db
		.select({
			id: orders.id,
			number: orders.number,
			offerId: orders.offerId,
			partyId: orders.partyId,
			partyName: parties.name,
			status: orders.status,
			projectNumber: orders.projectNumber,
			title: orders.title,
			location: orders.location,
			customerName: orders.customerName,
			customerAddition: orders.customerAddition,
			customerStreet: orders.customerStreet,
			customerZip: orders.customerZip,
			customerCity: orders.customerCity,
			customerContact: orders.customerContact,
			customerPhone: orders.customerPhone,
			note: orders.note,
			statusAt: orders.statusAt,
			statusByFirst: statusUser.firstName,
			statusByLast: statusUser.lastName,
			createdAt: orders.createdAt,
			creatorFirst: creator.firstName,
			creatorLast: creator.lastName
		})
		.from(orders)
		.leftJoin(parties, eq(parties.id, orders.partyId))
		.leftJoin(creator, eq(creator.id, orders.createdBy))
		.leftJoin(statusUser, eq(statusUser.id, orders.statusBy))
		.where(eq(orders.id, id))
		.get();
	if (!order) return null;
	const lines = await db
		.select({ id: orderPositions.id, kind: orderPositions.kind, text: orderPositions.text, quantity: orderPositions.quantity, unit: orderPositions.unit })
		.from(orderPositions)
		.where(eq(orderPositions.orderId, id))
		.orderBy(asc(orderPositions.sortOrder), asc(orderPositions.id))
		.all();
	return { ...order, lines, documents: await listOrderDocuments(id) };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof orderDetail>>>;

/**
 * Auftrag aus dem angenommenen Angebot: Nummer, Anschrift und Positionen
 * werden übernommen, Ansprechpartner und Telefon aus dem Kundenstamm.
 * Gibt die ID zurück – oder null, wenn das Angebot nicht (mehr) passt.
 */
export async function createOrderFromOffer(offerId: number, partyId: number, note: string, userId: number): Promise<number | null> {
	return db.transaction(async (tx) => {
		const offer = await tx.select().from(offers).where(eq(offers.id, offerId)).get();
		if (!offer || offer.status !== 'angenommen') return null;
		const existing = await tx.select({ id: orders.id }).from(orders).where(eq(orders.offerId, offerId)).get();
		if (existing) return existing.id;
		const customer = offer.customerId ? await tx.select().from(customers).where(eq(customers.id, offer.customerId)).get() : null;
		const row = await tx
			.insert(orders)
			.values({
				number: offer.number,
				offerId,
				partyId,
				projectNumber: offer.projectNumber,
				title: offer.title,
				location: offer.location,
				customerName: offer.customerName,
				customerAddition: offer.customerAddition,
				customerStreet: offer.customerStreet,
				customerZip: offer.customerZip,
				customerCity: offer.customerCity,
				customerContact: customer?.contact ?? '',
				customerPhone: customer?.phone ?? '',
				note: note.slice(0, 2000),
				createdBy: userId,
				updatedAt: new Date()
			})
			.returning({ id: orders.id })
			.get();
		const lines = await tx
			.select()
			.from(offerPositions)
			.where(eq(offerPositions.offerId, offerId))
			.orderBy(asc(offerPositions.sortOrder), asc(offerPositions.id))
			.all();
		for (const [i, l] of lines.entries()) {
			await tx.insert(orderPositions).values({ orderId: row.id, sortOrder: i, kind: l.kind, text: l.text, quantity: l.quantity, unit: l.unit });
		}
		return row.id;
	});
}

export async function setOrderStatus(id: number, status: OrderStatus, userId: number) {
	await db.update(orders).set({ status, statusBy: userId, statusAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, id));
}

export async function updateOrder(id: number, data: { partyId: number; location: string; note: string }) {
	await db
		.update(orders)
		.set({ partyId: data.partyId, location: data.location.slice(0, 300), note: data.note.slice(0, 2000), updatedAt: new Date() })
		.where(eq(orders.id, id));
}

/**
 * Aufträge, an die ein Tagesbericht gehängt werden kann: die offenen, die
 * dieser Benutzer sieht – dazu der schon verknüpfte, auch wenn er erledigt ist.
 */
export async function linkableOrders(user: SessionUser, current: number | null = null) {
	const where: (SQL | undefined)[] = [scope(user)];
	const open = or(eq(orders.status, 'erstellt'), eq(orders.status, 'in_arbeit'));
	where.push(current ? or(open, eq(orders.id, current)) : open);
	return db
		.select({ id: orders.id, number: orders.number, title: orders.title, location: orders.location, partyId: orders.partyId })
		.from(orders)
		.where(and(...where))
		.orderBy(desc(orders.createdAt))
		.limit(200)
		.all();
}

/* ---------------------------------------------------------- Unterlagen */

export function listOrderDocuments(orderId: number) {
	return db
		.select({
			id: orderDocuments.id,
			title: orderDocuments.title,
			fileName: orderDocuments.fileName,
			size: orderDocuments.size,
			createdAt: orderDocuments.createdAt
		})
		.from(orderDocuments)
		.where(eq(orderDocuments.orderId, orderId))
		.orderBy(asc(orderDocuments.createdAt), asc(orderDocuments.id))
		.all();
}

/** PDF ablegen (wie die PDFs am Artikel) und an den Auftrag hängen; der Titel kommt aus dem Dateinamen */
export async function addOrderDocument(orderId: number, file: File, userId: number) {
	await insertOrderDocument(orderId, file.name, await storeDocument(file), userId);
}

/** Eintrag für eine schon abgelegte Datei – beim Erstellen des Auftrags werden die PDFs vorher geprüft */
export async function insertOrderDocument(orderId: number, name: string, stored: { sha256: string; size: number }, userId: number) {
	const fileName = (name || 'unterlage.pdf').slice(0, 200);
	await db.insert(orderDocuments).values({
		orderId,
		title: titleFromFileName(fileName) || 'Unterlage',
		fileName: /\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`,
		sha256: stored.sha256,
		size: stored.size,
		uploadedBy: userId
	});
}

export function getOrderDocument(orderId: number, documentId: number) {
	return db
		.select()
		.from(orderDocuments)
		.where(and(eq(orderDocuments.id, documentId), eq(orderDocuments.orderId, orderId)))
		.get();
}

/** Die Datei bleibt noch eine Weile für Sicherungen liegen */
export async function deleteOrderDocument(orderId: number, documentId: number) {
	await db.delete(orderDocuments).where(and(eq(orderDocuments.id, documentId), eq(orderDocuments.orderId, orderId)));
}

/**
 * Auftrag löschen – Positionen und Unterlagen gehen mit, seine Tagesberichte
 * bleiben (ohne Auftrag). Das Angebot bleibt angenommen; daraus lässt sich neu
 * ein Auftrag erstellen.
 */
export async function deleteOrder(id: number) {
	await db.delete(orders).where(eq(orders.id, id));
}

/** Löschen: noch nicht begonnene, wer Aufträge erstellt – sonst nur mit „Aufträge löschen" */
export function mayDeleteOrder(user: SessionUser, order: { status: string }): boolean {
	return can(user.role, 'auftraege.loeschen') || (order.status === 'erstellt' && can(user.role, 'auftraege.erstellen'));
}

export function mayViewOrder(user: SessionUser, order: { partyId: number | null }): boolean {
	if (can(user.role, 'auftraege.alle.sehen')) return true;
	return !!user.partyId && user.partyId === order.partyId;
}

/** Status setzen: die eigene Partie – das Büro (Aufträge erstellen) bei allen */
export function maySetOrderStatus(user: SessionUser, order: { partyId: number | null }): boolean {
	if (!can(user.role, 'auftraege.status')) return false;
	return can(user.role, 'auftraege.erstellen') || (!!user.partyId && user.partyId === order.partyId);
}

/** Aktive Partien zur Auswahl */
export function activeParties() {
	return db
		.select({ id: parties.id, name: parties.name })
		.from(parties)
		.where(and(eq(parties.active, true), eq(parties.kind, 'gruppe')))
		.orderBy(asc(parties.name))
		.all();
}
