<script lang="ts">
	/** Druckansicht im Aufbau des Tagesbericht-Vordrucks aus dem Block */
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import PdfPages from '$lib/components/PdfPages.svelte';
	import ReportSheet from '$lib/modules/tagesberichte/components/ReportSheet.svelte';
	import ReportSummary from '$lib/modules/tagesberichte/components/ReportSummary.svelte';
	import { hasInk } from '$lib/ink';

	let { data } = $props();
	const report = $derived(data.report);
	/** Mit Handschrift kommt das Formular aus dem PDF – nur dort liegt sie genau an ihrer Stelle */
	const inked = $derived(hasInk(report.ink));
	let pagesReady = $state(false);
</script>

<svelte:head><title>{pageTitle(`Tagesbericht ${report.number || ''}`.trim())}</title></svelte:head>

<PrintSheet title="Tagesbericht {report.number}" back="/tagesberichte/{report.id}" pdf="/tagesberichte/{report.id}/pdf" bare ready={!inked || pagesReady}>
	{#if inked}
		<PdfPages url="/tagesberichte/{report.id}/pdf" title="Tagesbericht {report.number}" onready={() => (pagesReady = true)} />
	{:else}
		<div class="vordruck"><ReportSheet {report} /></div>

		<!--
			Am Handy wäre der Vordruck unlesbar klein. Dort stehen dieselben Angaben
			untereinander; gedruckt wird immer der Vordruck.
		-->
		<div class="handy space-y-4">
			<p class="text-[0.8125rem] text-ink-3">Am Handy vereinfacht dargestellt – gedruckt und im PDF steht der Bericht im Aufbau des Vordrucks.</p>
			<h2 class="text-xl">Tagesbericht {report.number}</h2>
			<ReportSummary {report} />
		</div>
	{/if}
</PrintSheet>

<style>
	/* Am Handy die lesbare Fassung statt des Vordrucks – beim Drucken nie */
	.handy {
		display: none;
	}
	@media screen and (max-width: 700px) {
		.vordruck {
			display: none;
		}
		.handy {
			display: block;
		}
	}
</style>
