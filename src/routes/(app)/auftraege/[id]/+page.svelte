<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import Printer from '@lucide/svelte/icons/printer';
	import Hammer from '@lucide/svelte/icons/hammer';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Phone from '@lucide/svelte/icons/phone';
	import FilePen from '@lucide/svelte/icons/file-pen-line';
	import Trash from '@lucide/svelte/icons/trash';
	import Dialog from '$lib/components/Dialog.svelte';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import { dateTime } from '$lib/format';
	import { addressLines, lineNumbers, ORDER_STATUS_LABELS, quantityLabel, spacedNumber } from '$lib/modules/auftraege/offer';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();
	const order = $derived(data.order);
	const st = $derived(ORDER_STATUS_LABELS[order.status] ?? ORDER_STATUS_LABELS.erstellt);
	const numbers = $derived(lineNumbers(order.lines));
	const statusBy = $derived([order.statusByFirst, order.statusByLast].filter(Boolean).join(' '));

	let busy = $state(false);
	let deleteOpen = $state(false);
	let resetOpen = $state(false);

	const STEP_DONE: Record<string, string> = { in_arbeit: 'Auftrag ist in Arbeit', abgeschlossen: 'Auftrag abgeschlossen', erstellt: 'Zurück auf „Auftrag erstellt"' };
	const statusEnhance = () => {
		busy = true;
		return async ({ result, update }: { result: { type: string; data?: Record<string, unknown> }; update: () => Promise<void> }) => {
			busy = false;
			resetOpen = false;
			if (result.type === 'success') toast.success(STEP_DONE[String(result.data?.status)] ?? 'Gespeichert');
			await update();
		};
	};
</script>

<svelte:head><title>{pageTitle(`Auftrag ${spacedNumber(order.number)}`)}</title></svelte:head>

<a href="/auftraege" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Aufträge
</a>

