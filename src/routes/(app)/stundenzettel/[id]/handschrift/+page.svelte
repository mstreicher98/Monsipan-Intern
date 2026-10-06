<script lang="ts">
	import { pageTitle } from '$lib/app';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import FileText from '@lucide/svelte/icons/file-text';
	import InkEditor from '$lib/components/InkEditor.svelte';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import ViewSwitch from '$lib/components/ViewSwitch.svelte';
	import { fullName } from '$lib/format';
	import { weekLabel } from '$lib/modules/stunden/week';

	let { data } = $props();

	const STATUS: Record<string, string> = {
		freigegeben: 'Die Woche ist freigegeben – schreiben kann nur noch, wer prüft.',
		geprueft: 'Die Woche ist geprüft – zum Ändern muss sie wieder geöffnet werden.'
	};
	const hint = $derived(data.editable ? '' : (STATUS[data.status] ?? 'Diesen Stundenzettel kannst du nur ansehen.'));
</script>

<svelte:head><title>{pageTitle(`${fullName(data)} – Handschrift`)}</title></svelte:head>

<a href="/stundenzettel?woche={data.weekStart}&monat={data.month}" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
	<ArrowLeft size={16} aria-hidden="true" />Stundenzettel
</a>

<div class="mt-3 mb-4 flex flex-wrap items-end justify-between gap-3">
	<div>
		<h1 class="text-[2rem] leading-tight">{fullName(data)}</h1>
		<p class="text-ink-2">{weekLabel(data.weekStart)}{data.partyName ? ` · ${data.partyName}` : ''}</p>
	</div>
	<ViewSwitch digital="/stundenzettel/{data.id}" handschrift="/stundenzettel/{data.id}/handschrift" current="handschrift" />
</div>

{#if hint}<p class="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">{hint}</p>{/if}

<InkEditor background="/stundenzettel/{data.id}/pdf?tinte=0" ink={data.ink} saveUrl="/stundenzettel/{data.id}/tinte" editable={data.editable}>
	{#snippet actions()}
		<PdfButton href="/stundenzettel/{data.id}/pdf" class="btn btn-secondary btn-sm"><FileText size={16} aria-hidden="true" />PDF</PdfButton>
	{/snippet}
</InkEditor>

<p class="field-hint mt-3">
	Mit dem Stift direkt aufs Formular schreiben; mit einem Finger verschieben, mit zwei Fingern zoomen. Name, Woche und schon
	getippte Werte stehen im Formular – wo von Hand geschrieben wird, zählt im Ausdruck die Handschrift. Freigeben und Prüfen gehen
	in der digitalen Ansicht; dort trägt das Büro beim Prüfen auch die Stunden ein.
</p>
