<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import FileText from '@lucide/svelte/icons/file-text';
	import Check from '@lucide/svelte/icons/check';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import Undo from '@lucide/svelte/icons/undo-2';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Trash from '@lucide/svelte/icons/trash';
	import Dialog from '$lib/components/Dialog.svelte';
	import SignaturePad from '$lib/modules/stunden/components/SignaturePad.svelte';
	import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
	import { dateTime, fullName } from '$lib/format';
	import {
		hoursLabel,
		monthLabel,
		parseHours,
		segmentLabel,
		WEEKDAY_LABELS,
		weekdayIndex,
		weekLabel,
		workedHours
	} from '$lib/modules/stunden/week';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();
	const sheet = $derived(data.sheet);

	type TimeKey = 'fromTime' | 'breakStart' | 'breakEnd' | 'toTime';
	type Row = {
		date: string;
		costCenter: string;
		site: string;
		fromTime: string;
		breakStart: string;
		breakEnd: string;
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
		breakStart: d.breakStart,
		breakEnd: d.breakEnd,
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
	let signOpen = $state(false);
	let signature = $state('');
	let checkOpen = $state(false);
	let checkSignature = $state('');
	let checking = $state(false);
	let confirmReopen = $state(false);
	let confirmUncheck = $state(false);

	const name = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ') || 'unbekannt';

	const TIME_FIELDS: { key: TimeKey; name: string; label: string; placeholder: string }[] = [
		{ key: 'fromTime', name: 'beginn', label: 'Beginn', placeholder: '06:30' },
		{ key: 'breakStart', name: 'pause', label: 'Pause', placeholder: '12:00' },
		{ key: 'breakEnd', name: 'pauseende', label: 'Pauseende', placeholder: '12:30' },
		{ key: 'toTime', name: 'ende', label: 'Ende', placeholder: '17:00' }
	];

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

	const worked = (r: Row) => workedHours(r.fromTime, r.breakStart, r.breakEnd, r.toTime);

	/**
	 * Zeit eintragen. Die Norm-Stunden folgen der errechneten Arbeitszeit,
	 * solange niemand sie von Hand anders gesetzt hat.
	 */
	function setTime(i: number, key: TimeKey, value: string) {
		const row = rows[i];
		const before = worked(row);
		row[key] = value;
		const after = worked(row);
		const followsTimes = !row.normalHours.trim() || (before != null && parseHours(row.normalHours) === before);
		if (after != null && followsTimes) row.normalHours = hoursLabel(after);
	}

	const rowTotal = (r: Row) => HOUR_FIELDS.reduce((s, f) => s + parseHours(r[f.key]), 0);
	const columnTotal = (key: (typeof HOUR_FIELDS)[number]['key']) => rows.reduce((s, r) => s + parseHours(r[key]), 0);
	const grandTotal = $derived(rows.reduce((s, r) => s + rowTotal(r), 0));

	const STATUS: Record<string, { label: string; tone: string }> = {
		entwurf: { label: 'In Arbeit', tone: '' },
		freigegeben: { label: 'Freigegeben', tone: 'badge-info' },
		geprueft: { label: 'Geprüft', tone: 'badge-ok' }
	};
	const status = $derived(STATUS[sheet.status]);

	const GRID = 'lg:grid-cols-[4rem_minmax(9rem,1fr)_5.5rem_repeat(4,3.9rem)_repeat(7,3.7rem)_3.2rem]';
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

{#snippet signed(label: string, signature: string | null, who: string, at: Date)}
	<div class="flex flex-wrap items-center gap-4">
		{#if signature}
			<svg
				viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}"
				class="h-16 w-48 shrink-0 rounded-lg bg-white"
				role="img"
				aria-label="Unterschrift {who}"
			>
				<path d={signature} fill="none" stroke="#1d2127" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		{/if}
		<p class="text-sm text-ink-2">
			{label}{signature ? ' und unterschrieben' : ''} von
			<span class="font-medium text-ink">{who}</span>
			am {dateTime(at)}
		</p>
	</div>
{/snippet}

{#if sheet.status !== 'entwurf' && sheet.releasedAt}
	<section class="card mb-4 grid gap-4 p-4 lg:grid-cols-2">
		{@render signed('Freigegeben', sheet.releaseSignature, name(sheet.releasedByFirst, sheet.releasedByLast), sheet.releasedAt)}
		{#if sheet.status === 'geprueft' && sheet.checkedAt}
			{@render signed('Geprüft', sheet.checkSignature, name(sheet.checkedByFirst, sheet.checkedByLast), sheet.checkedAt)}
		{/if}
	</section>
{/if}

<form
	id="zettel"
	method="POST"
	action="?/save"
	use:enhance={({ action }) => {
		busy = true;
		const releasing = action.search.includes('release');
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				toast.success(releasing ? 'Woche freigegeben' : 'Gespeichert');
				if (releasing) {
					signOpen = false;
					signature = '';
				}
			}
			await update({ reset: false });
		};
	}}
>
	<!-- Außerhalb des fieldset, damit sie auch bei gesperrter Woche nicht stört -->
	<input type="hidden" name="unterschrift" value={signature} />

	<fieldset disabled={!data.editable} class="contents">
		<div class="card lg:overflow-x-auto">
			<!--
				Am Handy ist jeder Tag eine kleine Karte: Baustelle breit, darunter
				Kostenstelle und die vier Zeiten, dann die Stunden als Raster. Ab lg
				klappen die Zwischenebenen per `contents` weg und alles steht in einer Zeile.
			-->
			<div class="hidden min-w-[66rem] gap-1.5 border-b border-line px-3 py-2 text-[0.75rem] text-ink-3 lg:grid {GRID}">
				<span>Tag</span>
				<span>Baustelle / Tätigkeit</span>
				<span>Kostenstelle</span>
				{#each TIME_FIELDS as t (t.key)}<span>{t.label}</span>{/each}
				{#each HOUR_FIELDS as f (f.key)}<span class="text-center">{f.short}</span>{/each}
				<span class="text-right">Summe</span>
			</div>

			{#each rows as row, i (row.date)}
				{@const day = WEEKDAY_LABELS[weekdayIndex(row.date)]}
				<div class="grid gap-2 border-b border-line px-3 py-3 last:border-0 lg:min-w-[66rem] {GRID} lg:items-center lg:gap-1.5 lg:py-2">
					<div class="flex items-baseline justify-between gap-2 lg:block">
						<span class="font-semibold lg:text-[0.9375rem] lg:font-medium">{day}</span>
						<span class="num text-sm text-ink-3 lg:hidden">
							{dayShort(row.date)}{rowTotal(row) ? ` · ${hoursLabel(rowTotal(row))} Std` : ''}
						</span>
					</div>

					<label class="block">
						<span class="field-label lg:sr-only">Baustelle / Tätigkeit</span>
						<input class="input input-sm" name="baustelle.{row.date}" maxlength="200" list="baustellen" bind:value={row.site} />
					</label>

					<div class="grid grid-cols-4 gap-2 lg:contents">
						<label class="col-span-4 block lg:col-span-1">
							<span class="field-label lg:sr-only">Kostenstelle</span>
							<input class="input input-sm" name="kostenstelle.{row.date}" maxlength="60" bind:value={row.costCenter} />
						</label>
						{#each TIME_FIELDS as t (t.key)}
							<label class="block">
								<span class="field-label truncate lg:sr-only">{t.label}</span>
								<input
									class="input input-sm num text-center"
									name="{t.name}.{row.date}"
									inputmode="numeric"
									placeholder={t.placeholder}
									value={row[t.key]}
									oninput={(e) => setTime(i, t.key, e.currentTarget.value)}
									aria-label="{day} {t.label}"
								/>
							</label>
						{/each}
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
									aria-label="{day} {f.label}"
								/>
							</label>
						{/each}
					</div>

					<span class="num hidden text-right font-semibold lg:block lg:text-[0.9375rem]">{hoursLabel(rowTotal(row)) || '–'}</span>
				</div>
			{/each}

			<div class="flex items-center justify-between gap-2 bg-surface-2 px-3 py-2.5 font-semibold lg:grid lg:min-w-[66rem] {GRID} lg:items-center lg:gap-1.5">
				<span class="lg:col-span-7">Gesamtstunden</span>
				{#each HOUR_FIELDS as f (f.key)}
					<span class="num hidden text-center lg:block">{hoursLabel(columnTotal(f.key)) || '–'}</span>
				{/each}
				<span class="num lg:text-right">{hoursLabel(grandTotal) || '–'}</span>
			</div>
		</div>
		<p class="field-hint mt-2">
			Aus Beginn, Pause, Pauseende und Ende wird die Arbeitszeit gerechnet und als Norm-Stunden eingetragen. Überstunden und
			andere Stundenarten trägst du selbst ein; ein von Hand geänderter Wert bleibt stehen.
		</p>

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
			{#if sheet.status === 'entwurf' && data.canRelease}
				<button type="button" class="btn btn-secondary" disabled={busy} onclick={() => (signOpen = true)}>
					<Lock size={18} aria-hidden="true" />Freigeben
				</button>
			{/if}
			<span class="num ml-auto text-sm text-ink-2">Gesamt {hoursLabel(grandTotal) || '0'} Stunden</span>
		</div>
	{:else}
		<p class="field-hint mt-4">
			{sheet.status === 'geprueft'
				? 'Diese Woche ist geprüft und damit abgeschlossen.'
				: 'Diese Woche ist freigegeben und wartet auf die Prüfung. Ändern oder wieder öffnen kann sie jetzt nur noch, wer prüft.'}
		</p>
	{/if}
</form>

<div class="mt-4 flex flex-wrap gap-2">
	{#if sheet.status === 'freigegeben' && data.canCheck}
		<button type="button" class="btn btn-primary" onclick={() => (checkOpen = true)}><Check size={18} aria-hidden="true" />Geprüft</button>
	{/if}
	{#if sheet.status === 'geprueft' && data.canCheck}
		<button type="button" class="btn btn-ghost" onclick={() => (confirmUncheck = true)}>
			<Undo size={18} aria-hidden="true" />Zurück auf freigegeben
		</button>
	{/if}
	{#if sheet.status !== 'entwurf' && data.canCheck}
		<button type="button" class="btn btn-ghost" onclick={() => (confirmReopen = true)}>
			<LockOpen size={18} aria-hidden="true" />Wieder öffnen
		</button>
	{/if}
	{#if sheet.status === 'entwurf' && data.editable}
		<button type="button" class="btn btn-ghost ml-auto text-danger hover:bg-danger-soft" onclick={() => (confirmDelete = true)}>
			<Trash size={18} aria-hidden="true" />Löschen
		</button>
	{/if}
</div>

<Dialog bind:open={signOpen} title="Woche freigeben">
	<p class="text-ink-2">
		Mit der Unterschrift bestätigst du die Stunden von <span class="font-medium text-ink">{fullName(sheet)}</span>
		für {sheet.siblings.length ? segmentLabel(sheet.weekStart, sheet.month) : weekLabel(sheet.weekStart)}. Sie steht danach auf dem
		Ausdruck in der Zeile „Unterschrift Vorarbeiter".
	</p>
	<div class="mt-4">
		<SignaturePad bind:path={signature} />
	</div>
	<div class="mt-4 flex flex-wrap justify-end gap-2">
		<button type="submit" form="zettel" formaction="?/release" name="ohneUnterschrift" value="1" class="btn btn-ghost" disabled={busy}>
			Ohne Unterschrift freigeben
		</button>
		<button type="submit" form="zettel" formaction="?/release" class="btn btn-primary" disabled={busy || !signature}>
			<PenLine size={18} aria-hidden="true" />Unterschreiben und freigeben
		</button>
	</div>
</Dialog>

<Dialog bind:open={checkOpen} title="Woche prüfen">
	<p class="text-ink-2">
		Mit der Unterschrift bestätigst du, dass du die Stunden von <span class="font-medium text-ink">{fullName(sheet)}</span>
		für {sheet.siblings.length ? segmentLabel(sheet.weekStart, sheet.month) : weekLabel(sheet.weekStart)} geprüft hast. Sie steht danach
		auf dem Ausdruck beim Feld „überprüft".
	</p>
	<form
		method="POST"
		action="?/check"
		use:enhance={() => {
			checking = true;
			return async ({ result, update }) => {
				checking = false;
				if (result.type === 'success') {
					toast.success('Als geprüft markiert');
					checkOpen = false;
					checkSignature = '';
				}
				await update();
			};
		}}
	>
		<input type="hidden" name="unterschrift" value={checkSignature} />
		<div class="mt-4">
			<SignaturePad bind:path={checkSignature} />
		</div>
		<div class="mt-4 flex flex-wrap justify-end gap-2">
			<button type="button" class="btn btn-ghost" onclick={() => (checkOpen = false)}>Abbrechen</button>
			<button class="btn btn-primary" disabled={checking || !checkSignature}>
				<PenLine size={18} aria-hidden="true" />Unterschreiben und als geprüft markieren
			</button>
		</div>
	</form>
</Dialog>

<Dialog bind:open={confirmReopen} title="Woche wieder öffnen?">
	<p class="text-ink-2">
		Die Woche von {fullName(sheet)} wird wieder änderbar.
		{sheet.status === 'geprueft'
			? 'Die Unterschriften von Freigabe und Prüfung verfallen – sie muss danach neu freigegeben und geprüft werden.'
			: 'Die Unterschrift der Freigabe verfällt – sie muss danach neu freigegeben werden.'}
	</p>
	<form
		method="POST"
		action="?/reopen"
		class="mt-5 flex justify-end gap-2"
		use:enhance={() => async ({ result, update }) => {
			if (result.type === 'success') {
				toast.info('Woche wieder geöffnet');
				confirmReopen = false;
			}
			await update();
		}}
	>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmReopen = false)}>Abbrechen</button>
		<button class="btn btn-primary"><LockOpen size={18} aria-hidden="true" />Wieder öffnen</button>
	</form>
</Dialog>

<Dialog bind:open={confirmUncheck} title="Prüfung zurücknehmen?">
	<p class="text-ink-2">
		Die Woche von {fullName(sheet)} geht zurück auf <span class="font-medium text-ink">freigegeben</span>. Die Prüf-Unterschrift
		verfällt, die Freigabe samt Unterschrift bleibt. Ändern kann sie danach nur, wer prüfen darf.
	</p>
	<form
		method="POST"
		action="?/uncheck"
		class="mt-5 flex justify-end gap-2"
		use:enhance={() => async ({ result, update }) => {
			if (result.type === 'success') {
				toast.info('Zurück auf freigegeben');
				confirmUncheck = false;
			}
			await update();
		}}
	>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmUncheck = false)}>Abbrechen</button>
		<button class="btn btn-primary"><Undo size={18} aria-hidden="true" />Zurück auf freigegeben</button>
	</form>
</Dialog>

<Dialog bind:open={confirmDelete} title="Woche löschen?">
	<p class="text-ink-2">Die Woche von {fullName(sheet)} wird samt allen Tagen gelöscht. Das lässt sich nicht rückgängig machen.</p>
	<form method="POST" action="?/delete" class="mt-5 flex justify-end gap-2" use:enhance>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmDelete = false)}>Abbrechen</button>
		<button class="btn btn-primary">Löschen</button>
	</form>
</Dialog>
