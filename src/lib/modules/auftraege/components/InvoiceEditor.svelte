<script lang="ts" module>
	export interface EditorHead {
		date: string;
		dueDate: string;
		serviceFrom: string;
		serviceTo: string;
		title: string;
		location: string;
		projectNumber: string;
		customerName: string;
		customerAddition: string;
		customerStreet: string;
		customerZip: string;
		customerCity: string;
		customerUid: string;
		intro: string;
		closing: string;
		vatRate: number;
		reverseCharge: boolean;
	}

	export interface EditorLine {
		number: string;
		kind: 'position' | 'titel';
		text: string;
		quantity: number | null;
		unit: string;
		unitPrice: number | null;
		offerLineId?: number | null;
		offerQuantity?: number | null;
		source?: string;
	}
</script>

<script lang="ts">
	/**
	 * Rechnung schreiben bzw. ändern: Kopf (Datum, Zahlungsziel, Leistungszeitraum,
	 * Kunde), Positionen mit Menge und Einheitspreis, Texte und Summen.
	 *
	 * Bei einer neuen Rechnung steht oben die Zuordnung: je Mengenspalte aus den
	 * Tagesberichten die Angebotsposition, deren Preis gilt. Ändert sich eine
	 * Zuordnung, bekommen die betroffenen Positionen ihre Menge neu.
	 */
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import { addDays, isValidIsoDate } from '$lib/modules/stunden/week';
	import { amountInput, invoiceTotals, lineTotal, money, OFFER_UNITS, parseAmount, quantityLabel, REVERSE_CHARGE_NOTE } from '../offer';
	import { invoiceLines, type Mapping, type PricedLine, type SummaryColumn } from '../summary';

	interface Props {
		head: EditorHead;
		lines: EditorLine[];
		paymentDays: number;
		/** Nur bei einer neuen Rechnung: Spalten aus den Tagesberichten und die Angebotspositionen */
		mapping?: { columns: SummaryColumn[]; priced: PricedLine[]; initial: Mapping } | null;
		busy?: boolean;
		submitLabel: string;
		message?: string;
	}
	let { head: initialHead, lines: initialLines, paymentDays, mapping = null, busy = false, submitLabel, message = '' }: Props = $props();

	type Line = { key: number; number: string; kind: 'position' | 'titel'; text: string; quantity: string; unit: string; price: string; offerLineId: number | null; offerQuantity: number | null; source: string };

	let nextKey = 1;
	const qtyInput = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
	// Die Vorgaben werden nur beim Öffnen übernommen – danach gehört der Stand dem Formular
	// svelte-ignore state_referenced_locally
	let head = $state({ ...initialHead, vat: String(initialHead.vatRate).replace('.', ',') });
	// svelte-ignore state_referenced_locally
	let lines = $state<Line[]>(
		initialLines.map((l) => ({
			key: nextKey++,
			number: l.number,
			kind: l.kind,
			text: l.text,
			quantity: qtyInput(l.quantity),
			unit: l.unit,
			price: amountInput(l.unitPrice),
			offerLineId: l.offerLineId ?? null,
			offerQuantity: l.offerQuantity ?? null,
			source: l.source ?? ''
		}))
	);
	// svelte-ignore state_referenced_locally
	let assigned = $state<Record<string, string>>(
		Object.fromEntries((mapping?.columns ?? []).map((c) => [c.key, mapping!.initial[c.key] === null ? 'nein' : mapping!.initial[c.key] == null ? '' : String(mapping!.initial[c.key])]))
	);
	/** Zahlbar bis folgt dem Rechnungsdatum, bis es jemand selbst ändert */
	let dueTouched = $state(false);

	const parsed = $derived(lines.map((l) => ({ kind: l.kind, quantity: parseAmount(l.quantity), unitPrice: parseAmount(l.price) })));
	const totals = $derived(invoiceTotals(parsed, parseAmount(head.vat) ?? 0, head.reverseCharge));
	const openColumns = $derived((mapping?.columns ?? []).filter((c) => !assigned[c.key]).length);

	function onDate() {
		if (!dueTouched && isValidIsoDate(head.date)) head.dueDate = addDays(head.date, paymentDays);
	}

	/** Zuordnung geändert: betroffene Positionen bekommen Menge und Herkunft neu */
	function remap() {
		if (!mapping) return;
		const current: Mapping = {};
		for (const [k, v] of Object.entries(assigned)) current[k] = v === 'nein' ? null : v ? Number(v) : undefined;
		const drafts = new Map(invoiceLines(mapping.priced, mapping.columns, current).map((d) => [d.offerLineId, d]));
		for (const l of lines) {
			if (l.offerLineId == null || l.kind !== 'position') continue;
			const d = drafts.get(l.offerLineId);
			if (!d || d.source === l.source) continue;
			l.quantity = qtyInput(d.quantity);
			l.source = d.source;
		}
	}

	function addLine() {
		lines.push({ key: nextKey++, number: '', kind: 'position', text: '', quantity: '', unit: '', price: '', offerLineId: null, offerQuantity: null, source: '' });
	}
	function removeLine(key: number) {
		lines = lines.filter((l) => l.key !== key);
	}

	const positionLabel = (p: PricedLine, nr: string) => `${nr} ${p.text.split('\n')[0].slice(0, 60)}${p.unit ? ` (${p.unit})` : ''}`;
	const pricedNumbers = $derived.by(() => {
		const map = new Map<number, string>();
		for (const l of initialLines) if (l.offerLineId != null) map.set(l.offerLineId, l.number);
		return map;
	});
