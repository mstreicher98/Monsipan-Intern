import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, type Tx } from '$lib/server/db';
import { locations, movements, parties, products, stock, users, type Movement, type MovementType } from '$lib/server/db/schema';

export class BookingError extends Error {
	constructor(
		message: string,
		public line?: number
	) {
		super(message);
	}
}

export interface BookingLine {
	productId: number;
	quantity: number;
	fromLocationId?: number | null;
	toLocationId?: number | null;
	/** Nur Inventur: gezählter Bestand */
	countedQuantity?: number | null;
}

export interface BookingInput {
	type: MovementType;
	lines: BookingLine[];
	/** Ausgabe an / Rückgabe von: entweder eine Partie … */
	partyId?: number | null;
	/** … oder eine Person (Benutzer ohne Partie bucht auf sich selbst) */
	recipientUserId?: number | null;
	note?: string;
}

export interface BookingResult {
	batchId: string;
	movementIds: number[];
	productIds: number[];
}

async function currentQty(tx: Tx, productId: number, locationId: number): Promise<number> {
	const row = await tx
		.select({ q: stock.quantity })
		.from(stock)
		.where(and(eq(stock.productId, productId), eq(stock.locationId, locationId)))
		.get();
	return row?.q ?? 0;
}

async function adjust(tx: Tx, productId: number, locationId: number, delta: number) {
	if (delta === 0) return;
	const now = new Date();
	await tx
		.insert(stock)
		.values({ productId, locationId, quantity: delta, updatedAt: now })
		.onConflictDoUpdate({
			target: [stock.productId, stock.locationId],
			set: { quantity: sql`${stock.quantity} + ${delta}`, updatedAt: now }
		});
	await tx
		.delete(stock)
		.where(and(eq(stock.productId, productId), eq(stock.locationId, locationId), eq(stock.quantity, 0)));
}

function isPositiveInt(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 1_000_000;
}

/** Bucht alle Zeilen in einer Transaktion – entweder alles oder nichts. */
export async function bookInTx(
	tx: Tx,
	input: BookingInput,
	userId: number,
	opts: { correctionOf?: number; batchId?: string } = {}
): Promise<BookingResult> {
	const { type, lines } = input;
	if (!lines.length) throw new BookingError('Keine Artikel in der Buchung.');
	if (lines.length > 500) throw new BookingError('Höchstens 500 Zeilen pro Buchung.');

	const needsParty = type === 'OUT' || type === 'RETURN';
	let partyId: number | null = null;
	let recipientUserId: number | null = null;
	if (needsParty) {
		if (input.partyId) {
			const party = await tx.select({ active: parties.active }).from(parties).where(eq(parties.id, input.partyId)).get();
			if (!party) throw new BookingError('Die gewählte Partie gibt es nicht mehr.');
			partyId = input.partyId;
		} else if (input.recipientUserId) {
			const person = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.recipientUserId)).get();
			if (!person) throw new BookingError('Die gewählte Person gibt es nicht mehr.');
			recipientUserId = input.recipientUserId;
		} else {
			throw new BookingError(type === 'OUT' ? 'Bitte angeben, an wen das Material geht.' : 'Bitte angeben, von wem die Rückgabe kommt.');
		}
	}

	const productIds = [...new Set(lines.map((l) => l.productId))];
	const found = await tx
		.select({ id: products.id, name: products.name, active: products.active })
		.from(products)
		.where(inArray(products.id, productIds))
		.all();
	const productName = new Map(found.map((p) => [p.id, p.name]));

	const locIds = new Set<number>();
	for (const l of lines) {
		if (l.fromLocationId) locIds.add(l.fromLocationId);
		if (l.toLocationId) locIds.add(l.toLocationId);
	}
	const locRows = locIds.size
		? await tx
				.select({ id: locations.id, name: locations.name, active: locations.active })
				.from(locations)
				.where(inArray(locations.id, [...locIds]))
				.all()
		: [];
	const loc = new Map(locRows.map((l) => [l.id, l]));

	const batchId = opts.batchId ?? randomUUID();
	const movementIds: number[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const name = productName.get(line.productId);
		if (!name) throw new BookingError('Artikel nicht gefunden.', i);

		let from = line.fromLocationId ?? null;
		let to = line.toLocationId ?? null;
		let quantity = line.quantity;
		let counted: number | null = null;
		let previous: number | null = null;

		const requireLoc = (id: number | null, label: string, mustBeActive: boolean) => {
			if (!id) throw new BookingError(`Bitte ${label} für „${name}“ wählen.`, i);
			const l = loc.get(id);
			if (!l) throw new BookingError(`Lagerort für „${name}“ nicht gefunden.`, i);
			if (mustBeActive && !l.active) throw new BookingError(`Lagerort „${l.name}“ ist deaktiviert.`, i);
			return l;
		};

		switch (type) {
			case 'IN':
			case 'RETURN':
				from = null;
				requireLoc(to, 'den Ziel-Lagerort', true);
				if (!isPositiveInt(quantity)) throw new BookingError(`Menge für „${name}“ muss eine ganze Zahl ab 1 sein.`, i);
				break;
			case 'OUT':
				to = null;
				requireLoc(from, 'den Lagerort', false);
				if (!isPositiveInt(quantity)) throw new BookingError(`Menge für „${name}“ muss eine ganze Zahl ab 1 sein.`, i);
				break;
			case 'TRANSFER':
				requireLoc(from, 'den Quell-Lagerort', false);
				requireLoc(to, 'den Ziel-Lagerort', true);
				if (from === to) throw new BookingError(`„${name}“: Quelle und Ziel sind derselbe Lagerort.`, i);
				if (!isPositiveInt(quantity)) throw new BookingError(`Menge für „${name}“ muss eine ganze Zahl ab 1 sein.`, i);
				break;
			case 'INVENTORY': {
				from = null;
				requireLoc(to, 'den Lagerort', false);
				const c = line.countedQuantity;
				if (typeof c !== 'number' || !Number.isInteger(c) || c < 0 || c > 1_000_000)
					throw new BookingError(`Gezählte Menge für „${name}“ fehlt oder ist ungültig.`, i);
				counted = c;
				previous = await currentQty(tx, line.productId, to!);
				quantity = Math.abs(counted - previous);
				break;
			}
		}

		// Bestand prüfen und anpassen
		if (type === 'OUT' || type === 'TRANSFER') {
			const have = await currentQty(tx, line.productId, from!);
			if (have < quantity) {
				const l = loc.get(from!)!;
				throw new BookingError(
					have === 0
						? `„${name}“ liegt nicht in ${l.name}.`
						: `Nur ${have} Stück „${name}“ in ${l.name} – ${quantity} gebucht.`,
					i
				);
			}
			await adjust(tx, line.productId, from!, -quantity);
		}
		if (type === 'IN' || type === 'RETURN' || type === 'TRANSFER') await adjust(tx, line.productId, to!, quantity);
		if (type === 'INVENTORY') await adjust(tx, line.productId, to!, counted! - previous!);

		const inserted = await tx
			.insert(movements)
			.values({
				batchId,
				type,
				productId: line.productId,
				quantity,
				fromLocationId: from,
				toLocationId: to,
				partyId,
				recipientUserId,
				countedQuantity: counted,
				previousQuantity: previous,
				note: (input.note ?? '').slice(0, 500),
				userId,
				correctionOf: opts.correctionOf ?? null
			})
			.returning({ id: movements.id })
			.get();
		movementIds.push(inserted.id);
	}

	return { batchId, movementIds, productIds };
}

