<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Printer from '@lucide/svelte/icons/printer';
	import FileText from '@lucide/svelte/icons/file-text';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import Trash from '@lucide/svelte/icons/trash';
	import Dialog from '$lib/components/Dialog.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();
	const report = $derived(data.report);

	const MATERIALS = [
		{ kind: 'gelb', label: 'gelb' },
		{ kind: 'weiss', label: 'weiß' },
		{ kind: 'reflex', label: 'Reflexk.' }
	] as const;

	type Row = { key: number; id: number | null; label: string; q: string[] };

	const num = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));

	let nextKey = 1;
	// svelte-ignore state_referenced_locally
	let rows = $state<Row[]>(
		data.report.rows.map((r) => ({
			key: nextKey++,
			id: r.id,
			label: r.label,
			q: [r.q1, r.q2, r.q3, r.q4, r.q5, r.q6, r.q7, r.q8].map(num)
		}))
	);
	// svelte-ignore state_referenced_locally
	let positions = $state(data.report.positions.map((p) => ({ idx: p.idx, lbPos: p.lbPos, unit: p.unit })));
	let busy = $state(false);
	let confirmDelete = $state(false);

	function addRow() {
		rows = [...rows, { key: nextKey++, id: null, label: '', q: Array(8).fill('') }];
	}
	function removeRow(key: number) {
		rows = rows.filter((r) => r.key !== key);
	}

	const parse = (v: string) => {
		const n = Number(String(v).replace(',', '.'));
		return Number.isFinite(n) ? n : 0;
	};
	const sums = $derived(Array.from({ length: 8 }, (_, c) => rows.reduce((s, r) => s + parse(r.q[c]), 0)));
	const show = (n: number) => (n ? String(Math.round(n * 1000) / 1000).replace('.', ',') : '');
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
		<a href="/tagesberichte/{report.id}/pdf" class="btn btn-secondary" download><FileText size={18} aria-hidden="true" />PDF</a>
		<a href="/tagesberichte/{report.id}/druck" class="btn btn-secondary"><Printer size={18} aria-hidden="true" />Drucken</a>
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

		<div class="card mt-4 overflow-x-auto">
			<table class="w-full min-w-[60rem] border-collapse text-sm">
				<thead>
					<tr class="border-b border-line">
						<th scope="col" class="px-3 py-2 text-left">Ortsbezeichnungen und Markierungsarten</th>
						{#each positions as p, i (p.idx)}
							<th scope="col" class="w-[6.5rem] px-1.5 py-1.5">
								<span class="sr-only">Spalte {p.idx}</span>
								<input
									class="input input-sm num text-center"
									name="lbpos.{p.idx}"
									placeholder="LB-Pos."
									maxlength="40"
									bind:value={positions[i].lbPos}
									aria-label="LB-Position Spalte {p.idx}"
								/>
								<input
									class="input input-sm mt-1 text-center"
									name="einheit.{p.idx}"
									placeholder="Einheit"
									maxlength="20"
									bind:value={positions[i].unit}
									aria-label="Einheit Spalte {p.idx}"
								/>
							</th>
						{/each}
						<th scope="col" class="w-10"></th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row, i (row.key)}
						<tr class="border-b border-line">
							<td class="px-3 py-1.5">
								<input type="hidden" name="zeile.{i}.id" value={row.id ?? 'neu'} />
								<input
									class="input input-sm"
									name="zeile.{i}.text"
									maxlength="200"
									bind:value={rows[i].label}
									aria-label="Ortsbezeichnung Zeile {i + 1}"
								/>
							</td>
							{#each Array(8) as _, c (c)}
								<td class="px-1.5 py-1.5">
									<input
										class="input input-sm num text-center"
										name="zeile.{i}.q{c + 1}"
										inputmode="decimal"
										bind:value={rows[i].q[c]}
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
					<tr class="bg-surface-2 font-semibold">
						<th scope="row" class="px-3 py-2 text-left">Einheitssumme</th>
						{#each sums as s, c (c)}
							<td class="num px-1.5 py-2 text-center">{show(s)}</td>
						{/each}
						<td></td>
					</tr>
				</tbody>
			</table>
		</div>

		{#if data.editable}
			<button type="button" class="btn btn-secondary btn-sm mt-3" onclick={addRow}><Plus size={16} aria-hidden="true" />Zeile hinzufügen</button>
		{/if}

		<div class="mt-4 grid gap-4 lg:grid-cols-3">
			<section class="card p-4 lg:p-5">
				<h2 class="text-lg">Material</h2>
				<table class="mt-2 w-full text-sm">
					<thead>
						<tr class="text-left text-ink-3">
							<th scope="col" class="pb-1 font-normal">Material</th>
							<th scope="col" class="pb-1 font-normal">Kenn-Nr.</th>
							<th scope="col" class="pb-1 font-normal">Filmdicke (mm)</th>
						</tr>
					</thead>
					<tbody>
						{#each MATERIALS as m (m.kind)}
							{@const row = report.materials.find((x) => x.kind === m.kind)}
							<tr>
								<th scope="row" class="py-1 pr-2 text-left font-medium">{m.label}</th>
								<td class="py-1 pr-2"><input class="input input-sm" name="material.{m.kind}.nr" value={row?.code ?? ''} maxlength="60" /></td>
								<td class="py-1">
									<input class="input input-sm num" name="material.{m.kind}.dicke" inputmode="decimal" value={num(row?.filmThickness ?? null)} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>

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

	{#if data.editable}
		<div class="card sticky bottom-24 mt-4 flex flex-wrap items-center gap-2 p-3 lg:bottom-6">
			<button class="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Speichern'}</button>
			<span class="ml-auto text-sm text-ink-2">{rows.length} Zeilen</span>
		</div>
	{:else}
		<p class="field-hint mt-4">Dieser Bericht ist abgeschlossen. Zum Ändern muss er wieder geöffnet werden.</p>
	{/if}
</form>

<div class="mt-4 flex flex-wrap gap-2">
	{#if report.status === 'entwurf' && data.canClose}
		<form method="POST" action="?/close" use:enhance={() => async ({ update }) => {
			toast.success('Bericht abgeschlossen');
			await update();
		}}>
			<button class="btn btn-secondary"><Check size={18} aria-hidden="true" />Abschließen</button>
		</form>
	{/if}
	{#if report.status === 'abgeschlossen' && data.canClose}
		<form method="POST" action="?/reopen" use:enhance={() => async ({ update }) => {
			toast.info('Bericht wieder geöffnet');
			await update();
		}}>
			<button class="btn btn-ghost"><LockOpen size={18} aria-hidden="true" />Wieder öffnen</button>
		</form>
	{/if}
	{#if report.status === 'entwurf' && data.editable}
		<button type="button" class="btn btn-ghost ml-auto text-danger hover:bg-danger-soft" onclick={() => (confirmDelete = true)}>
			<Trash size={18} aria-hidden="true" />Löschen
		</button>
	{/if}
</div>

<Dialog bind:open={confirmDelete} title="Tagesbericht löschen?">
	<p class="text-ink-2">Der Bericht {report.number} wird samt allen Zeilen gelöscht. Das lässt sich nicht rückgängig machen.</p>
	<form method="POST" action="?/delete" class="mt-5 flex justify-end gap-2" use:enhance>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmDelete = false)}>Abbrechen</button>
		<button class="btn btn-primary">Löschen</button>
	</form>
</Dialog>
