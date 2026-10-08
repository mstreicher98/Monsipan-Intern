import { fail } from '@sveltejs/kit';
import { asc } from 'drizzle-orm';
import { afterStockChange } from '$lib/modules/lager/server/alerts';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { intOrNull, requirePermission, str } from '$lib/server/guard';
import { PERIODS, readMovementQuery, toMovementFilter } from '$lib/modules/lager/server/movement-filter';
import { countMovements, listMovements } from '$lib/modules/lager/server/movements';
import { locationOptions, partyOptions } from '$lib/server/options';
import { BookingError, cancelMovement, correctMovement } from '$lib/modules/lager/server/stock';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url, depends, locals }) => {
	depends('app:stock');
	requirePermission(locals, 'lager.bewegungen.sehen');
	const query = readMovementQuery(url);
	const filter = await toMovementFilter(query);
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const [rows, count, locations, parties, userList] = await Promise.all([
		listMovements(filter, PAGE_SIZE, (page - 1) * PAGE_SIZE),
		countMovements(filter),
		locationOptions(false),
		partyOptions(false),
		db
			.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, deletedAt: users.deletedAt })
			.from(users)
			.orderBy(asc(users.firstName))
			.all()
	]);
	return { query, rows, count, page, pageSize: PAGE_SIZE, locations, parties, users: userList, periods: PERIODS };
};

export const actions: Actions = {
	cancel: async ({ request, locals, url }) => {
		const user = requirePermission(locals, 'lager.bewegungen.bearbeiten');
		const form = await request.formData();
		const id = intOrNull(form.get('id'));
		const reason = str(form.get('reason'), 300);
		if (!id) return fail(400, { message: 'Buchung fehlt.' });
		if (!reason) return fail(400, { message: 'Bitte einen Grund angeben.', id });
		try {
			const m = await cancelMovement(id, user.id, reason);
			afterStockChange([m.productId], url.origin);
			return { cancelled: id };
		} catch (err) {
			if (err instanceof BookingError) return fail(400, { message: err.message, id });
			throw err;
		}
	},
	correct: async ({ request, locals, url }) => {
		const user = requirePermission(locals, 'lager.bewegungen.bearbeiten');
		const form = await request.formData();
		const id = intOrNull(form.get('id'));
		const quantity = intOrNull(form.get('quantity'));
		const counted = intOrNull(form.get('countedQuantity'));
		const reason = str(form.get('reason'), 300);
		if (!id) return fail(400, { message: 'Buchung fehlt.' });
		if (!reason) return fail(400, { message: 'Bitte einen Grund angeben.', id });
		// "party:3" oder "user:7" – Empfänger von Ausgabe/Rückgabe
		const recipient = /^(party|user):(\d+)$/.exec(String(form.get('recipient') ?? ''));
		const recipientPatch = recipient
			? recipient[1] === 'party'
				? { partyId: Number(recipient[2]), recipientUserId: null }
				: { partyId: null, recipientUserId: Number(recipient[2]) }
			: {};
		try {
			const { original } = await correctMovement(
				id,
				{
					quantity: quantity ?? 0,
					fromLocationId: form.has('fromLocationId') ? intOrNull(form.get('fromLocationId')) : undefined,
					toLocationId: form.has('toLocationId') ? intOrNull(form.get('toLocationId')) : undefined,
					...recipientPatch,
					countedQuantity: form.has('countedQuantity') ? counted : undefined,
					note: form.has('note') ? str(form.get('note'), 500) : undefined
				},
				user.id,
				`Korrektur: ${reason}`
			);
			afterStockChange([original.productId], url.origin);
			return { corrected: id };
		} catch (err) {
			if (err instanceof BookingError) return fail(400, { message: err.message, id });
			throw err;
		}
	}
};
