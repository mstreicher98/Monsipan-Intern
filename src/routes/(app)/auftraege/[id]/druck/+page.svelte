<script lang="ts">
	/** Druckansicht: die Seiten des Auftrags-PDFs */
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import PdfPages from '$lib/components/PdfPages.svelte';
	import { spacedNumber } from '$lib/modules/auftraege/offer';

	let { data } = $props();
	let ready = $state(false);
	const title = $derived(`Auftrag ${spacedNumber(data.number)}`);
</script>

<svelte:head><title>{pageTitle(title)}</title></svelte:head>

<PrintSheet {title} back="/auftraege/{data.id}" pdf="/auftraege/{data.id}/pdf" bare {ready}>
	<PdfPages url="/auftraege/{data.id}/pdf" {title} onready={() => (ready = true)} />
</PrintSheet>
