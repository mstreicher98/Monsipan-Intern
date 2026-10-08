import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { afterStockChange } from '$lib/modules/lager/server/alerts';
import { inventoryList } from '$lib/modules/lager/server/inventory';
import { book, BookingError } from '$lib/modules/lager/server/stock';
import { requirePermission } from '$lib/server/guard';
import { locationOptions } from '$lib/server/options';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, depends }) => {
	depends('app:stock');
	requirePermission(locals, 'lager.bestand.inventur');
	const locations = await locationOptions();
	const wanted = Number(url.searchParams.get('ort'));
	const locationId = locations.some((l) => l.id === wanted) ? wanted : null;
	return {
		locations,
		locationId,
		items: locationId ? await inventoryList(locationId) : []
	};
};

const Payload = z.object({
	locationId: z.number().int().positive(),
	note: z.string().max(500).optional(),
	lines: z
		.array(z.object({ productId: z.number().int().positive(), counted: z.number().int().min(0).max(1_000_000) }))
		.min(1)
		.max(1000)
});

export const actions: Actions = {
	save: async ({ request, locals, url }) => {
		const user = requirePermission(locals, 'lager.bestand.inventur');
		let raw: unknown;
		try {
			raw = JSON.parse(String((await request.formData()).get('payload') ?? ''));
		} catch {
			return fail(400, { message: 'Ungültige Daten.' });
		}
		const parsed = Payload.safeParse(raw);
		if (!parsed.success) return fail(400, { message: 'Es wurde nichts gezählt – bitte mindestens eine Menge eintragen.' });

		try {
			const result = await book(
				{
					type: 'INVENTORY',
					note: parsed.data.note,
					lines: parsed.data.lines.map((l) => ({
						productId: l.productId,
						quantity: 0,
						toLocationId: parsed.data.locationId,
						countedQuantity: l.counted
					}))
				},
				user.id
			);
			afterStockChange(result.productIds, url.origin);
			return { ok: true, count: result.movementIds.length };
		} catch (err) {
			if (err instanceof BookingError) return fail(400, { message: err.message, line: err.line ?? null });
			throw err;
		}
	}
};
