<script lang="ts">
	/** Das Monsipan-Logo als SVG – dieselben Pfade wie in den PDFs. Breite gibt der Platz vor, die Höhe folgt. */
	import { LOGO } from '$lib/logo';

	let { label = 'Monsipan' }: { label?: string } = $props();
</script>

<svg viewBox="0 0 {LOGO.width} {LOGO.height}" class="block h-auto w-full" role="img" aria-label={label}>
	{#each LOGO.paths as p, i (i)}
		<path d={p.d} fill={p.fill} stroke={p.stroke} stroke-width={p.strokeWidth} stroke-linejoin="round" fill-rule={p.evenOdd ? 'evenodd' : 'nonzero'} />
	{/each}
</svg>
