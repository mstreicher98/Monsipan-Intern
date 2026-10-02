<script lang="ts">
	import { APP_NAME, pageTitle } from '$lib/app';
	import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line';
	import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import X from '@lucide/svelte/icons/x';
	import BarChart from '$lib/components/BarChart.svelte';
	import CountUp from '$lib/components/CountUp.svelte';
	import MovementList from '$lib/modules/lager/components/MovementList.svelte';
	import ProductAvatar from '$lib/modules/lager/components/ProductAvatar.svelte';
	import { monthLong, monthShort } from '$lib/format';
	import { install } from '$lib/install.svelte';
	import { visibleModules } from '$lib/nav';
	import { can } from '$lib/permissions';

	let { data } = $props();

	// Bereiche der Anwendung; wächst mit jedem freigeschalteten Modul
	const areas = $derived(visibleModules(data.user.role).filter((m) => m.key !== 'dashboard'));

	const canBook = $derived(can(data.user.role, 'lager.stock.book'));
	// Ohne Berichte-Recht führt "Nachbestellen" in den gefilterten Bestand statt zur Bestellliste
	const lowHref = $derived(can(data.user.role, 'lager.reports.view') ? '/lager/bestellliste' : '/lager/bestand?status=nachbestellen');
	const lowLinkLabel = $derived(can(data.user.role, 'lager.reports.view') ? 'Bestellliste' : 'Im Bestand ansehen');
	const hour = new Date().getHours();
	const greeting = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
	const today = new Intl.DateTimeFormat('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

	const consumption = $derived(data.consumption ?? []);
	const chartData = $derived(
		consumption.map((c, i) => ({
			key: c.month,
			label: monthShort(c.month),
			longLabel: monthLong(c.month),
			value: c.qty,
			partial: i === consumption.length - 1
		}))
	);
	// Hinweis auf die App: nur am Handy, nur solange nicht installiert und nicht weggeklickt
	const HINT_KEY = 'lager-app-hinweis';
	let hintHidden = $state(false);
	$effect(() => {
		try {
			hintHidden = localStorage.getItem(HINT_KEY) === 'weg';
		} catch {
			/* kein Speicherzugriff */
		}
	});
	function hideHint() {
		hintHidden = true;
		try {
			localStorage.setItem(HINT_KEY, 'weg');
		} catch {
			/* kein Speicherzugriff */
		}
	}

	const thisMonth = $derived(consumption.at(-1)?.qty ?? 0);
	const lastMonth = $derived(consumption.at(-2)?.qty ?? 0);
</script>

<svelte:head><title>{pageTitle('Übersicht')}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-4 pt-2 pb-6">
	<div>
		<h1 class="text-[2rem] leading-tight">{greeting}, {data.user.firstName || data.user.username}</h1>
		<p class="text-ink-2">{today}</p>
	</div>
	{#if canBook}
		<div class="flex w-full gap-2 sm:w-auto">
			<a href="/lager/buchen?art=OUT" class="btn btn-primary flex-1 sm:flex-none"><ArrowUpFromLine size={18} aria-hidden="true" />Ausbuchen</a>
			<a href="/lager/buchen?art=IN" class="btn btn-secondary flex-1 sm:flex-none"><ArrowDownToLine size={18} aria-hidden="true" />Einbuchen</a>
			<a href="/lager/buchen?art=TRANSFER" class="btn btn-secondary hidden sm:inline-flex"><ArrowLeftRight size={18} aria-hidden="true" />Umlagern</a>
		</div>
	{/if}
</div>

{#if install.suggest && !hintHidden}
	<div class="card mb-4 flex items-center gap-3 p-3">
		<span class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-ink"><Smartphone size={20} aria-hidden="true" /></span>
		<p class="min-w-0 flex-1 text-sm">
			<span class="font-medium">{APP_NAME} als App</span>
			<span class="block text-ink-3">Symbol am Startbildschirm, Vollbild ohne Browserleiste.</span>
		</p>
		<a href="/app" class="btn btn-primary btn-sm shrink-0">Einrichten</a>
		<button class="btn btn-ghost btn-sm btn-icon shrink-0" aria-label="Hinweis ausblenden" onclick={hideHint}><X size={16} /></button>
	</div>
{/if}

{#if areas.length > 1}
	<section class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Bereiche">
		{#each areas as m (m.key)}
			<a href={m.href} class="card flex items-center gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-2)]">
				<span class="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-2"><m.icon size={20} aria-hidden="true" /></span>
				<span class="min-w-0">
					<span class="block font-semibold">{m.label}</span>
					{#if m.hint}<span class="block truncate text-[0.8125rem] text-ink-3">{m.hint}</span>{/if}
				</span>
			</a>
		{/each}
	</section>
{/if}

<div class="mb-3 flex items-center justify-between gap-2">
	<h2 class="text-xl">Lagermanagement</h2>
	<a href="/lager/bestand" class="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
		Zum Bereich<ChevronRight size={16} aria-hidden="true" />
	</a>
</div>

<!-- Kennzahlen -->
<section class="grid grid-cols-2 gap-3 lg:gap-4 {data.kpi.today !== null ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}" aria-label="Kennzahlen">
	<a href="/lager/bestand" class="card group p-4 transition-shadow hover:shadow-[var(--shadow-2)] lg:p-5">
		<p class="text-sm text-ink-2">Aktive Artikel</p>
		<p class="mt-1 font-display text-[2.25rem] leading-none font-semibold"><CountUp value={data.kpi.products} /></p>
		<p class="mt-2 text-[0.8125rem] text-ink-3">im Sortiment</p>
	</a>
	<a href="/lager/bestand" class="card p-4 transition-shadow hover:shadow-[var(--shadow-2)] lg:p-5">
		<p class="text-sm text-ink-2">Stück auf Lager</p>
		<p class="mt-1 font-display text-[2.25rem] leading-none font-semibold"><CountUp value={data.kpi.units} /></p>
		<p class="mt-2 text-[0.8125rem] text-ink-3">verteilt auf {data.kpi.locations} Lagerorte</p>
	</a>
	<a
		href={lowHref}
		class="card relative overflow-hidden p-4 transition-shadow hover:shadow-[var(--shadow-2)] lg:p-5 {data.kpi.low > 0 ? 'border-warn/40' : ''} {data.kpi
			.today === null
			? 'col-span-2 lg:col-span-1'
			: ''}"
	>
		{#if data.kpi.low > 0}<span class="lane absolute inset-x-0 top-0 h-1" aria-hidden="true"></span>{/if}
		<p class="text-sm text-ink-2">Nachbestellen</p>
		<p class="mt-1 font-display text-[2.25rem] leading-none font-semibold {data.kpi.low > 0 ? 'text-warn' : ''}"><CountUp value={data.kpi.low} /></p>
		<p class="mt-2 text-[0.8125rem] text-ink-3">{data.kpi.low === 1 ? 'Artikel am Mindestbestand' : 'Artikel am Mindestbestand'}</p>
	</a>
	{#if data.kpi.today !== null}
		<a href="/lager/bewegungen" class="card p-4 transition-shadow hover:shadow-[var(--shadow-2)] lg:p-5">
			<p class="text-sm text-ink-2">Buchungen heute</p>
			<p class="mt-1 font-display text-[2.25rem] leading-none font-semibold"><CountUp value={data.kpi.today} /></p>
			<p class="mt-2 text-[0.8125rem] text-ink-3">ohne Stornos</p>
		</a>
	{/if}
</section>

<div class="mt-4 grid gap-4 lg:grid-cols-3">
	<!-- Verbrauch -->
	{#if data.consumption}
	<section class="card min-w-0 p-4 lg:col-span-2 lg:p-6" aria-labelledby="h-consumption">
		<div class="flex flex-wrap items-start justify-between gap-2">
			<div>
				<h2 id="h-consumption" class="text-xl">Verbrauch je Monat</h2>
				<p class="text-sm text-ink-3">Ausgaben minus Rückgaben, in Stück</p>
			</div>
			<div class="text-right">
				<p class="text-sm text-ink-3">Bisher diesen Monat</p>
				<p class="font-display text-2xl leading-tight font-semibold">
					{thisMonth} <span class="text-base font-medium text-ink-3">Stück</span>
				</p>
				{#if lastMonth > 0}<p class="text-[0.8125rem] text-ink-3">Vormonat gesamt {lastMonth}</p>{/if}
			</div>
		</div>
		<div class="mt-4">
			<BarChart data={chartData} title="Verbrauch je Monat" />
		</div>
	</section>
	{/if}

	<!-- Nachbestellen -->
	<section class="card flex min-w-0 flex-col p-4 lg:p-6 {data.consumption ? '' : 'lg:col-span-3'}" aria-labelledby="h-low">
		<div class="flex items-center justify-between gap-2">
			<h2 id="h-low" class="text-xl">Nachbestellen</h2>
			{#if data.kpi.low > 0}
				<a href={lowHref} class="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">
					{lowLinkLabel}<ChevronRight size={16} aria-hidden="true" />
				</a>
			{/if}
		</div>
		{#if data.low.length === 0}
			<div class="flex flex-1 flex-col items-center justify-center py-8 text-center">
				<span class="grid size-12 place-items-center rounded-2xl bg-ok-soft text-ok"><CircleCheck size={24} aria-hidden="true" /></span>
				<p class="mt-3 font-medium">Alles ausreichend auf Lager</p>
				<p class="text-sm text-ink-3">Kein Artikel hat den Mindestbestand erreicht.</p>
			</div>
		{:else}
			<ul class="mt-3 space-y-1">
				{#each data.low as p (p.id)}
					{@const ratio = Math.min(1, p.total / Math.max(1, p.minStock ?? 1))}
					<li>
						<a href="/lager/artikel/{p.id}" class="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
							<ProductAvatar colorHex={p.colorHex} category={p.categoryName} size="sm" />
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[0.9375rem] font-medium">{p.name}</span>
								<span class="mt-1.5 block h-1.5 overflow-hidden rounded-full {p.total <= 0 ? 'bg-danger-soft' : 'bg-warn-soft'}">
									<span class="block h-full rounded-full {p.total <= 0 ? 'bg-danger' : 'bg-warn'}" style="width: {Math.max(4, ratio * 100)}%"></span>
								</span>
							</span>
							<span class="num text-right text-sm whitespace-nowrap">
								<span class="font-semibold">{p.total}</span><span class="text-ink-3"> / {p.minStock}</span>
							</span>
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>

<!-- Letzte Bewegungen -->
{#if data.recent}
	<section class="card mt-4 overflow-hidden" aria-labelledby="h-recent">
		<div class="flex items-center justify-between gap-2 px-4 pt-4 pb-3 lg:px-6 lg:pt-5">
			<h2 id="h-recent" class="text-xl">Letzte Bewegungen</h2>
			<a href="/lager/bewegungen" class="inline-flex items-center gap-1 text-sm font-medium text-ink-2 hover:text-ink">Alle<ChevronRight size={16} aria-hidden="true" /></a>
		</div>
		<MovementList rows={data.recent} />
	</section>
{/if}
