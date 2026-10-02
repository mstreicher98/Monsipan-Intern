<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { page } from '$app/state';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { dateTime, fullName, int } from '$lib/format';
	import { MOVEMENT_META, routeParts, signedQty } from '$lib/modules/lager/movement-view';

	let { data } = $props();

	const back = $derived(`/lager/bewegungen${page.url.search}`);
	const bookedBy = (r: (typeof data.rows)[number]) => fullName({ firstName: r.userFirst, lastName: r.userLast }) || r.username;
</script>

<svelte:head><title>{pageTitle('Bewegungen drucken')}</title></svelte:head>

<PrintSheet title="Bewegungen" facts={data.facts} notice={data.notice} {back} pdf="/export/bewegungen.pdf{page.url.search}">
	<table class="print-table mt-3">
		<colgroup>
			<col style="width: 8.5rem" />
			<col style="width: 6.5rem" />
			<col />
			<col style="width: 4.5rem" />
			<col style="width: 11rem" />
			<col style="width: 7rem" />
		</colgroup>
		<thead>
			<tr>
				<th scope="col">Zeitpunkt</th>
				<th scope="col">Art</th>
				<th scope="col">Artikel</th>
				<th scope="col" class="right">Menge</th>
				<th scope="col">Von / Nach</th>
				<th scope="col">Gebucht von</th>
			</tr>
		</thead>
		<tbody>
			{#each data.rows as r (r.id)}
				{@const route = routeParts(r)}
				<tr class={r.cancelledAt ? 'cancelled' : ''}>
					<td class="num">{dateTime(r.createdAt)}</td>
					<td>
						{MOVEMENT_META[r.type].noun}
						{#if r.cancelledAt}<span class="sub">storniert</span>{/if}
					</td>
					<td>
						<span class="name">{r.productName}</span>
						{#if r.articleNumber || r.note}
							<span class="sub">{[r.articleNumber, r.note].filter(Boolean).join(' · ')}</span>
						{/if}
					</td>
					<td class="right num total">
						{signedQty(r)}
						{#if r.type === 'INVENTORY'}<span class="sub">gezählt {int(r.countedQuantity ?? 0)}</span>{/if}
					</td>
					<td>{[route[0], route[1]].filter(Boolean).join(' → ') || '–'}</td>
					<td>{bookedBy(r)}</td>
				</tr>
			{:else}
				<tr><td colspan="6">Keine Buchungen für diese Auswahl.</td></tr>
			{/each}
		</tbody>
	</table>

	<p class="mt-3 text-sm text-ink-3">Durchgestrichene Zeilen sind stornierte Buchungen. Mengen: + Zugang, − Abgang.</p>
</PrintSheet>
