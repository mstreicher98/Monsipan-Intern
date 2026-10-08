import { csvResponse, today, toCsv } from '$lib/server/csv';
import { requirePermission } from '$lib/server/guard';
import { readMovementQuery, toMovementFilter } from '$lib/modules/lager/server/movement-filter';
import { listMovements } from '$lib/modules/lager/server/movements';
import { MOVEMENT_NOUNS, fullName, unitLabel } from '$lib/format';
import { counterpart } from '$lib/modules/lager/movement-view';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'lager.bewegungen.sehen');
	const filter = await toMovementFilter(readMovementQuery(url));
	const rows = await listMovements(filter, 100_000, 0);
	const header = [
		'Zeitpunkt',
		'Art',
		'Artikel',
		'Artikelnummer',
		'Menge (Stück)',
		'Inhalt je Stück',
		'Einheit',
		'Von Lagerort',
		'Nach Lagerort',
		'Partie / Person',
		'Gezählt',
		'Vorher',
		'Gebucht von',
		'Notiz',
		'Storniert am',
		'Storno-Grund'
	];
	const body = rows.map((r) => {
		const signed =
			r.type === 'OUT'
				? -r.quantity
				: r.type === 'INVENTORY'
					? (r.countedQuantity ?? 0) - (r.previousQuantity ?? 0)
					: r.quantity;
		return [
			r.createdAt,
			MOVEMENT_NOUNS[r.type],
			r.productName,
			r.articleNumber,
			signed,
			r.packageSize,
			unitLabel(r.unit),
			r.fromLocation,
			r.toLocation,
			counterpart(r),
			r.countedQuantity,
			r.previousQuantity,
			fullName({ firstName: r.userFirst, lastName: r.userLast, username: r.username }),
			r.note,
			r.cancelledAt,
			r.cancelReason
		];
	});
	return csvResponse(`bewegungen-${today()}.csv`, toCsv(header, body));
};
