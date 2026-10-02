<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import Printer from '@lucide/svelte/icons/printer';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { dateTime } from '$lib/format';

	interface Props {
		title: string;
		/** Kurze Angaben zum Ausdruck: Filter, Zeitraum, Anzahl */
		facts?: string[];
		/** Hinweis, wenn nicht alle Zeilen gedruckt werden */
		notice?: string | null;
		/** Zurück zur Liste */
		back: string;
		/** Ohne Standardkopf – für Formulare mit eigenem Briefkopf (z. B. Lohnzettel) */
		bare?: boolean;
		children: Snippet;
	}
	let { title, facts = [], notice = null, back, bare = false, children }: Props = $props();

	const printed = new Date();

	onMount(() => {
		// Mit ?nodruck=1 lässt sich die Ansicht ohne Druckfenster anschauen
		if (page.url.searchParams.has('nodruck')) return;
		// Erst drucken, wenn die Schriften geladen sind – sonst stimmen die Umbrüche nicht
		let done = false;
		const go = () => {
			if (done) return;
			done = true;
			window.print();
		};
		const timer = setTimeout(go, 800);
		document.fonts?.ready.then(() => setTimeout(go, 120));
		return () => clearTimeout(timer);
	});
</script>

<div class="mb-4 flex flex-wrap items-center gap-2 print:hidden">
	<a href={back} class="btn btn-secondary btn-sm"><ArrowLeft size={16} aria-hidden="true" />Zurück zur Liste</a>
	<button class="btn btn-primary btn-sm" onclick={() => window.print()}><Printer size={16} aria-hidden="true" />Drucken</button>
	<p class="text-sm text-ink-3">Öffnet sich das Druckfenster nicht von selbst, hier klicken.</p>
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
