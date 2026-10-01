import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { afterStockChange } from '$lib/modules/lager/server/alerts';
import { MOVEMENT_TYPES } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { locationOptions, partyOptions } from '$lib/server/options';
import { productWithLocations } from '$lib/modules/lager/server/products';
import { book, BookingError } from '$lib/modules/lager/server/stock';
import { fullName } from '$lib/format';
import { can } from '$lib/permissions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:stock');
	const user = requirePermission(locals, 'lager.stock.book');
	const productId = Number(url.searchParams.get('produkt'));
	const [locations, parties, prefill] = await Promise.all([
		locationOptions(),
		partyOptions(),
		Number.isInteger(productId) && productId > 0 ? productWithLocations(productId) : null
	]);
	const art = url.searchParams.get('art');
	// Eigene Partie vorauswählen, sofern sie aktiv ist – sonst die eigene Person
	const defaultPartyId = user.partyId && parties.some((p) => p.id === user.partyId) ? user.partyId : null;
	return {
		locations,
		parties,
		defaultPartyId,
		selfName: fullName(user),
		prefill,
		initialType: (MOVEMENT_TYPES as readonly string[]).includes(art ?? '') ? (art as (typeof MOVEMENT_TYPES)[number]) : null,
		canInventory: can(user.role, 'lager.stock.inventory')
	};
};

const Payload = z.object({
	type: z.enum(MOVEMENT_TYPES),
	partyId: z.number().int().positive().nullable().optional(),
	/** Ausgabe an / Rückgabe von der buchenden Person selbst */
	recipientSelf: z.boolean().optional(),
	note: z.string().max(500).optional(),
	lines: z
		.array(
			z.object({
				productId: z.number().int().positive(),
				quantity: z.number().int().min(0).max(1_000_000),
				fromLocationId: z.number().int().positive().nullable().optional(),
				toLocationId: z.number().int().positive().nullable().optional(),
				countedQuantity: z.number().int().min(0).max(1_000_000).nullable().optional()
			})
		)
		.min(1)
		.max(500)
});

export const actions: Actions = {
	book: async ({ request, locals, url }) => {
		const user = requirePermission(locals, 'lager.stock.book');
		let raw: unknown;
		try {
			raw = JSON.parse(String((await request.formData()).get('payload') ?? ''));
		} catch {
			return fail(400, { message: 'Ungültige Buchungsdaten.' });
		}
		const parsed = Payload.safeParse(raw);
		if (!parsed.success) return fail(400, { message: 'Buchungsdaten unvollständig – bitte Eingaben prüfen.' });
		if (parsed.data.type === 'INVENTORY' && !can(user.role, 'lager.stock.inventory')) {
			return fail(403, { message: 'Inventur ist der Bauleitung vorbehalten.' });
		}
		const { recipientSelf, ...input } = parsed.data;
		try {
			const result = await book(
				{ ...input, partyId: recipientSelf ? null : input.partyId, recipientUserId: recipientSelf ? user.id : null },
				user.id
			);
			afterStockChange(result.productIds, url.origin);
			const units = parsed.data.lines.reduce((s, l) => s + l.quantity, 0);
			return { ok: true, batchId: result.batchId, count: result.movementIds.length, units, type: parsed.data.type };
		} catch (err) {
			if (err instanceof BookingError) return fail(400, { message: err.message, line: err.line ?? null });
			throw err;
		}
	}
};
