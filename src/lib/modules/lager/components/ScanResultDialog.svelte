<script lang="ts">
	import { goto } from '$app/navigation';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import Plus from '@lucide/svelte/icons/plus';
	import Link from '@lucide/svelte/icons/link';
	import Dialog from '$lib/components/Dialog.svelte';
	import ProductAvatar from './ProductAvatar.svelte';
	import ProductChoice from './ProductChoice.svelte';
	import StockStatus from './StockStatus.svelte';
	import ProductSearch from './ProductSearch.svelte';
	import { int, packageLabel } from '$lib/format';
	import { displayGtin, type ParsedScan } from '$lib/modules/lager/scan/parse';
	import { toast } from '$lib/stores/toast.svelte';
	import type { LookupResult, ProductSummary } from '$lib/modules/lager/types';

	interface Props {
		open: boolean;
		result: LookupResult | null;
		canBook: boolean;
		/** Code einem anderen Artikel zuordnen */
		canManage: boolean;
		/** Neuen Artikel anlegen */
		canCreate?: boolean;
	}
	let { open = $bindable(), result, canBook, canManage, canCreate = false }: Props = $props();
	let assigning = $state(false);
	let busy = $state(false);
	let conflict = $state<{ product: ProductSummary; message: string } | null>(null);
	/** Gewählter Artikel, wenn die Nummer zu mehreren gehört */
	let chosenId = $state<number | null>(null);

	const products = $derived(result?.products ?? []);
	const parsed = $derived(result?.parsed ?? null);
	const product = $derived(products.length === 1 ? products[0] : (products.find((p) => p.id === chosenId) ?? null));
	const title = $derived(
		assigning ? 'Artikel zuordnen' : product ? 'Artikel gefunden' : products.length ? 'Mehrere Artikel' : 'Code nicht gefunden'
	);

	/** Der Code, der beim Zuordnen gespeichert wird */
	function primaryCode(p: ParsedScan | null): { code: string; kind: 'ean' | 'artikel' | 'sonstige' } | null {
		if (!p) return null;
		if (p.gtin) return { code: displayGtin(p.gtin), kind: 'ean' };
		if (p.fields.ean) return { code: p.fields.ean, kind: 'ean' };
		if (p.fields.article) return { code: p.fields.article, kind: 'artikel' };
		if (p.fields.sap) return { code: p.fields.sap, kind: 'sonstige' };
		return p.text ? { code: p.text, kind: 'sonstige' } : null;
	}
	const code = $derived(primaryCode(parsed));

	// Jeder neue Scan – und jedes Öffnen und Schließen – fängt von vorn an
	$effect(() => {
		void result;
		void open;
		assigning = false;
		conflict = null;
		chosenId = null;
	});

	function go(href: string) {
		open = false;
		goto(href);
	}

	async function assign(p: ProductSummary, shared = false) {
		if (!code) return;
		busy = true;
		try {
			const res = await fetch('/api/codes', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ productId: p.id, code: code.code, kind: code.kind, shared })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				// Die Nummer gehört schon zu einem anderen Artikel – nachfragen statt abbrechen
				if (data.conflict && !shared) {
					conflict = { product: p, message: data.message };
					return;
				}
				toast.error('Zuordnen nicht möglich', data.message);
				return;
			}
			toast.success('Code zugeordnet', `${code.code} gehört jetzt zu „${p.name}“.`);
			go(`/lager/artikel/${p.id}`);
		} finally {
			busy = false;
		}
	}
</script>

