<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import FileText from '@lucide/svelte/icons/file-text';
	import Check from '@lucide/svelte/icons/check';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import Trash from '@lucide/svelte/icons/trash';
	import Dialog from '$lib/components/Dialog.svelte';
	import { fullName } from '$lib/format';
	import { hoursLabel, monthLabel, parseHours, segmentLabel, WEEKDAY_LABELS, weekdayIndex, weekLabel } from '$lib/modules/stunden/week';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();
	const sheet = $derived(data.sheet);

	type Row = {
		date: string;
		costCenter: string;
		site: string;
		fromTime: string;
		toTime: string;
		normalHours: string;
		overtime50: string;
		overtime100: string;
		vacationHours: string;
		holidayHours: string;
		rainHours: string;
		sickHours: string;
	};

	const toRow = (d: (typeof data.sheet.days)[number]): Row => ({
		date: d.date,
		costCenter: d.costCenter,
		site: d.site,
		fromTime: d.fromTime,
		toTime: d.toTime,
		normalHours: hoursLabel(d.normalHours),
		overtime50: hoursLabel(d.overtime50),
		overtime100: hoursLabel(d.overtime100),
		vacationHours: hoursLabel(d.vacationHours),
		holidayHours: hoursLabel(d.holidayHours),
		rainHours: hoursLabel(d.rainHours),
		sickHours: hoursLabel(d.sickHours)
	});

	// svelte-ignore state_referenced_locally
	let rows = $state<Row[]>(data.sheet.days.map(toRow));
	// svelte-ignore state_referenced_locally
	let allowanceDays = $state(hoursLabel(data.sheet.allowanceDays));
	// svelte-ignore state_referenced_locally
	let allowanceAmount = $state(hoursLabel(data.sheet.allowanceAmount));
	// svelte-ignore state_referenced_locally
	let vaz = $state(data.sheet.vaz);
	// svelte-ignore state_referenced_locally
	let vazPercent = $state(hoursLabel(data.sheet.vazPercent));
	// svelte-ignore state_referenced_locally
	let note = $state(data.sheet.note);
	let busy = $state(false);
	let confirmDelete = $state(false);

	const HOUR_FIELDS = [
		{ key: 'normalHours', name: 'norm', label: 'Norm-Std.', short: 'Norm' },
		{ key: 'overtime50', name: 'ue50', label: 'ÜS 50 %', short: 'ÜS 50' },
		{ key: 'overtime100', name: 'ue100', label: 'ÜS 100 %', short: 'ÜS 100' },
		{ key: 'vacationHours', name: 'urlaub', label: 'Urlaub', short: 'Urlaub' },
		{ key: 'holidayHours', name: 'feiertag', label: 'Feiertag', short: 'Feiertag' },
		{ key: 'rainHours', name: 'regen', label: 'Regen', short: 'Regen' },
		{ key: 'sickHours', name: 'efzg', label: 'Efzg', short: 'Efzg' }
	] as const;

	/** Kurzes Datum für die Tageszeile am Handy */
	const dayShort = (iso: string) => {
		const [, m, d] = iso.split('-');
		return `${d}.${m}.`;
	};

	const rowTotal = (r: Row) => HOUR_FIELDS.reduce((s, f) => s + parseHours(r[f.key]), 0);
	const columnTotal = (key: (typeof HOUR_FIELDS)[number]['key']) => rows.reduce((s, r) => s + parseHours(r[key]), 0);
	const grandTotal = $derived(rows.reduce((s, r) => s + rowTotal(r), 0));

	const STATUS: Record<string, { label: string; tone: string }> = {
		entwurf: { label: 'In Arbeit', tone: '' },
		freigegeben: { label: 'Freigegeben', tone: 'badge-info' },
		geprueft: { label: 'Geprüft', tone: 'badge-ok' }
	};
	const status = $derived(STATUS[sheet.status]);
</script>

<svelte:head><title>{pageTitle(`${fullName(sheet)} – ${weekLabel(sheet.weekStart)}`)}</title></svelte:head>

<a href="/stundenzettel?woche={sheet.weekStart}" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Stundenzettel
</a>

