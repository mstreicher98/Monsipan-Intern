<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { addDays, hoursLabel, mondayOf, monthLabel, monthsOfWeek, segmentLabel, today, weekLabel } from '$lib/modules/stunden/week';
	import { fullName } from '$lib/format';

	let { data } = $props();

	const prev = $derived(addDays(data.weekStart, -7));
	const next = $derived(addDays(data.weekStart, 7));
	const isCurrent = $derived(data.weekStart === mondayOf(today()));
	/** Über den Monatswechsel gibt es je Monat einen eigenen Zettel */
	const split = $derived(monthsOfWeek(data.weekStart).length > 1);

	const STATUS: Record<string, { label: string; tone: string }> = {
		entwurf: { label: 'In Arbeit', tone: '' },
		freigegeben: { label: 'Freigegeben', tone: 'badge-info' },
		geprueft: { label: 'Geprüft', tone: 'badge-ok' }
	};
</script>

<svelte:head><title>{pageTitle('Stundenzettel')}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3 pt-2 pb-5">
	<div>
		<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><Clock size={26} aria-hidden="true" />Stundenzettel</h1>
		<p class="text-ink-2">
			Eine Woche je Person – Montag bis Sonntag. Geht die Woche über den Monatswechsel, gibt es je Monat einen eigenen Zettel.
		</p>
	</div>
	<div class="flex items-center gap-2">
		<a href="/stundenzettel?woche={prev}" class="btn btn-secondary btn-icon" aria-label="Woche zurück"><ChevronLeft size={18} /></a>
		<span class="num min-w-[13rem] text-center font-medium">{weekLabel(data.weekStart)}</span>
		<a href="/stundenzettel?woche={next}" class="btn btn-secondary btn-icon" aria-label="Woche vor"><ChevronRight size={18} /></a>
		{#if !isCurrent}<a href="/stundenzettel" class="btn btn-ghost btn-sm">Diese Woche</a>{/if}
	</div>
</div>

<div class="card overflow-hidden">
	<ul>
		{#each data.rows as row (`${row.user.id}-${row.month}`)}
			{@const status = row.status ? STATUS[row.status] : null}
			<li class="border-b border-line last:border-0">
				<form method="POST" action="?/open" use:enhance>
					<input type="hidden" name="userId" value={row.user.id} />
					<input type="hidden" name="weekStart" value={data.weekStart} />
					<input type="hidden" name="monat" value={row.month} />
					<button class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium">
								{fullName(row.user)}{#if split}<span class="font-normal text-ink-3">&nbsp;· {monthLabel(row.month)}</span>{/if}
							</span>
							<span class="block truncate text-[0.8125rem] text-ink-3">
								{split ? `${segmentLabel(data.weekStart, row.month)} · ` : ''}{row.user.partyName ?? 'Ohne Partie'}{row.allowanceDays
									? ` · Auslöse ${hoursLabel(row.allowanceDays)} Tage`
									: ''}
							</span>
						</span>
						{#if status}
							<span class="badge {status.tone}">
								{#if row.status === 'geprueft'}<CircleCheck size={13} aria-hidden="true" />{/if}{status.label}
							</span>
						{/if}
						<span class="num w-20 text-right font-display text-lg font-semibold">
							{row.total ? hoursLabel(row.total) : '–'}
						</span>
						<ChevronRight size={18} class="shrink-0 text-ink-3" aria-hidden="true" />
					</button>
				</form>
			</li>
		{:else}
			<li class="p-8 text-center text-ink-3">
				Für diese Woche gibt es niemanden, dessen Stunden du erfassen darfst.
			</li>
		{/each}
	</ul>
</div>

<p class="field-hint mt-3">
	Ein Klick öffnet die Woche – ist noch kein Zettel vorhanden, wird er angelegt. Stunden stehen in Stunden, nicht als Uhrzeit (8,5 = acht
	Stunden dreißig).
</p>
