<script lang="ts">
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { fullName } from '$lib/format';
	import { hoursLabel, WEEKDAY_LABELS, weekLabel } from '$lib/modules/stunden/week';

	let { data } = $props();
	const sheet = $derived(data.sheet);
	const t = $derived(data.totals);

	const COLUMNS = [
		{ key: 'normalHours', label: 'Norm-Std.', total: 'normal' },
		{ key: 'overtime50', label: 'ÜS 50 %', total: 'o50' },
		{ key: 'overtime100', label: 'ÜS 100 %', total: 'o100' },
		{ key: 'vacationHours', label: 'Urlaubs-std.', total: 'vacation' },
		{ key: 'holidayHours', label: 'Feiertags-std.', total: 'holiday' },
		{ key: 'rainHours', label: 'Regen-Std.', total: 'rain' },
		{ key: 'sickHours', label: 'Efzg', total: 'sick' }
	] as const;

	const STATUS: Record<string, string> = { entwurf: 'In Arbeit', freigegeben: 'Freigegeben', geprueft: 'Geprüft' };
</script>

<svelte:head><title>{pageTitle(`Lohnzettel ${fullName(sheet)}`)}</title></svelte:head>

<PrintSheet
	title="Lohnzettel"
	facts={[fullName(sheet), weekLabel(sheet.weekStart), sheet.partyName ?? 'Ohne Partie', STATUS[sheet.status]]}
	back="/stundenzettel/{sheet.id}"
>
	<table class="mt-4 w-full border-collapse text-[0.8125rem]">
		<thead>
			<tr>
				<th class="border border-line px-1.5 py-1 text-left">Tag</th>
				<th class="border border-line px-1.5 py-1 text-left">Kostenstelle</th>
				<th class="border border-line px-1.5 py-1 text-left">Baustelle / Tätigkeit</th>
				<th class="border border-line px-1.5 py-1">Zeit von/bis</th>
				{#each COLUMNS as c (c.key)}<th class="border border-line px-1.5 py-1">{c.label}</th>{/each}
				<th class="border border-line px-1.5 py-1">Summe</th>
			</tr>
		</thead>
		<tbody>
			{#each sheet.days as day, i (day.date)}
				{@const sum = COLUMNS.reduce((s, c) => s + Number(day[c.key] ?? 0), 0)}
				<tr>
					<th scope="row" class="border border-line px-1.5 py-1 text-left font-semibold">{WEEKDAY_LABELS[i]}</th>
					<td class="num border border-line px-1.5 py-1">{day.costCenter}</td>
					<td class="border border-line px-1.5 py-1">{day.site}</td>
					<td class="num border border-line px-1.5 py-1 text-center whitespace-nowrap">
						{day.fromTime && day.toTime ? `${day.fromTime}–${day.toTime}` : (day.fromTime ?? '')}
					</td>
					{#each COLUMNS as c (c.key)}
						<td class="num border border-line px-1.5 py-1 text-center">{hoursLabel(day[c.key])}</td>
					{/each}
					<td class="num border border-line px-1.5 py-1 text-center font-semibold">{hoursLabel(sum)}</td>
				</tr>
			{/each}
			<tr>
				<th colspan="4" scope="row" class="border border-line px-1.5 py-1 text-left">Gesamtstunden</th>
				{#each COLUMNS as c (c.key)}
					<td class="num border border-line px-1.5 py-1 text-center font-semibold">{hoursLabel(t[c.total])}</td>
				{/each}
				<td class="num border border-line px-1.5 py-1 text-center font-semibold">{hoursLabel(t.total)}</td>
			</tr>
		</tbody>
	</table>

	<div class="mt-4 flex flex-wrap gap-x-10 gap-y-2 text-sm">
		<p>
			<span class="text-ink-3">Auslöse:</span>
			<span class="num font-medium">{hoursLabel(sheet.allowanceDays) || '–'}</span> Tage
			<span class="num ml-2 font-medium">{hoursLabel(sheet.allowanceAmount) || '–'}</span> €
		</p>
		{#if sheet.vaz || sheet.vazPercent}
			<p>
				<span class="text-ink-3">VAZ:</span> <span class="num font-medium">{sheet.vaz}</span>
				{#if sheet.vazPercent}<span class="num ml-2 font-medium">{hoursLabel(sheet.vazPercent)} %</span>{/if}
			</p>
		{/if}
	</div>

	{#if sheet.note}
		<p class="mt-3 text-sm"><span class="text-ink-3">Notiz:</span> {sheet.note}</p>
	{/if}

	<p class="mt-5 text-[0.8125rem] italic">Freiwillige Leistungen über KV begründen keinen Rechtsanspruch!</p>

	<div class="mt-10 grid grid-cols-2 gap-10 text-[0.8125rem]">
		<p class="border-t border-ink pt-1">Unterschrift Vorarbeiter</p>
		<p class="border-t border-ink pt-1">überprüft</p>
	</div>
</PrintSheet>
