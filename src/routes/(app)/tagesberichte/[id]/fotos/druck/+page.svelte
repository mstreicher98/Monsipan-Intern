<script lang="ts">
	/** Fotos zum Tagesbericht drucken – zwei je Seite, ein einzelnes Foto über die ganze Seite */
	import { onMount } from 'svelte';
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { dateTime } from '$lib/format';

	let { data } = $props();

	/** Gedruckt wird erst, wenn alle Bilder da sind (oder sich nicht laden ließen) */
	let loaded = $state<Record<number, true>>({});
	const ready = $derived(Object.keys(loaded).length >= data.photos.length);
	const mark = (id: number) => (loaded[id] = true);
	let box = $state<HTMLDivElement>();
	// Bilder aus dem Zwischenspeicher sind womöglich schon vor dem Start der Seite fertig
	onMount(() => box?.querySelectorAll('img').forEach((img) => img.complete && mark(Number(img.dataset.id))));
	const single = $derived(data.photos.length === 1);
	const facts = $derived([...data.facts, single ? `Foto ${data.photos[0].number}` : `${data.photos.length} Fotos`]);
</script>

<svelte:head><title>{pageTitle(data.title)}</title></svelte:head>

<PrintSheet
	title={data.title}
	{facts}
	back="/tagesberichte/{data.id}"
	pdf="/tagesberichte/{data.id}/fotos/pdf{data.only ? `?foto=${data.only}` : ''}"
	{ready}
>
	<div class="fotos {single ? 'einzeln' : ''}" bind:this={box}>
		{#each data.photos as p (p.id)}
			<figure>
				<div class="bild">
					<img
						src="/tagesberichte/{data.id}/fotos/{p.id}"
						alt="Foto {p.number}"
						data-id={p.id}
						onload={() => mark(p.id)}
						onerror={() => mark(p.id)}
					/>
				</div>
				<figcaption>{[`Foto ${p.number}`, p.createdBy, dateTime(p.createdAt)].filter(Boolean).join(' · ')}</figcaption>
			</figure>
		{/each}
	</div>
</PrintSheet>

<style>
	.fotos {
		display: grid;
		gap: 1.5rem;
		margin-top: 1rem;
	}
	figure {
		margin: 0;
		break-inside: avoid;
	}
	.bild {
		height: min(70vh, 34rem);
		background: var(--c-surface-2);
		border-radius: 0.75rem;
		overflow: hidden;
	}
	/* Füllt den Rahmen, das Foto selbst bleibt ganz darin – auch im Hochformat */
	.bild img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	figcaption {
		margin-top: 0.4rem;
		text-align: center;
		font-size: 0.8125rem;
		color: var(--c-ink-3);
	}

	/* Auf Papier: zwei Fotos je A4-Seite, ein einzelnes über die ganze Seite */
	@media print {
		.fotos {
			gap: 6mm;
			margin-top: 4mm;
		}
		.bild {
			height: 108mm;
			background: none;
			border-radius: 0;
		}
		.einzeln .bild {
			height: 225mm;
		}
		figure:nth-child(2n) {
			break-after: page;
		}
		figure:last-child {
			break-after: auto;
		}
		figcaption {
			color: #444;
			font-size: 8.5pt;
		}
	}
</style>
