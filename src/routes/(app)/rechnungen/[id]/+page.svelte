<script lang="ts">
	/** Eine Rechnung: Positionen und Summen, PDF und Druck, offen oder bezahlt */
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import Printer from '@lucide/svelte/icons/printer';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash';
	import HardHat from '@lucide/svelte/icons/hard-hat';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Dialog from '$lib/components/Dialog.svelte';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import { date as dateLabel, dateTime } from '$lib/format';
	import {
		addressLines,
		INVOICE_STATUS_LABELS,
		invoiceTotals,
		lineNumbers,
		lineTotal,
		money,
		priceLabel,
		quantityLabel,
		REVERSE_CHARGE_NOTE,
		spacedNumber
	} from '$lib/modules/auftraege/offer';
	import { reportDateLabel } from '$lib/modules/tagesberichte/sheet';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();
	const invoice = $derived(data.invoice);
	const st = $derived(INVOICE_STATUS_LABELS[invoice.status] ?? INVOICE_STATUS_LABELS.offen);
	const overdue = $derived(invoice.status === 'offen' && invoice.dueDate < data.today);
	const numbers = $derived(lineNumbers(invoice.lines));
	const totals = $derived(invoiceTotals(invoice.lines, invoice.vatRate, invoice.reverseCharge));
	const name = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(' ');

	let deleteOpen = $state(false);
	let paidOn = $state('');
	let busy = $state(false);
	$effect(() => {
		paidOn = data.today;
	});
</script>

<svelte:head><title>{pageTitle(`Rechnung ${spacedNumber(invoice.number)}`)}</title></svelte:head>

<a href="/rechnungen" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Rechnungen
</a>

