<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { page } from '$app/state';
	import Logo from '$lib/components/Logo.svelte';

	const title = $derived(
		page.status === 404 ? 'Seite nicht gefunden' : page.status === 403 ? 'Keine Berechtigung' : 'Etwas ist schiefgelaufen'
	);
	const text = $derived(
		page.status === 404
			? 'Die Adresse gibt es nicht (mehr). Über die Übersicht geht es weiter.'
			: page.status === 403
				? (page.error?.message ?? 'Für diese Seite fehlt dir die Berechtigung.')
				: 'Der Server konnte die Anfrage nicht abschließen. Bitte die Seite neu laden – bleibt der Fehler, die Administration informieren.'
	);
</script>

<svelte:head><title>{pageTitle(title)}</title></svelte:head>

<main class="grid min-h-dvh place-items-center px-6">
	<div class="max-w-md text-center">
		<div class="mb-10 flex justify-center"><Logo /></div>
		<p class="num font-display text-7xl font-semibold text-ink-3">{page.status}</p>
		<span class="lane mx-auto mt-4 block h-1.5 w-28 rounded-full" aria-hidden="true"></span>
		<h1 class="mt-6 text-3xl">{title}</h1>
		<p class="mt-2 text-ink-2">{text}</p>
		<div class="mt-8 flex justify-center gap-2">
			<a href="/" class="btn btn-primary">Zur Übersicht</a>
			<button class="btn btn-secondary" onclick={() => location.reload()}>Neu laden</button>
		</div>
	</div>
</main>
