<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Trash from '@lucide/svelte/icons/trash';
	import ProductForm from '$lib/modules/lager/components/ProductForm.svelte';
	import Dialog from '$lib/components/Dialog.svelte';

	let { data, form } = $props();
	const p = $derived(data.product);
	let confirmDelete = $state(false);

	const initial = $derived(
		form && 'values' in form && form.values
			? (form.values as never)
			: {
					name: p.name,
					articleNumber: p.articleNumber ?? '',
					manufacturer: p.manufacturer,
					categoryId: p.categoryId ? String(p.categoryId) : '',
					colorId: p.colorId ? String(p.colorId) : '',
					packageSize: p.packageSize != null ? String(p.packageSize).replace('.', ',') : '',
					unit: p.unit,
					minStock: p.minStock != null ? String(p.minStock) : '',
					targetStock: p.targetStock != null ? String(p.targetStock) : '',
					notes: p.notes,
					active: p.active
				}
	);
</script>

<svelte:head><title>{pageTitle(`${p.name} bearbeiten`)}</title></svelte:head>

<a href="/lager/artikel/{p.id}" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />{p.name}</a>
<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<h1 class="text-[2rem] leading-tight">Artikel bearbeiten</h1>
	<button class="btn btn-ghost text-danger hover:bg-danger-soft hover:text-danger" onclick={() => (confirmDelete = true)}>
		<Trash size={18} aria-hidden="true" />Löschen
	</button>
</div>

{#key form}
	<ProductForm
		mode="edit"
		action="?/save"
		{initial}
		initialCodes={form && 'values' in form && form.values ? ((form.values as { codes: never[] }).codes ?? []) : data.codes}
		categories={data.categories}
		colors={data.colors}
		manufacturers={data.manufacturers}
		errors={form && 'errors' in form ? (form.errors ?? {}) : {}}
		codeConflict={form && 'codeConflict' in form ? (form.codeConflict ?? null) : null}
	/>
{/key}

<Dialog bind:open={confirmDelete} title="Artikel löschen?">
	{#if data.hasMovements}
		<p class="text-ink-2">
			„{p.name}“ hat bereits Buchungen. Damit die Historie vollständig bleibt, kann er nicht gelöscht werden. Deaktiviere ihn stattdessen –
			dann taucht er in Suche und Buchung nicht mehr auf.
		</p>
	{:else}
		<p class="text-ink-2">„{p.name}“ wird endgültig entfernt, zusammen mit seinen Codes.</p>
	{/if}
	{#if form && 'deleteError' in form}<p class="field-error">{form.deleteError}</p>{/if}
	{#snippet footer()}
		<button class="btn btn-secondary" onclick={() => (confirmDelete = false)}>Abbrechen</button>
		{#if !data.hasMovements}
			<form method="POST" action="?/delete" use:enhance>
				<button class="btn btn-danger">Endgültig löschen</button>
			</form>
		{/if}
	{/snippet}
</Dialog>
