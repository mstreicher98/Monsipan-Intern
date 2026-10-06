<script lang="ts" module>
	/**
	 * Gewählte Ansicht je Gerät merken: Wer am Tablet handschriftlich ausfüllt,
	 * landet beim nächsten Öffnen gleich wieder in der Handschrift-Ansicht.
	 */
	const KEY = 'monsipan-ansicht';

	export function preferredView(): 'digital' | 'handschrift' {
		try {
			return localStorage.getItem(KEY) === 'handschrift' ? 'handschrift' : 'digital';
		} catch {
			return 'digital';
		}
	}

	function remember(view: 'digital' | 'handschrift') {
		try {
			localStorage.setItem(KEY, view);
		} catch {
			/* kein Speicher – dann eben ohne Merken */
		}
	}
</script>

<script lang="ts">
	/** Umschalter zwischen digitaler Eingabe und Handschrift auf dem Formular */
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import PenLine from '@lucide/svelte/icons/pen-line';

	interface Props {
		digital: string;
		handschrift: string;
		current: 'digital' | 'handschrift';
	}
	let { digital, handschrift, current }: Props = $props();

	const views = $derived([
		{ key: 'digital' as const, label: 'Digital', href: `${digital}?ansicht=digital`, icon: Keyboard },
		{ key: 'handschrift' as const, label: 'Handschrift', href: handschrift, icon: PenLine }
	]);
</script>

<div class="inline-flex rounded-xl border border-line bg-surface p-1" role="group" aria-label="Ansicht">
	{#each views as v (v.key)}
		<a
			href={v.href}
			data-sveltekit-replacestate
			aria-current={current === v.key ? 'page' : undefined}
			onclick={() => remember(v.key)}
			class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {current === v.key
				? 'bg-ink text-surface'
				: 'text-ink-2 hover:bg-surface-3 hover:text-ink'}"
		>
			<v.icon size={16} aria-hidden="true" />{v.label}
		</a>
	{/each}
</div>
