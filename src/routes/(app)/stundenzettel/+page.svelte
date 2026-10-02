<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clock from '@lucide/svelte/icons/clock';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Dialog from '$lib/components/Dialog.svelte';
	import { addDays, hoursLabel, mondayOf, monthLabel, monthsOfWeek, segmentLabel, today, weekLabel } from '$lib/modules/stunden/week';
	import { fullName } from '$lib/format';

	let { data, form } = $props();
	let borrowOpen = $state(false);
	let borrowId = $state<number | null>(null);
	let borrowing = $state(false);

	/** Partie in der Zeile – bei Aushilfe mit Hinweis, wer die Woche schreibt */
	function partyLine(row: (typeof data.rows)[number]): string {
		const own = row.user.partyName ?? 'Ohne Partie';
		if (!row.writingPartyId) return own;
		if (row.writingPartyId === data.ownPartyId) return `Aushilfe aus ${own}`;
		return `${own} · diese Woche bei ${row.writingPartyName ?? 'einer anderen Partie'}`;
	}

	const prev = $derived(addDays(data.weekStart, -7));
	const next = $derived(addDays(data.weekStart, 7));
	const isCurrent = $derived(data.weekStart === mondayOf(today()));
	/** Über den Monatswechsel gibt es je Monat einen eigenen Zettel */
	const split = $derived(monthsOfWeek(data.weekStart).length > 1);
	const groups = $derived(monthsOfWeek(data.weekStart).map((month) => ({ month, rows: data.rows.filter((r) => r.month === month) })));

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
	<div class="flex flex-wrap items-center gap-2">
		<a href="/stundenzettel?woche={prev}" class="btn btn-secondary btn-icon" aria-label="Woche zurück"><ChevronLeft size={18} /></a>
		<span class="num min-w-[13rem] text-center font-medium">{weekLabel(data.weekStart)}</span>
		<a href="/stundenzettel?woche={next}" class="btn btn-secondary btn-icon" aria-label="Woche vor"><ChevronRight size={18} /></a>
		{#if !isCurrent}<a href="/stundenzettel" class="btn btn-ghost btn-sm">Diese Woche</a>{/if}
		{#if data.candidates.length}
			<button type="button" class="btn btn-secondary" onclick={() => ((borrowId = null), (borrowOpen = true))}>
				<UserPlus size={18} aria-hidden="true" />Aushilfe übernehmen
			</button>
		{/if}
	</div>
</div>

{#snippet entry(row: (typeof data.rows)[number])}
	{@const status = row.status ? STATUS[row.status] : null}
	<li class="border-b border-line last:border-0">
		<form method="POST" action="?/open" use:enhance>
			<input type="hidden" name="userId" value={row.user.id} />
			<input type="hidden" name="weekStart" value={data.weekStart} />
			<input type="hidden" name="monat" value={row.month} />
			<button class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
				<span class="min-w-0 flex-1">
					<span class="block truncate font-medium">{fullName(row.user)}</span>
					<span class="block truncate text-[0.8125rem] text-ink-3">
						{partyLine(row)}{row.allowanceDays ? ` · Auslöse ${hoursLabel(row.allowanceDays)} Tage` : ''}{row.user.timesheetExempt ? ' · sonst keine Stundenzettel' : ''}
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
{/snippet}

<!-- Über den Monatswechsel: je Monat ein eigener Block, weil der Lohn monatlich abgerechnet wird -->
{#each groups as group (group.month)}
	<section class="mb-4">
		{#if split}
			<h2 class="mb-2 flex flex-wrap items-baseline gap-x-2 text-lg">
				{monthLabel(group.month)}
				<span class="num text-sm font-normal text-ink-3">{segmentLabel(data.weekStart, group.month)}</span>
			</h2>
		{/if}
		<div class="card overflow-hidden">
			<ul>
				{#each group.rows as row (`${row.user.id}-${row.month}`)}
					{@render entry(row)}
				{:else}
					<li class="p-8 text-center text-ink-3">Für diese Woche gibt es niemanden, dessen Stunden du erfassen darfst.</li>
				{/each}
			</ul>
		</div>
	</section>
{/each}

<p class="field-hint mt-3">
	Ein Klick öffnet den Zettel – gibt es ihn noch nicht, wird er angelegt. Die Stunden ergeben sich aus Beginn, Pause, Pauseende und Ende.
</p>

<Dialog bind:open={borrowOpen} title="Aushilfe übernehmen">
	<p class="text-ink-2">
		War jemand aus einer anderen Partie diese Woche <span class="font-medium text-ink">mehr Tage bei dir</span> als bei seiner eigenen,
		schreibst du seinen Zettel für die ganze Woche – auch für die Tage bei seiner Partie. War er weniger Tage bei dir, schreibt ihn
		seine eigene Partie.
	</p>
	<form
		method="POST"
		action="?/aushilfe"
		class="mt-4 space-y-4"
		use:enhance={() => {
			borrowing = true;
			return async ({ update }) => {
				borrowing = false;
				await update();
			};
		}}
	>
		<input type="hidden" name="weekStart" value={data.weekStart} />
		<label class="block">
			<span class="field-label">Wer – {weekLabel(data.weekStart)}</span>
			<select name="userId" class="select" required bind:value={borrowId}>
				<option value={null}>Person wählen</option>
				{#each data.candidates as c (c.id)}
					<option value={c.id}>{fullName(c)} · {c.partyName ?? 'ohne Partie'}</option>
				{/each}
			</select>
		</label>
		<p class="field-hint">Seine eigene Partie sieht den Zettel danach nur noch. Was sie schon eingetragen hat, bleibt stehen.</p>
		{#if form && 'message' in form && form.message}<p class="field-error" role="alert">{form.message}</p>{/if}
		<div class="flex justify-end gap-2">
			<button type="button" class="btn btn-ghost" onclick={() => (borrowOpen = false)}>Abbrechen</button>
			<button class="btn btn-primary" disabled={!borrowId || borrowing}><UserPlus size={18} aria-hidden="true" />Woche übernehmen</button>
		</div>
	</form>
</Dialog>
