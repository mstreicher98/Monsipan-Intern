<script lang="ts">
	import { APP_NAME, pageTitle } from '$lib/app';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import CircleHelp from '@lucide/svelte/icons/circle-help';
	import Keyboard from '@lucide/svelte/icons/keyboard';
	import Copy from '@lucide/svelte/icons/copy';
	import { onScan, onScanReport, type WedgeScan } from '$lib/modules/lager/scan/wedge';
	import { WEDGE_TIMING, type KeyInput, type SequenceReport, type Verdict } from '$lib/modules/lager/scan/detector';
	import { strokeReadings, type Layout } from '$lib/modules/lager/scan/layout';
	import { lookupScan } from '$lib/modules/lager/scan/lookup';
	import { parseScan } from '$lib/modules/lager/scan/parse';
	import { scanner } from '$lib/modules/lager/scan/scanner.svelte';
	import { feedbackError, feedbackSuccess } from '$lib/modules/lager/scan/feedback';
	import { toast } from '$lib/stores/toast.svelte';
	import type { LookupResult } from '$lib/modules/lager/types';

	interface Entry {
		id: number;
		scan: WedgeScan;
		result: LookupResult | null;
		at: Date;
	}
	interface ReportEntry {
		id: number;
		report: SequenceReport;
		at: Date;
	}
	let entries = $state<Entry[]>([]);
	let reports = $state.raw<ReportEntry[]>([]);
	let n = 0;

	const FIELD_LABELS: Record<string, string> = {
		name: 'Bezeichnung',
		article: 'Artikelnummer',
		ean: 'EAN',
		sap: 'SAP-Nummer',
		batch: 'Charge',
		content: 'Inhalt',
		packageSize: 'Menge',
		unit: 'Einheit',
		productionDate: 'Produziert',
		expiryDate: 'Haltbar bis',
		color: 'Farbe (erkannt)',
		category: 'Materialart (erkannt)',
		reference: 'Liefer-/Palettennummer'
	};
	const FORMAT_LABELS = {
		gtin: 'EAN / GTIN',
		gs1: 'GS1-Code',
		kv: 'Hersteller-DataMatrix',
		swarco: 'SWARCO-Palettenetikett',
		text: 'Text / Nummer'
	};
	const SOURCE_LABELS = { wedge: 'Handscanner', camera: 'Kamera', manual: 'Eingabe' };
	const LAYOUT_LABELS: Record<Layout, string> = { os: 'Wie vom PC gelesen', us: 'US-Layout', de: 'DE-Layout' };
	const END_LABELS = { enter: 'Enter', tab: 'Tab', pause: 'Pause (kein Enter)', abbruch: 'Abbruch' };

	const VERDICTS: Record<Verdict, { label: string; tone: 'ok' | 'warn' | 'danger'; hint?: string }> = {
		scan: { label: 'Als Scan erkannt', tone: 'ok' },
		'zu-langsam': {
			label: 'Nicht erkannt: Zeichen kamen zu langsam',
			tone: 'warn',
			hint: `Scanner schicken normalerweise alle paar Millisekunden ein Zeichen. Erwartet werden höchstens ${WEDGE_TIMING.maxMedianGap} ms typischer Abstand. Falls der Scanner eine Einstellung für die Übertragungsgeschwindigkeit hat: auf schnell stellen.`
		},
		'zu-kurz': { label: 'Nicht erkannt: zu wenige Zeichen', tone: 'warn', hint: `Ein Scan braucht mindestens ${WEDGE_TIMING.minLength} Zeichen.` },
		textfeld: { label: 'Als Text im Eingabefeld gelassen', tone: 'warn' },
		abgebrochen: {
			label: 'Abgebrochen',
			tone: 'danger',
			hint: 'Mitten im Code kam eine Taste, die kein Zeichen ist. Meist ist ein Präfix, eine Steuertaste oder ein falsches Tastaturlayout am Scanner eingestellt.'
		},
		'ohne-abschluss': {
			label: 'Kein Enter am Ende',
			tone: 'warn',
			hint: `Am Scanner als Abschluss (Suffix) „Enter“ einstellen. Ohne Enter werden nur Codes ab ${WEDGE_TIMING.minLengthNoSuffix} Zeichen nach einer kurzen Pause erkannt.`
		}
	};

	onMount(() => {
		const offScan = onScan(async (scan) => {
			const entry: Entry = { id: ++n, scan, result: null, at: new Date() };
			entries = [entry, ...entries].slice(0, 10);
			try {
				const r = await lookupScan(scan.variants);
				const e = entries.find((x) => x.id === entry.id);
				if (e) e.result = r;
				if (r.products.length) feedbackSuccess();
				else feedbackError();
			} catch {
				feedbackError();
			}
		});
		const offReport = onScanReport((report) => {
			reports = [{ id: ++n, report, at: new Date() }, ...reports].slice(0, 6);
		});
		return () => {
			offScan();
			offReport();
		};
	});

	const CONTROL_NAMES: Record<string, string> = { '\n': '⏎', '\t': '⇥', '\x1d': '⟨GS⟩', '\x1e': '⟨RS⟩', '\x1c': '⟨FS⟩', '\x04': '⟨EOT⟩', '\x1b': '⟨ESC⟩' };
	const show = (s: string) =>
		s.replace(/[\x00-\x1f]/g, (c) => CONTROL_NAMES[c] ?? `⟨0x${c.charCodeAt(0).toString(16).padStart(2, '0')}⟩`);

	const layoutLabel = (layouts: Layout[] | undefined, i: number) =>
		layouts ? layouts.map((l) => LAYOUT_LABELS[l]).join(' = ') : i === 0 ? 'Wie vom PC gelesen' : 'Umgerechnet';

	const MOD_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'NumLock']);

	interface Token {
		label: string;
		gap: number | null;
		special: boolean;
	}

	/** Tastenfolge kompakt darstellen: Umschalttasten als Präfix, Abstand in ms */
	function tokens(events: KeyInput[]): Token[] {
		const out: Token[] = [];
		let prev: number | null = null;
		for (const e of events) {
			if (e.type === 'up') {
				out.push({ label: 'Alt↑', gap: null, special: true });
				continue;
			}
			if (MOD_KEYS.has(e.key) || e.repeat) continue;
			const gap = prev === null ? null : Math.round(e.time - prev);
			prev = e.time;
			const ctrl = e.ctrl && !e.altGr;
			const base =
				e.key === 'Enter'
					? '⏎'
					: e.key === 'Tab'
						? '⇥'
						: e.key === ' '
							? '␣'
							: e.key === 'Dead'
								? `tot:${e.code}`
								: ctrl
									? e.code.replace(/^(Key|Digit)/, '')
									: e.key.length === 1
										? e.key
										: e.key || e.code || '?';
			const prefix = (ctrl ? 'Strg+' : '') + (e.altGr ? 'AltGr+' : e.alt ? 'Alt+' : '');
			const special = Boolean(prefix) || base.length > 1;
			out.push({ label: prefix + base, gap, special });
		}
		return out;
	}

	function gapClass(gap: number | null) {
		if (gap === null) return 'text-ink-3';
		if (gap > 300) return 'text-danger font-semibold';
		if (gap > WEDGE_TIMING.maxMedianGap) return 'text-warn font-semibold';
		return 'text-ink-3';
	}

	function protocol(r: ReportEntry): string {
		const { report } = r;
		const lines = [
			`${APP_NAME} – Scanner-Protokoll`,
			`Zeit: ${r.at.toLocaleString('de-AT')}`,
			`Browser: ${navigator.userAgent}`,
			`Ergebnis: ${VERDICTS[report.verdict].label}${report.note ? ` (${report.note})` : ''}`,
			`Ende: ${END_LABELS[report.end]} · ${report.stats.chars} Zeichen · ${report.stats.durationMs} ms · typischer Abstand ${report.stats.medianGapMs} ms · längste Pause ${report.stats.maxGapMs} ms`,
			...strokeReadings(report.strokes).map((x) => `${x.layouts.join('=')}: ${show(x.text)}`),
			'Tasten (Zeit ms, Taste, Code, Umschalttasten):'
		];
		const t0 = report.events[0]?.time ?? 0;
		for (const e of report.events) {
			const mods = [e.shift && 'Shift', e.ctrl && 'Ctrl', e.alt && 'Alt', e.altGr && 'AltGr', e.meta && 'Meta', e.repeat && 'repeat'].filter(Boolean).join('+');
			lines.push(`${(e.time - t0).toFixed(1).padStart(8)} ${e.type === 'up' ? '↑' : '↓'} ${JSON.stringify(e.key)} ${e.code}${mods ? ` [${mods}]` : ''}`);
		}
		return lines.join('\n');
	}

	async function copyProtocol(r: ReportEntry) {
		try {
			await navigator.clipboard.writeText(protocol(r));
			toast.success('Protokoll kopiert', 'Zum Beispiel in eine E-Mail oder einen Chat einfügen.');
		} catch {
			toast.error('Kopieren nicht möglich', 'Der Browser hat den Zugriff auf die Zwischenablage verweigert.');
		}
	}
