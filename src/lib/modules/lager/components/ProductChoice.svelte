<script lang="ts">
	/**
	 * Auswahl, wenn ein gescannter Code zu mehreren Artikeln gehört –
	 * manche Lieferanten drucken dieselbe Nummer auf verschiedene Produkte.
	 */
	import ProductAvatar from './ProductAvatar.svelte';
	import StockStatus from './StockStatus.svelte';
	import { int, packageLabel } from '$lib/format';
	import type { ProductSummary } from '$lib/modules/lager/types';

	interface Props {
		products: ProductSummary[];
		onselect: (p: ProductSummary) => void;
		/** Der Code, der zu allen diesen Artikeln gehört */
		code?: string | null;
		batch?: string | null;
	}
	let { products, onselect, code = null, batch = null }: Props = $props();
</script>

<p class="text-sm text-ink-2">
	{#if code}Die Nummer <span class="num font-medium text-ink">{code}</span> gehört zu mehreren Artikeln.{:else}Der Code gehört zu mehreren Artikeln.{/if}
	Bitte den passenden auswählen.
	{#if batch}<span class="block">Auf dem Etikett steht Charge <span class="num">{batch}</span>.</span>{/if}
</p>

<ul class="mt-3 space-y-2">
	{#each products as p (p.id)}
		<li>
			<button type="button" class="choice" onclick={() => onselect(p)}>
				<ProductAvatar colorHex={p.colorHex} category={p.categoryName} />
				<span class="min-w-0 flex-1">
					<span class="block truncate font-semibold">{p.name}</span>
					<span class="block truncate text-sm text-ink-3">
						{[p.articleNumber && `Art.-Nr. ${p.articleNumber}`, p.manufacturer, packageLabel(p.packageSize, p.unit)].filter(Boolean).join(', ')}
					</span>
					<StockStatus total={p.total} minStock={p.minStock} active={p.active} />
				</span>
				<span class="shrink-0 text-right">
					<span class="num font-display block text-2xl leading-none font-semibold">{int(p.total)}</span>
					<span class="block text-[0.8125rem] text-ink-3">Stück</span>
				</span>
			</button>
		</li>
	{/each}
</ul>

<style>
	.choice {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.75rem;
		border-radius: 1rem;
		border: 1px solid var(--c-line);
		background: var(--c-surface-2);
		padding: 0.75rem;
		text-align: left;
		transition:
			border-color 140ms var(--ease-out),
			background-color 140ms var(--ease-out);
	}
	.choice:hover {
		border-color: var(--c-ink-3);
		background: var(--c-surface-3);
	}
	.choice:focus-visible {
		outline: 2px solid var(--c-focus);
		outline-offset: 2px;
	}
</style>