<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="text-[2rem] leading-tight">Rechnung {spacedNumber(invoice.number)}</h1>
		<p class="text-ink-2">{invoice.title || 'Ohne BV'}</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		{#if overdue}<span class="badge badge-danger">Überfällig</span>{:else}<span class="badge {st.tone}">{st.label}</span>{/if}
		<PdfButton href="/rechnungen/{invoice.id}/pdf"><FileText size={18} aria-hidden="true" />PDF</PdfButton>
		<a href="/rechnungen/{invoice.id}/druck" class="btn btn-secondary"><Printer size={18} aria-hidden="true" />Drucken</a>
		{#if data.canEdit}<a href="/rechnungen/{invoice.id}/bearbeiten" class="btn btn-secondary"><Pencil size={18} aria-hidden="true" />Bearbeiten</a>{/if}
	</div>
</div>

{#if form && 'message' in form && form.message}<p class="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">{form.message}</p>{/if}

<!-- Zahlung: offen → bezahlt und zurück -->
<section class="card mb-4 flex flex-wrap items-center gap-3 p-4 lg:p-5 {invoice.status === 'bezahlt' ? '' : overdue ? 'border-danger/50' : 'border-warn/50'}">
	{#if invoice.status === 'bezahlt'}
		<CircleCheck size={22} class="text-ok" aria-hidden="true" />
		<p class="min-w-0 flex-1">
			Bezahlt am <span class="font-medium">{invoice.paidOn ? dateLabel(invoice.paidOn) : '–'}</span>{name(invoice.paidByFirst, invoice.paidByLast)
				? ` · eingetragen von ${name(invoice.paidByFirst, invoice.paidByLast)}`
				: ''}
		</p>
		{#if data.canPay}
			<form method="POST" action="?/open" use:enhance={() => async ({ update }) => (toast.success('Wieder offen'), await update())}>
				<button class="btn btn-ghost btn-sm"><Undo size={16} aria-hidden="true" />Wieder offen</button>
			</form>
		{/if}
	{:else}
		<p class="min-w-[12rem] flex-1">
			{overdue ? 'Überfällig seit' : 'Zahlbar bis'} <span class="font-medium">{dateLabel(invoice.dueDate)}</span> · {money(totals.gross)}
		</p>
		{#if data.canPay}
			<form
				method="POST"
				action="?/paid"
				class="flex flex-wrap items-center gap-2"
				use:enhance={() => {
					busy = true;
					return async ({ result, update }) => {
						busy = false;
						if (result.type === 'success') toast.success('Als bezahlt markiert');
						await update();
					};
				}}
			>
				<label class="flex items-center gap-2 text-sm">
					Bezahlt am
					<input class="input num w-auto" type="date" name="am" required max={data.today} bind:value={paidOn} />
				</label>
				<button class="btn btn-primary" disabled={busy}><CircleCheck size={18} aria-hidden="true" />Bezahlt</button>
			</form>
		{/if}
	{/if}
</section>

<div class="grid gap-4 lg:grid-cols-2">
	<section class="card p-4 lg:p-5">
		<h2 class="text-lg">Kunde</h2>
		<p class="mt-2 leading-relaxed">
			{#each addressLines( { name: invoice.customerName, addition: invoice.customerAddition, street: invoice.customerStreet, zip: invoice.customerZip, city: invoice.customerCity } ) as l, i (i)}
				<span class="block {i === 0 ? 'font-medium' : ''}">{l}</span>
			{/each}
		</p>
		{#if invoice.customerUid}<p class="mt-2 text-sm text-ink-2">UID {invoice.customerUid}</p>{/if}
	</section>
	<section class="card p-4 lg:p-5">
		<h2 class="text-lg">Rechnung</h2>
		<dl class="mt-2 grid grid-cols-[9rem_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="text-ink-3">Rechnungsdatum</dt>
			<dd>{dateLabel(invoice.date)}</dd>
			<dt class="text-ink-3">Zahlbar bis</dt>
			<dd>{dateLabel(invoice.dueDate)}</dd>
			{#if invoice.serviceFrom}
				<dt class="text-ink-3">Leistungszeitraum</dt>
				<dd>{reportDateLabel(invoice.serviceFrom, invoice.serviceTo)}</dd>
			{/if}
			{#if invoice.location}
				<dt class="text-ink-3">Ausführungsort</dt>
				<dd>{invoice.location}</dd>
			{/if}
			{#if invoice.projectNumber}
				<dt class="text-ink-3">Projektnummer</dt>
				<dd class="num">{invoice.projectNumber}</dd>
			{/if}
			<dt class="text-ink-3">Erstellt</dt>
			<dd>{dateTime(invoice.createdAt)}{name(invoice.creatorFirst, invoice.creatorLast) ? ` · ${name(invoice.creatorFirst, invoice.creatorLast)}` : ''}</dd>
		</dl>
		{#if data.canSeeOrder}
			<a href="/auftraege/{invoice.orderId}" class="btn btn-ghost btn-sm mt-3"><HardHat size={16} aria-hidden="true" />Zum Auftrag</a>
		{/if}
	</section>
</div>

<section class="card mt-4 overflow-hidden">
	<h2 class="px-4 pt-4 text-lg lg:px-5">Positionen</h2>
	{#if invoice.intro}<p class="px-4 pt-1 text-sm whitespace-pre-line text-ink-2 lg:px-5">{invoice.intro}</p>{/if}
	<ul class="mt-2 divide-y divide-line">
		{#each invoice.lines as l, i (l.id)}
			{#if l.kind === 'titel'}
				<li class="bg-surface-2 px-4 py-2 font-semibold lg:px-5"><span class="num mr-2">{l.number || numbers[i]}</span>{l.text}</li>
			{:else}
				<li class="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-x-3 px-4 py-3 lg:px-5">
					<span class="num text-sm text-ink-3">{l.number || numbers[i]}</span>
					<span class="min-w-0 font-medium whitespace-pre-line">{l.text}</span>
					<span class="num text-right font-medium">{money(lineTotal(l))}</span>
					<span class="num col-start-2 text-sm text-ink-2">{quantityLabel(l.quantity)} {l.unit} × {priceLabel(l.unitPrice)}</span>
				</li>
			{/if}
		{/each}
	</ul>
	<dl class="num mx-4 mt-2 mb-4 ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 border-t border-line pt-3 lg:mx-5 lg:ml-auto">
		<dt>Gesamt Netto</dt>
		<dd class="text-right">{money(totals.net)}</dd>
		{#if !invoice.reverseCharge}
			<dt>{String(invoice.vatRate).replace('.', ',')} % Umsatzsteuer</dt>
			<dd class="text-right">{money(totals.vat)}</dd>
		{/if}
		<dt class="border-t border-ink pt-1.5 text-lg font-semibold">Gesamtbetrag</dt>
		<dd class="border-t border-ink pt-1.5 text-right text-lg font-semibold">{money(totals.gross)}</dd>
	</dl>
	{#if invoice.reverseCharge}<p class="px-4 pb-4 text-sm text-ink-2 lg:px-5">{REVERSE_CHARGE_NOTE} UID des Kunden: {invoice.customerUid}</p>{/if}
	{#if invoice.closing}<p class="border-t border-line px-4 py-3 text-sm whitespace-pre-line text-ink-2 lg:px-5">{invoice.closing}</p>{/if}
</section>

{#if data.canDelete}
	<div class="mt-4 flex">
		<button type="button" class="btn btn-ghost ml-auto text-danger hover:bg-danger-soft" onclick={() => (deleteOpen = true)}>
			<Trash size={18} aria-hidden="true" />Rechnung löschen
		</button>
	</div>
	<Dialog bind:open={deleteOpen} title="Rechnung löschen?">
		<p class="text-ink-2">Die Rechnung {spacedNumber(invoice.number)} wird gelöscht. Zum Auftrag lässt sich danach eine neue erstellen – mit derselben Nummer.</p>
		<form method="POST" action="?/delete" class="mt-5 flex justify-end gap-2" use:enhance>
			<button type="button" class="btn btn-ghost" onclick={() => (deleteOpen = false)}>Abbrechen</button>
			<button class="btn btn-primary"><Trash size={18} aria-hidden="true" />Löschen</button>
		</form>
	</Dialog>
{/if}
