<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import FileText from '@lucide/svelte/icons/file-text';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import Trash from '@lucide/svelte/icons/trash';
	import Dialog from '$lib/components/Dialog.svelte';
	import SignaturePad from '$lib/modules/stunden/components/SignaturePad.svelte';
	import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
	import { MAX_MATERIALS, MAX_POSITIONS, productMaterial, quantityLabel, sumLabel } from '$lib/modules/tagesberichte/sheet';
	import { dateTime } from '$lib/format';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();
	const report = $derived(data.report);

	type Position = { key: number; lbPos: string; unit: string; total: string };
	type Row = { key: number; id: number | null; label: string; q: string[] };
	type Material = { key: number; productId: string; material: string; code: string; thickness: string };

	let nextKey = 1;
	// Der Bericht wird nur beim Öffnen übernommen – danach gehört der Stand dem Formular
	// svelte-ignore state_referenced_locally
	let positions = $state<Position[]>(
		data.report.positions.map((p) => ({ key: nextKey++, lbPos: p.lbPos, unit: p.unit, total: quantityLabel(p.totalQuantity) }))
	);
	// svelte-ignore state_referenced_locally
	let rows = $state<Row[]>(
		data.report.rows.map((r) => ({
			key: nextKey++,
			id: r.id,
			label: r.label,
			q: positions.map((_, i) => quantityLabel(r.quantities[i]))
		}))
	);
	const emptyMaterial = (): Material => ({ key: nextKey++, productId: '', material: '', code: '', thickness: '' });
	// svelte-ignore state_referenced_locally
	let materials = $state<Material[]>(
		data.report.materials.length
			? data.report.materials.map((m) => ({
					key: nextKey++,
					productId: m.productId == null ? '' : String(m.productId),
					material: m.material,
					code: m.code,
					thickness: quantityLabel(m.filmThickness)
				}))
			: [emptyMaterial()]
	);

	let busy = $state(false);
	let confirmDelete = $state(false);
	let confirmReopen = $state(false);
	let closeOpen = $state(false);
	let signature = $state('');
	let confirmColumn = $state<number | null>(null);
	let tableBox = $state<HTMLDivElement>();

	function addRow() {
		rows.push({ key: nextKey++, id: null, label: '', q: positions.map(() => '') });
	}
	function removeRow(key: number) {
		rows = rows.filter((r) => r.key !== key);
	}

	/** Neue LB-Position hinten anfügen – die Tabelle rollt hin, der Cursor steht im neuen Feld */
	async function addPosition() {
		if (positions.length >= MAX_POSITIONS) return;
		positions.push({ key: nextKey++, lbPos: '', unit: '', total: '' });
		for (const r of rows) r.q.push('');
		await tick();
		tableBox?.scrollTo({ left: tableBox.scrollWidth, behavior: 'smooth' });
		tableBox?.querySelector<HTMLInputElement>(`[data-lbpos="${positions.length - 1}"]`)?.focus({ preventScroll: true });
	}
	const columnUsed = (i: number) =>
		!!(positions[i].lbPos.trim() || positions[i].unit.trim() || positions[i].total.trim() || rows.some((r) => r.q[i]?.trim()));
	/** Spalte mit Inhalt erst nach Rückfrage entfernen */
	function askRemovePosition(i: number) {
		if (columnUsed(i)) confirmColumn = i;
		else removePosition(i);
	}
	function removePosition(i: number) {
		positions.splice(i, 1);
		for (const r of rows) r.q.splice(i, 1);
		confirmColumn = null;
	}

	function addMaterial() {
		if (materials.length < MAX_MATERIALS) materials.push(emptyMaterial());
	}
	function removeMaterial(key: number) {
		materials = materials.filter((m) => m.key !== key);
	}

	const productById = $derived(new Map(data.products.map((p) => [String(p.id), p])));
	/** Kategorien als Gruppen in der Auswahl, in der Reihenfolge der Stammdaten */
	const productGroups = $derived.by(() => {
		const groups = new Map<string, typeof data.products>();
		for (const p of data.products) {
			const name = p.categoryName ?? 'Ohne Materialart';
			groups.set(name, [...(groups.get(name) ?? []), p]);
		}
		return [...groups.entries()];
	});
	/** Artikel, die am Bericht hängen, aber nicht mehr aktiv sind – sonst fiele die Auswahl leer */
	const inactiveLinked = $derived(
		report.materials.filter((m) => m.productId != null && !productById.has(String(m.productId)))
	);

	/** Artikel gewählt: Material (Farbe) und Kenn-Nr. kommen aus den Stammdaten */
	function pickProduct(m: Material) {
		const p = productById.get(m.productId);
		if (!p) return;
		m.material = productMaterial(p);
		m.code = p.name;
	}

	const parse = (v: string) => {
		const n = Number(String(v).replace(',', '.'));
		return Number.isFinite(n) ? n : 0;
	};
	const sums = $derived(positions.map((_, c) => rows.reduce((s, r) => s + parse(r.q[c] ?? ''), 0)));
	const closer = $derived([report.closedByFirst, report.closedByLast].filter(Boolean).join(' '));
