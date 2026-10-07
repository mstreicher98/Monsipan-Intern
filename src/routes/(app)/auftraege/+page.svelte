<script lang="ts">
	import { pageTitle } from '$lib/app';
	import HardHat from '@lucide/svelte/icons/hard-hat';
	import Search from '@lucide/svelte/icons/search';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { dateTime } from '$lib/format';
	import { ORDER_STATUS_LABELS, spacedNumber } from '$lib/modules/auftraege/offer';

	let { data } = $props();

	const FILTERS = [
		['offen', 'Offen'],
		['erstellt', 'Neu'],
		['in_arbeit', 'In Arbeit'],
		['abgeschlossen', 'Abgeschlossen'],
		['', 'Alle']
	];
</script>

<svelte:head><title>{pageTitle('Aufträge')}</title></svelte:head>

<div class="pt-2 pb-5">
	<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><HardHat size={26} aria-hidden="true" />Aufträge</h1>
	<p class="text-ink-2">
		{data.all ? 'Aus angenommenen Angeboten – je Partie, mit Stand der Arbeiten.' : 'Die Aufträge deiner Partie – hier setzt ihr sie auf „in Arbeit" und „abgeschlossen".'}
	</p>
</div>

<form method="GET" class="card mb-4 flex flex-wrap items-end gap-3 p-3">
	<label class="min-w-[12rem] flex-1">
		<span class="field-label">Suche</span>
		<input class="input" name="q" value={data.filter.q} placeholder="Nummer, BV, Kunde" />
	</label>
	<label>
		<span class="field-label">Stand</span>
		<select class="select" name="status" value={data.filter.status}>
			{#each FILTERS as [key, label] (key)}<option value={key}>{label}</option>{/each}
		</select>
	</label>
	{#if data.all}
		<label>
			<span class="field-label">Partie</span>
			<select class="select" name="partie" value={data.filter.partyId ? String(data.filter.partyId) : ''}>
				<option value="">Alle Partien</option>
				{#each data.parties as p (p.id)}<option value={String(p.id)}>{p.name}</option>{/each}
			</select>
		</label>
	{/if}
	<button class="btn btn-secondary"><Search size={18} aria-hidden="true" />Filtern</button>
</form>

<div class="card overflow-hidden">
	<ul>
		{#each data.orders as o (o.id)}
			{@const st = ORDER_STATUS_LABELS[o.status] ?? ORDER_STATUS_LABELS.erstellt}
			<li class="border-b border-line last:border-0">
				<a href="/auftraege/{o.id}" class="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
					<span class="num w-20 shrink-0 font-display text-lg font-semibold">{spacedNumber(o.number)}</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{o.title || 'Ohne BV'}</span>
						<span class="block truncate text-[0.8125rem] text-ink-3">
							{[o.location || o.customerName, data.all ? o.partyName : null].filter(Boolean).join(' · ')}
						</span>
					</span>
					<span class="hidden shrink-0 text-right text-[0.8125rem] text-ink-3 sm:block">{o.statusAt ? dateTime(o.statusAt) : dateTime(o.createdAt)}</span>
					<span class="badge {st.tone}">{st.label}</span>
					<ChevronRight size={18} class="shrink-0 text-ink-3" aria-hidden="true" />
				</a>
			</li>
		{:else}
			<li class="p-10 text-center">
				<p class="font-medium">Keine Aufträge{data.filter.status === 'offen' ? ' offen' : ''}</p>
				<p class="mt-1 text-sm text-ink-3">
					{!data.all && !data.hasParty
						? 'Du bist keiner Partie zugeordnet – Aufträge sieht man hier für die eigene Partie.'
						: 'Aufträge entstehen aus angenommenen Angeboten.'}
				</p>
			</li>
		{/each}
	</ul>
</div>
