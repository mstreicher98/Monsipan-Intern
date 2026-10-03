<script lang="ts">
	import { goto } from '$app/navigation';
	import Bell from '@lucide/svelte/icons/bell';
	import Search from '@lucide/svelte/icons/search';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import Logo from './Logo.svelte';
	import ProductSearch from '$lib/modules/lager/components/ProductSearch.svelte';
	import Dialog from './Dialog.svelte';
	import type { ProductSummary } from '$lib/modules/lager/types';

	interface Props {
		showAlerts: boolean;
		lowStockCount: number;
		onscan: () => void;
	}
	let { showAlerts, lowStockCount, onscan }: Props = $props();
	let searchOpen = $state(false);

	function openProduct(p: ProductSummary) {
		searchOpen = false;
		goto(`/lager/artikel/${p.id}`);
	}
</script>

<!-- Abstand oben um safe-area-inset-top: in der App liegt die Seite unter der Statusleiste -->
<header class="no-print sticky top-0 z-20 border-b border-line bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-lg lg:border-b-0">
	<div class="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
		<a href="/" class="rounded-lg lg:hidden" aria-label="Zur Übersicht"><Logo /></a>

		<div class="hidden w-full max-w-md lg:block">
			<ProductSearch onselect={openProduct} shortcut id="global-search" />
		</div>

		<div class="ml-auto flex items-center gap-1.5">
			<button class="btn btn-ghost btn-icon lg:hidden" aria-label="Artikel suchen" onclick={() => (searchOpen = true)}>
				<Search size={21} />
			</button>
			<button class="btn btn-secondary hidden lg:inline-flex" onclick={onscan}>
				<ScanBarcode size={18} aria-hidden="true" /> Mit Kamera scannen
			</button>
			{#if showAlerts}
				<a
					href="/lager/bestellliste"
					class="btn btn-ghost btn-icon relative"
					aria-label={lowStockCount > 0 ? `${lowStockCount} Artikel unter Mindestbestand` : 'Keine Warnungen'}
				>
					<Bell size={21} aria-hidden="true" />
					{#if lowStockCount > 0}
						{#key lowStockCount}
							<span
								class="num absolute top-1.5 right-1.5 grid h-[1.125rem] min-w-[1.125rem] animate-pop place-items-center rounded-full bg-warn px-1 text-[0.6875rem] font-semibold text-white ring-2 ring-bg"
							>
								{lowStockCount > 99 ? '99+' : lowStockCount}
							</span>
						{/key}
					{/if}
				</a>
			{/if}
		</div>
	</div>
</header>

<Dialog bind:open={searchOpen} title="Artikel suchen">
	<div class="pb-24">
		<ProductSearch onselect={openProduct} autofocus id="mobile-search" size="lg" />
		<p class="field-hint">Name, Artikelnummer, EAN, Materialart oder Farbe</p>
	</div>
</Dialog>