<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-[2rem] leading-tight">{fullName(sheet)}</h1>
		<p class="text-ink-2">
			{weekLabel(sheet.weekStart)}{sheet.partyName ? ` · ${sheet.partyName}` : ''}
		</p>
		{#if sheet.siblings.length}
			<p class="mt-1 text-sm text-ink-3">
				Diese Woche geht über den Monatswechsel – dieser Zettel umfasst
				<span class="font-medium text-ink">{monthLabel(sheet.month)}</span>
				({segmentLabel(sheet.weekStart, sheet.month)}).
				{#each sheet.siblings as s (s.id)}
					<a href="/stundenzettel/{s.id}" class="font-medium underline hover:text-ink">Zum Teil {monthLabel(s.month)}</a>
				{/each}
			</p>
		{/if}
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<span class="badge {status.tone}">{status.label}</span>
		<a href="/stundenzettel/{sheet.id}/pdf" class="btn btn-secondary" download><FileText size={18} aria-hidden="true" />PDF</a>
		<a href="/stundenzettel/{sheet.id}/druck" class="btn btn-secondary"><Printer size={18} aria-hidden="true" />Drucken</a>
	</div>
</div>

{#if form && 'message' in form && form.message}
	<p class="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">{form.message}</p>
{/if}

<form
	method="POST"
	action="?/save"
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') toast.success('Gespeichert');
			await update({ reset: false });
		};
	}}