export async function book(input: BookingInput, userId: number): Promise<BookingResult> {
	return db.transaction((tx) => bookInTx(tx, input, userId));
}

/* -------------------------------------------------------------- Storno */

async function reverseInTx(tx: Tx, m: Movement) {
	const name = (await tx.select({ n: products.name }).from(products).where(eq(products.id, m.productId)).get())?.n ?? '';
	const take = async (locationId: number, qty: number) => {
		const have = await currentQty(tx, m.productId, locationId);
		if (have < qty) {
			const l = await tx.select({ name: locations.name }).from(locations).where(eq(locations.id, locationId)).get();
			throw new BookingError(
				`Storno nicht möglich: In ${l?.name ?? 'dem Lagerort'} liegen nur noch ${have} Stück „${name}“, die Buchung braucht ${qty}.`
			);
		}
		await adjust(tx, m.productId, locationId, -qty);
	};
	switch (m.type) {
		case 'IN':
		case 'RETURN':
			await take(m.toLocationId!, m.quantity);
			break;
		case 'OUT':
			await adjust(tx, m.productId, m.fromLocationId!, m.quantity);
			break;
		case 'TRANSFER':
			await take(m.toLocationId!, m.quantity);
			await adjust(tx, m.productId, m.fromLocationId!, m.quantity);
			break;
		case 'INVENTORY': {
			const delta = (m.countedQuantity ?? 0) - (m.previousQuantity ?? 0);
			if (delta > 0) await take(m.toLocationId!, delta);
			else await adjust(tx, m.productId, m.toLocationId!, -delta);
			break;
		}
	}
}

async function loadOpenMovement(tx: Tx, id: number) {
	const m = await tx.select().from(movements).where(eq(movements.id, id)).get();
	if (!m) throw new BookingError('Buchung nicht gefunden.');
	if (m.cancelledAt) throw new BookingError('Diese Buchung ist bereits storniert.');
	return m;
}

export async function cancelMovement(id: number, userId: number, reason: string) {
	return db.transaction(async (tx) => {
		const m = await loadOpenMovement(tx, id);
		await reverseInTx(tx, m);
		await tx
			.update(movements)
			.set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason: reason.slice(0, 300) || null })
			.where(eq(movements.id, id));
		return m;
	});
}

/** Korrektur = Storno der alten Buchung + neue Buchung mit Verweis darauf */
export async function correctMovement(
	id: number,
	patch: {
		quantity: number;
		fromLocationId?: number | null;
		toLocationId?: number | null;
		partyId?: number | null;
		recipientUserId?: number | null;
		countedQuantity?: number | null;
		note?: string;
	},
	userId: number,
	reason: string
) {
	return db.transaction(async (tx) => {
		const m = await loadOpenMovement(tx, id);
		await reverseInTx(tx, m);
		await tx
			.update(movements)
			.set({ cancelledAt: new Date(), cancelledBy: userId, cancelReason: reason.slice(0, 300) || 'Korrigiert' })
			.where(eq(movements.id, id));
		const result = await bookInTx(
			tx,
			{
				type: m.type,
				// Empfänger bleibt erhalten, außer die Korrektur wählt einen anderen
				partyId: patch.partyId !== undefined ? patch.partyId : m.partyId,
				recipientUserId: patch.recipientUserId !== undefined ? patch.recipientUserId : m.recipientUserId,
				note: patch.note ?? m.note,
				lines: [
					{
						productId: m.productId,
						quantity: patch.quantity,
						fromLocationId: patch.fromLocationId !== undefined ? patch.fromLocationId : m.fromLocationId,
						toLocationId: patch.toLocationId !== undefined ? patch.toLocationId : m.toLocationId,
						countedQuantity: patch.countedQuantity !== undefined ? patch.countedQuantity : m.countedQuantity
					}
				]
			},
			userId,
			{ correctionOf: id, batchId: m.batchId }
		);
		return { original: m, result };
	});
}
