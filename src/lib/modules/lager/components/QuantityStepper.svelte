<script lang="ts">
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';

	interface Props {
		value: number | null;
		min?: number;
		max?: number;
		label: string;
		invalid?: boolean;
		id?: string;
		/** Kurz aufleuchten lassen, z. B. nach erneutem Scan */
		pulse?: number;
	}
	let { value = $bindable(), min = 1, max = 99999, label, invalid = false, id, pulse = 0 }: Props = $props();

	function set(n: number) {
		value = Math.min(max, Math.max(min, n));
	}
</script>

<div class="inline-flex items-center rounded-xl border bg-surface {invalid ? 'border-danger' : 'border-line-strong'}" role="group" aria-label={label}>
	<button type="button" class="grid size-11 place-items-center rounded-l-xl text-ink-2 hover:bg-surface-3 disabled:opacity-40" aria-label="Weniger" disabled={value != null && value <= min} onclick={() => set((value ?? min) - 1)}>
		<Minus size={18} />
	</button>
	{#key pulse}
		<input
			{id}
			class="num h-11 w-14 border-x border-line bg-transparent text-center font-display text-lg font-semibold outline-none focus:bg-brand-soft {pulse ? 'animate-pop' : ''}"
			inputmode="numeric"
			pattern="[0-9]*"
			aria-label={label}
			aria-invalid={invalid || undefined}
			value={value ?? ''}
			oninput={(e) => {
				const raw = e.currentTarget.value.replace(/\D/g, '');
				value = raw === '' ? null : Math.min(max, Number(raw));
			}}
			onblur={() => {
				if (value != null && value < min) value = min;
			}}
			onfocus={(e) => e.currentTarget.select()}
		/>
	{/key}
	<button type="button" class="grid size-11 place-items-center rounded-r-xl text-ink-2 hover:bg-surface-3" aria-label="Mehr" onclick={() => set((value ?? min - 1) + 1)}>
		<Plus size={18} />
	</button>
</div>