{#snippet assignBlock()}
	{#if conflict}
		<div class="rounded-2xl bg-surface-2 p-4 text-sm">
			<p class="font-medium">{conflict.message}</p>
			<p class="mt-1 text-ink-2">
				Trotzdem auch „{conflict.product.name}“ zuordnen? Beim Scannen fragt die App dann, welcher Artikel gemeint ist.
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<button class="btn btn-primary btn-sm" disabled={busy} onclick={() => assign(conflict!.product, true)}>Trotzdem zuordnen</button>
				<button class="btn btn-ghost btn-sm" onclick={() => (conflict = null)}>Abbrechen</button>
			</div>
		</div>
	{:else}
		<p class="field-label">Welchem Artikel gehört der Code?</p>
		<ProductSearch onselect={(p) => assign(p)} autofocus scanTarget={false} id="assign-search" />
		{#if busy}<p class="field-hint">Wird zugeordnet …</p>{/if}
	{/if}
{/snippet}

<Dialog bind:open {title}>
	{#if assigning}
		{@render assignBlock()}
	{:else if product}
		<div class="flex items-start gap-4">
			<ProductAvatar colorHex={product.colorHex} category={product.categoryName} size="lg" />
			<div class="min-w-0 flex-1">
				<p class="text-lg leading-snug font-semibold">{product.name}</p>
				<p class="text-sm text-ink-3">
					{[product.articleNumber && `Art.-Nr. ${product.articleNumber}`, packageLabel(product.packageSize, product.unit)]
						.filter(Boolean)
						.join(', ')}
				</p>
				<div class="mt-2"><StockStatus total={product.total} minStock={product.minStock} active={product.active} /></div>
			</div>
			<div class="text-right">
				<p class="num font-display text-4xl leading-none font-semibold">{int(product.total)}</p>
				<p class="mt-1 text-sm text-ink-3">Stück</p>
			</div>
		</div>

		{#if product.locations.length}
			<ul class="mt-4 flex flex-wrap gap-2">
				{#each product.locations as l (l.locationId)}
					<li class="rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-sm">
						{l.name} <span class="num ml-1 font-semibold">{l.quantity}</span>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-4 text-sm text-ink-3">Aktuell an keinem Lagerort vorhanden.</p>
		{/if}

		<div class="mt-6 grid grid-cols-2 gap-2">
			{#if canBook}
				<button class="btn btn-primary" onclick={() => go(`/lager/buchen?art=OUT&produkt=${product.id}`)}>
					<ArrowUpFromLine size={18} aria-hidden="true" />Ausbuchen
				</button>
				<button class="btn btn-secondary" onclick={() => go(`/lager/buchen?art=IN&produkt=${product.id}`)}>
					<ArrowDownToLine size={18} aria-hidden="true" />Einbuchen
				</button>
				<button class="btn btn-secondary" onclick={() => go(`/lager/buchen?art=TRANSFER&produkt=${product.id}`)}>
					<ArrowLeftRight size={18} aria-hidden="true" />Umlagern
				</button>
			{/if}
			<button class="btn btn-ghost {canBook ? '' : 'col-span-2'}" onclick={() => go(`/lager/artikel/${product.id}`)}>Details ansehen</button>
			{#if products.length > 1}
				<button class="btn btn-ghost col-span-2" onclick={() => (chosenId = null)}>Zurück zur Auswahl</button>
			{:else if canManage}
				<button class="btn btn-ghost col-span-2" onclick={() => (assigning = true)}>
					<Link size={18} aria-hidden="true" />Nummer gehört auch zu einem anderen Artikel
				</button>
			{/if}
		</div>
	{:else if products.length}
		<ProductChoice
			{products}
			code={result?.matched ?? code?.code ?? null}
			batch={parsed?.fields.batch ?? null}
			onselect={(p) => (chosenId = p.id)}
		/>
	{:else if result}
		<div class="flex items-start gap-3 rounded-2xl bg-surface-2 p-4">
			<CircleHelp size={22} class="mt-0.5 shrink-0 text-ink-3" aria-hidden="true" />
			<div class="min-w-0">
				<p class="font-medium">Zu diesem Code gibt es noch keinen Artikel.</p>
				{#if code}<p class="num mt-1 text-sm break-all text-ink-2">{code.code}</p>{/if}
				{#if parsed?.fields.name}
					<p class="mt-2 text-sm text-ink-2">
						Erkannt: <span class="font-medium text-ink">{parsed.fields.name}</span>{#if parsed.fields.content}, {parsed.fields.content}{/if}
					</p>
				{:else if parsed?.format === 'swarco'}
					<p class="mt-2 text-sm text-ink-2">
						Erkannt: <span class="font-medium text-ink">SWARCO-Palettenetikett</span>, Artikelnummer
						<span class="num">{parsed.fields.article}</span>{#if parsed.fields.batch}, Charge <span class="num">{parsed.fields.batch}</span>{/if}
					</p>
				{/if}
			</div>
		</div>

		{#if canManage || canCreate}
			<div class="mt-5 grid gap-2 sm:grid-cols-2">
				{#if canCreate}
					<button class="btn btn-primary" onclick={() => go(`/lager/artikel/neu?scan=${encodeURIComponent(parsed?.input ?? '')}`)}>
						<Plus size={18} aria-hidden="true" />Neuen Artikel anlegen
					</button>
				{/if}
				{#if canManage}
					<button class="btn {canCreate ? 'btn-secondary' : 'btn-primary'}" onclick={() => (assigning = true)}>
						<Link size={18} aria-hidden="true" />Artikel zuordnen
					</button>
				{/if}
			</div>
			<p class="field-hint">Zuordnen, wenn der Artikel schon existiert, aber z. B. vom Lieferanten einen neuen Barcode bekommen hat.</p>
		{:else}
			<p class="mt-4 text-sm text-ink-2">Bitte die Bauleitung informieren, damit der Artikel angelegt wird.</p>
		{/if}
	{/if}
</Dialog>
