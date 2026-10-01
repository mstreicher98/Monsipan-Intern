<script lang="ts">
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import { onScan, SCAN_PRIORITY } from '$lib/modules/lager/scan/wedge';
	import { scanner } from '$lib/modules/lager/scan/scanner.svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLInputAttributes, 'value'> {
		id: string;
		value?: string;
		/** Wird mit allen Lesarten eines Scans aufgerufen (Handscanner oder Kamera) */
		oncode: (variants: string[]) => void;
		scanTitle?: string;
	}
	let { id, value = $bindable(''), oncode, scanTitle = 'Code scannen', ...rest }: Props = $props();

	let off: (() => void) | null = null;

	function onfocus() {
		off?.();
		off = onScan((s) => oncode(s.variants), SCAN_PRIORITY.field);
	}
	function onblur() {
		off?.();
		off = null;
	}

	async function camera() {
		const v = await scanner.captureOnce(scanTitle);
		if (v) oncode(v);
	}

	$effect(() => () => off?.());
</script>

<div class="flex gap-2">
	<input
		{id}
		class="input flex-1"
		autocomplete="off"
		spellcheck="false"
		data-scan-target
		bind:value
		{onfocus}
		{onblur}
		onkeydown={(e) => {
			// Enter beim Eintippen übernimmt den Code, statt das ganze Formular abzuschicken
			if (e.key === 'Enter') {
				e.preventDefault();
				if (value.trim()) oncode([value.trim()]);
			}
		}}
		{...rest}
	/>
	<button type="button" class="btn btn-secondary btn-icon shrink-0" aria-label="Mit Kamera scannen" onclick={camera}>
		<ScanBarcode size={20} />
	</button>
</div>
