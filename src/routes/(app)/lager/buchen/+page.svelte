<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { onMount, tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidate } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { fly, fade, scale } from 'svelte/transition';
	import X from '@lucide/svelte/icons/x';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import ScanLine from '@lucide/svelte/icons/scan-line';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Check from '@lucide/svelte/icons/check';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Dialog from '$lib/components/Dialog.svelte';
	import ProductAvatar from '$lib/modules/lager/components/ProductAvatar.svelte';
	import ProductChoice from '$lib/modules/lager/components/ProductChoice.svelte';
	import ProductSearch from '$lib/modules/lager/components/ProductSearch.svelte';
	import QuantityStepper from '$lib/modules/lager/components/QuantityStepper.svelte';
	import { int, packageLabel } from '$lib/format';
	import { MOVEMENT_META, type MovementType } from '$lib/modules/lager/movement-view';
	import { can } from '$lib/permissions';
	import { lookupScan } from '$lib/modules/lager/scan/lookup';
	import { onScan } from '$lib/modules/lager/scan/wedge';
	import { scanner } from '$lib/modules/lager/scan/scanner.svelte';
	import { feedbackError, feedbackSaved, feedbackSuccess } from '$lib/modules/lager/scan/feedback';
	import { toast } from '$lib/stores/toast.svelte';
	import type { LocationQty, ProductSummary } from '$lib/modules/lager/types';

	let { data } = $props();

	type P = ProductSummary & { locations: LocationQty[] };
	interface Line {
		key: number;
		product: P;
		quantity: number | null;
		fromLocationId: number | null;
		pulse: number;
	}

	const TYPES: { value: MovementType; hint: string }[] = [
		{ value: 'OUT', hint: 'Material an eine Partie oder an dich selbst ausgeben' },
		{ value: 'IN', hint: 'Lieferung oder Zugang ins Lager buchen' },
		{ value: 'TRANSFER', hint: 'Zwischen zwei Lagerorten verschieben' },
		{ value: 'RETURN', hint: 'Nicht verbrauchtes Material zurücknehmen' }
	];
	const types = TYPES;

	// svelte-ignore state_referenced_locally
	let type = $state<MovementType>(data.initialType ?? 'OUT');
	let lines = $state<Line[]>([]);
	let toLocationId = $state<number | null>(null);
	let fromLocationId = $state<number | null>(null);
	// svelte-ignore state_referenced_locally
	/** Ausgabe an / Rückgabe von: Partie-ID als Text oder "self" für die eigene Person */
	// svelte-ignore state_referenced_locally
	const defaultRecipient = data.defaultPartyId ? String(data.defaultPartyId) : 'self';
	let recipient = $state<string>(defaultRecipient);
	let note = $state('');
	let busy = $state(false);
	let serverError = $state<{ message: string; line: number | null } | null>(null);
	let done = $state<{ count: number; units: number; type: MovementType } | null>(null);
	let restored = $state(false);
	/** Auswahl, wenn ein Code zu mehreren Artikeln gehört */
	let choice = $state<{ products: P[]; code: string | null; batch: string | null } | null>(null);
	let choiceOpen = $state(false);
	let nextKey = 1;

	const meta = $derived(MOVEMENT_META[type]);
	const needsParty = $derived(type === 'OUT' || type === 'RETURN');
	const needsTo = $derived(type === 'IN' || type === 'RETURN' || type === 'TRANSFER');
	const locName = (id: number | null) => data.locations.find((l) => l.id === id)?.name ?? '';
	const qtyAt = (p: P, id: number | null) => (id ? (p.locations.find((l) => l.locationId === id)?.quantity ?? 0) : 0);

	function defaultFrom(p: P): number | null {
		const withStock = p.locations.filter((l) => l.quantity > 0 && data.locations.some((x) => x.id === l.locationId));
		if (!withStock.length) return p.locations[0]?.locationId ?? null;
		return withStock.reduce((a, b) => (b.quantity > a.quantity ? b : a)).locationId;
	}

	function lineIssue(l: Line): string | null {
		if (!l.quantity || l.quantity < 1) return 'Menge eintragen';
		if (type === 'OUT') {
			if (!l.fromLocationId) return 'Lagerort wählen';
			const have = qtyAt(l.product, l.fromLocationId);
			if (have < l.quantity) return have === 0 ? `Nicht in ${locName(l.fromLocationId)} vorrätig` : `Nur ${have} in ${locName(l.fromLocationId)}`;
		}
		if (type === 'TRANSFER' && fromLocationId) {
			const have = qtyAt(l.product, fromLocationId);
			if (have < l.quantity) return have === 0 ? `Nicht in ${locName(fromLocationId)} vorrätig` : `Nur ${have} in ${locName(fromLocationId)}`;
		}
		return null;
	}

	const headerIssue = $derived.by(() => {
		if (needsParty && !recipient) return type === 'OUT' ? 'Angeben, an wen das Material geht' : 'Angeben, von wem die Rückgabe kommt';
		if (type === 'TRANSFER') {
			if (!fromLocationId) return 'Quell-Lagerort wählen';
			if (!toLocationId) return 'Ziel-Lagerort wählen';
			if (fromLocationId === toLocationId) return 'Quelle und Ziel müssen verschieden sein';
		} else if (needsTo && !toLocationId) return 'Ziel-Lagerort wählen';
		return null;
	});
	const issues = $derived(lines.map(lineIssue));
	const ready = $derived(lines.length > 0 && !headerIssue && issues.every((i) => !i));
	const units = $derived(lines.reduce((s, l) => s + (l.quantity ?? 0), 0));

	const submitLabel = $derived.by(() => {
		const n = lines.length;
		const art = n === 1 ? '1 Artikel' : `${n} Artikel`;
		switch (type) {
			case 'OUT':
				return `${art} ausbuchen`;
			case 'IN':
				return `${art} einbuchen`;
			case 'TRANSFER':
				return `${art} umlagern`;
			case 'RETURN':
				return `${art} zurücknehmen`;
			default:
				return `${art} buchen`;
		}
	});

	/* ------------------------------------------------------------ Zeilen */

	function addProduct(p: P) {
		serverError = null;
		const existing = lines.find((l) => l.product.id === p.id);
		if (existing) {
			existing.product = p;
			existing.quantity = (existing.quantity ?? 0) + 1;
			existing.pulse++;
			return;
		}
		const line: Line = {
			key: nextKey++,
			product: p,
			quantity: 1,
			fromLocationId: defaultFrom(p),
			pulse: 0
		};
		lines = [line, ...lines];
	}

	function removeLine(key: number) {
		lines = lines.filter((l) => l.key !== key);
	}

	async function addById(id: number) {
		const res = await fetch(`/api/products/${id}`);
		if (!res.ok) return toast.error('Artikel konnte nicht geladen werden');
		addProduct(await res.json());
	}

	/** Gescannten Artikel in die Liste übernehmen */
	function acceptProduct(p: P) {
		if (!p.active) {
			feedbackError();
			scanner.report(false, `${p.name} ist deaktiviert`);
			if (!scanner.open) toast.error('Artikel ist deaktiviert', p.name);
			return;
		}
		feedbackSuccess();
		addProduct(p);
		const line = lines.find((l) => l.product.id === p.id);
		scanner.report(true, `${p.name}${line?.quantity ? ` – ${line.quantity} Stück` : ''}`);
	}

	async function handleScan(variants: string[]) {
		try {
			const r = await lookupScan(variants);
			if (!r.products.length) {
				feedbackError();
				scanner.report(false, 'Unbekannter Code – Artikel zuerst anlegen');
				if (!scanner.open) toast.error('Unbekannter Code', r.parsed?.fields.name ?? r.parsed?.text ?? undefined);
				return;
			}
			// Dieselbe Nummer bei mehreren Artikeln: nachfragen statt raten
			if (r.products.length > 1) {
				feedbackError();
				scanner.report(false, 'Mehrere Artikel – bitte auswählen');
				scanner.close();
				choice = { products: r.products, code: r.matched, batch: r.parsed?.fields.batch ?? null };
				choiceOpen = true;
				return;
			}
			acceptProduct(r.products[0]);
		} catch {
			feedbackError();
			toast.error('Suche fehlgeschlagen', 'Bitte Verbindung prüfen.');
		}
	}

	/* ------------------------------------------------------------ Entwurf */

	const draftKey = () => `lager-buchung-${data.user.id}`;

	function saveDraft() {
		try {
			localStorage.setItem(
				draftKey(),
				JSON.stringify({ type, toLocationId, fromLocationId, recipient, note, lines: lines.map(({ pulse: _p, ...l }) => l) })
			);
		} catch {
			/* privater Modus */
		}
	}

	function clearAll() {
		lines = [];
		note = '';
		serverError = null;
		restored = false;
		// Nächste Buchung startet wieder mit der eigenen Partie
		recipient = defaultRecipient;
	}

	onMount(() => {
		try {
			const raw = localStorage.getItem(draftKey());
			if (raw) {
				const d = JSON.parse(raw);
				toLocationId = d.toLocationId ?? null;
				fromLocationId = d.fromLocationId ?? null;
				if (!data.initialType && d.type && d.type !== 'INVENTORY') type = d.type;
				if (Array.isArray(d.lines) && d.lines.length && !data.prefill) {
					lines = d.lines.map((l: Line) => ({ ...l, key: nextKey++, pulse: 0 }));
					note = d.note ?? '';
					// Beim Wiederherstellen die zuvor gewählte Auswahl behalten, sofern es sie noch gibt
					const saved = typeof d.recipient === 'string' ? d.recipient : null;
					if (saved === 'self' || data.parties.some((p) => String(p.id) === saved)) recipient = saved!;
					restored = true;
				}
			}
		} catch {
			/* kaputter Entwurf */
		}
		// Sinnvolle Vorbelegung, wenn es nur einen Lagerort gibt
		if (!toLocationId && data.locations.length === 1) toLocationId = data.locations[0].id;
		if (data.prefill) addProduct(data.prefill);

		const off = onScan((s) => handleScan(s.variants));
		return off;
	});

	$effect(() => {
		// Abhängigkeiten lesen, dann speichern
		JSON.stringify([type, toLocationId, fromLocationId, recipient, note, lines]);
		saveDraft();
	});

	// Beim Wechsel auf Ausbuchen fehlende Quell-Lagerorte ergänzen
	$effect(() => {
		if (type === 'OUT') for (const l of lines) if (!l.fromLocationId) l.fromLocationId = defaultFrom(l.product);
	});