</script>

<svelte:head><title>{pageTitle('Scanner testen')}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3 pt-2 pb-5">
	<div>
		<h1 class="text-[2rem] leading-tight">Scanner testen</h1>
		<p class="max-w-2xl text-ink-2">
			Einfach einen Code scannen. Die Seite zeigt, was der Scanner schickt, wie es zerlegt wird und welcher Artikel gefunden wurde. Kommt beim
			Handscanner Unsinn an, ist er vermutlich auf ein anderes Tastaturlayout eingestellt – die App gleicht das automatisch aus.
		</p>
	</div>
	<button class="btn btn-primary" onclick={() => scanner.openCamera({ mode: 'continuous', title: 'Scanner testen' })}>
		<ScanBarcode size={18} aria-hidden="true" />Mit Kamera testen
	</button>
</div>

{#if reports.length}
	<section class="card mb-4 p-4 lg:p-6" aria-labelledby="h-keys">
		<h2 id="h-keys" class="flex items-center gap-2 text-xl"><Keyboard size={20} aria-hidden="true" />Tastenprotokoll</h2>
		<p class="mt-1 text-sm text-ink-2">
			Was der Handscanner Taste für Taste geschickt hat – auch wenn es nicht als Scan erkannt wurde. Die kleinen Zahlen sind die Abstände in
			Millisekunden; auffällige Pausen sind markiert.
		</p>
		<ul class="mt-4 space-y-3">
			{#each reports as r, i (r.id)}
				{@const v = VERDICTS[r.report.verdict]}
				{@const readings = strokeReadings(r.report.strokes)}
				<li class="rounded-xl border border-line" in:fly={{ y: -6, duration: 200 }}>
					<details open={i === 0} class="group">
						<summary class="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
							<span class="badge {v.tone === 'ok' ? 'badge-ok' : v.tone === 'warn' ? 'badge-warn' : 'badge-danger'}">{v.label}</span>
							<span class="text-sm text-ink-2">
								{r.report.stats.chars} Zeichen · typisch {r.report.stats.medianGapMs} ms · längste Pause {r.report.stats.maxGapMs} ms · Ende: {END_LABELS[
									r.report.end
								]}
							</span>
							<span class="ml-auto text-sm text-ink-3">{r.at.toLocaleTimeString('de-AT')}</span>
						</summary>
						<div class="border-t border-line px-3 py-3">
							{#if r.report.note}<p class="text-sm font-medium">{r.report.note}</p>{/if}
							{#if v.hint}<p class="text-sm text-ink-2">{v.hint}</p>{/if}
							{#if readings.length}
								<dl class="mt-2 space-y-1 text-sm">
									{#each readings as x (x.text)}
										<div class="flex flex-wrap gap-x-2">
											<dt class="text-ink-3">{layoutLabel(x.layouts, 0)}:</dt>
											<dd class="num min-w-0 break-all">{show(x.text)}</dd>
										</div>
									{/each}
								</dl>
							{/if}
							{#if r.report.events.length}
								<ol class="mt-3 flex flex-wrap gap-1" aria-label="Tastenfolge">
									{#each tokens(r.report.events).slice(0, 300) as t, j (j)}
										<li class="flex flex-col items-center">
											<kbd class="num rounded-md border border-line px-1.5 py-0.5 text-[0.8125rem] {t.special ? 'bg-brand-soft' : 'bg-surface-2'}">{t.label}</kbd>
											<span class="num text-[0.6875rem] {gapClass(t.gap)}">{t.gap ?? '·'}</span>
										</li>
									{/each}
								</ol>
							{/if}
							<button class="btn btn-secondary btn-sm mt-3" onclick={() => copyProtocol(r)}>
								<Copy size={15} aria-hidden="true" />Protokoll kopieren
							</button>
						</div>
					</details>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if entries.length === 0}
	<div class="card flex flex-col items-center px-6 py-16 text-center">
		<span class="grid size-14 place-items-center rounded-2xl bg-surface-3 text-ink-3"><ScanBarcode size={28} aria-hidden="true" /></span>
		<p class="mt-4 text-lg font-medium">Warte auf den ersten Scan …</p>
		<p class="mt-1 text-ink-3">Handscanner: einfach auf ein Etikett zielen. Das Browserfenster muss dabei aktiv sein.</p>
	</div>
{/if}

<div class="space-y-4">
	{#each entries as e (e.id)}
		{@const best = e.result?.parsed ?? parseScan(e.scan.variants[0])}
		<section class="card p-4 lg:p-6" in:fly={{ y: -8, duration: 240 }}>
			<div class="flex flex-wrap items-center gap-2">
				<span class="badge">{SOURCE_LABELS[e.scan.source]}</span>
				<span class="badge badge-info">{FORMAT_LABELS[best.format]}</span>
				{#if e.result?.products.length}
					<span class="badge badge-ok">
						<CircleCheck size={13} aria-hidden="true" />
						{e.result.products.length === 1 ? 'Artikel gefunden' : `${e.result.products.length} Artikel mit diesem Code`}
					</span>
				{:else if e.result}
					<span class="badge badge-warn"><CircleHelp size={13} aria-hidden="true" />Kein Artikel</span>
				{/if}
				<span class="ml-auto text-sm text-ink-3">{e.at.toLocaleTimeString('de-AT')}</span>
			</div>

			{#if e.result?.products.length}
				<div class="mt-3">
					{#each e.result.products as p (p.id)}
						<a href="/lager/artikel/{p.id}" class="block text-lg font-semibold hover:underline">{p.name}</a>
					{/each}
					<p class="text-sm text-ink-3">
						Gefunden über Code {e.result.matched}{e.result.products.length > 1 ? ' – beim Scannen fragt die App nach' : ''}
					</p>
				</div>
			{/if}

			<div class="mt-4 grid gap-4 lg:grid-cols-2">
				<div>
					<h3 class="text-base">Empfangen</h3>
					<ul class="mt-2 space-y-2">
						{#each e.scan.variants as v, i (i)}
							<li class="rounded-xl border border-line p-2.5 {v === best.input ? 'border-ok bg-ok-soft/50' : ''}">
								<p class="text-[0.8125rem] text-ink-3">
									{e.scan.source !== 'wedge' ? 'Inhalt' : layoutLabel(e.scan.layouts?.[i], i)}{v === best.input && e.scan.variants.length > 1 ? ' – verwendet' : ''}
								</p>
								<p class="num mt-0.5 break-all">{show(v)}</p>
							</li>
						{/each}
					</ul>
				</div>
				<div>
					<h3 class="text-base">Zerlegt</h3>
					{#if Object.keys(best.fields).length}
						<dl class="mt-2 divide-y divide-line rounded-xl border border-line text-[0.9375rem]">
							{#each Object.entries(best.fields) as [k, v] (k)}
								{#if v !== undefined && v !== null && v !== ''}
									<div class="flex justify-between gap-4 px-3 py-2"><dt class="text-ink-3">{FIELD_LABELS[k] ?? k}</dt><dd class="text-right break-all">{v}</dd></div>
								{/if}
							{/each}
						</dl>
					{:else}
						<p class="mt-2 text-ink-3">Keine Felder – der Code wird als Ganzes gesucht.</p>
					{/if}
					<p class="mt-3 text-sm text-ink-3">Gesucht nach: <span class="num text-ink-2">{best.candidates.join(', ') || '–'}</span></p>
				</div>
			</div>
		</section>
	{/each}
</div>

<details class="card mt-4 p-4 lg:p-6">
	<summary class="cursor-pointer text-lg font-semibold">Tipps für Bluetooth-Handscanner</summary>
	<ul class="mt-3 list-disc space-y-1.5 pl-5 text-ink-2">
		<li>Als Abschluss (Suffix) <strong>Enter</strong> einstellen.</li>
		<li>Tastaturlayout am Scanner am besten auf <strong>Deutsch</strong> – dann kommen auch Umlaute wie in „GRÜN“ richtig an. Auf US gleicht die App y/z und Sonderzeichen aus, Umlaute kommen damit aber meist nicht an.</li>
		<li>Fehlen Zeichen oder sind sie vertauscht, die Übertragungsgeschwindigkeit am Scanner verringern (sofern einstellbar) – manche Geräte verschlucken sonst Zeichen.</li>
		<li>Handy: Solange ein Bluetooth-Scanner verbunden ist, blendet das Handy die Bildschirmtastatur meist aus. Bei Inateck lässt sie sich über den Scanner wieder einblenden (siehe Anleitung).</li>
		<li>Der Scanner tippt dorthin, wo gerade der Fokus ist. Auf „Buchen“ landet jeder Scan in der Liste – auch wenn gerade ein Mengenfeld aktiv ist.</li>
	</ul>
</details>
