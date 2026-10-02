<script lang="ts">
	/**
	 * PDF-Knopf. Am Computer ein gewöhnlicher Download-Link; in der Android-App
	 * und am iPhone/iPad holt er das PDF selbst und speichert oder teilt es
	 * (siehe pdf-download.ts).
	 */
	import type { Snippet } from 'svelte';
	import FileText from '@lucide/svelte/icons/file-text';
	import Share from '@lucide/svelte/icons/share';
	import Dialog from '$lib/components/Dialog.svelte';
	import { deliverPdf, fetchPdf, needsPdfHelp, type PdfOutcome } from '$lib/pdf-download';
	import { toast } from '$lib/stores/toast.svelte';

	interface Props {
		href: string;
		class?: string;
		children: Snippet;
	}
	let { href, class: cls = 'btn btn-secondary', children }: Props = $props();

	let busy = $state(false);
	/** Fertiges PDF, das noch einen Fingertipp zum Teilen braucht */
	let ready = $state<File | null>(null);

	function report(outcome: PdfOutcome) {
		if (outcome === 'saved') toast.success('PDF gespeichert', 'Liegt im Ordner „Downloads“.');
		if (outcome === 'downloaded') toast.success('PDF heruntergeladen');
	}

	async function onclick(e: MouseEvent) {
		if (!needsPdfHelp()) return;
		e.preventDefault();
		if (busy) return;
		busy = true;
		try {
			const file = await fetchPdf(href);
			const outcome = await deliverPdf(file);
			if (outcome === 'needs-tap') ready = file;
			else report(outcome);
		} catch (err) {
			toast.error('PDF ging nicht', err instanceof Error ? err.message : undefined);
		} finally {
			busy = false;
		}
	}

	async function shareReady() {
		const file = ready;
		ready = null;
		if (!file) return;
		try {
			report(await deliverPdf(file));
		} catch (err) {
			toast.error('PDF ging nicht', err instanceof Error ? err.message : undefined);
		}
	}
</script>

<a {href} class={cls} download {onclick} aria-busy={busy}>
	{#if busy}<span class="inline-flex items-center gap-2"><FileText size={18} aria-hidden="true" />Wird erstellt …</span>{:else}{@render children()}{/if}
</a>

<Dialog open={!!ready} title="PDF ist fertig" onclose={() => (ready = null)}>
	<p class="text-ink-2">Über „Teilen“ lässt es sich in Dateien sichern, drucken oder verschicken.</p>
	<div class="mt-5 flex justify-end gap-2">
		<button type="button" class="btn btn-ghost" onclick={() => (ready = null)}>Abbrechen</button>
		<button type="button" class="btn btn-primary" onclick={shareReady}><Share size={18} aria-hidden="true" />Teilen</button>
	</div>
</Dialog>