</script>

<svelte:head><title>{pageTitle(`Tagesbericht ${report.number || ''}`.trim())}</title></svelte:head>

<a href="/tagesberichte" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Tagesberichte
</a>

<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-[2rem] leading-tight">Tagesbericht {report.number}</h1>
		<p class="text-ink-2">
			{report.road || report.site || 'Ohne Bezeichnung'}{report.partyName ? ` · ${report.partyName}` : ''}
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<span class="badge {report.status === 'abgeschlossen' ? 'badge-ok' : ''}">
			{report.status === 'abgeschlossen' ? 'Abgeschlossen' : 'In Arbeit'}
		</span>
		<PdfButton href="/tagesberichte/{report.id}/pdf"><FileText size={18} aria-hidden="true" />PDF</PdfButton>
		<a href="/tagesberichte/{report.id}/druck" class="btn btn-secondary"><Printer size={18} aria-hidden="true" />Drucken</a>
	</div>
</div>

{#if form && 'message' in form && form.message}
	<p class="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">{form.message}</p>
{/if}

{#if report.status === 'abgeschlossen' && report.closedAt}
	<section class="card mb-4 flex flex-wrap items-center gap-4 p-4">
		{#if report.closeSignature}
			<svg viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}" class="h-16 w-48 shrink-0 rounded-lg bg-white" role="img" aria-label="Unterschrift {closer}">
				<path d={report.closeSignature} fill="none" stroke="#1d2127" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		{/if}
		<p class="text-sm text-ink-2">
			Abgeschlossen{report.closeSignature ? ' und unterschrieben' : ''}{closer ? ' von ' : ''}<span class="font-medium text-ink">{closer}</span>
			am {dateTime(report.closedAt)} – im Ausdruck bei „Für den Auftragnehmer".
		</p>
	</section>
{/if}

<form
	id="bericht"
	method="POST"
	action="?/save"
	use:enhance={({ action }) => {
		busy = true;
		const closing = action.search.includes('close');
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') {
				toast.success(closing ? 'Bericht abgeschlossen' : 'Gespeichert');
				if (closing) {
					closeOpen = false;
					signature = '';
				}
			}
			await update({ reset: false });
		};
	}}
