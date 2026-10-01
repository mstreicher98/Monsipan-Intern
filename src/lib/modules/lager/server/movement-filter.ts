import { MOVEMENT_TYPES, type MovementType } from '$lib/server/db/schema';
import type { MovementFilter } from './movements';
import { searchCondition } from './products';

export const PERIODS = [
	{ value: 'heute', label: 'Heute' },
	{ value: '7', label: 'Letzte 7 Tage' },
	{ value: '30', label: 'Letzte 30 Tage' },
	{ value: 'monat', label: 'Dieser Monat' },
	{ value: 'vormonat', label: 'Letzter Monat' },
	{ value: 'alle', label: 'Gesamter Zeitraum' },
	{ value: 'frei', label: 'Eigener Zeitraum' }
] as const;

function parseDate(s: string | null): Date | null {
	if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export interface MovementQuery {
	period: string;
	von: string;
	bis: string;
	art: MovementType | '';
	ort: number | null;
	partie: number | null;
	nutzer: number | null;
	q: string;
	stornos: boolean;
}

export function readMovementQuery(url: URL): MovementQuery {
	const n = (k: string) => {
		const v = Number(url.searchParams.get(k));
		return Number.isInteger(v) && v > 0 ? v : null;
	};
	const art = url.searchParams.get('art') ?? '';
	const period = url.searchParams.get('zeitraum') ?? '30';
	return {
		period: PERIODS.some((p) => p.value === period) ? period : '30',
		von: url.searchParams.get('von') ?? '',
		bis: url.searchParams.get('bis') ?? '',
		art: (MOVEMENT_TYPES as readonly string[]).includes(art) ? (art as MovementType) : '',
		ort: n('ort'),
		partie: n('partie'),
		nutzer: n('nutzer'),
		q: (url.searchParams.get('q') ?? '').slice(0, 200),
		stornos: url.searchParams.get('stornos') !== 'nein'
	};
}

export async function toMovementFilter(q: MovementQuery): Promise<MovementFilter> {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	let from: Date | null = null;
	let to: Date | null = null;
	switch (q.period) {
		case 'heute':
			from = today;
			break;
		case '7':
			from = new Date(today.getTime() - 6 * 86_400_000);
			break;
		case '30':
			from = new Date(today.getTime() - 29 * 86_400_000);
			break;
		case 'monat':
			from = new Date(now.getFullYear(), now.getMonth(), 1);
			break;
		case 'vormonat':
			from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
			to = new Date(now.getFullYear(), now.getMonth(), 1);
			break;
		case 'frei': {
			from = parseDate(q.von);
			const b = parseDate(q.bis);
			to = b ? new Date(b.getTime() + 86_400_000) : null;
			break;
		}
	}
	return {
		from,
		to,
		types: q.art ? [q.art] : undefined,
		locationId: q.ort,
		partyId: q.partie,
		userId: q.nutzer,
		includeCancelled: q.stornos,
		productCondition: await searchCondition(q.q)
	};
}