</script>

{#if mapping}
	<section class="card mb-4 p-4 lg:p-5">
		<h2 class="text-lg">Mengen aus den Tagesberichten</h2>
		{#if mapping.columns.length}
			<p class="mt-1 text-sm text-ink-2">
				Je Spalte der Berichte die Position aus dem Angebot wählen – deren Preis gilt. Die Zuordnung merkt sich der Auftrag.
				{#if openColumns}<span class="font-medium text-warn">Noch {openColumns} ohne Zuordnung.</span>{/if}
			</p>
			<ul class="mt-3 divide-y divide-line rounded-xl border border-line">
				{#each mapping.columns as c (c.key)}
					<li class="grid items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)]">
						<span class="min-w-0">
							<span class="num font-semibold">{c.lbPos || 'ohne LB-Pos.'}</span>
							<span class="text-ink-3"> · {c.unit || 'ohne Einheit'}</span>
							<span class="num block text-sm text-ink-2">Summe {quantityLabel(c.total)} {c.unit}</span>
						</span>
						<ArrowRight size={16} class="hidden text-ink-3 sm:block" aria-hidden="true" />
						<select class="select {assigned[c.key] ? '' : 'border-warn'}" name="m.{c.key}" bind:value={assigned[c.key]} onchange={remap} aria-label="Position für {c.lbPos} {c.unit}">
							<option value="">Bitte wählen …</option>
							{#each mapping.priced.filter((p) => p.kind === 'position') as p (p.id)}
								<option value={String(p.id)}>{positionLabel(p, pricedNumbers.get(p.id) ?? '')}</option>
							{/each}
							<option value="nein">Nicht abrechnen</option>
						</select>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-1 text-sm text-ink-2">Keine geprüften Tagesberichte mit Mengen – die Mengen hier unten selbst eintragen.</p>
		{/if}
	</section>
{/if}

<div class="grid gap-4 lg:grid-cols-2">
	<section class="card p-4 lg:p-5">
		<h2 class="text-lg">Kunde</h2>
		<div class="mt-3 grid gap-3 sm:grid-cols-6">
			<label class="block sm:col-span-6">
				<span class="field-label">Firma bzw. Name *</span>
				<input class="input" name="k_name" required maxlength="160" bind:value={head.customerName} />
			</label>
			<label class="block sm:col-span-6">
				<span class="field-label">Zusatz</span>
				<input class="input" name="k_zusatz" maxlength="160" bind:value={head.customerAddition} />
			</label>
			<label class="block sm:col-span-6">
				<span class="field-label">Straße</span>
				<input class="input" name="k_strasse" maxlength="160" bind:value={head.customerStreet} />
			</label>
			<label class="block sm:col-span-2">
				<span class="field-label">PLZ</span>
				<input class="input num" name="k_plz" maxlength="12" bind:value={head.customerZip} />
			</label>
			<label class="block sm:col-span-4">
				<span class="field-label">Ort</span>
				<input class="input" name="k_ort" maxlength="120" bind:value={head.customerCity} />
			</label>
			<label class="block sm:col-span-3">
				<span class="field-label">UID-Nummer{head.reverseCharge ? ' *' : ''}</span>
				<input class="input num" name="k_uid" maxlength="30" required={head.reverseCharge} bind:value={head.customerUid} />
			</label>
		</div>
	</section>

	<section class="card p-4 lg:p-5">
		<h2 class="text-lg">Rechnung</h2>
		<div class="mt-3 grid grid-cols-2 gap-3">
			<label class="block">
				<span class="field-label">Rechnungsdatum *</span>
				<input class="input num" type="date" name="datum" required bind:value={head.date} oninput={onDate} />
			</label>
			<label class="block">
				<span class="field-label">Zahlbar bis *</span>
				<input class="input num" type="date" name="faellig" required bind:value={head.dueDate} oninput={() => (dueTouched = true)} />
			</label>
			<label class="block">
				<span class="field-label">Leistung von</span>
				<input class="input num" type="date" name="von" bind:value={head.serviceFrom} />
			</label>
			<label class="block">
				<span class="field-label">Leistung bis</span>
				<input class="input num" type="date" name="bis" bind:value={head.serviceTo} />
			</label>
			<label class="col-span-2 block">
				<span class="field-label">Bauvorhaben (BV)</span>
				<textarea class="textarea auto" name="titel" rows="1" maxlength="300" bind:value={head.title}></textarea>
			</label>
			<label class="col-span-2 block">
				<span class="field-label">Ausführungsort</span>
				<input class="input" name="ort" maxlength="300" bind:value={head.location} />
			</label>
			<label class="block">
				<span class="field-label">Projektnummer</span>
				<input class="input num" name="projekt" maxlength="30" bind:value={head.projectNumber} />
			</label>
			<label class="block">
				<span class="field-label">Umsatzsteuer in %</span>
				<input class="input num" name="ust" inputmode="decimal" maxlength="6" required bind:value={head.vat} disabled={head.reverseCharge} />
				{#if head.reverseCharge}<input type="hidden" name="ust" value={head.vat} />{/if}
			</label>
			<label class="col-span-2 flex items-start gap-2.5 rounded-xl bg-surface-2 p-3">
				<input type="checkbox" class="mt-0.5 size-5 shrink-0 accent-[var(--c-ink)]" name="reverse" bind:checked={head.reverseCharge} />
				<span>
					<span class="block font-medium">Übergang der Steuerschuld (Reverse Charge)</span>
					<span class="block text-[0.8125rem] text-ink-3">Bauleistung an ein Bauunternehmen – ohne Umsatzsteuer, mit Hinweis und UID des Kunden: „{REVERSE_CHARGE_NOTE}"</span>
				</span>
			</label>
		</div>
	</section>
</div>

<section class="card mt-4 p-4 lg:p-5">
	<label class="block">
		<span class="field-label">Einleitung</span>
		<textarea class="textarea auto" name="einleitung" rows="2" maxlength="3000" bind:value={head.intro}></textarea>
	</label>
</section>

<section class="card mt-4 p-4 lg:p-5">
	<h2 class="text-lg">Positionen</h2>
	<p class="mt-1 text-sm text-ink-2">Positionen ohne Menge kommen nicht auf die Rechnung, Überschriften nur, wenn darunter etwas steht.</p>
	<div class="mt-3 hidden gap-2 text-[0.8125rem] text-ink-3 xl:grid xl:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6.5rem_7rem_7rem_2.25rem]">
		<span>Nr.</span><span>Bezeichnung</span><span class="text-right">Menge</span><span>Einheit</span><span class="text-right">EP in €</span><span class="text-right">GP</span><span></span>
	</div>
	<ul class="mt-1 divide-y divide-line">
		{#each lines as l, i (l.key)}
			{@const empty = l.kind === 'position' && !parsed[i].quantity}
			<li class="py-2.5 {empty ? 'opacity-60 focus-within:opacity-100' : ''}">
				<input type="hidden" name="z.{i}.art" value={l.kind} />
				<input type="hidden" name="z.{i}.nr" value={l.number} />
				{#if l.kind === 'titel'}
					<div class="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2">
						<span class="num font-semibold">{l.number}</span>
						<input class="input font-semibold" name="z.{i}.text" maxlength="300" bind:value={l.text} aria-label="Überschrift Zeile {i + 1}" />
					</div>
				{:else}
					<div class="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] gap-2 xl:grid-cols-[2.5rem_minmax(0,1fr)_6rem_6.5rem_7rem_7rem_2.25rem] xl:items-start">
						<span class="num pt-2 text-sm">{l.number}</span>
						<div class="min-w-0">
							<textarea class="textarea auto min-h-10 py-2 font-medium" name="z.{i}.text" rows="1" maxlength="4000" bind:value={l.text} aria-label="Bezeichnung Zeile {i + 1}"></textarea>
							{#if l.source || l.offerQuantity != null}
								<p class="mt-1 text-[0.75rem] text-ink-3">
									{[l.source && `Menge aus ${l.source}`, l.offerQuantity != null && `lt. Angebot ${quantityLabel(l.offerQuantity)} ${l.unit}`].filter(Boolean).join(' · ')}
								</p>
							{/if}
						</div>
						<button type="button" class="grid size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-danger xl:hidden" aria-label="Zeile {i + 1} entfernen" onclick={() => removeLine(l.key)}>
							<X size={16} />
						</button>
						<div class="col-span-3 grid grid-cols-4 gap-2 xl:contents">
							<label class="block">
								<span class="field-label xl:sr-only">Menge</span>
								<input class="input num text-right" name="z.{i}.menge" inputmode="decimal" maxlength="14" bind:value={l.quantity} />
							</label>
							<label class="block">
								<span class="field-label xl:sr-only">Einheit</span>
								<input class="input" name="z.{i}.einheit" maxlength="20" list="rechnung-einheiten" bind:value={l.unit} />
							</label>
							<label class="block">
								<span class="field-label xl:sr-only">EP in €</span>
								<input class="input num text-right" name="z.{i}.preis" inputmode="decimal" maxlength="14" bind:value={l.price} />
							</label>
							<div class="block">
								<span class="field-label xl:sr-only">GP</span>
								<p class="num py-2 text-right font-medium">{money(lineTotal(parsed[i])) || '–'}</p>
							</div>
						</div>
						<button type="button" class="hidden size-9 place-items-center rounded-lg text-ink-3 hover:bg-surface-3 hover:text-danger xl:grid" aria-label="Zeile {i + 1} entfernen" onclick={() => removeLine(l.key)}>
							<X size={16} />
						</button>
					</div>
				{/if}
			</li>
		{/each}
	</ul>
	<datalist id="rechnung-einheiten">{#each OFFER_UNITS as u (u)}<option value={u}></option>{/each}</datalist>
	<button type="button" class="btn btn-secondary btn-sm mt-3" onclick={addLine}><Plus size={16} aria-hidden="true" />Position</button>

	<dl class="num mt-4 ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 border-t border-line pt-3">
		<dt>Gesamt Netto</dt>
		<dd class="text-right">{money(totals.net)}</dd>
		{#if !head.reverseCharge}
			<dt>{head.vat || '0'} % Umsatzsteuer</dt>
			<dd class="text-right">{money(totals.vat)}</dd>
		{/if}
		<dt class="border-t border-ink pt-1.5 text-lg font-semibold">Gesamtbetrag</dt>
		<dd class="border-t border-ink pt-1.5 text-right text-lg font-semibold">{money(totals.gross)}</dd>
	</dl>
</section>

<section class="card mt-4 p-4 lg:p-5">
	<label class="block">
		<span class="field-label">Schlusstext</span>
		<textarea class="textarea auto" name="schluss" rows="2" maxlength="5000" bind:value={head.closing}></textarea>
	</label>
	<p class="mt-2 text-[0.8125rem] text-ink-3">Darüber steht auf der Rechnung „Zahlbar bis … ohne Abzug"; die Bankverbindung steht in der Fußzeile.</p>
</section>

<div class="card sticky bottom-24 mt-4 flex flex-wrap items-center gap-3 p-3 lg:bottom-6">
	<button class="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : submitLabel}</button>
	<span class="num text-sm text-ink-2">Gesamtbetrag {money(totals.gross)}</span>
	{#if message}<p class="w-full text-sm text-danger" role="alert">{message}</p>{/if}
</div>
