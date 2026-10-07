<script lang="ts">
	/**
	 * Der Tagesbericht im Aufbau des Vordrucks aus dem Block – für die
	 * Druckansicht und die Seite des Kunden. Intern kommen Kostenstelle und
	 * Notiz dazu. Am Bildschirm in den Farben der Umgebung, gedruckt schwarz auf weiß.
	 */
	import { dateTime } from '$lib/format';
	import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
	import { spacedNumber } from '$lib/modules/auftraege/offer';
	import { columnSums, LETTERHEAD, quantityLabel, reportDateLabel, SHEET_MATERIAL_ROWS, sheets, sumLabel } from '../sheet';

	interface Report {
		number: string;
		date: string;
		dateTo: string | null;
		/** Nummer des Auftrags, zu dem der Bericht gehört */
		orderNumber?: string | null;
		road: string;
		site: string;
		costCenter: string;
		dailyOutput: string;
		lvPosition: string;
		note: string;
		positions: { lbPos: string; unit: string; totalQuantity: number | null }[];
		rows: { id: number; label: string; quantities: (number | null)[] }[];
		materials: { material: string; code: string; filmThickness: string }[];
		releaseSignature: string | null;
		releasedAt: Date | null;
		releasedByFirst: string | null;
		releasedByLast: string | null;
		customerName: string | null;
		customerSignature: string | null;
		customerSignedAt: Date | null;
	}
	interface Props {
		report: Report;
		/** Kostenstelle und Notiz zeigen – nicht für den Kunden */
		internal?: boolean;
	}
	let { report, internal = true }: Props = $props();

	const blaetter = $derived(sheets(report.positions, report.rows, report.materials.length));
	const sums = $derived(columnSums(report.rows, report.positions.length));
	/** Der Materialblock hat mindestens die drei Zeilen des Vordrucks */
	const materialRows = $derived(
		Array.from({ length: Math.max(SHEET_MATERIAL_ROWS, report.materials.length) }, (_, i) => report.materials[i] ?? null)
	);
	const releaser = $derived([report.releasedByFirst, report.releasedByLast].filter(Boolean).join(' '));
	/** Auftrag für alle, Kostenstelle nur intern */
	const extra = $derived(
		[report.orderNumber && `Auftrag Nr. ${spacedNumber(report.orderNumber)}`, internal && report.costCenter && `Kostenstelle: ${report.costCenter}`]
			.filter(Boolean)
			.join(' · ')
	);
	/** Unter „Einheitssumme" stehen Gesamtmenge, Tagesleistung und LV-Position */
	const LABELS = ['Gesamtmenge', 'Tagesleistung', 'LV-Position Nr.'];

	/** Lange Ortsbezeichnungen etwas kleiner, damit sie in der Zeile bleiben */
	const fit = (text: string) => (text.length > 95 ? '6pt' : text.length > 70 ? '7pt' : undefined);
	/** Die LB-Spalten sind schmal – längere Nummern und Einheiten werden kleiner geschrieben */
	const fitLb = (text: string) => (text.length > 10 ? '5.5pt' : text.length > 8 ? '6.3pt' : text.length > 6 ? '7.3pt' : undefined);
	/** Kenn-Nr. ist der Artikelname – er darf in seiner Spalte bis zu vier Zeilen haben */
	const fitKenn = (text: string) =>
		text.length > 52 ? '4.5pt' : text.length > 42 ? '5pt' : text.length > 24 ? '5.5pt' : text.length > 18 ? '6.5pt' : undefined;
	/** Filmdicke ist frei – in der schmalen Spalte darf längerer Text kleiner werden und umbrechen */
	const fitFilm = (text: string) => (text.length > 24 ? '4.5pt' : text.length > 14 ? '5.5pt' : text.length > 7 ? '6.5pt' : undefined);
	const hasQuantity = (v: number | null | undefined) => v != null && Number.isFinite(v);
</script>

