<script lang="ts">
	/** Neue Rechnung zum abgeschlossenen Auftrag – Zuordnung, Positionen, Kopf und Texte */
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Sigma from '@lucide/svelte/icons/sigma';
	import InvoiceEditor from '$lib/modules/auftraege/components/InvoiceEditor.svelte';
	import { spacedNumber } from '$lib/modules/auftraege/offer';
	import { reportDateLabel } from '$lib/modules/tagesberichte/sheet';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle(`Rechnung ${spacedNumber(data.order.number)}`)}</title></svelte:head>

<a href="/auftraege/{data.order.id}" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Auftrag {spacedNumber(data.order.number)}
</a>

<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="text-[2rem] leading-tight">Neue Rechnung {spacedNumber(data.order.number)}</h1>
		<p class="text-ink-2">
			{data.order.title || 'Ohne BV'} · {data.summary.counted}
			{data.summary.counted === 1 ? 'geprüfter Tagesbericht' : 'geprüfte Tagesberichte'}{data.summary.from
				? ` (${reportDateLabel(data.summary.from, data.summary.to)})`
				: ''}
		</p>
	</div>
	{#if data.summary.counted + data.summary.pending >= 2}
		<a href="/auftraege/{data.order.id}/summenblatt" class="btn btn-secondary"><Sigma size={18} aria-hidden="true" />Summenblatt</a>
	{/if}
</div>

{#if data.summary.pending}
	<p class="card mb-4 border-warn/50 p-3 text-sm">
		{data.summary.pending}
		{data.summary.pending === 1 ? 'Tagesbericht ist' : 'Tagesberichte sind'} noch nicht geprüft und {data.summary.pending === 1 ? 'zählt' : 'zählen'} deshalb nicht mit.
	</p>
{/if}
{#if !data.hasPrices}
	<p class="card mb-4 border-warn/50 p-3 text-sm">Zu diesem Auftrag gibt es kein Angebot mehr – die Einheitspreise bitte selbst eintragen.</p>
{/if}

<form
	method="POST"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			busy = false;
			await update({ reset: false });
		};
	}}
>
	<InvoiceEditor head={data.head} lines={data.lines} paymentDays={data.paymentDays} mapping={data.mapping} {busy} submitLabel="Rechnung erstellen" message={form?.message ?? ''} />
</form>
