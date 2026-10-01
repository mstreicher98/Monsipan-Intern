<script lang="ts" module>
	import type { MovementType } from '$lib/modules/lager/movement-view';

	export interface Row {
		id: number;
		type: MovementType;
		quantity: number;
		countedQuantity: number | null;
		previousQuantity: number | null;
		note: string;
		createdAt: Date | string;
		cancelledAt: Date | string | null;
		cancelReason: string | null;
		cancelledByName: string | null;
		correctionOf: number | null;
		productId: number;
		productName: string;
		articleNumber: string | null;
		categoryName: string | null;
		colorHex: string | null;
		fromLocation: string | null;
		toLocation: string | null;
		partyName: string | null;
		recipientName?: string | null;
		recipientUsername?: string | null;
		userFirst: string;
		userLast: string;
		username: string;
	}
</script>

<script lang="ts" generics="R extends Row">
	import type { Snippet } from 'svelte';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ProductAvatar from './ProductAvatar.svelte';
	import { fullName, relativeDateTime } from '$lib/format';
	import { MOVEMENT_META, routeParts, signedQty } from '$lib/modules/lager/movement-view';

	interface Props {
		rows: R[];
		showProduct?: boolean;
		actions?: Snippet<[R]>;
		empty?: string;
	}
	let { rows, showProduct = true, actions, empty = 'Noch keine Bewegungen.' }: Props = $props();
</script>

{#snippet route(r: Row)}
	{@const [a, b] = routeParts(r)}
	<span class="inline-flex items-center gap-1.5 text-ink-2">
		{#if a}<span>{a}</span><ArrowRight size={14} class="text-ink-3" aria-label="nach" />{/if}
		<span>{b ?? '–'}</span>
	</span>
{/snippet}

{#snippet typeChip(r: Row)}
	{@const m = MOVEMENT_META[r.type]}
	<span class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[0.8125rem] font-medium {m.soft}" title={m.noun}>
		<m.icon size={14} aria-hidden="true" /><span class="sr-only 2xl:not-sr-only">{m.noun}</span>
	</span>
{/snippet}

{#if rows.length === 0}
	<p class="px-4 py-10 text-center text-ink-3">{empty}</p>
{:else}
	<!-- Tabelle ab Tablet -->
	<div class="hidden overflow-x-auto md:block">
		<table class="data-table">
			<thead>
				<tr>
					<th>Zeitpunkt</th>
					<th>Art</th>
					{#if showProduct}<th>Artikel</th>{/if}
					<th class="text-right">Menge</th>
					<th>Von / Nach</th>
					{#if actions}<th><span class="sr-only">Aktionen</span></th>{/if}
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.id)}
					<tr class:opacity-55={r.cancelledAt}>
						<td class="whitespace-nowrap">
							<span class="block text-ink-2">{relativeDateTime(r.createdAt)}</span>
							<span class="block text-[0.8125rem] text-ink-3">{fullName({ firstName: r.userFirst, lastName: r.userLast, username: r.username })}</span>
						</td>
						<td>{@render typeChip(r)}</td>
						{#if showProduct}
							<td class="max-w-[16rem] 2xl:max-w-[24rem]">
								<a href="/lager/artikel/{r.productId}" class="flex items-center gap-3 hover:underline">
									<ProductAvatar colorHex={r.colorHex} category={r.categoryName} size="sm" />
									<span class="min-w-0">
										<span class="block truncate font-medium" class:line-through={r.cancelledAt} title={r.productName}>{r.productName}</span>
										{#if r.note}<span class="block truncate text-sm text-ink-3">{r.note}</span>{/if}
									</span>
								</a>
							</td>
						{/if}
						<td class="num text-right font-display text-lg font-semibold whitespace-nowrap {MOVEMENT_META[r.type].tone}" class:line-through={r.cancelledAt}>
							{signedQty(r)}
						</td>
						<td class="whitespace-nowrap">{@render route(r)}</td>
						{#if actions}<td class="w-24 text-right">{@render actions(r)}</td>{/if}
					</tr>
					{#if r.cancelledAt}
						<tr>
							<td colspan="6" class="!pt-0 text-sm text-danger">
								Storniert {relativeDateTime(r.cancelledAt)}{r.cancelledByName ? ` von ${r.cancelledByName}` : ''}{r.cancelReason ? `: ${r.cancelReason}` : ''}
							</td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Liste am Handy -->
	<ul class="divide-y divide-line md:hidden">
		{#each rows as r (r.id)}
			{@const m = MOVEMENT_META[r.type]}
			<li class="flex gap-3 px-4 py-3" class:opacity-60={r.cancelledAt}>
				<span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl {m.soft}"><m.icon size={18} aria-label={m.noun} /></span>
				<div class="min-w-0 flex-1">
					{#if showProduct}
						<a href="/lager/artikel/{r.productId}" class="block truncate font-medium" class:line-through={r.cancelledAt}>{r.productName}</a>
					{:else}
						<p class="font-medium">{m.noun}</p>
					{/if}
					<p class="text-sm">{@render route(r)}</p>
					<p class="text-[0.8125rem] text-ink-3">
						{relativeDateTime(r.createdAt)}, {fullName({ firstName: r.userFirst, lastName: r.userLast, username: r.username })}
					</p>
					{#if r.cancelledAt}<p class="text-[0.8125rem] text-danger">Storniert{r.cancelReason ? `: ${r.cancelReason}` : ''}</p>{/if}
				</div>
				<div class="flex flex-col items-end gap-1">
					<span class="num font-display text-xl font-semibold {m.tone}" class:line-through={r.cancelledAt}>{signedQty(r)}</span>
					{#if actions}{@render actions(r)}{/if}
				</div>
			</li>
		{/each}
	</ul>
{/if}
