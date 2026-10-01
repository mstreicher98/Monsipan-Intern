<script lang="ts">
	import { fly } from 'svelte/transition';
	import Search from '@lucide/svelte/icons/search';
	import ProductAvatar from './ProductAvatar.svelte';
	import { int, packageLabel } from '$lib/format';
	import type { ProductSummary } from '$lib/modules/lager/types';

	interface Props {
		placeholder?: string;
		onselect: (p: ProductSummary) => void;
		autofocus?: boolean;
		/** Handscanner-Eingaben in dieses Feld gehen an den Scan-Empfänger */
		scanTarget?: boolean;
		shortcut?: boolean;
		id?: string;
		label?: string;
		size?: 'md' | 'lg';
	}
	let {
		placeholder = 'Artikel, Nummer oder EAN suchen',
		onselect,
		autofocus = false,
		scanTarget = true,
		shortcut = false,
		id = 'product-search',
		label = 'Artikel suchen',
		size = 'md'
	}: Props = $props();

	let query = $state('');
	let items = $state<ProductSummary[]>([]);
	let open = $state(false);
	let active = $state(0);
	let loading = $state(false);
	let input: HTMLInputElement;
	let timer: ReturnType<typeof setTimeout>;
	let seq = 0;

	function search(q: string) {
		clearTimeout(timer);
		if (!q.trim()) {
			items = [];
			open = false;
			return;
		}
		timer = setTimeout(async () => {
			const my = ++seq;
			loading = true;
			try {
				const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}&limit=8`);
				const data = await res.json();
				if (my !== seq) return;
				items = data.items ?? [];
				active = 0;
				open = true;
			} finally {
				if (my === seq) loading = false;
			}
		}, 160);
	}

	function choose(p: ProductSummary) {
		onselect(p);
		query = '';
		items = [];
		open = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = items.length > 0;
			active = Math.min(active + 1, items.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			if (open && items[active]) {
				e.preventDefault();
				choose(items[active]);
			}
		} else if (e.key === 'Escape') {
			open = false;
		}
	}

	$effect(() => {
		if (autofocus) input?.focus();
	});

	$effect(() => {
		if (!shortcut) return;
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				input?.focus();
				input?.select();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<div class="relative w-full">
	<label for={id} class="sr-only">{label}</label>
	<Search size={18} class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-3" aria-hidden="true" />
	<input
		bind:this={input}
		{id}
		type="search"
		class="input pl-10 {size === 'lg' ? 'min-h-12 text-[1.0625rem]' : ''} {shortcut ? 'pr-16' : ''}"
		{placeholder}
		autocomplete="off"
		spellcheck="false"
		role="combobox"
		aria-expanded={open}
		aria-controls="{id}-list"
		aria-autocomplete="list"
		aria-activedescendant={open && items[active] ? `${id}-opt-${items[active].id}` : undefined}
		data-scan-target={scanTarget ? '' : undefined}
		bind:value={query}
		oninput={() => search(query)}
		onfocus={() => (open = items.length > 0)}
		onblur={() => setTimeout(() => (open = false), 150)}
		{onkeydown}
	/>
	{#if shortcut}
		<kbd
			class="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3 lg:block"
			>Strg K</kbd
		>
	{/if}

	{#if open}
		<ul
			id="{id}-list"
			role="listbox"
			class="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[60vh] overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-2)]"
			transition:fly={{ y: -4, duration: 160 }}
		>
			{#each items as p, i (p.id)}
				<li
					id="{id}-opt-{p.id}"
					role="option"
					aria-selected={i === active}
					class="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 {i === active ? 'bg-surface-3' : ''}"
					onmousedown={(e) => {
						e.preventDefault();
						choose(p);
					}}
					onmouseenter={() => (active = i)}
				>
					<ProductAvatar colorHex={p.colorHex} category={p.categoryName} size="sm" />
					<span class="min-w-0 flex-1">
						<span class="block truncate font-medium">{p.name}</span>
						<span class="block truncate text-sm text-ink-3">
							{[p.articleNumber, packageLabel(p.packageSize, p.unit)].filter(Boolean).join(', ')}
						</span>
					</span>
					<span class="num text-right font-display text-lg font-semibold {p.total <= 0 ? 'text-ink-3' : ''}">{int(p.total)}</span>
				</li>
			{:else}
				<li class="px-3 py-4 text-center text-sm text-ink-3">{loading ? 'Suche …' : `Nichts gefunden für „${query}“`}</li>
			{/each}
		</ul>
	{/if}
</div>
