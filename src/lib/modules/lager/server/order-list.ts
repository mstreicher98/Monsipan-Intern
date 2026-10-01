import { lowStockProducts } from './alerts';

/** Bestellvorschlag: bis zum Sollbestand auffüllen, ohne Sollbestand auf das Doppelte des Mindestbestands */
export async function orderList() {
	const items = await lowStockProducts();
	return items.map((p) => {
		const target = p.targetStock ?? (p.minStock ?? 0) * 2;
		return { ...p, suggested: Math.max(1, target - p.total) };
	});
}
