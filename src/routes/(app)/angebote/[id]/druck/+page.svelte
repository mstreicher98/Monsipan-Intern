<script lang="ts">
	/** Druckansicht: die Seiten des Angebots-PDFs – so sieht der Ausdruck genau aus wie das PDF */
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import PdfPages from '$lib/components/PdfPages.svelte';
	import { spacedNumber } from '$lib/modules/auftraege/offer';

	let { data } = $props();
	let ready = $state(false);
	const title = $derived(`Angebot ${spacedNumber(data.number)}`);
</script>

<svelte:head><title>{pageTitle(title)}</title></svelte:head>

<PrintSheet {title} back="/angebote/{data.id}" pdf="/angebote/{data.id}/pdf" bare {ready}>
	<PdfPages url="/angebote/{data.id}/pdf" {title} onready={() => (ready = true)} />
</PrintSheet>
