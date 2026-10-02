<script lang="ts">
	/** Druckansicht im Aufbau des Lohnzettel-Formulars aus dem Block */
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { dateTime, fullName } from '$lib/format';
	import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH } from '$lib/modules/stunden/signature';
	import {
		hoursLabel,
		isoWeek,
		monthLabel,
		monthsOfWeek,
		timeRangeLabel,
		WEEKDAY_LABELS,
		weekdayIndex,
		weekDays
	} from '$lib/modules/stunden/week';

	let { data } = $props();
	const sheet = $derived(data.sheet);
	const t = $derived(data.totals);
	const week = $derived(isoWeek(sheet.weekStart));
	/** Das Raster zeigt immer alle sieben Tage; Tage des anderen Monats bleiben leer */
	const split = $derived(monthsOfWeek(sheet.weekStart).length > 1);
	const byDate = $derived(new Map(sheet.days.map((d) => [d.date, d])));
	const alleTage = $derived(weekDays(sheet.weekStart));
	const releaser = $derived([sheet.releasedByFirst, sheet.releasedByLast].filter(Boolean).join(' '));
	const checker = $derived([sheet.checkedByFirst, sheet.checkedByLast].filter(Boolean).join(' '));
	const checked = $derived(sheet.status === 'geprueft' && !!sheet.checkSignature && !!sheet.checkedAt);

	const HOURS = [
		{ key: 'normalHours', total: 'normal' },
		{ key: 'overtime50', total: 'o50' },
		{ key: 'overtime100', total: 'o100' },
		{ key: 'vacationHours', total: 'vacation' },
		{ key: 'holidayHours', total: 'holiday' },
		{ key: 'rainHours', total: 'rain' },
		{ key: 'sickHours', total: 'sick' }
	] as const;

	const date = (iso: string) => {
		const [y, m, d] = iso.split('-');
		return `${d}.${m}.${y}`;
	};
</script>

<svelte:head><title>{pageTitle(`Lohnzettel ${fullName(sheet)}`)}</title></svelte:head>

