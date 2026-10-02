<script lang="ts">
	/** Druckansicht im Aufbau des Lohnzettel-Formulars aus dem Block */
	import { pageTitle } from '$lib/app';
	import PrintSheet from '$lib/components/PrintSheet.svelte';
	import { fullName } from '$lib/format';
	import { hoursLabel, isoWeek, monthLabel, monthsOfWeek, WEEKDAY_LABELS, weekdayIndex, weekDays } from '$lib/modules/stunden/week';

	let { data } = $props();
	const sheet = $derived(data.sheet);
	const t = $derived(data.totals);
	const week = $derived(isoWeek(sheet.weekStart));
	/** Das Raster zeigt immer alle sieben Tage; Tage des anderen Monats bleiben leer */
	const split = $derived(monthsOfWeek(sheet.weekStart).length > 1);
	const byDate = $derived(new Map(sheet.days.map((d) => [d.date, d])));
	const alleTage = $derived(weekDays(sheet.weekStart));

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
			<span class="feld"><span class="klein">Lohnwoche</span><span class="wert">{split ? `KW ${week.week} · ${monthLabel(sheet.month)}` : `KW ${week.week} / ${week.year}`}</span></span>
			<span class="feld"><span class="klein">von</span><span class="wert">{date(sheet.days[0]?.date ?? sheet.weekStart)}</span></span>
			<span class="feld"><span class="klein">bis</span><span class="wert">{date(sheet.days.at(-1)?.date ?? sheet.weekStart)}</span></span>
		</div>

		<table class="raster">
			<thead>
				<tr>
					<th rowspan="2" class="c-tag">Tag<span class="sub">Arbeits&shy;zeit</span></th>
					<th rowspan="2" class="c-kst">Kosten-<br />stelle</th>
					<th rowspan="2" class="c-site">Baustelle / Tätigkeit</th>
					<th rowspan="2" class="c-std">Norm-<br />Std.</th>
					<th colspan="2" class="c-ue">Überstunden</th>
					<th rowspan="2" class="c-std">Urlaubs-<br />std.</th>
					<th rowspan="2" class="c-std">Feiertags-<br />std.</th>
					<th rowspan="2" class="c-std">Regen-<br />Std.</th>
					<th rowspan="2" class="c-std">Efzg</th>
					<th rowspan="2" class="c-rest"></th>
				</tr>
				<tr>
					<th class="c-std">50 %</th>
					<th class="c-std">100 %</th>
				</tr>
			</thead>
			<tbody>
				{#each alleTage as datum (datum)}
					{@const day = byDate.get(datum)}
					<tr class="tag">
						<th scope="row" class="c-tag">{WEEKDAY_LABELS[weekdayIndex(datum)]}</th>
						<td class="c-kst num">{day?.costCenter ?? ''}</td>
						<td class="c-site">{day?.site ?? ''}</td>
						{#each HOURS as h (h.key)}
							<td rowspan="2" class="c-std num zahl">{day ? hoursLabel(day[h.key]) : ''}</td>
						{/each}
						<td rowspan="2" class="c-rest"></td>
					</tr>
					<tr class="zeit">
						<th scope="row" class="c-tag"><span class="sub">Zeit<br />von/bis</span></th>
						<td colspan="2" class="num">
							{day?.fromTime && day.toTime ? `${day.fromTime} – ${day.toTime}` : (day?.fromTime ?? '')}
						</td>
					</tr>
				{/each}
				<tr class="summe">
					<td class="c-tag"></td>
					<td class="c-kst num">{sheet.vazPercent != null ? `${hoursLabel(sheet.vazPercent)} %` : '%'}</td>
					<td class="c-site">Gesamtstunden</td>
					{#each HOURS as h (h.key)}
						<td class="c-std num zahl">{hoursLabel(t[h.total])}</td>
					{/each}
					<td class="c-rest num zahl">{hoursLabel(t.total)}</td>
				</tr>
			</tbody>
		</table>

		<p class="vaz"><span class="klein">VAZ</span><span class="wert linie">{sheet.vaz}</span></p>

		<p class="ausloese">
			Auslöse <span class="wert linie kurz">{hoursLabel(sheet.allowanceDays)}</span> Tage
			<span class="wert linie kurz">{hoursLabel(sheet.allowanceAmount)}</span> €
		</p>

		{#if sheet.note}<p class="notiz">Notiz: {sheet.note}</p>{/if}

		<footer class="fuss">
			<span class="sign">Unterschrift Vorarbeiter</span>
			<span class="hinweis">Freiwillige Leistungen über KV begründen keinen Rechtsanspruch!</span>
			<span class="sign">überprüft</span>
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
	.klein {
		font-size: 0.6875rem;
	}
	.wert {
		flex: 1;
		border-bottom: 1px solid var(--rahmen);
		padding: 0 0.25rem 1px;
		font-size: 0.8125rem;
		min-height: 1.1rem;
	}
	.woche {
		display: flex;
		gap: 1.5rem;
		margin: 0.6rem 0 0.75rem;
		padding-left: 9.5rem;
	}

	.raster {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}
	.raster th,
	.raster td {
		border: 1px solid var(--rahmen);
		padding: 2px 3px;
		vertical-align: top;
		font-weight: 400;
	}
	.raster thead th {
		text-align: center;
		vertical-align: middle;
		font-size: 0.6875rem;
		line-height: 1.1;
	}
	.sub {
		display: block;
		font-size: 0.5625rem;
		line-height: 1.05;
	}
	.c-tag {
		width: 5.7%;
		text-align: center;
	}
	.c-kst {
		width: 8%;
	}
	.c-site {
		width: 39%;
	}
	.c-std {
		width: 6%;
	}
	.c-rest {
		width: 5%;
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
	.summe .c-site {
		font-size: 0.9rem;
	}

	.vaz {
		display: flex;
		align-items: baseline;
		gap: 0.4rem;
		width: 45%;
		margin-top: 0.1rem;
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
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 3.5rem;
	}
	.sign {
		width: 11rem;
		border-top: 1px solid var(--rahmen);
		padding-top: 2px;
		text-align: center;
		font-size: 0.75rem;
	}
	.hinweis {
		flex: 1;
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
