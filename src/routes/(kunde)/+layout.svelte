<script lang="ts">
	/** Seiten für Kunden: ohne Navigation der App, mit dem Briefkopf der Firma */
	import Logo from '$lib/components/Logo.svelte';
	import Toaster from '$lib/components/Toaster.svelte';
	import { LETTERHEAD } from '$lib/modules/tagesberichte/sheet';

	let { children } = $props();
</script>

<div class="flex min-h-dvh flex-col bg-bg">
	<header class="border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
		<div class="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
			<Logo compact />
			<span class="leading-tight">
				<span class="block font-display text-[1.0625rem] font-semibold tracking-[0.2em]">{LETTERHEAD.brand}</span>
				<span class="block text-[0.8125rem] text-ink-3">{LETTERHEAD.lines[0]}</span>
			</span>
		</div>
	</header>

	<main class="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
		{@render children()}
	</main>

	<footer class="mx-auto w-full max-w-3xl px-4 pt-2 pb-[max(2rem,env(safe-area-inset-bottom))] text-[0.8125rem] text-ink-3 sm:px-6">
		{LETTERHEAD.brand} {LETTERHEAD.lines.join(' · ')}
	</footer>
</div>

<Toaster />
