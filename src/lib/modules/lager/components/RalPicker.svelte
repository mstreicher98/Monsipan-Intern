<script lang="ts">
	import { fly } from 'svelte/transition';
	import X from '@lucide/svelte/icons/x';
	import { findRal, searchRal, type RalColor } from '$lib/ral';

	interface Props {
		id: string;
		/** Gewählte RAL-Nummer, z. B. "6024" */
		value: string | null;
		onpick: (color: RalColor | null) => void;
	}
	let { id, value, onpick }: Props = $props();

	const selected = $derived(findRal(value));
	let query = $state('');
	let open = $state(false);
	let active = $state(0);
	let input: HTMLInputElement;

	const results = $derived(searchRal(query));

	function choose(c: RalColor | null) {
		onpick(c);
		query = '';
		open = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			open = true;
			active = Math.min(active + 1, results.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			active = Math.max(active - 1, 0);
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (open && results[active]) choose(results[active]);
		} else if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<div>
	<div class="relative">
		<span
			class="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 rounded-md border border-black/15"
			style:background={selected?.hex ?? 'transparent'}
			style:border-style={selected ? 'solid' : 'dashed'}
			aria-hidden="true"
		></span>
		<input
			bind:this={input}
			{id}
			class="input pr-10 pl-11 {selected ? 'placeholder:text-ink' : ''}"
			role="combobox"
			autocomplete="off"
			spellcheck="false"
			aria-expanded={open}
			aria-controls="{id}-list"
			aria-autocomplete="list"
			aria-activedescendant={open && results[active] ? `${id}-opt-${results[active].code}` : undefined}
			placeholder={selected ? `RAL ${selected.code} ${selected.name}` : 'Nummer oder Name, z. B. 6024 oder Verkehrsgrün'}
			bind:value={query}
			oninput={() => {
				open = true;
				active = 0;
			}}
			onfocus={() => (open = true)}
			onblur={() => setTimeout(() => (open = false), 150)}
			{onkeydown}
		/>
		{#if selected}
			<button
				type="button"
				class="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-ink"
				aria-label="RAL-Farbe entfernen"
				onclick={() => {
					choose(null);
					input.focus();
				}}
			>
				<X size={16} />
			</button>
		{/if}
	</div>

	{#if open}
		<ul
			id="{id}-list"
			role="listbox"
			class="mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-[var(--shadow-1)]"
			transition:fly={{ y: -4, duration: 150 }}
		>
			{#if !query.trim()}
				<li class="px-2.5 pt-1 pb-1.5 text-[0.8125rem] text-ink-3" role="presentation">Verkehrsfarben</li>
			{/if}
			{#each results as c, i (c.code)}
				<li
					id="{id}-opt-{c.code}"
					role="option"
					aria-selected={c.code === value}
					class="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 {i === active ? 'bg-surface-3' : ''}"
					onmousedown={(e) => {
						e.preventDefault();
						choose(c);
					}}
					onmouseenter={() => (active = i)}
				>
					<span class="size-7 shrink-0 rounded-lg border border-black/15" style:background={c.hex}></span>
					<span class="num shrink-0 font-medium whitespace-nowrap">RAL {c.code}</span>
					<span class="min-w-0 flex-1 truncate text-ink-2">{c.name}</span>
				</li>
			{:else}
				<li class="px-3 py-4 text-center text-sm text-ink-3">Keine RAL-Farbe zu „{query}“ – dann das Farbmuster unten per Hex-Wert festlegen.</li>
			{/each}
		</ul>
	{/if}
</div>
