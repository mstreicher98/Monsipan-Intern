<script lang="ts">
	interface Props {
		compact?: boolean;
	}
	let { compact = false }: Props = $props();
</script>

<span class="inline-flex items-center gap-2.5 select-none">
	<!-- Fahrbahn von oben: weiße Randlinien, gelbe unterbrochene Mittellinie (wie favicon.svg) -->
	<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" class="shrink-0">
		<rect width="32" height="32" rx="6" fill="#1b2027" />
		<path fill="#f4f5f6" d="M4 .35h1.6v31.3H4zM26.4 .35H28v31.3h-1.6z" />
		<path fill="#f8f000" d="M15 0h2v4h-2zM15 6.4h2v4.8h-2zM15 13.6h2v4.8h-2zM15 20.8h2v4.8h-2zM15 28h2v4h-2z" />
		<!-- Rand zuletzt, damit die dunkle Kachel auch auf dunklem Grund abgesetzt ist -->
		<rect x="0.5" y="0.5" width="31" height="31" rx="5.5" fill="none" stroke="var(--c-line-strong)" />
	</svg>
	{#if !compact}
		<span class="leading-none">
			<span class="block font-display text-[1.0625rem] font-semibold tracking-tight text-ink">Monsipan</span>
			<span class="block text-[0.75rem] whitespace-nowrap text-ink-3">Portal</span>
		</span>
	{/if}
</span>