<PrintSheet title="Lohnzettel" back="/stundenzettel/{sheet.id}" bare>
	<div class="form">
		<header class="kopf">
			<span class="marke">MONSIPAN</span>
			<span class="titel">LOHNZETTEL</span>
			<span class="feld"><span class="klein">für</span><span class="wert">{fullName(sheet)}</span></span>
		</header>

		<div class="woche">
			<span class="feld breit">
				<span class="klein">Lohnwoche</span><span class="wert">{split ? `KW ${week.week} · ${monthLabel(sheet.month)}` : `KW ${week.week} / ${week.year}`}</span>
			</span>
			<span class="feld"><span class="klein">von</span><span class="wert">{date(sheet.days[0]?.date ?? sheet.weekStart)}</span></span>
			<span class="feld"><span class="klein">bis</span><span class="wert">{date(sheet.days.at(-1)?.date ?? sheet.weekStart)}</span></span>
		</div>

		<table class="raster">
			<colgroup>
				<col class="w-tag" />
				<col class="w-kst" />
				<col />
				<col class="w-norm" />
				<col class="w-ue" />
				<col class="w-ue" />
				<col class="w-urlaub" />
				<col class="w-feiertag" />
				<col class="w-regen" />
				<col class="w-efzg" />
				<col class="w-rest" />
			</colgroup>
			<thead>
				<tr>
					<th rowspan="2">Tag<span class="sub">Arbeits&shy;zeit</span></th>
					<th rowspan="2">Kosten-<br />stelle</th>
					<th rowspan="2">Baustelle / Tätigkeit</th>
					<th rowspan="2" class="h">Norm-<br />Std.</th>
					<th colspan="2" class="h">Überstunden</th>
					<th rowspan="2" class="h">Urlaubs-<br />std.</th>
					<th rowspan="2" class="h">Feiertags-<br />std.</th>
					<th rowspan="2" class="h">Regen-<br />Std.</th>
					<th rowspan="2" class="h">Efzg</th>
					<th rowspan="2"></th>
				</tr>
				<tr>
					<th class="h">50 %</th>
					<th class="h">100 %</th>
				</tr>
			</thead>
			<tbody>
				{#each alleTage as datum (datum)}
					{@const day = byDate.get(datum)}
					<tr class="tag">
						<th scope="row" class="c-tag">{WEEKDAY_LABELS[weekdayIndex(datum)]}</th>
						<td class="num">{day?.costCenter ?? ''}</td>
						<td>{day?.site ?? ''}</td>
						{#each HOURS as h (h.key)}
							<td rowspan="2" class="num zahl">{day ? hoursLabel(day[h.key]) : ''}</td>
						{/each}
						<td rowspan="2"></td>
					</tr>
					<tr class="zeit">
						<th scope="row" class="c-tag"><span class="sub">Zeit<br />von/bis</span></th>
						<td colspan="2" class="num">{day ? timeRangeLabel(day.times) : ''}</td>
					</tr>
				{/each}
				<tr class="summe">
					<td></td>
					<td></td>
					<td>Gesamtstunden</td>
					{#each HOURS as h (h.key)}
						<td class="num zahl">{hoursLabel(t[h.total])}</td>
					{/each}
					<td></td>
				</tr>
			</tbody>
		</table>

		<p class="vaz">
			<span class="klein">VAZ</span>
			{#if sheet.vaz}<span class="vaz-text">{sheet.vaz}</span>{/if}
			<span class="wert linie prozent">{sheet.vazPercent != null ? hoursLabel(sheet.vazPercent) : ''}</span><span class="klein">%</span>
		</p>

		<p class="ausloese">
			Auslöse <span class="wert linie kurz">{hoursLabel(sheet.allowanceDays)}</span> Tage
			<span class="wert linie kurz">{hoursLabel(sheet.allowanceAmount)}</span> €
		</p>

		{#if sheet.note}<p class="notiz">Notiz: {sheet.note}</p>{/if}

		<footer class="fuss">
			<div class="sign-block">
				<div class="sign-bild">
					{#if sheet.releaseSignature}
						<svg viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}" role="img" aria-label="Unterschrift {releaser}">
							<path d={sheet.releaseSignature} fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{/if}
				</div>
				<span class="sign">Unterschrift Vorarbeiter</span>
				{#if sheet.releaseSignature && sheet.releasedAt}
					<span class="sign-info">{releaser}, {dateTime(sheet.releasedAt)}</span>
				{/if}
			</div>
			<span class="hinweis">Freiwillige Leistungen über KV begründen keinen Rechtsanspruch!</span>
			<div class="sign-block">
				<div class="sign-bild">
					{#if checked}
						<svg viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}" role="img" aria-label="Unterschrift {checker}">
							<path d={sheet.checkSignature} fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					{/if}
				</div>
				<span class="sign">überprüft</span>
				{#if checked && sheet.checkedAt}
					<span class="sign-info">{checker}, {dateTime(sheet.checkedAt)}</span>
				{/if}
			</div>
		</footer>
	</div>
</PrintSheet>

<style>
	.form {
		/* Am Bildschirm in den Farben der App, auf Papier schwarz auf weiß */
		color: var(--c-ink);
		--rahmen: var(--c-line-strong);
		font-size: 10px;
	}
	.kopf {
		display: flex;
		align-items: baseline;
		gap: 1.5rem;
	}
	.marke {
		font-family: var(--font-display, inherit);
		font-style: italic;
		font-weight: 800;
		font-size: 1.5rem;
		letter-spacing: 0.02em;
	}
	.titel {
		font-weight: 700;
		font-size: 1.05rem;
		letter-spacing: 0.22em;
	}
	.feld {
		display: inline-flex;
		flex: 1;
		align-items: baseline;
		gap: 0.4rem;
	}
	.feld.breit {
		flex: 1.7;
	}
	.klein {
		font-size: 0.6875rem;
	}
	.wert {
		flex: 1;
		border-bottom: 1px solid var(--rahmen);
		padding: 0 0.25rem 1px;
		font-size: 0.8125rem;
		min-height: 1.1rem;
		white-space: nowrap;
	}
	.woche {
		display: flex;
		gap: 1.25rem;
		margin: 0.6rem 0 0.75rem;
		padding-left: 7.5rem;
	}

	.raster {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	/* Spaltenbreiten wie auf dem Vordruck */
	.w-tag {
		width: 5.7%;
	}
	.w-kst {
		width: 8%;
	}
	.w-norm {
		width: 5.1%;
	}
	.w-ue {
		width: 5.3%;
	}
	.w-urlaub {
		width: 6.6%;
	}
	.w-feiertag {
		width: 7.2%;
	}
	.w-regen {
		width: 6.8%;
	}
	.w-efzg {
		width: 5.7%;
	}
	.w-rest {
		width: 5.1%;
	}
	.raster th,
	.raster td {
		border: 1px solid var(--rahmen);
		padding: 2px 3px;
		vertical-align: top;
		font-weight: 400;
		overflow: hidden;
	}
	.raster thead th {
		text-align: center;
		vertical-align: middle;
		font-size: 0.6875rem;
		line-height: 1.1;
	}
	/* Stundenspalten sind schmal – die Überschrift etwas kleiner, damit nichts übersteht */
	.raster thead th.h {
		font-size: 0.6rem;
		padding: 2px 1px;
		overflow-wrap: anywhere;
	}
	.sub {
		display: block;
		font-size: 0.5625rem;
		line-height: 1.05;
	}
	.c-tag {
		text-align: center;
	}
	.tag th.c-tag {
		font-size: 0.9rem;
		vertical-align: middle;
	}
	.tag td {
		height: 2.1rem;
		font-size: 0.8125rem;
		vertical-align: middle;
	}
	.zeit td,
	.zeit th {
		height: 1rem;
		font-size: 0.75rem;
		vertical-align: middle;
	}
	.zahl {
		text-align: center;
		vertical-align: middle;
		font-size: 0.875rem;
	}
	.summe td {
		height: 1.5rem;
		font-weight: 600;
		vertical-align: middle;
	}

	/* VAZ ohne lange Linie – nur der Prozentsatz hat sein Feld */
	.vaz {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		margin-top: 0.1rem;
	}
	.vaz-text {
		font-size: 0.8125rem;
	}
	.vaz .prozent {
		flex: 0 0 4rem;
		text-align: center;
	}
	.linie {
		border-bottom: 1px solid var(--rahmen);
		min-height: 1rem;
	}
	.ausloese {
		margin-top: 2.5rem;
		text-align: right;
		font-size: 0.875rem;
	}
	.kurz {
		display: inline-block;
		width: 7rem;
		text-align: center;
	}
	.notiz {
		margin-top: 1rem;
		font-size: 0.75rem;
	}
	.fuss {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 1.5rem;
		/* Platz für Name und Datum unter den Linien */
		padding-bottom: 1rem;
	}
	.sign-block {
		position: relative;
		display: flex;
		width: 11rem;
		flex-direction: column;
		align-items: stretch;
	}
	.sign-bild {
		height: 3.6rem;
	}
	.sign-bild svg {
		display: block;
		height: 100%;
		width: 100%;
	}
	.sign {
		border-top: 1px solid var(--rahmen);
		padding-top: 2px;
		text-align: center;
		font-size: 0.75rem;
	}
	/* Hängt unter der Linie, damit beide Linien auf einer Höhe bleiben */
	.sign-info {
		position: absolute;
		top: 100%;
		right: 0;
		left: 0;
		text-align: center;
		font-size: 0.625rem;
		opacity: 0.75;
	}
	.hinweis {
		flex: 1;
		padding-bottom: 0.2rem;
		text-align: center;
		font-style: italic;
		font-size: 0.75rem;
	}

	@media print {
		.form {
			color: #000;
			--rahmen: #000;
			font-size: 10pt;
		}
	}
</style>
