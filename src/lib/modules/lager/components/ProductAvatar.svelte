<script lang="ts">
	/**
	 * Erkennungszeichen eines Artikels – wie der Farbbalken auf den Hersteller-Etiketten:
	 * oben die Materialfarbe, darunter das Kürzel der Materialart.
	 */
	interface Props {
		colorHex?: string | null;
		category?: string | null;
		size?: 'sm' | 'md' | 'lg';
	}
	let { colorHex = null, category = null, size = 'md' }: Props = $props();

	const KNOWN: Record<string, string> = {
		Kaltplastik: 'KP',
		Heißplastik: 'HP',
		Farbe: 'FA',
		Markierungsband: 'MB',
		Glasperlen: 'GP',
		Härter: 'HÄ',
		Primer: 'PR',
		'Reiniger & Verdünnung': 'RV',
		Sonstiges: 'SO'
	};

	function abbr(name: string | null): string {
		if (!name) return '';
		if (KNOWN[name]) return KNOWN[name];
		const words = name.split(/[^A-Za-zÄÖÜäöüß]+/).filter(Boolean);
		if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
		return name.slice(0, 2).toUpperCase();
	}

	const dims = { sm: 'size-8 rounded-[9px] text-[0.625rem]', md: 'size-10 rounded-[11px] text-[0.6875rem]', lg: 'size-14 rounded-[14px] text-sm' };
</script>

<span
	class="relative inline-flex shrink-0 flex-col overflow-hidden border border-line bg-surface-2 {dims[size]}"
	aria-hidden="true"
>
	<span
		class="h-[38%] w-full border-b border-black/5"
		style:background={colorHex ?? 'var(--c-line-strong)'}
		style:background-image={colorHex ? null : 'repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.06) 4px 6px)'}
	></span>
	<span class="flex flex-1 items-center justify-center font-display font-semibold tracking-wide text-ink-2">
		{abbr(category)}
	</span>
</span>