>
	<fieldset disabled={!data.editable} class="contents">
		<div class="card lg:overflow-x-auto">
			<!--
				Am Handy ist jeder Tag eine kleine Karte: Baustelle breit, darunter
				Kostenstelle/Zeit und die Stunden als Raster. Ab lg klappen die
				Zwischenebenen per `contents` weg und alles steht in einer Zeile.
			-->
			<div class="hidden min-w-[62rem] gap-1.5 border-b border-line px-3 py-2 text-[0.75rem] text-ink-3 lg:grid lg:grid-cols-[4.5rem_minmax(10rem,1fr)_6rem_4.25rem_4.25rem_repeat(7,4rem)_3.5rem]">
				<span>Tag</span>
				<span>Baustelle / Tätigkeit</span>
				<span>Kostenstelle</span>
				<span>von</span>
				<span>bis</span>
				{#each HOUR_FIELDS as f (f.key)}<span class="text-center">{f.label}</span>{/each}
				<span class="text-right">Summe</span>
			</div>

			{#each rows as row, i (row.date)}
				<div
					class="grid gap-2 border-b border-line px-3 py-3 last:border-0 lg:min-w-[62rem] lg:grid-cols-[4.5rem_minmax(10rem,1fr)_6rem_4.25rem_4.25rem_repeat(7,4rem)_3.5rem] lg:items-center lg:gap-1.5 lg:py-2"
				>
					<div class="flex items-baseline justify-between gap-2 lg:block">
						<span class="font-semibold lg:text-[0.9375rem] lg:font-medium">{WEEKDAY_LABELS[weekdayIndex(row.date)]}</span>
						<span class="num text-sm text-ink-3 lg:hidden">
							{dayShort(row.date)}{rowTotal(row) ? ` · ${hoursLabel(rowTotal(row))} Std` : ''}
						</span>
					</div>

					<label class="block">
						<span class="field-label lg:sr-only">Baustelle / Tätigkeit</span>
						<input class="input input-sm" name="baustelle.{row.date}" maxlength="200" list="baustellen" bind:value={row.site} />
					</label>

					<div class="grid grid-cols-[1fr_4.5rem_4.5rem] gap-2 lg:contents">
						<label class="block">
							<span class="field-label lg:sr-only">Kostenstelle</span>
							<input class="input input-sm" name="kostenstelle.{row.date}" maxlength="60" bind:value={row.costCenter} />
						</label>
						<label class="block">
							<span class="field-label lg:sr-only">von</span>
							<input class="input input-sm num" name="von.{row.date}" inputmode="numeric" placeholder="07:00" bind:value={row.fromTime} />
						</label>
						<label class="block">
							<span class="field-label lg:sr-only">bis</span>
							<input class="input input-sm num" name="bis.{row.date}" inputmode="numeric" placeholder="16:30" bind:value={row.toTime} />
						</label>
					</div>

					<div class="grid grid-cols-4 gap-2 lg:contents">
						{#each HOUR_FIELDS as f (f.key)}
							<label class="block">
								<span class="field-label truncate lg:sr-only">{f.short}</span>
								<input
									class="input input-sm num text-center"
									name="{f.name}.{row.date}"
									inputmode="decimal"
									bind:value={rows[i][f.key]}
									aria-label="{WEEKDAY_LABELS[weekdayIndex(row.date)]} {f.label}"
								/>
							</label>
						{/each}
					</div>

					<span class="num hidden text-right font-semibold lg:block lg:text-[0.9375rem]">{hoursLabel(rowTotal(row)) || '–'}</span>
				</div>
			{/each}

			<div
				class="flex items-center justify-between gap-2 bg-surface-2 px-3 py-2.5 font-semibold lg:grid lg:min-w-[62rem] lg:grid-cols-[4.5rem_minmax(10rem,1fr)_6rem_4.25rem_4.25rem_repeat(7,4rem)_3.5rem] lg:items-center lg:gap-1.5"
			>
				<span class="lg:col-span-5">Gesamtstunden</span>
				{#each HOUR_FIELDS as f (f.key)}
					<span class="num hidden text-center lg:block">{hoursLabel(columnTotal(f.key)) || '–'}</span>
				{/each}
				<span class="num lg:text-right">{hoursLabel(grandTotal) || '–'}</span>
			</div>
		</div>

		<datalist id="baustellen">
			{#each data.sites as s (s)}<option value={s}></option>{/each}
		</datalist>

		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<section class="card space-y-3 p-4 lg:p-5">
				<h2 class="text-lg">Auslöse</h2>
				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="field-label">Tage</span>
						<input class="input num" name="ausloeseTage" inputmode="decimal" bind:value={allowanceDays} />
					</label>
					<label class="block">
						<span class="field-label">Betrag (€)</span>
						<input class="input num" name="ausloeseBetrag" inputmode="decimal" bind:value={allowanceAmount} />
					</label>
				</div>
			</section>

			<section class="card space-y-3 p-4 lg:p-5">
				<h2 class="text-lg">VAZ</h2>
				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="field-label">VAZ</span>
						<input class="input" name="vaz" maxlength="60" bind:value={vaz} />
					</label>
					<label class="block">
						<span class="field-label">Prozent</span>
						<input class="input num" name="vazProzent" inputmode="decimal" bind:value={vazPercent} />
					</label>
				</div>
			</section>

			<section class="card p-4 lg:p-5">
				<h2 class="text-lg">Notiz</h2>
				<textarea class="textarea mt-2" name="notiz" rows="3" maxlength="2000" bind:value={note}></textarea>
			</section>
		</div>
	</fieldset>

	{#if data.editable}
		<div class="card sticky bottom-24 mt-4 flex flex-wrap items-center gap-2 p-3 lg:bottom-6">
			<button class="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Speichern'}</button>
			<span class="num ml-auto text-sm text-ink-2">Gesamt {hoursLabel(grandTotal) || '0'} Stunden</span>
		</div>
	{:else}
		<p class="field-hint mt-4">
			{sheet.status === 'geprueft'
				? 'Diese Woche ist geprüft und damit abgeschlossen.'
				: 'Diese Woche ist freigegeben und wartet auf die Prüfung.'}
		</p>
	{/if}
</form>

<div class="mt-4 flex flex-wrap gap-2">
	{#if sheet.status === 'entwurf' && data.canRelease && data.editable}
		<form method="POST" action="?/release" use:enhance={() => async ({ update }) => {
			toast.success('Woche freigegeben');
			await update();
		}}>
			<button class="btn btn-secondary"><Lock size={18} aria-hidden="true" />Freigeben</button>
		</form>
	{/if}
	{#if sheet.status === 'freigegeben' && data.canCheck}
		<form method="POST" action="?/check" use:enhance={() => async ({ update }) => {
			toast.success('Als geprüft markiert');
			await update();
		}}>
			<button class="btn btn-primary"><Check size={18} aria-hidden="true" />Geprüft</button>
		</form>
	{/if}
	{#if sheet.status !== 'entwurf' && (data.canCheck || (sheet.status === 'freigegeben' && data.canRelease))}
		<form method="POST" action="?/reopen" use:enhance={() => async ({ update }) => {
			toast.info('Woche wieder geöffnet');
			await update();
		}}>
			<button class="btn btn-ghost"><LockOpen size={18} aria-hidden="true" />Wieder öffnen</button>
		</form>
	{/if}
	{#if sheet.status === 'entwurf' && data.editable}
		<button type="button" class="btn btn-ghost ml-auto text-danger hover:bg-danger-soft" onclick={() => (confirmDelete = true)}>
			<Trash size={18} aria-hidden="true" />Löschen
		</button>
	{/if}
</div>

<Dialog bind:open={confirmDelete} title="Woche löschen?">
	<p class="text-ink-2">Die Woche von {fullName(sheet)} wird samt allen Tagen gelöscht. Das lässt sich nicht rückgängig machen.</p>
	<form method="POST" action="?/delete" class="mt-5 flex justify-end gap-2" use:enhance>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmDelete = false)}>Abbrechen</button>
		<button class="btn btn-primary">Löschen</button>
	</form>
</Dialog>