</script>

<svelte:head><title>{pageTitle(meta.verb)}</title></svelte:head>

<div class="pt-2 pb-4">
	<h1 class="text-[2rem] leading-tight">Buchen</h1>
	<p class="text-ink-2">Artikel scannen oder suchen, Mengen prüfen, fertig.</p>
</div>

<!-- Buchungsart -->
<div class="no-scrollbar -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="radiogroup" aria-label="Buchungsart">
	<div class="inline-flex min-w-full gap-1 rounded-2xl border border-line bg-surface p-1 sm:min-w-0">
		{#each types as t (t.value)}
			{@const m = MOVEMENT_META[t.value]}
			{@const active = type === t.value}
			<button
				role="radio"
				aria-checked={active}
				class="relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors {active
					? 'bg-ink text-surface'
					: 'text-ink-2 hover:bg-surface-3 hover:text-ink'}"
				onclick={() => {
					type = t.value;
					serverError = null;
				}}
			>
				<m.icon size={18} aria-hidden="true" />{m.verb}
			</button>
		{/each}
	</div>
</div>
<p class="mt-2 text-sm text-ink-3">{TYPES.find((t) => t.value === type)?.hint}</p>

<div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
	<!-- Linke Spalte: Erfassen + Zeilen -->
	<div class="min-w-0 space-y-4">
		<section class="card p-4 lg:p-5" aria-label="Artikel erfassen">
			<div class="flex flex-col gap-3 sm:flex-row">
				<div class="flex-1">
					<ProductSearch
						onselect={(p) => addById(p.id)}
						placeholder="Artikel suchen oder Handscanner benutzen"
						id="book-search"
						label="Artikel suchen"
					/>
				</div>
				<button class="btn btn-primary sm:w-auto" onclick={() => scanner.openCamera({ mode: 'continuous', title: `${meta.verb}: Artikel scannen` })}>
					<ScanBarcode size={20} aria-hidden="true" />Kamera
				</button>
			</div>
			<p class="mt-2 hidden items-center gap-2 text-sm text-ink-3 lg:flex">
				<span class="inline-flex size-2 rounded-full bg-ok" aria-hidden="true"></span>
				Handscanner bereit – einfach scannen, jeder Scan erhöht die Menge um 1.
			</p>
		</section>

		{#if restored && lines.length}
			<div class="flex items-center gap-3 rounded-2xl border border-line bg-brand-soft px-4 py-3" transition:fade={{ duration: 150 }}>
				<RotateCcw size={18} class="shrink-0" aria-hidden="true" />
				<p class="flex-1 text-sm">Nicht gespeicherte Buchung wiederhergestellt.</p>
				<button class="btn btn-ghost btn-sm" onclick={clearAll}>Verwerfen</button>
			</div>
		{/if}

		<section class="card overflow-hidden" aria-labelledby="h-lines">
			<div class="flex items-center justify-between gap-2 border-b border-line px-4 py-3 lg:px-5">
				<h2 id="h-lines" class="text-lg">
					{lines.length === 0 ? 'Noch keine Artikel' : `${lines.length} Artikel`}{#if units > 0}<span class="font-sans text-base font-normal text-ink-3">, {units} Stück</span>{/if}
				</h2>
				{#if lines.length}<button class="btn btn-ghost btn-sm" onclick={clearAll}>Alle entfernen</button>{/if}
			</div>

			{#if lines.length === 0}
				<div class="flex flex-col items-center px-6 py-14 text-center">
					<span class="grid size-14 place-items-center rounded-2xl bg-surface-3 text-ink-3"><ScanLine size={28} aria-hidden="true" /></span>
					<p class="mt-4 font-medium">Scanne den ersten Artikel</p>
					<p class="mt-1 max-w-sm text-sm text-ink-3">Mit der Kamera, dem Handscanner oder über die Suche. Mehrfach scannen erhöht die Menge.</p>
				</div>
			{:else}
				<ul class="divide-y divide-line">
					{#each lines as l, i (l.key)}
						{@const issue = issues[i]}
						{@const failed = serverError?.line === i}
						<li
							class="px-4 py-3 lg:px-5 {failed ? 'bg-danger-soft' : ''}"
							animate:flip={{ duration: 240 }}
							in:fly={{ y: -10, duration: 260 }}
							out:fly={{ x: 40, duration: 180 }}
						>
							<div class="flex items-start gap-3">
								<ProductAvatar colorHex={l.product.colorHex} category={l.product.categoryName} />
								<div class="min-w-0 flex-1">
									<p class="leading-snug font-medium">{l.product.name}</p>
									<p class="text-sm text-ink-3">
										{[l.product.articleNumber, packageLabel(l.product.packageSize, l.product.unit)].filter(Boolean).join(', ')}
									</p>
								</div>
								<button class="btn btn-ghost btn-sm btn-icon -mt-1 -mr-2" aria-label="{l.product.name} entfernen" onclick={() => removeLine(l.key)}>
									<X size={18} />
								</button>
							</div>

							<div class="mt-3 flex flex-wrap items-end gap-3 pl-[3.25rem]">
								{#if type === 'OUT'}
									<div class="min-w-[10rem] flex-1">
										<label class="field-label !mb-1 text-[0.8125rem]" for="from-{l.key}">Aus Lagerort</label>
										<select id="from-{l.key}" class="select" bind:value={l.fromLocationId}>
											{#each data.locations as loc (loc.id)}
												{@const q = qtyAt(l.product, loc.id)}
												<option value={loc.id} disabled={q === 0 && l.fromLocationId !== loc.id}>{loc.name} ({q})</option>
											{/each}
										</select>
									</div>
								{/if}

								<div>
									<span class="field-label !mb-1 text-[0.8125rem]">Stück</span>
									<QuantityStepper bind:value={l.quantity} label="Menge {l.product.name}" invalid={Boolean(issue) || failed} pulse={l.pulse} />
								</div>
								{#if type === 'TRANSFER' && fromLocationId}
									<p class="pb-2.5 text-sm text-ink-3">{qtyAt(l.product, fromLocationId)} in {locName(fromLocationId)}</p>
								{:else if type !== 'OUT'}
									<p class="pb-2.5 text-sm text-ink-3">Bestand gesamt {int(l.product.total)}</p>
								{/if}
							</div>

							{#if issue && (l.quantity != null || type === 'OUT' || type === 'TRANSFER')}
								<p class="mt-2 flex items-center gap-1.5 pl-[3.25rem] text-sm font-medium text-danger" transition:fade={{ duration: 120 }}>
									<TriangleAlert size={15} aria-hidden="true" />{issue}
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<!-- Rechte Spalte: Angaben + Abschluss -->
	<aside class="lg:sticky lg:top-20 lg:self-start">
		<form
			method="POST"
			action="?/book"
			class="card space-y-4 p-4 lg:p-5"
			use:enhance={() => {
				busy = true;
				serverError = null;
				return async ({ result }) => {
					busy = false;
					if (result.type === 'success' && result.data?.ok) {
						feedbackSaved();
						done = { count: Number(result.data.count), units: Number(result.data.units), type: result.data.type as MovementType };
						clearAll();
						await invalidate('app:stock');
						setTimeout(() => (done = null), 1800);
					} else if (result.type === 'failure') {
						feedbackError();
						serverError = { message: String(result.data?.message ?? 'Buchung fehlgeschlagen'), line: (result.data?.line as number | null) ?? null };
						// Bestände neu laden, damit die Zeilen aktuelle Zahlen zeigen
						for (const l of lines) {
							const res = await fetch(`/api/products/${l.product.id}`);
							if (res.ok) l.product = await res.json();
						}
					} else {
						feedbackError();
						serverError = { message: 'Buchung fehlgeschlagen – bitte erneut versuchen.', line: null };
					}
				};
			}}
		>
			<h2 class="text-lg">Angaben</h2>

			{#if type === 'TRANSFER'}
				<div>
					<label for="from-loc" class="field-label">Von Lagerort</label>
					<select id="from-loc" class="select" bind:value={fromLocationId}>
						<option value={null}>Bitte wählen</option>
						{#each data.locations as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
					</select>
				</div>
			{/if}
			{#if needsParty}
				<div>
					<label for="party" class="field-label">{type === 'OUT' ? 'Ausgabe an' : 'Zurück von'}</label>
					<select id="party" class="select" bind:value={recipient}>
						<option value="self">{data.selfName} (ich)</option>
						{#if data.parties.length}
							<optgroup label="Partien">
								{#each data.parties as p (p.id)}
									<option value={String(p.id)}>{p.name}{p.id === data.defaultPartyId ? ' (eigene Partie)' : ''}</option>
								{/each}
							</optgroup>
						{/if}
					</select>
					{#if recipient !== defaultRecipient}
						<button type="button" class="field-hint underline decoration-mark decoration-2 underline-offset-2 hover:text-ink" onclick={() => (recipient = defaultRecipient)}>
							{data.defaultPartyId ? 'Wieder eigene Partie verwenden' : 'Wieder auf mich buchen'}
						</button>
					{:else if data.defaultPartyId}
						<p class="field-hint">Deine Partie ist vorausgewählt.</p>
					{:else}
						<p class="field-hint">Du gehörst zu keiner Partie – daher wird auf dich gebucht. Eine Partie lässt sich auswählen.</p>
					{/if}
				</div>
			{/if}
			{#if needsTo}
				<div>
					<label for="to-loc" class="field-label">{type === 'TRANSFER' ? 'Nach Lagerort' : 'In Lagerort'}</label>
					<select id="to-loc" class="select" bind:value={toLocationId}>
						<option value={null}>Bitte wählen</option>
						{#each data.locations as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
					</select>
				</div>
			{/if}
			<div>
				<label for="note" class="field-label">Notiz <span class="font-normal text-ink-3">(optional)</span></label>
				<input id="note" class="input" maxlength="500" placeholder={type === 'IN' ? 'z. B. Lieferschein-Nr.' : 'z. B. Baustelle'} bind:value={note} />
			</div>

			<input
				type="hidden"
				name="payload"
				value={JSON.stringify({
					type,
					partyId: needsParty && recipient !== 'self' && recipient ? Number(recipient) : null,
					recipientSelf: needsParty && recipient === 'self',
					note,
					lines: lines.map((l) => ({
						productId: l.product.id,
						quantity: l.quantity ?? 0,
						fromLocationId: type === 'OUT' ? l.fromLocationId : type === 'TRANSFER' ? fromLocationId : null,
						toLocationId: needsTo ? toLocationId : null,
						countedQuantity: null
					}))
				})}
			/>

			{#if serverError}
				<div class="flex gap-2 rounded-xl bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert" in:fly={{ y: -4, duration: 180 }}>
					<TriangleAlert size={18} class="mt-px shrink-0" aria-hidden="true" />
					<p class="font-medium">{serverError.message}</p>
				</div>
			{:else if lines.length && headerIssue}
				<p class="text-sm font-medium text-warn">{headerIssue}</p>
			{/if}

			<button class="btn btn-primary hidden min-h-12 w-full text-base lg:flex" disabled={!ready || busy}>
				{busy ? 'Wird gebucht …' : lines.length ? submitLabel : `${meta.verb}`}
			</button>

			<!-- Handy: Abschlussleiste über der Navigation -->
			<div
				class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden"
				class:hidden={lines.length === 0}
			>
				<button class="btn btn-primary min-h-12 w-full text-base" disabled={!ready || busy}>
					{busy ? 'Wird gebucht …' : submitLabel}
					{#if ready && !busy}<ArrowRight size={18} aria-hidden="true" />{/if}
				</button>
				{#if !ready && (headerIssue || issues.find(Boolean))}
					<p class="mt-1.5 text-center text-[0.8125rem] text-ink-3">{headerIssue ?? issues.find(Boolean)}</p>
				{/if}
			</div>
		</form>
	</aside>
</div>

<!-- Platz für die Abschlussleiste am Handy -->
{#if lines.length}<div class="h-24 lg:hidden" aria-hidden="true"></div>{/if}

<Dialog bind:open={choiceOpen} title="Mehrere Artikel">
	{#if choice}
		<ProductChoice
			products={choice.products}
			code={choice.code}
			batch={choice.batch}
			onselect={(p) => {
				const hit = choice?.products.find((x) => x.id === p.id);
				choiceOpen = false;
				if (hit) acceptProduct(hit);
			}}
		/>
	{/if}
</Dialog>

{#if done}
	<div class="pointer-events-none fixed inset-0 z-[65] grid place-items-center p-6" transition:fade={{ duration: 200 }}>
		<div class="flex flex-col items-center rounded-3xl border border-line bg-surface px-10 py-8 text-center shadow-[var(--shadow-3)]" in:scale={{ start: 0.9, duration: 320 }}>
			<span class="grid size-16 place-items-center rounded-full bg-ok text-white">
				<Check size={34} strokeWidth={3} class="check-draw" aria-hidden="true" />
			</span>
			<p class="mt-4 font-display text-2xl font-semibold">Gebucht</p>
			<p class="mt-1 text-ink-2">
				{done.count} {done.count === 1 ? 'Artikel' : 'Artikel'}, {done.units} Stück
			</p>
			<span class="lane mt-5 h-1 w-24 animate-lane rounded-full" aria-hidden="true"></span>
		</div>
	</div>
{/if}

<style>
	:global(.check-draw path) {
		stroke-dasharray: 30;
		stroke-dashoffset: 30;
		animation: draw 420ms var(--ease-out) 120ms forwards;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
