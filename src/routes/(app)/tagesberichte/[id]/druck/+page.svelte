<script lang="ts">
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { dayLabel } from '$lib/modules/stunden/week';

	let { data } = $props();
	const report = $derived(data.report);

	const MATERIALS = [
		{ kind: 'gelb', label: 'gelb' },
		{ kind: 'weiss', label: 'weiß' },
		{ kind: 'reflex', label: 'Reflexk.' }
	] as const;

	const QS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8'] as const;
	const show = (v: number | null | undefined) => (v == null || v === 0 ? '' : String(Math.round(v * 1000) / 1000).replace('.', ','));

	/** Nur Zeilen mit Inhalt drucken */
	const rows = $derived(report.rows.filter((r) => r.label.trim() || QS.some((k) => r[k] != null)));
	/** Spalten ohne Position und ohne Menge weglassen, damit der Ausdruck nicht leer wirkt */
	const columns = $derived(
		report.positions.filter((p, i) => p.lbPos.trim() || p.unit.trim() || rows.some((r) => r[QS[i]] != null))
	);
</script>

<svelte:head><title>{pageTitle(`Tagesbericht ${report.number || ''}`.trim())}</title></svelte:head>

<PrintSheet
	title="Tagesbericht {report.number}"
	facts={[dayLabel(report.date), report.road, report.site, report.partyName ?? ''].filter(Boolean)}
	back="/tagesberichte/{report.id}"
	pdf="/tagesberichte/{report.id}/pdf"
>
	<table class="mt-4 w-full border-collapse text-[0.8125rem]">
		<thead>
			<tr>
				<th class="border border-line px-1.5 py-1 text-left">Ortsbezeichnungen und Markierungsarten</th>
				{#each columns as p (p.idx)}
					<th class="border border-line px-1.5 py-1 text-center">
						<span class="num block">{p.lbPos || `Pos. ${p.idx}`}</span>
						<span class="block text-[0.6875rem] font-normal text-ink-3">{p.unit}</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr>
					<td class="border border-line px-1.5 py-1">{r.label}</td>
					{#each columns as p (p.idx)}
						<td class="num border border-line px-1.5 py-1 text-right">{show(r[QS[p.idx - 1]])}</td>
					{/each}
				</tr>
			{:else}
				<tr><td class="border border-line px-1.5 py-2 text-ink-3" colspan={columns.length + 1}>Keine Zeilen erfasst</td></tr>
			{/each}
			<tr class="font-semibold">
				<th scope="row" class="border border-line px-1.5 py-1 text-left">Einheitssumme</th>
				{#each columns as p (p.idx)}
					<td class="num border border-line px-1.5 py-1 text-right">{show(data.sums[QS[p.idx - 1]])}</td>
				{/each}
			</tr>
		</tbody>
	</table>

	<div class="mt-4 grid gap-4 sm:grid-cols-2">
		<table class="w-full border-collapse text-[0.8125rem]">
			<thead>
				<tr>
					<th class="border border-line px-1.5 py-1 text-left">Material</th>
					<th class="border border-line px-1.5 py-1 text-left">Kenn-Nr.</th>
					<th class="border border-line px-1.5 py-1 text-left">Filmdicke in mm</th>
				</tr>
			</thead>
			<tbody>
				{#each MATERIALS as m (m.kind)}
					{@const row = report.materials.find((x) => x.kind === m.kind)}
					<tr>
						<th scope="row" class="border border-line px-1.5 py-1 text-left font-normal">{m.label}</th>
						<td class="num border border-line px-1.5 py-1">{row?.code ?? ''}</td>
						<td class="num border border-line px-1.5 py-1">{show(row?.filmThickness)}</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<dl class="text-[0.8125rem]">
			<dt class="text-ink-3">Tagesleistung</dt>
			<dd class="mb-2 border-b border-line pb-1 font-medium">{report.dailyOutput || ' '}</dd>
			<dt class="text-ink-3">LV-Position Nr.</dt>
			<dd class="border-b border-line pb-1 font-medium">{report.lvPosition || ' '}</dd>
			{#if report.note}
				<dt class="mt-2 text-ink-3">Notiz</dt>
				<dd>{report.note}</dd>
			{/if}
		</dl>
	</div>

	<div class="mt-10 grid grid-cols-2 gap-10 text-[0.8125rem]">
		<p class="border-t border-ink pt-1">Für den Auftragnehmer</p>
		<p class="border-t border-ink pt-1">Für den Auftraggeber</p>
	</div>
</PrintSheet>
