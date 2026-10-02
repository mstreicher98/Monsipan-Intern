/**
 * Daten für Bestands- und Bewegungslisten zum Drucken und als PDF.
 * Beide Wege nehmen dieselbe Quelle, damit Papier und Datei gleich aussehen.
 */
import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { categoryOptions, colorOptions, locationOptions, partyOptions } from '$lib/server/options';
import { fullName, MOVEMENT_LABELS } from '$lib/format';
import { stockByLocation } from './products';
import { listStock, parseStockFilter } from './stock-list';
import { PERIODS, readMovementQuery, toMovementFilter } from './movement-filter';
import { countMovements, listMovements } from './movements';

/** So viele Zeilen kommen höchstens aufs Papier */
export const MAX_ROWS = 2000;

const STATUS_TEXT: Record<string, string> = {
	aktiv: 'Alle aktiven Artikel',
	nachbestellen: 'Nur Artikel zum Nachbestellen',
	leer: 'Nur Artikel ohne Bestand',
	inaktiv: 'Nur inaktive Artikel',
	alle: 'Alle Artikel'
};

const SORT_TEXT: Record<string, string> = {
	name: 'nach Name',
	bestand: 'nach Bestand aufsteigend',
	'bestand-ab': 'nach Bestand absteigend',
	nummer: 'nach Artikelnummer'
};

export async function stockPrintData(url: URL) {
	const filter = parseStockFilter(url);
	const [{ rows, count }, locations, categories, colors] = await Promise.all([
		listStock(filter, MAX_ROWS, 0),
		locationOptions(false),
		categoryOptions(),
		colorOptions()
	]);
	const byLoc = await stockByLocation(rows.map((r) => r.id));
	const locName = new Map(locations.map((l) => [l.id, l.name]));
	const locOrder = new Map(locations.map((l, i) => [l.id, i]));

	const facts = [STATUS_TEXT[filter.status] ?? STATUS_TEXT.aktiv];
	if (filter.q) facts.push(`Suche: „${filter.q}“`);
	if (filter.locationId) facts.push(`Lagerort: ${locName.get(filter.locationId) ?? '?'}`);
	if (filter.categoryId) facts.push(`Materialart: ${categories.find((c) => c.id === filter.categoryId)?.name ?? '?'}`);
	if (filter.colorId) facts.push(`Farbe: ${colors.find((c) => c.id === filter.colorId)?.name ?? '?'}`);
	facts.push(`Sortiert ${SORT_TEXT[filter.sort] ?? SORT_TEXT.name}`);
	facts.push(count === 1 ? '1 Artikel' : `${count} Artikel`);

	return {
		facts,
		count,
		notice:
			count > rows.length ? `Es werden die ersten ${rows.length} von ${count} Artikeln gedruckt. Zum Kürzen die Filter enger stellen.` : null,
		items: rows.map((r) => ({
			...r,
			locations: (byLoc.get(r.id) ?? [])
				.sort((a, b) => (locOrder.get(a.locationId) ?? 0) - (locOrder.get(b.locationId) ?? 0))
				.map((l) => ({ ...l, name: locName.get(l.locationId) ?? '?' }))
		}))
	};
}

const date = (s: string) => {
	const [y, m, d] = s.split('-');
	return `${d}.${m}.${y}`;
};

export async function movementsPrintData(url: URL) {
	const query = readMovementQuery(url);
	const filter = await toMovementFilter(query);
	const [rows, count, locations, parties, userList] = await Promise.all([
		listMovements(filter, MAX_ROWS, 0),
		countMovements(filter),
		locationOptions(false),
		partyOptions(false),
		db
			.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username })
			.from(users)
			.orderBy(asc(users.firstName))
			.all()
	]);

	const period = PERIODS.find((p) => p.value === query.period);
	const facts: string[] = [];
	if (query.period === 'frei' && (query.von || query.bis)) {
		facts.push(`Zeitraum ${query.von ? date(query.von) : 'Beginn'} bis ${query.bis ? date(query.bis) : 'heute'}`);
	} else {
		facts.push(period?.label ?? 'Letzte 30 Tage');
	}
	if (query.art) facts.push(`Art: ${MOVEMENT_LABELS[query.art]}`);
	if (query.ort) facts.push(`Lagerort: ${locations.find((l) => l.id === query.ort)?.name ?? '?'}`);
	if (query.partie) facts.push(`Partie: ${parties.find((p) => p.id === query.partie)?.name ?? '?'}`);
	if (query.nutzer) {
		const u = userList.find((x) => x.id === query.nutzer);
		facts.push(`Gebucht von: ${u ? fullName(u) : '?'}`);
	}
	if (query.q) facts.push(`Suche: „${query.q}“`);
	if (!query.stornos) facts.push('ohne Stornos');
	facts.push(count === 1 ? '1 Buchung' : `${count} Buchungen`);

	return {
		facts,
		count,
		notice:
			count > rows.length
				? `Es werden die neuesten ${rows.length} von ${count} Buchungen gedruckt. Zum Kürzen den Zeitraum enger stellen.`
				: null,
		rows
	};
}
