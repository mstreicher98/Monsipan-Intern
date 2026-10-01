import type { LookupResult } from '$lib/modules/lager/types';

export async function lookupScan(variants: string[]): Promise<LookupResult> {
	const params = new URLSearchParams();
	for (const v of variants) params.append('v', v);
	const res = await fetch(`/api/lookup?${params}`);
	if (!res.ok) throw new Error('Suche fehlgeschlagen');
	return res.json();
}