>
	<!-- Außerhalb des fieldset, damit sie auch bei gesperrtem Bericht mitkommt -->
	<input type="hidden" name="unterschrift" value={signature} />

	<fieldset disabled={!data.editable} class="contents">
		<section class="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:p-5">
			<label class="block">
				<span class="field-label">Nummer</span>
				<input class="input num" name="nummer" value={report.number} maxlength="40" />
			</label>
			<label class="block">
				<span class="field-label">Datum</span>
				<input class="input num" type="date" name="datum" value={report.date} required />
			</label>
			<label class="block">
				<span class="field-label">Bundesstraße Nr.</span>
				<input class="input" name="strasse" value={report.road} maxlength="120" list="strassen" />
			</label>
			<label class="block">
				<span class="field-label">Baustelle</span>
				<input class="input" name="baustelle" value={report.site} maxlength="200" list="baustellen" />
			</label>
			<label class="block">
				<span class="field-label">Kostenstelle</span>
				<input class="input" name="kostenstelle" value={report.costCenter} maxlength="60" />
			</label>
		</section>
		<datalist id="strassen">{#each data.places.roads as r (r)}<option value={r}></option>{/each}</datalist>
		<datalist id="baustellen">{#each data.places.sites as s (s)}<option value={s}></option>{/each}</datalist>

		<!-- relative: sonst ragen die unsichtbaren Beschriftungen (sr-only) aus der Rollfläche und verbreitern die Seite -->
		<div class="card relative mt-4 overflow-x-auto" bind:this={tableBox}>
			<table class="w-full border-collapse text-sm" style="min-width: {10 + positions.length * 7 + 2.5}rem">
				<thead>
					<tr class="border-b border-line">
						<th scope="col" class="sticky left-0 w-[10rem] bg-surface px-3 py-2 text-left align-bottom sm:w-[16rem]">Ortsbezeichnungen und Markierungsarten</th>
						{#each positions as p, i (p.key)}
							<th scope="col" class="w-[7rem] px-1.5 py-1.5 align-bottom">
								<div class="mb-1 flex h-6 items-center justify-between gap-1">
									<span class="num text-[0.6875rem] font-normal text-ink-3">Spalte {i + 1}</span>
									{#if data.editable}
										<button
											type="button"
											class="grid size-6 place-items-center rounded-md text-ink-3 hover:bg-surface-3 hover:text-danger"
											aria-label="LB-Position Spalte {i + 1} entfernen"
											onclick={() => askRemovePosition(i)}
										>
											<X size={13} />
										</button>
									{/if}
								</div>
								<input
									class="input input-sm num text-center"
									name="pos.lbpos"
									placeholder="LB-Pos."
									maxlength="40"
									data-lbpos={i}
									bind:value={p.lbPos}
									aria-label="LB-Position Spalte {i + 1}"
								/>
								<input
									class="input input-sm mt-1 text-center"
									name="pos.einheit"
									placeholder="Einheit"
									maxlength="20"
									bind:value={p.unit}
									aria-label="Einheit Spalte {i + 1}"
								/>
							</th>
						{/each}
						<th scope="col" class="w-10"><span class="sr-only">Zeile entfernen</span></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i (row.key)}
						<tr class="border-b border-line">
							<td class="sticky left-0 bg-surface px-3 py-1.5">
								<input type="hidden" name="zeile.{i}.id" value={row.id ?? 'neu'} />
								<input
									class="input input-sm"
									name="zeile.{i}.text"
									maxlength="200"
									bind:value={row.label}
									aria-label="Ortsbezeichnung Zeile {i + 1}"
								/>
							</td>
							{#each positions as p, c (p.key)}
								<td class="px-1.5 py-1.5">
									<input
										class="input input-sm num text-center"
										name="zeile.{i}.menge"
										inputmode="decimal"
										bind:value={row.q[c]}
										aria-label="Menge Zeile {i + 1} Spalte {c + 1}"
									/>
								</td>
							{/each}
							<td class="px-1 py-1.5 text-center">
								{#if data.editable}
									<button
										type="button"
										class="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-danger"
										aria-label="Zeile {i + 1} entfernen"
										onclick={() => removeRow(row.key)}
									>
										<X size={15} />
									</button>
								{/if}
							</td>
						</tr>
					{/each}
					<tr class="border-b border-line bg-surface-2 font-semibold">
						<th scope="row" class="sticky left-0 bg-surface-2 px-3 py-2 text-left">Einheitssumme</th>
						{#each sums as s, c (c)}
							<td class="num px-1.5 py-2 text-center">{sumLabel(s)}</td>
						{/each}
						<td></td>
					</tr>
					<tr class="bg-surface-2">
						<th scope="row" class="sticky left-0 bg-surface-2 px-3 py-1.5 text-left font-semibold">
							Gesamtmenge
							<span class="block text-[0.75rem] font-normal text-ink-3">von Hand eintragen</span>
						</th>
						{#each positions as p, c (p.key)}
							<td class="px-1.5 py-1.5">
								<input
									class="input input-sm num text-center"
									name="pos.gesamt"
									inputmode="decimal"
									bind:value={p.total}
									aria-label="Gesamtmenge Spalte {c + 1}"
								/>
							</td>
						{/each}
						<td></td>
					</tr>
				</tbody>
			</table>
		</div>

		{#if data.editable}
			<div class="mt-3 flex flex-wrap gap-2">
				<button type="button" class="btn btn-secondary btn-sm" onclick={addRow}><Plus size={16} aria-hidden="true" />Zeile hinzufügen</button>
				<button type="button" class="btn btn-secondary btn-sm" onclick={addPosition} disabled={positions.length >= MAX_POSITIONS}>
					<Plus size={16} aria-hidden="true" />LB-Pos. hinzufügen
				</button>
			</div>
		{/if}

		<section class="card mt-4 p-4 lg:p-5">
			<h2 class="text-lg">Material</h2>
			{#if data.editable}
				<p class="field-hint">Artikel aus dem Lager wählen – Material (die Farbe) und Kenn-Nr. (der Artikelname) füllen sich selbst aus, dazu nur noch die Filmdicke.</p>
			{/if}
			<div class="mt-3 hidden gap-2 text-[0.8125rem] text-ink-3 md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1.7fr)_7rem_2.25rem]">
				<span>Artikel aus dem Lager</span><span>Material</span><span>Kenn-Nr.</span><span>Filmdicke in mm</span><span></span>
			</div>
			<ul class="mt-1 space-y-3 md:space-y-2">
				{#each materials as m, i (m.key)}
					<li class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] gap-2 border-b border-line pb-3 md:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1.7fr)_7rem_2.25rem] md:border-0 md:pb-0">
						<label class="col-span-3 block md:col-span-1">
							<span class="field-label md:sr-only">Artikel aus dem Lager</span>
							<select
								class="select min-h-9 py-1 text-[0.9375rem]"
								name="material.artikel"
								bind:value={m.productId}
								onchange={() => pickProduct(m)}
							>
								<option value="">Ohne Artikel – von Hand</option>
								{#each inactiveLinked.filter((x) => String(x.productId) === m.productId) as x (x.productId)}
									<option value={String(x.productId)}>{x.productName ?? 'Gelöschter Artikel'} (nicht mehr aktiv)</option>
								{/each}
								{#each productGroups as [group, list] (group)}
									<optgroup label={group}>
										{#each list as p (p.id)}
											<option value={String(p.id)}>{p.name}{p.articleNumber ? ` · ${p.articleNumber}` : ''}</option>
										{/each}
									</optgroup>
								{/each}
							</select>
						</label>
						<label class="order-2 block md:order-none">
							<span class="field-label md:sr-only">Material</span>
							<input class="input input-sm" name="material.name" maxlength="60" bind:value={m.material} aria-label="Material Zeile {i + 1}" />
						</label>
						<!-- Am Handy steht der Artikelname gleich unter der Auswahl, über die volle Breite -->
						<label class="order-1 col-span-3 block md:order-none md:col-span-1">
							<span class="field-label md:sr-only">Kenn-Nr.</span>
							<input class="input input-sm" name="material.nr" maxlength="120" bind:value={m.code} aria-label="Kenn-Nr. Zeile {i + 1}" />
						</label>
						<label class="order-2 block md:order-none">
							<span class="field-label md:sr-only">Filmdicke in mm</span>
							<input
								class="input input-sm num"
								name="material.dicke"
								inputmode="decimal"
								bind:value={m.thickness}
								aria-label="Filmdicke in mm Zeile {i + 1}"
							/>
						</label>
						<div class="order-2 flex items-end justify-end md:order-none md:items-center">
							{#if data.editable}
								<button
									type="button"
									class="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-danger"
									aria-label="Material Zeile {i + 1} entfernen"
									onclick={() => removeMaterial(m.key)}
								>
									<X size={15} />
								</button>
							{/if}
						</div>
					</li>
				{:else}
					<li class="text-sm text-ink-3">Kein Material eingetragen.</li>
				{/each}
			</ul>
			{#if data.editable}
				<button type="button" class="btn btn-secondary btn-sm mt-3" onclick={addMaterial} disabled={materials.length >= MAX_MATERIALS}>
					<Plus size={16} aria-hidden="true" />Material hinzufügen
				</button>
			{/if}
		</section>

		<div class="mt-4 grid gap-4 lg:grid-cols-2">
			<section class="card space-y-3 p-4 lg:p-5">
				<label class="block">
					<span class="field-label">Tagesleistung</span>
					<input class="input" name="tagesleistung" value={report.dailyOutput} maxlength="200" />
				</label>
				<label class="block">
					<span class="field-label">LV-Position Nr.</span>
					<input class="input" name="lvposition" value={report.lvPosition} maxlength="200" />
				</label>
			</section>

			<section class="card p-4 lg:p-5">
				<h2 class="text-lg">Notiz</h2>
				<textarea class="textarea mt-2" name="notiz" rows="4" maxlength="2000" value={report.note}></textarea>
			</section>
		</div>
	</fieldset>

	{#if data.editable && report.status === 'entwurf'}
		<div class="card sticky bottom-24 mt-4 flex flex-wrap items-center gap-2 p-3 lg:bottom-6">
			<button class="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Speichern'}</button>
			{#if data.canClose}
				<button type="button" class="btn btn-secondary" disabled={busy} onclick={() => (closeOpen = true)}>
					<Check size={18} aria-hidden="true" />Abschließen
				</button>
			{/if}
			<span class="ml-auto text-sm text-ink-2">{rows.length} Zeilen · {positions.length} LB-Pos.</span>
		</div>
	{:else if data.editable}
		<div class="card sticky bottom-24 mt-4 flex flex-wrap items-center gap-2 p-3 lg:bottom-6">
			<button class="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Speichern'}</button>
			<span class="text-sm text-ink-2">Der Bericht ist abgeschlossen – du darfst ihn trotzdem ändern.</span>
		</div>
	{:else if report.status === 'abgeschlossen'}
		<p class="field-hint mt-4">Dieser Bericht ist abgeschlossen. Zum Ändern muss er wieder geöffnet werden.</p>
	{:else}
		<p class="field-hint mt-4">Diesen Bericht kannst du nur ansehen.</p>
	{/if}
</form>

<div class="mt-4 flex flex-wrap gap-2">
	{#if report.status === 'entwurf' && data.canClose && !data.editable}
		<button type="button" class="btn btn-secondary" onclick={() => (closeOpen = true)}><Check size={18} aria-hidden="true" />Abschließen</button>
	{/if}
	{#if report.status === 'abgeschlossen' && data.canClose}
		<button type="button" class="btn btn-ghost" onclick={() => (confirmReopen = true)}><LockOpen size={18} aria-hidden="true" />Wieder öffnen</button>
	{/if}
	{#if report.status === 'entwurf' && data.editable}
		<button type="button" class="btn btn-ghost ml-auto text-danger hover:bg-danger-soft" onclick={() => (confirmDelete = true)}>
			<Trash size={18} aria-hidden="true" />Löschen
		</button>
	{/if}
</div>

<Dialog bind:open={closeOpen} title="Bericht abschließen">
	<p class="text-ink-2">
		Mit deiner Unterschrift schließt du den Bericht {report.number} ab. Sie steht danach im Ausdruck bei
		<span class="font-medium text-ink">„Für den Auftragnehmer"</span>. Was im Formular steht, wird vorher gespeichert.
	</p>
	<div class="mt-4">
		<SignaturePad bind:path={signature} />
	</div>
	{#if form && 'message' in form && form.message}<p class="field-error" role="alert">{form.message}</p>{/if}
	<div class="mt-4 flex flex-wrap justify-end gap-2">
		<button type="button" class="btn btn-ghost" onclick={() => (closeOpen = false)}>Abbrechen</button>
		<button type="submit" form="bericht" formaction="?/close" class="btn btn-primary" disabled={busy || !signature}>
			<PenLine size={18} aria-hidden="true" />Unterschreiben und abschließen
		</button>
	</div>
</Dialog>

<Dialog bind:open={confirmReopen} title="Bericht wieder öffnen?">
	<p class="text-ink-2">
		Der Bericht {report.number} wird wieder bearbeitbar.{report.closeSignature
			? ' Die Unterschrift verfällt – beim nächsten Abschließen muss neu unterschrieben werden.'
			: ''}
	</p>
	<form
		method="POST"
		action="?/reopen"
		class="mt-5 flex justify-end gap-2"
		use:enhance={() => async ({ result, update }) => {
			confirmReopen = false;
			if (result.type === 'success') toast.info('Bericht wieder geöffnet');
			await update();
		}}
	>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmReopen = false)}>Abbrechen</button>
		<button class="btn btn-primary"><LockOpen size={18} aria-hidden="true" />Wieder öffnen</button>
	</form>
</Dialog>

<Dialog open={confirmColumn !== null} onclose={() => (confirmColumn = null)} title="LB-Position entfernen?">
	{#if confirmColumn !== null}
		{@const p = positions[confirmColumn]}
		<p class="text-ink-2">
			Spalte {confirmColumn + 1}{p?.lbPos ? ` (LB-Pos. ${p.lbPos})` : ''} wird samt ihren Mengen entfernt. Erst mit „Speichern" ist es endgültig.
		</p>
		<div class="mt-5 flex justify-end gap-2">
			<button type="button" class="btn btn-ghost" onclick={() => (confirmColumn = null)}>Abbrechen</button>
			<button type="button" class="btn btn-primary" onclick={() => confirmColumn !== null && removePosition(confirmColumn)}>Entfernen</button>
		</div>
	{/if}
</Dialog>

<Dialog bind:open={confirmDelete} title="Tagesbericht löschen?">
	<p class="text-ink-2">Der Bericht {report.number} wird samt allen Zeilen gelöscht. Das lässt sich nicht rückgängig machen.</p>
	<form method="POST" action="?/delete" class="mt-5 flex justify-end gap-2" use:enhance>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmDelete = false)}>Abbrechen</button>
		<button class="btn btn-primary">Löschen</button>
	</form>
</Dialog>
