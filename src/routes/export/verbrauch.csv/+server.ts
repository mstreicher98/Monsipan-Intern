import { csvResponse, today, toCsv } from '$lib/server/csv';
import { requirePermission } from '$lib/server/guard';
import { consumptionMatrix } from '$lib/modules/lager/server/movements';
import { monthLong, unitLabel } from '$lib/format';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
	requirePermission(locals, 'lager.reports.view');
	const months = [6, 12, 24].includes(Number(url.searchParams.get('monate'))) ? Number(url.searchParams.get('monate')) : 12;
	const { keys, rows } = await consumptionMatrix(months, {
		categoryId: Number(url.searchParams.get('kat')) || null,
		partyId: Number(url.searchParams.get('partie')) || null
	});
	const header = ['Artikel', 'Artikelnummer', 'Materialart', 'Inhalt je Stück', 'Einheit', ...keys.map(monthLong), 'Gesamt (Stück)', 'Gesamtmenge'];
	const body = rows.map((r) => [
		r.name,
		r.articleNumber,
		r.categoryName,
		r.packageSize,
		unitLabel(r.unit),
		...keys.map((k) => r.months[k] ?? 0),
		r.total,
		r.packageSize != null ? r.total * r.packageSize : null
	]);
	return csvResponse(`verbrauch-${today()}.csv`, toCsv(header, body));
};
