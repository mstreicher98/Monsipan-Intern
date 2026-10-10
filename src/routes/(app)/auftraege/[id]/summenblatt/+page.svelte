<script lang="ts">
	/**
	 * Summenblatt: alle Tagesberichte des Auftrags in einer Tabelle – je Bericht
	 * eine Zeile, je LB-Position und Einheit eine Spalte, unten die Summe. Es
	 * zählen nur geprüfte und vom Kunden unterschriebene Berichte. PDF und Druck
	 * sehen aus wie der Vordruck „Tagesbericht-Summenblatt".
	 */
	import { pageTitle } from '$lib/app';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import Printer from '@lucide/svelte/icons/printer';
	import Sigma from '@lucide/svelte/icons/sigma';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import { quantityLabel, spacedNumber } from '$lib/modules/auftraege/offer';
	import { columnLabel } from '$lib/modules/auftraege/summary';
	import { reportDateLabel } from '$lib/modules/tagesberichte/sheet';

	let { data } = $props();
	const order = $derived(data.order);
	const summary = $derived(data.summary);
	const counted = $derived(summary.reports.filter((r) => r.counted));
	const pending = $derived(summary.reports.filter((r) => !r.counted));

	const STATUS: Record<string, string> = {
		entwurf: 'In Arbeit',
		freigegeben: 'Freigegeben – noch nicht geprüft',
		geprueft: 'Geprüft',
		abgeschlossen: 'Vom Kunden unterschrieben'
	};
</script>

<svelte:head><title>{pageTitle(`Summenblatt ${spacedNumber(order.number)}`)}</title></svelte:head>

<a href="/auftraege/{order.id}" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Auftrag {spacedNumber(order.number)}
</a>

<div class="mt-3 mb-5 flex flex-wrap items-end justify-between gap-3">
	<div class="min-w-0">
		<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><Sigma size={26} aria-hidden="true" />Summenblatt</h1>
		<p class="text-ink-2">
			{[order.title || 'Ohne BV', order.location, summary.from ? reportDateLabel(summary.from, summary.to) : null].filter(Boolean).join(' · ')}
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<PdfButton href="/auftraege/{order.id}/summenblatt/pdf"><FileText size={18} aria-hidden="true" />PDF</PdfButton>
		<a href="/auftraege/{order.id}/summenblatt/druck" class="btn btn-secondary"><Printer size={18} aria-hidden="true" />Drucken</a>
	</div>
</div>

{#if !counted.length}
	<div class="card p-8 text-center">
		<p class="font-medium">Noch kein geprüfter Tagesbericht</p>
		<p class="mt-1 text-sm text-ink-3">In die Summe kommen Berichte, sobald sie geprüft oder vom Kunden unterschrieben sind.</p>
	</div>
{:else}
	<section class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full border-collapse text-sm">
				<thead>
					<tr class="border-b border-line bg-surface-2 align-bottom">
						<th scope="col" class="sticky left-0 z-10 bg-surface-2 px-4 py-2.5 text-left font-semibold">Bericht</th>
						<th scope="col" class="px-3 py-2.5 text-left font-semibold">Datum</th>
						<th scope="col" class="px-3 py-2.5 text-left font-semibold">Baustelle</th>
						{#if data.seesInvoices}<th scope="col" class="px-3 py-2.5 text-left font-semibold">Rechnung</th>{/if}
						{#each summary.columns as c (c.key)}
							<th scope="col" class="max-w-[11rem] min-w-[5rem] px-3 py-2.5 text-right">
								<span class="num block font-semibold">{columnLabel(c)}</span>
								<span class="block text-[0.75rem] font-normal text-ink-3">{c.unit || '–'}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each counted as r (r.id)}
						<tr class="border-b border-line">
							<th scope="row" class="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium">
								<a href="/tagesberichte/{r.id}" class="num underline-offset-2 hover:underline">{r.number || '–'}</a>
							</th>
							<td class="px-3 py-2 whitespace-nowrap">{reportDateLabel(r.date, r.dateTo)}</td>
							<td class="max-w-[16rem] truncate px-3 py-2 text-ink-2">{[r.site, r.partyName].filter(Boolean).join(' · ')}</td>
							{#if data.seesInvoices}
								<td class="num px-3 py-2 whitespace-nowrap">
									{#if r.invoiceId}<a href="/rechnungen/{r.invoiceId}" class="underline-offset-2 hover:underline">{spacedNumber(r.invoiceNumber ?? '')}</a>{:else}<span class="text-ink-3">offen</span>{/if}
								</td>
							{/if}
							{#each summary.columns as c (c.key)}
								<td class="num px-3 py-2 text-right">{r.values[c.key] ? quantityLabel(r.values[c.key]) : ''}</td>
							{/each}
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t-2 border-ink bg-surface-2 font-semibold">
						<th scope="row" colspan={data.seesInvoices ? 4 : 3} class="sticky left-0 z-10 bg-surface-2 px-4 py-2.5 text-left">
							Summe aus {counted.length} {counted.length === 1 ? 'Bericht' : 'Berichten'}
						</th>
						{#each summary.columns as c (c.key)}
							<td class="num px-3 py-2.5 text-right whitespace-nowrap">{quantityLabel(c.total)}</td>
						{/each}
					</tr>
				</tfoot>
			</table>
		</div>
	</section>
{/if}

{#if pending.length}
	<section class="card mt-4 border-warn/50 p-4 lg:p-5">
		<h2 class="text-lg">Nicht in der Summe</h2>
		<p class="mt-1 text-sm text-ink-2">Diese Berichte zählen, sobald sie geprüft sind.</p>
		<ul class="mt-3 divide-y divide-line rounded-xl border border-line">
			{#each pending as r (r.id)}
				<li>
					<a href="/tagesberichte/{r.id}" class="flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
						<span class="num w-14 shrink-0 font-semibold">{r.number || '–'}</span>
						<span class="min-w-0 flex-1 truncate">{reportDateLabel(r.date, r.dateTo)}{r.site ? ` · ${r.site}` : ''}</span>
						<span class="badge">{STATUS[r.status] ?? r.status}</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if summary.materials.length}
	<section class="card mt-4 p-4 lg:p-5">
		<h2 class="text-lg">Material</h2>
		<ul class="mt-2 flex flex-wrap gap-2">
			{#each summary.materials as m, i (i)}
				<li class="badge h-auto py-1">{[m.material, m.code, m.filmThickness && `Filmdicke ${m.filmThickness}`].filter(Boolean).join(' · ')}</li>
			{/each}
		</ul>
	</section>
{/if}