{#snippet signBlock(label: string, path: string | null, who: string, at: Date | null)}
	<div class="sign-block">
		<div class="sign-bild">
			{#if path && at}
				<svg viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}" role="img" aria-label="Unterschrift {who}">
					<path d={path} fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			{/if}
		</div>
		<span class="sign">{label}</span>
		{#if path && at}<span class="sign-info">{[who, dateTime(at)].filter(Boolean).join(', ')}</span>{/if}
	</div>
{/snippet}

{#each blaetter as blatt (blatt.number)}
	<section class="blatt" aria-label={blatt.count > 1 ? `Blatt ${blatt.number} von ${blatt.count}` : undefined}>
		<header class="kopf">
			<div class="brief">
				<span class="marke">{LETTERHEAD.brand}</span>
				{#each LETTERHEAD.lines as line (line)}<span class="zeile">{line}</span>{/each}
			</div>
			<h2 class="titel">Tagesbericht</h2>
			<p class="vom"><span>vom</span><span class="linie">{reportDateLabel(report.date, report.dateTo)}</span></p>
			<p class="nr"><span>Nr.</span><span class="linie">{report.number}</span></p>
			<!-- Steht nicht auf dem Vordruck: die Baustelle groß unter dem Briefkopf -->
			<p class="baustelle"><span>Baustelle:</span><span class="linie">{report.site}</span></p>
			{#if extra || blatt.count > 1}
				<p class="extra">
					{extra}{#if blatt.count > 1}<span class="blatt-nr">Blatt {blatt.number} von {blatt.count}</span>{/if}
				</p>
			{/if}
			<div class="strasse">
				<span class="klein">Bundesstraße Nr.</span>
				<span class="strasse-wert">{report.road}</span>
			</div>
		</header>

		<table class="raster">
			<colgroup>
				<col class="w-mat" />
				<col class="w-kenn" />
				<col class="w-film" />
				<col class="w-label" />
				{#each blatt.columns as _, i (i)}<col class="w-lb" />{/each}
			</colgroup>
			<thead>
				<tr>
					<th colspan="4" class="ort">Ortsbezeichnungen und<br />Markierungsarten</th>
					{#each blatt.columns as col, i (i)}
						<th class="lb">
							<span class="lb-k">LB-Pos.</span>
							<span class="lb-v num" style:font-size={fitLb(col?.position.lbPos ?? '')}>{col?.position.lbPos ?? ''}</span>
							<span class="lb-dl"></span>
							<span class="lb-e">Einheit</span>
							<span class="lb-u" style:font-size={fitLb(col?.position.unit ?? '')}>{col?.position.unit ?? ''}</span>
							<span class="lb-l"></span>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each blatt.rows as row, r (r)}
					<tr class="zeile-k">
						<td colspan="4" class="ort-zeile" style:font-size={row ? fit(row.label) : undefined}>{row?.label ?? ''}</td>
						{#each blatt.columns as col, i (i)}
							<td class="num menge">{row && col && hasQuantity(row.quantities[col.index]) ? quantityLabel(row.quantities[col.index]) : ''}</td>
						{/each}
					</tr>
				{/each}

				<tr class="fuss">
					<th class="mh">Material</th>
					<th class="mh">Kenn-Nr.</th>
					<th class="mh">Filmdicke<br />in mm</th>
					<th class="fl">Einheitssumme</th>
					{#each blatt.columns as col, i (i)}
						<td class="num summe">{col ? sumLabel(sums[col.index]) : ''}</td>
					{/each}
				</tr>
				{#each materialRows as m, i (i)}
					<tr class="fuss">
						<td class="mat">{m?.material ?? ''}</td>
						<td class="mat kenn"><span style:font-size={m ? fitKenn(m.code) : undefined}>{m?.code ?? ''}</span></td>
						<td class="mat kenn num"><span style:font-size={m ? fitFilm(m.filmThickness) : undefined}>{m?.filmThickness ?? ''}</span></td>
						<th class="fl">{LABELS[i] ?? ''}</th>
						{#if i === 0}
							{#each blatt.columns as col, c (c)}
								<td class="num summe">{col ? quantityLabel(col.position.totalQuantity) : ''}</td>
							{/each}
						{:else if i === 1}
							<td colspan={blatt.columns.length} class="lang">{report.dailyOutput}</td>
						{:else if i === 2}
							<td colspan={blatt.columns.length} class="lang">{report.lvPosition}</td>
						{:else}
							<td colspan={blatt.columns.length}></td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>

		{#if internal && report.note}<p class="notiz">Notiz: {report.note}</p>{/if}

		<footer class="unterschriften">
			{@render signBlock('Für den Auftragnehmer', report.releaseSignature, releaser, report.releasedAt)}
			{@render signBlock('Für den Auftraggeber', report.customerSignature, report.customerName ?? '', report.customerSignedAt)}
		</footer>
	</section>
{/each}

<style>
	/*
	 * Maße vom Vordruck abgenommen (Scan mit 300 dpi): Spaltenanteile der
	 * Tabellenbreite, Höhen in mm. Ein Blatt passt mit den Rändern der App auf A4.
	 * Abweichung: Die Kenn-Nr. ist breiter (der Artikelname steht drin), die
	 * Filmdicke dafür schmaler – sie hat nur kurze Zahlen.
	 */
	.blatt {
		/* Am Bildschirm in den Farben der App, auf Papier schwarz auf weiß */
		color: var(--c-ink);
		--rahmen: var(--c-line-strong);
		font-family: Arial, Helvetica, sans-serif;
		max-width: 200mm;
		margin: 0 auto;
	}
	.blatt + .blatt {
		margin-top: 2.5rem;
		break-before: page;
	}

	/* ------------------------------------------------------------ Kopf */
	.kopf {
		position: relative;
		height: 35.5mm;
	}
	.brief {
		position: absolute;
		top: 0;
		left: 0;
		width: 34.8%;
		height: 20mm;
		display: flex;
		flex-direction: column;
		/* Oben ausgerichtet: was nicht ganz hineinpasst, ragt nach unten statt über den Seitenrand */
		justify-content: flex-start;
		padding: 0 2mm 0 0;
		border-right: 1px solid var(--rahmen);
		border-bottom: 1px solid var(--rahmen);
		font-size: 8.5pt;
		line-height: 1.12;
	}
	.marke {
		font-size: 12.5pt;
		line-height: 1;
		letter-spacing: 0.62em;
		margin-bottom: 0.8mm;
	}
	.zeile {
		white-space: nowrap;
	}
	.titel {
		position: absolute;
		top: 0;
		left: 38.6%;
		margin: 0;
		font-family: inherit;
		font-size: 25pt;
		font-weight: 400;
		line-height: 1.1;
		letter-spacing: 0;
	}
	.vom,
	.nr {
		position: absolute;
		display: flex;
		align-items: baseline;
		gap: 1.5mm;
		margin: 0;
	}
	.vom {
		top: 14.5mm;
		left: 38.6%;
		width: 33%;
		font-size: 9.5pt;
	}
	.nr {
		top: 5mm;
		right: 0;
		width: 18%;
		font-size: 19pt;
	}
	.linie {
		flex: 1;
		min-height: 1.2em;
		border-bottom: 1px solid var(--rahmen);
		text-align: center;
		white-space: nowrap;
		overflow: hidden;
	}
	.vom .linie {
		font-size: 10.5pt;
	}
	.nr .linie {
		font-size: 13pt;
	}
	.baustelle {
		position: absolute;
		top: 22mm;
		left: 0;
		width: 84%;
		display: flex;
		align-items: baseline;
		gap: 1.5mm;
		margin: 0;
		font-size: 10pt;
	}
	.baustelle .linie {
		padding-left: 0.6mm;
		text-align: left;
		font-size: 14pt;
		font-weight: 700;
		text-overflow: ellipsis;
	}
	.extra {
		position: absolute;
		top: 30.3mm;
		left: 0;
		width: 82%;
		margin: 0;
		font-size: 8.5pt;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.blatt-nr {
		margin-left: 3mm;
		font-weight: 700;
	}
	.strasse {
		position: absolute;
		top: 21.8mm;
		right: 0;
		width: 13.2%;
		height: 12.5mm;
		display: flex;
		flex-direction: column;
		align-items: center;
		border: 1px solid var(--rahmen);
		padding: 0.6mm 1mm 0;
		overflow: hidden;
	}
	.klein {
		font-size: 6.5pt;
		white-space: nowrap;
	}
	.strasse-wert {
		margin-top: 1mm;
		font-size: 11pt;
		font-weight: 700;
		white-space: nowrap;
	}

	/* ----------------------------------------------------------- Raster */
	.raster {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
		border: 1.5px solid var(--rahmen);
	}
	.w-mat {
		width: 8.13%;
	}
	.w-kenn {
		width: 12.24%;
	}
	.w-film {
		width: 7.24%;
	}
	.w-label {
		width: 20.36%;
	}
	.w-lb {
		width: 6.5%;
	}
	.raster th,
	.raster td {
		border: 1px solid var(--rahmen);
		padding: 0 1mm;
		font-weight: 400;
		overflow: hidden;
		white-space: nowrap;
	}
	.raster thead th {
		height: 19mm;
		border-bottom-width: 1.5px;
	}
	.ort {
		text-align: center;
		font-size: 12.5pt;
		line-height: 1.25;
	}
	/* Kopf einer LB-Spalte: „LB-Pos.", Doppellinie, „Einheit", Linie */
	.lb {
		position: relative;
		padding: 0 !important;
	}
	.lb > span {
		position: absolute;
		left: 6%;
		right: 6%;
		text-align: center;
	}
	.lb-k,
	.lb-e {
		font-size: 6.5pt;
	}
	.lb-k {
		top: 4%;
	}
	.lb-v {
		top: 16%;
		font-size: 9pt;
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lb-dl {
		top: 36%;
		height: 1.1mm;
		border-top: 1px solid var(--rahmen);
		border-bottom: 1px solid var(--rahmen);
	}
	.lb-e {
		top: 47%;
	}
	.lb-u {
		top: 63%;
		font-size: 9pt;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.lb-l {
		top: 88%;
		border-top: 1px solid var(--rahmen);
	}
	/* 33 Zeilen à 4,6 mm – so bleibt das Blatt mit Notiz und Unterschriften auf einer A4-Seite */
	.zeile-k td {
		height: 4.6mm;
		font-size: 8.5pt;
		line-height: 1;
	}
	.ort-zeile {
		text-overflow: ellipsis;
	}
	.menge {
		text-align: center;
	}
	.fuss > * {
		height: 7mm;
	}
	.mh {
		font-size: 6.5pt;
		line-height: 1.15;
		text-align: center;
	}
	.mat {
		font-size: 8pt;
		text-overflow: ellipsis;
	}
	.kenn span {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
		white-space: normal;
		overflow-wrap: anywhere;
		line-height: 1.05;
	}
	.fl {
		text-align: right;
		font-size: 12.5pt;
		padding-right: 1.8mm !important;
	}
	.summe {
		text-align: center;
		font-size: 9pt;
		font-weight: 700;
	}
	.lang {
		font-size: 9.5pt;
		padding-left: 2mm !important;
		text-overflow: ellipsis;
	}
	.notiz {
		margin: 1.5mm 0 0;
		font-size: 8pt;
		white-space: pre-line;
		max-height: 7mm;
		overflow: hidden;
	}

	/* ---------------------------------------------------- Unterschriften */
	.unterschriften {
		display: flex;
		justify-content: space-between;
		margin-top: 3mm;
		/* Platz für Name und Datum unter der Linie */
		padding-bottom: 3.5mm;
	}
	.sign-block {
		position: relative;
		display: flex;
		width: 32.4%;
		flex-direction: column;
	}
	.sign-bild {
		height: 11mm;
	}
	.sign-bild svg {
		display: block;
		height: 100%;
		width: 100%;
	}
	.sign {
		border-top: 1px solid var(--rahmen);
		padding-top: 0.6mm;
		text-align: center;
		font-size: 7pt;
	}
	/* Hängt unter der Linie, damit beide Linien auf einer Höhe bleiben */
	.sign-info {
		position: absolute;
		top: 100%;
		right: 0;
		left: 0;
		text-align: center;
		font-size: 6.5pt;
		opacity: 0.75;
	}

	@media print {
		.blatt {
			color: #000;
			--rahmen: #000;
			max-width: none;
		}
		.blatt + .blatt {
			margin-top: 0;
		}
	}
</style>
