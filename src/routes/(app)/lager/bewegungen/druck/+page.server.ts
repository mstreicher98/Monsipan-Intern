import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { PERIODS, readMovementQuery, toMovementFilter } from '$lib/modules/lager/server/movement-filter';
import { countMovements, listMovements } from '$lib/modules/lager/server/movements';
import { locationOptions, partyOptions } from '$lib/server/options';
import { fullName } from '$lib/format';
import { MOVEMENT_LABELS } from '$lib/format';
import type { PageServerLoad } from './$types';

/** So viele Zeilen kommen höchstens aufs Papier */
const MAX_ROWS = 2000;

const date = (s: string) => {
	const [y, m, d] = s.split('-');
	return `${d}.${m}.${y}`;
};

export const load: PageServerLoad = async ({ url, depends, locals }) => {
	depends('app:stock');
	requirePermission(locals, 'lager.movements.view');
	const query = readMovementQuery(url);
	const filter = await toMovementFilter(query);
	const [rows, count, locations, parties, userList] = await Promise.all([
		listMovements(filter, MAX_ROWS, 0),
		countMovements(filter),
		locationOptions(false),
		partyOptions(false),
		db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username }).from(users).orderBy(asc(users.firstName)).all()
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
		notice: count > rows.length ? `Es werden die neuesten ${rows.length} von ${count} Buchungen gedruckt. Zum Kürzen den Zeitraum enger stellen.` : null,
		rows
	};
};
