<script lang="ts">
	import { pageTitle } from '$lib/app';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import InkEditor from '$lib/components/InkEditor.svelte';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import ViewSwitch from '$lib/components/ViewSwitch.svelte';

	let { data } = $props();

	const STATUS: Record<string, string> = {
		freigegeben: 'Der Bericht ist freigegeben – schreiben kann nur noch, wer prüft.',
		geprueft: 'Der Bericht ist geprüft – zum Ändern muss er wieder geöffnet werden.',
		abgeschlossen: 'Der Bericht ist abgeschlossen – zum Ändern muss er wieder geöffnet werden.'
	};
	const hint = $derived(
		data.editable
			? ''
			: data.lockedByCustomer
				? 'Der Kunde hat vor Ort unterschrieben – zum Ändern erst seine Unterschrift entfernen.'
				: (STATUS[data.status] ?? 'Diesen Bericht kannst du nur ansehen.')
	);
</script>

<svelte:head><title>{pageTitle(`Tagesbericht ${data.number || ''} – Handschrift`.trim())}</title></svelte:head>

<a href="/tagesberichte" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Tagesberichte
</a>

<div class="mt-3 mb-4 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-[2rem] leading-tight">Tagesbericht {data.number}</h1>
		<p class="text-ink-2">{data.road || data.site || 'Ohne Bezeichnung'}</p>
	</div>
	<ViewSwitch digital="/tagesberichte/{data.id}" handschrift="/tagesberichte/{data.id}/handschrift" current="handschrift" />
</div>

{#if hint}<p class="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">{hint}</p>{/if}

<InkEditor background="/tagesberichte/{data.id}/pdf?tinte=0" ink={data.ink} saveUrl="/tagesberichte/{data.id}/tinte" editable={data.editable}>
	{#snippet actions()}
		<PdfButton href="/tagesberichte/{data.id}/pdf" class="btn btn-secondary btn-sm"><FileText size={16} aria-hidden="true" />PDF</PdfButton>
	{/snippet}
</InkEditor>

<p class="field-hint mt-3">
	Direkt aufs Formular schreiben. Getippte Werte stehen schon im Formular – wo von Hand geschrieben wird, zählt im Ausdruck die
	Handschrift. Freigeben und Prüfen gehen in der digitalen Ansicht.
</p>
