<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import Printer from '@lucide/svelte/icons/printer';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import { dateTime } from '$lib/format';
	import { inNativeApp, nativePlugin, printPage } from '$lib/native';
	import { isIOS } from '$lib/pdf-download';

	interface Props {
		title: string;
		/** Kurze Angaben zum Ausdruck: Filter, Zeitraum, Anzahl */
		facts?: string[];
		/** Hinweis, wenn nicht alle Zeilen gedruckt werden */
		notice?: string | null;
		/** Zurück zur Liste */
		back: string;
		/** Dasselbe als PDF – am Handy der sichere Weg zum Speichern und Drucken */
		pdf?: string;
		/** Ohne Standardkopf – für Formulare mit eigenem Briefkopf (z. B. Lohnzettel) */
		bare?: boolean;
		children: Snippet;
	}
	let { title, facts = [], notice = null, back, pdf, bare = false, children }: Props = $props();

	const printed = new Date();

	/** Hinweis je nach Gerät – erst im Browser bekannt */
	let hint = $state('Öffnet sich das Druckfenster nicht von selbst, hier klicken.');
	/** Ältere App ohne Druck-Plugin: Drucken geht dort gar nicht */
	let canPrint = $state(true);

	onMount(() => {
		if (inNativeApp() && !nativePlugin()) {
			canPrint = false;
			hint = pdf ? 'Diese App-Version kann noch nicht drucken – bitte die App aktualisieren oder das PDF nehmen.' : 'Diese App-Version kann noch nicht drucken – bitte die App aktualisieren.';
		} else if (isIOS() && pdf) {
			hint = 'Am iPhone/iPad: Kommt kein Druckfenster, „PDF“ tippen und im Teilen-Menü „Drucken“ wählen.';
		}

		// Mit ?nodruck=1 lässt sich die Ansicht ohne Druckfenster anschauen
		if (page.url.searchParams.has('nodruck') || !canPrint) return;
		// Erst drucken, wenn die Schriften geladen sind – sonst stimmen die Umbrüche nicht
		let done = false;
		const go = () => {
			if (done) return;
			done = true;
			printPage();
		};
		const timer = setTimeout(go, 800);
		document.fonts?.ready.then(() => setTimeout(go, 120));
		return () => clearTimeout(timer);
	});
</script>

<div class="mb-4 flex flex-wrap items-center gap-2 print:hidden">
	<a href={back} class="btn btn-secondary btn-sm"><ArrowLeft size={16} aria-hidden="true" />Zurück</a>
	{#if canPrint}
		<button class="btn btn-primary btn-sm" onclick={printPage}><Printer size={16} aria-hidden="true" />Drucken</button>
	{/if}
	{#if pdf}
		<PdfButton href={pdf} class="btn btn-secondary btn-sm"><FileText size={16} aria-hidden="true" />PDF</PdfButton>
	{/if}
	<p class="basis-full text-sm text-ink-3 sm:basis-auto">{hint}</p>
</div>

<div class="print-sheet card p-5 lg:p-6">
	{#if !bare}
		<header class="print-head flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
			<div>
				<p class="text-sm font-semibold tracking-wide uppercase">Monsipan Bautenschutz</p>
				<h1 class="font-display text-2xl leading-tight font-semibold">{title}</h1>
				{#if facts.length}<p class="mt-1 text-sm text-ink-2">{facts.join(' · ')}</p>{/if}
			</div>
			<p class="text-sm text-ink-3">Ausdruck vom {dateTime(printed)}</p>
		</header>
	{/if}

	{#if notice}<p class="mt-3 text-sm font-medium">{notice}</p>{/if}

	{@render children()}
</div>
