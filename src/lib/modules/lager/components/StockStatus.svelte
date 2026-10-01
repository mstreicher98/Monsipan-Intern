<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import CircleOff from '@lucide/svelte/icons/circle-off';

	interface Props {
		total: number;
		minStock: number | null;
		active?: boolean;
	}
	let { total, minStock, active = true }: Props = $props();

	const state = $derived(
		!active ? 'inactive' : total <= 0 ? 'empty' : minStock != null && minStock > 0 && total <= minStock ? 'low' : 'ok'
	);
</script>

{#if state === 'inactive'}
	<span class="badge"><CircleOff size={13} aria-hidden="true" />Inaktiv</span>
{:else if state === 'empty'}
	<span class="badge badge-danger"><CircleAlert size={13} aria-hidden="true" />Leer</span>
{:else if state === 'low'}
	<span class="badge badge-warn"><TriangleAlert size={13} aria-hidden="true" />Nachbestellen</span>
{/if}
