<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import FileText from '@lucide/svelte/icons/file-text';
	import PenLine from '@lucide/svelte/icons/pen-line';
	import PdfButton from '$lib/components/PdfButton.svelte';
	import SignaturePad from '$lib/modules/stunden/components/SignaturePad.svelte';
	import ReportSheet from '$lib/modules/tagesberichte/components/ReportSheet.svelte';
	import ReportSummary from '$lib/modules/tagesberichte/components/ReportSummary.svelte';
	import { dateTime } from '$lib/format';

	let { data, form } = $props();

	/** Vordruck oder Liste – die Liste ist am Handy ohne Zoomen lesbar */
	let view = $state<'formular' | 'liste'>('formular');
	/** Der Vordruck ist für 200 mm (≈ 756 px) gebaut; schmalere Flächen verkleinern ihn */
	const SHEET_PX = (200 / 25.4) * 96;
	let paperWidth = $state(0);
	const scale = $derived(paperWidth ? Math.min(1, paperWidth / SHEET_PX) : 1);

	// svelte-ignore state_referenced_locally
	let name = $state(form && 'name' in form ? String(form.name ?? '') : '');
	let signature = $state('');
	let busy = $state(false);

	const title = $derived(`Tagesbericht${data.number ? ` Nr. ${data.number}` : ''}`);
</script>

<svelte:head>
	<title>{title} – Monsipan</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<h1 class="text-[1.75rem] leading-tight">{title}</h1>

{#if !data.ready || !data.report}
	<div class="card mt-4 p-5">
		<p class="font-medium">Dieser Bericht wird gerade überarbeitet.</p>
		<p class="mt-1 text-ink-2">Sobald er wieder bereit ist, können Sie ihn über denselben Link ansehen und unterschreiben.</p>
	</div>
{:else}
	{#if data.signed && data.report.customerSignedAt}
		<div class="card mt-4 flex flex-wrap items-center gap-4 p-4 sm:p-5">
			<CircleCheck size={28} class="shrink-0 text-ok" aria-hidden="true" />
			<p class="min-w-[14rem] flex-1">
				Unterschrieben von <span class="font-medium">{data.report.customerName}</span> am {dateTime(data.report.customerSignedAt)}.
				<span class="block text-sm text-ink-2">Über diesen Link können Sie den Bericht jederzeit wieder öffnen, drucken oder herunterladen.</span>
			</p>
			<PdfButton href="/bericht/{data.token}/pdf" class="btn btn-primary"><FileText size={18} aria-hidden="true" />Bericht als PDF</PdfButton>
		</div>
	{:else}
		<p class="mt-1 text-ink-2">Bitte prüfen Sie den Bericht und unterschreiben Sie unten für den Auftraggeber. Danach können Sie ihn als PDF herunterladen.</p>
	{/if}

	<div class="mt-4 flex flex-wrap items-center justify-between gap-2">
		<div class="inline-flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Ansicht">
			{#each [['formular', 'Formular'], ['liste', 'Liste']] as [key, label] (key)}
				<button
					type="button"
					role="tab"
					aria-selected={view === key}
					class="rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors {view === key ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-surface-3'}"
					onclick={() => (view = key as 'formular' | 'liste')}
				>
					{label}
				</button>
			{/each}
		</div>
		{#if view === 'formular' && scale < 0.9}<p class="text-[0.8125rem] text-ink-3">Mit zwei Fingern vergrößern</p>{/if}
	</div>

	{#if view === 'formular'}
		<!-- Der Vordruck als weißes Blatt; ist der Bildschirm schmaler, wird er verkleinert statt umgebrochen -->
		<div class="papier mt-3">
			<div bind:clientWidth={paperWidth}>
				<div class="papier-blatt" style:zoom={scale}>
					<ReportSheet report={data.report} internal={false} />
				</div>
			</div>
		</div>
	{:else}
		<section class="card mt-3 p-4 sm:p-5">
			<ReportSummary report={data.report} internal={false} />
		</section>
	{/if}

	{#if !data.signed}
		<form
			method="POST"
			action="?/sign"
			class="card mt-4 space-y-4 p-4 sm:p-5"
			use:enhance={() => {
				busy = true;
				return async ({ update }) => {
					busy = false;
					await update({ reset: false });
				};
			}}
		>
			<h2 class="text-lg">Unterschrift für den Auftraggeber</h2>
			<label class="block">
				<span class="field-label">Ihr Name</span>
				<input class="input" name="name" required minlength="2" maxlength="120" autocomplete="name" bind:value={name} />
			</label>
			<SignaturePad bind:path={signature} label="Hier unterschreiben" />
			<input type="hidden" name="unterschrift" value={signature} />
			{#if form && 'message' in form && form.message}<p class="field-error" role="alert">{form.message}</p>{/if}
			<p class="field-hint">Mit Ihrer Unterschrift bestätigen Sie die oben aufgeführten Leistungen.</p>
			<button class="btn btn-primary w-full sm:w-auto" disabled={busy || !signature || name.trim().length < 2}>
				<PenLine size={18} aria-hidden="true" />{busy ? 'Wird gespeichert …' : 'Unterschreiben'}
			</button>
		</form>
	{/if}
{/if}

<style>
	/* Weißes Blatt wie das PDF – unabhängig vom hellen oder dunklen Design */
	.papier {
		--c-ink: #1d2127;
		--c-line-strong: #1d2127;
		color: #1d2127;
		background: #fff;
		border: 1px solid var(--c-line);
		border-radius: var(--radius-card);
		box-shadow: var(--shadow-1);
		padding: clamp(0.5rem, 3vw, 1.75rem);
		overflow: hidden;
	}
	.papier-blatt {
		width: 200mm;
	}
</style>
