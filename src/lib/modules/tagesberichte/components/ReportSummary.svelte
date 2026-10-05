<script lang="ts">
	/**
	 * Der Tagesbericht untereinander statt als Vordruck – für schmale Bildschirme
	 * und für den Kunden. Intern kommen Kostenstelle und Notiz dazu.
	 */
	import { dateTime } from '$lib/format';
	import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
	import { columnSums, filmLabel, quantityLabel, sumLabel } from '../sheet';

	interface Report {
		date: string;
		road: string;
		site: string;
		costCenter: string;
		dailyOutput: string;
		lvPosition: string;
		note: string;
		positions: { lbPos: string; unit: string; totalQuantity: number | null }[];
		rows: { id: number; label: string; quantities: (number | null)[] }[];
		materials: { material: string; code: string; filmThickness: string }[];
		releaseSignature: string | null;
		releasedAt: Date | null;
		releasedByFirst: string | null;
		releasedByLast: string | null;
		customerName: string | null;
		customerSignature: string | null;
		customerSignedAt: Date | null;
	}
	interface Props {
		report: Report;
		/** Kostenstelle und Notiz zeigen – nicht auf der Seite des Kunden */
		internal?: boolean;
	}
	let { report, internal = true }: Props = $props();

	const sums = $derived(columnSums(report.rows, report.positions.length));
	const has = (v: number | null | undefined) => v != null && Number.isFinite(v);
	const rows = $derived(report.rows.filter((r) => r.label.trim() || r.quantities.some(has)));
	const releaser = $derived([report.releasedByFirst, report.releasedByLast].filter(Boolean).join(' '));
	const date = (iso: string) => {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	};
</script>

{#snippet signature(label: string, path: string | null, who: string, at: Date | null)}
	<div class="rounded-xl border border-line p-3">
		<p class="text-[0.8125rem] text-ink-3">{label}</p>
		{#if path && at}
			<svg viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}" class="mt-1 h-14 w-full rounded-lg bg-white" role="img" aria-label="Unterschrift {who}">
				<path d={path} fill="none" stroke="#1d2127" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
			<p class="mt-1 text-[0.8125rem]">{[who, dateTime(at)].filter(Boolean).join(', ')}</p>
		{:else}
			<p class="mt-1 text-sm text-ink-3">noch nicht unterschrieben</p>
		{/if}
	</div>
{/snippet}

<div class="space-y-4">
	<p class="num text-sm text-ink-2">
		{[
			date(report.date),
			report.road && `Bundesstraße ${report.road}`,
			report.site && `Baustelle ${report.site}`,
			internal && report.costCenter && `Kostenstelle ${report.costCenter}`
		]
			.filter(Boolean)
			.join(' · ')}
	</p>

	<section>
		<h3 class="mb-1.5 text-[0.9375rem] font-semibold">Leistungen</h3>
		<ul class="divide-y divide-line rounded-xl border border-line">
			{#each report.positions as p, i (i)}
				<li class="flex items-baseline justify-between gap-3 px-3 py-2">
					<span class="font-medium">LB-Pos. {p.lbPos || i + 1}{p.unit ? ` · ${p.unit}` : ''}</span>
					<span class="num text-right text-sm">
						<span class="font-semibold">{sumLabel(sums[i]) || '–'}</span>
						{#if p.totalQuantity != null}<span class="block text-[0.8125rem] text-ink-3">Gesamt {quantityLabel(p.totalQuantity)}</span>{/if}
					</span>
				</li>
			{:else}
				<li class="px-3 py-2 text-ink-3">Keine LB-Positionen</li>
			{/each}
		</ul>
	</section>

	<section>
		<h3 class="mb-1.5 text-[0.9375rem] font-semibold">Ortsbezeichnungen und Markierungsarten</h3>
		<ul class="divide-y divide-line rounded-xl border border-line">
			{#each rows as row (row.id)}
				<li class="px-3 py-2">
					<p>{row.label || '–'}</p>
					<p class="num text-[0.8125rem] text-ink-2">
						{report.positions
							.map((p, i) => (has(row.quantities[i]) ? `${p.lbPos || `Spalte ${i + 1}`}: ${quantityLabel(row.quantities[i])}${p.unit ? ` ${p.unit}` : ''}` : ''))
							.filter(Boolean)
							.join(' · ')}
					</p>
				</li>
			{:else}
				<li class="px-3 py-2 text-ink-3">Keine Zeilen erfasst</li>
			{/each}
		</ul>
	</section>

	<dl class="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1 text-sm">
		<dt class="text-ink-3">Material</dt>
		<dd class="num">
			{#each report.materials as m, i (i)}
				<span class="block">{[m.material, m.code, filmLabel(m.filmThickness)].filter(Boolean).join(' · ')}</span>
			{:else}–{/each}
		</dd>
		<dt class="text-ink-3">Tagesleistung</dt>
		<dd>{report.dailyOutput || '–'}</dd>
		<dt class="text-ink-3">LV-Position Nr.</dt>
		<dd class="num">{report.lvPosition || '–'}</dd>
		{#if internal && report.note}
			<dt class="text-ink-3">Notiz</dt>
			<dd>{report.note}</dd>
		{/if}
	</dl>

	<div class="grid gap-3 sm:grid-cols-2">
		{@render signature('Für den Auftragnehmer', report.releaseSignature, releaser, report.releasedAt)}
		{@render signature('Für den Auftraggeber', report.customerSignature, report.customerName ?? '', report.customerSignedAt)}
	</div>
</div>
