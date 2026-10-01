<script lang="ts">
	import { pageTitle } from '$lib/app';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Download from '@lucide/svelte/icons/download';
	import Share from '@lucide/svelte/icons/share';
	import SquarePlus from '@lucide/svelte/icons/square-plus';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import Copy from '@lucide/svelte/icons/copy';
	import Monitor from '@lucide/svelte/icons/monitor';
	import { install } from '$lib/install.svelte';
	import { toast } from '$lib/stores/toast.svelte';

	let { data } = $props();

	async function installPrompt() {
		const ok = await install.promptInstall();
		if (ok) toast.success('App wird installiert');
	}

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(data.siteUrl);
			toast.success('Adresse kopiert');
		} catch {
			toast.error('Kopieren nicht möglich');
		}
	}
</script>

<svelte:head><title>{pageTitle('App fürs Handy')}</title></svelte:head>

<div class="pt-2 pb-5">
	<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><Smartphone size={26} aria-hidden="true" />App fürs Handy</h1>
	<p class="max-w-2xl text-ink-2">
		Monsipan Intern als App am Startbildschirm: eigenes Symbol, Vollbild ohne Browserleiste, Scannen mit der Kamera wie gewohnt. Die Daten kommen
		weiterhin vom Server, angemeldet bleibst du wie im Browser.
	</p>
</div>

<div class="grid gap-4 lg:grid-cols-2">
	{#if install.standalone}
		<section class="card p-4 lg:col-span-2 lg:p-6">
			<h2 class="flex items-center gap-2 text-xl text-ok"><CircleCheck size={20} aria-hidden="true" />Läuft bereits als App</h2>
			<p class="mt-1 text-ink-2">Du hast die App schon am Startbildschirm. Es gibt nichts zu tun – Updates kommen automatisch vom Server.</p>
		</section>
	{:else if install.platform === 'android'}
		<section class="card p-4 lg:p-6">
			<h2 class="text-xl">Android-App herunterladen</h2>
			<p class="mt-1 text-ink-2">Die Datei installiert Monsipan Intern als richtige App.</p>
			<a href={data.apkUrl} class="btn btn-primary mt-4 w-full" download rel="noopener">
				<Download size={18} aria-hidden="true" />App herunterladen
			</a>
			<ol class="mt-4 list-decimal space-y-1.5 pl-5 text-ink-2">
				<li>Auf den Knopf tippen und den Download bestätigen.</li>
				<li>Die heruntergeladene Datei öffnen (Benachrichtigung oder Downloads-Ordner).</li>
				<li>Android fragt einmalig, ob Apps aus dieser Quelle installiert werden dürfen – erlauben.</li>
				<li>Installieren, öffnen, anmelden. Fertig.</li>
				<li>Die alte App „Lagermanagement“ danach deinstallieren – sie wird nicht mehr gebraucht.</li>
			</ol>
			<p class="mt-3 text-sm text-ink-3">
				Die Nachfrage kommt, weil die App nicht aus dem Play Store stammt, sondern direkt von uns. Die neue App ersetzt die alte nicht
				automatisch: Sie hat eine eigene Kennung und wird deshalb daneben installiert.
			</p>
		</section>

		<section class="card p-4 lg:p-6">
			<h2 class="text-xl">Oder ohne Download</h2>
			<p class="mt-1 text-ink-2">Chrome kann die Webseite selbst als App einrichten – kleiner, aber sonst gleich.</p>
			{#if install.canPrompt}
				<button class="btn btn-secondary mt-4 w-full" onclick={installPrompt}><SquarePlus size={18} aria-hidden="true" />Als App einrichten</button>
			{:else}
				<ol class="mt-4 list-decimal space-y-1.5 pl-5 text-ink-2">
					<li>In Chrome oben rechts auf die drei Punkte tippen.</li>
					<li><strong>App installieren</strong> oder <strong>Zum Startbildschirm zufügen</strong> wählen.</li>
					<li>Bestätigen – das Symbol liegt dann bei den anderen Apps.</li>
				</ol>
			{/if}
		</section>
	{:else if install.platform === 'ios'}
		<section class="card p-4 lg:col-span-2 lg:p-6">
			<h2 class="text-xl">Auf dem iPhone einrichten</h2>
			<p class="mt-1 text-ink-2">
				Für iPhones gibt es keine Datei zum Herunterladen – Apple erlaubt das nicht. Stattdessen legt Safari die App in drei Schritten als
				App auf den Startbildschirm. Das Ergebnis ist dasselbe: eigenes Symbol, Vollbild, Kamera-Scan.
			</p>
			<ol class="mt-4 space-y-3">
				<li class="flex gap-3">
					<span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 font-semibold">1</span>
					<span class="flex flex-wrap items-center gap-1.5 pt-1">
						In <strong>Safari</strong> unten auf das Teilen-Symbol tippen
						<span class="inline-grid size-7 place-items-center rounded-lg bg-surface-3"><Share size={16} aria-hidden="true" /></span>
					</span>
				</li>
				<li class="flex gap-3">
					<span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 font-semibold">2</span>
					<span class="flex flex-wrap items-center gap-1.5 pt-1">
						In der Liste <strong>Zum Home-Bildschirm</strong> wählen
						<span class="inline-grid size-7 place-items-center rounded-lg bg-surface-3"><SquarePlus size={16} aria-hidden="true" /></span>
					</span>
				</li>
				<li class="flex gap-3">
					<span class="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 font-semibold">3</span>
					<span class="pt-1">Oben rechts auf <strong>Hinzufügen</strong> tippen – fertig.</span>
				</li>
			</ol>
			<p class="mt-4 text-sm text-ink-3">Das geht nur in Safari. In Chrome oder Firefox am iPhone fehlt der Eintrag.</p>
		</section>
	{:else if install.ready}
		<section class="card p-4 lg:col-span-2 lg:p-6">
			<h2 class="flex items-center gap-2 text-xl"><Monitor size={20} aria-hidden="true" />Am Handy öffnen</h2>
			<p class="mt-1 text-ink-2">
				Die App gibt es fürs Handy. Diese Seite am Handy im Browser öffnen, anmelden – dann steht hier der passende Knopf für Android
				beziehungsweise die Anleitung fürs iPhone.
			</p>
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<code class="num rounded-xl border border-line bg-surface-2 px-3 py-2 break-all">{data.siteUrl}</code>
				<button class="btn btn-secondary" onclick={copyLink}><Copy size={16} aria-hidden="true" />Adresse kopieren</button>
			</div>
		</section>
	{/if}
</div>
