<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { page } from '$app/state';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { int } from '$lib/format';

	let { data } = $props();

	const back = $derived(`/lager/bestand${page.url.search}`);
	const low = (i: (typeof data.items)[number]) => i.minStock != null && i.minStock > 0 && i.total <= i.minStock;
</script>

<svelte:head><title>{pageTitle('Bestandsliste drucken')}</title></svelte:head>

<PrintSheet title="Bestandsliste" facts={data.facts} notice={data.notice} {back} pdf="/export/bestand.pdf{page.url.search}">
	<table class="print-table mt-3">
		<colgroup>
			<col />
			<col style="width: 8rem" />
			<col style="width: 7rem" />
			<col style="width: 5.5rem" />
			<col style="width: 5rem" />
			<col style="width: 6rem" />
		</colgroup>
		<thead>
			<tr>
				<th scope="col">Artikel</th>
				<th scope="col">Materialart / Farbe</th>
				<th scope="col">Inhalt</th>
				<th scope="col" class="right">Bestand</th>
				<th scope="col" class="right">Mindest</th>
				<th scope="col" class="right">gezählt</th>
			</tr>
		</thead>
		<tbody>
			{#each data.items as i (i.id)}
				<tr class={low(i) ? 'low' : ''}>
					<td>
						<span class="name">{i.name}</span>
						{#if i.articleNumber || i.manufacturer}
							<span class="sub">{[i.articleNumber, i.manufacturer].filter(Boolean).join(' · ')}</span>
						{/if}
						{#if i.locations.length}
							<span class="sub">{i.locations.map((l) => `${l.name}: ${int(l.quantity)}`).join(' · ')}</span>
						{:else}
							<span class="sub">kein Bestand auf einem Lagerort</span>
						{/if}
					</td>
					<td>
						{i.categoryName ?? '–'}
						{#if i.colorName}<span class="sub">{i.colorName}{i.colorRal ? ` (RAL ${i.colorRal})` : ''}</span>{/if}
					</td>
					<td>{i.packageSize ? `${int(i.packageSize)} ${i.unit}` : i.unit}</td>
					<td class="right num total">
						{int(i.total)}
						{#if low(i)}<span class="sub">unter Mindestbestand</span>{/if}
					</td>
					<td class="right num">{i.minStock ? int(i.minStock) : '–'}</td>
					<td class="right write"></td>
				</tr>
			{:else}
				<tr><td colspan="6">Keine Artikel für diese Auswahl.</td></tr>
			{/each}
		</tbody>
	</table>

	<p class="mt-3 text-sm text-ink-3">
		Fett gedruckte Bestände liegen auf oder unter dem Mindestbestand. Die Spalte „gezählt“ ist zum Eintragen bei der Inventur.
	</p>
</PrintSheet>