<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="text-[2rem] leading-tight">Auftrag {spacedNumber(order.number)}</h1>
		<p class="text-ink-2">{order.title || 'Ohne BV'}</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<span class="badge {st.tone}">{#if order.status === 'abgeschlossen'}<CircleCheck size={13} aria-hidden="true" />{/if}{st.label}</span>
		<PdfButton href="/auftraege/{order.id}/pdf"><FileText size={18} aria-hidden="true" />PDF</PdfButton>
		<a href="/auftraege/{order.id}/druck" class="btn btn-secondary"><Printer size={18} aria-hidden="true" />Drucken</a>
	</div>
</div>

{#if form && 'message' in form && form.message}<p class="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">{form.message}</p>{/if}

{#if data.canStatus && order.status !== 'abgeschlossen'}
	<!-- Der Stand der Arbeiten – groß, damit es auf der Baustelle mit einem Tipp geht -->
	<form method="POST" action="?/status" class="card mb-4 flex flex-wrap items-center gap-3 p-4" use:enhance={statusEnhance}>
		<p class="min-w-[12rem] flex-1 text-ink-2">
			{order.status === 'erstellt' ? 'Sobald ihr anfangt, auf „In Arbeit" setzen.' : 'Fertig? Dann auf „Abgeschlossen" setzen.'}
		</p>
		{#if order.status === 'erstellt'}
			<button class="btn btn-primary" name="status" value="in_arbeit" disabled={busy}><Hammer size={18} aria-hidden="true" />In Arbeit</button>
		{/if}
		<button class="btn {order.status === 'in_arbeit' ? 'btn-primary' : 'btn-secondary'}" name="status" value="abgeschlossen" disabled={busy}>
			<CircleCheck size={18} aria-hidden="true" />Abgeschlossen
		</button>
	</form>
{/if}

{#if order.statusAt}
	<p class="mb-4 text-sm text-ink-3">Stand zuletzt gesetzt{statusBy ? ` von ${statusBy}` : ''} am {dateTime(order.statusAt)}.</p>
{/if}

<div class="grid gap-4 lg:grid-cols-2">
	<section class="card p-4 lg:p-5">
		<h2 class="text-lg">Kunde</h2>
		<p class="mt-2 leading-relaxed">
			{#each addressLines({ name: order.customerName, addition: order.customerAddition, street: order.customerStreet, zip: order.customerZip, city: order.customerCity }) as l, i (i)}
				<span class="block {i === 0 ? 'font-medium' : ''}">{l}</span>
			{/each}
		</p>
		{#if order.customerContact || order.customerPhone}
			<p class="mt-3 text-sm">
				{#if order.customerContact}<span class="block">Ansprechpartner: {order.customerContact}</span>{/if}
				{#if order.customerPhone}
					<a href="tel:{order.customerPhone.replace(/[^\d+]/g, '')}" class="mt-1 inline-flex items-center gap-1.5 font-medium underline-offset-2 hover:underline">
						<Phone size={15} aria-hidden="true" />{order.customerPhone}
					</a>
				{/if}
			</p>
		{/if}
	</section>

	<section class="card p-4 lg:p-5">
		<h2 class="text-lg">Auftrag</h2>
		<dl class="mt-2 grid grid-cols-[8rem_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-ink-3">Auftragsnummer</dt>
			<dd class="num">{order.number}</dd>
			{#if order.projectNumber}
				<dt class="text-ink-3">Projektnummer</dt>
				<dd class="num">{order.projectNumber}</dd>
			{/if}
			<dt class="text-ink-3">Partie</dt>
			<dd>{order.partyName ?? '–'}</dd>
			<dt class="text-ink-3">Erstellt</dt>
			<dd>{dateTime(order.createdAt)}{order.creatorFirst || order.creatorLast ? ` · ${[order.creatorFirst, order.creatorLast].filter(Boolean).join(' ')}` : ''}</dd>
		</dl>
		{#if data.canSeeOffer}
			<a href="/angebote/{order.offerId}" class="btn btn-ghost btn-sm mt-3"><FilePen size={16} aria-hidden="true" />Zum Angebot</a>
		{/if}
	</section>
</div>

{#if order.note.trim()}
	<section class="card mt-4 border-warn/50 p-4 lg:p-5">
		<h2 class="text-lg">Hinweis für die Partie</h2>
		<p class="mt-2 whitespace-pre-line">{order.note}</p>
	</section>
{/if}

<section class="card mt-4 overflow-hidden">
	<h2 class="px-4 pt-4 text-lg lg:px-5">Positionen</h2>
	<ul class="mt-2 divide-y divide-line">
		{#each order.lines as l, i (l.id)}
			{#if l.kind === 'titel'}
				<li class="bg-surface-2 px-4 py-2 font-semibold lg:px-5"><span class="num mr-2">{numbers[i]}</span>{l.text}</li>
			{:else}
				<li class="flex items-start gap-3 px-4 py-3 lg:px-5">
					<span class="num w-9 shrink-0 text-sm text-ink-3">{numbers[i]}</span>
					<span class="min-w-0 flex-1 font-medium whitespace-pre-line">{l.text}</span>
					<span class="num shrink-0 text-right">{quantityLabel(l.quantity)} <span class="text-ink-3">{l.unit}</span></span>
				</li>
			{/if}
		{:else}
			<li class="px-4 py-3 text-ink-3">Keine Positionen.</li>
		{/each}
	</ul>
</section>

{#if data.canManage}
	<section class="card mt-4 p-4 lg:p-5">
		<h2 class="text-lg">Partie und Hinweis</h2>
		<form
			method="POST"
			action="?/update"
			class="mt-3 space-y-3"
			use:enhance={() => async ({ result, update }) => {
				if (result.type === 'success') toast.success('Gespeichert');
				await update({ reset: false });
			}}
		>
			<label class="block max-w-sm">
				<span class="field-label">Partie</span>
				<select class="select" name="partie" required value={order.partyId ? String(order.partyId) : ''}>
					<option value="">Bitte wählen</option>
					{#each data.parties as p (p.id)}<option value={String(p.id)}>{p.name}</option>{/each}
				</select>
			</label>
			<label class="block">
				<span class="field-label">Hinweis für die Partie</span>
				<textarea class="textarea" name="hinweis" rows="3" maxlength="2000" value={order.note}></textarea>
			</label>
			<button class="btn btn-secondary">Speichern</button>
		</form>
	</section>
{/if}

<div class="mt-4 flex flex-wrap gap-2">
	{#if data.canStatus && order.status === 'abgeschlossen'}
		<form method="POST" action="?/status" use:enhance={statusEnhance}>
			<button class="btn btn-ghost" name="status" value="in_arbeit" disabled={busy}><Undo size={18} aria-hidden="true" />Wieder in Arbeit</button>
		</form>
	{/if}
	{#if data.canManage && order.status !== 'erstellt'}
		<button type="button" class="btn btn-ghost" onclick={() => (resetOpen = true)}><Undo size={18} aria-hidden="true" />Zurück auf „Auftrag erstellt"</button>
	{/if}
	{#if data.canManage && order.status === 'erstellt'}
		<button type="button" class="btn btn-ghost ml-auto text-danger hover:bg-danger-soft" onclick={() => (deleteOpen = true)}>
			<Trash size={18} aria-hidden="true" />Auftrag löschen
		</button>
	{/if}
</div>

<Dialog bind:open={resetOpen} title="Zurück auf „Auftrag erstellt“?">
	<p class="text-ink-2">Der Auftrag gilt dann wieder als nicht begonnen. Die Partie setzt ihn erneut auf „in Arbeit".</p>
	<form method="POST" action="?/status" class="mt-5 flex justify-end gap-2" use:enhance={statusEnhance}>
		<button type="button" class="btn btn-ghost" onclick={() => (resetOpen = false)}>Abbrechen</button>
		<button class="btn btn-primary" name="status" value="erstellt">Zurücksetzen</button>
	</form>
</Dialog>

<Dialog bind:open={deleteOpen} title="Auftrag löschen?">
	<p class="text-ink-2">
		Der Auftrag {spacedNumber(order.number)} wird gelöscht. Das Angebot bleibt angenommen – daraus lässt sich wieder ein Auftrag erstellen, etwa für eine
		andere Partie.
	</p>
	<form method="POST" action="?/delete" class="mt-5 flex justify-end gap-2" use:enhance>
		<button type="button" class="btn btn-ghost" onclick={() => (deleteOpen = false)}>Abbrechen</button>
		<button class="btn btn-primary">Löschen</button>
	</form>
</Dialog>
