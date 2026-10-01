<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import NewPasswordFields from '$lib/components/NewPasswordFields.svelte';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Passwort festlegen')}</title></svelte:head>

<span class="grid size-12 place-items-center rounded-2xl bg-brand-soft text-ink"><KeyRound size={24} aria-hidden="true" /></span>
<h1 class="mt-5 text-3xl">Eigenes Passwort festlegen</h1>
<p class="mt-2 text-ink-2">
	Du bist mit einem vorläufigen Passwort angemeldet ({data.username}). Lege jetzt dein eigenes fest – danach geht es direkt weiter.
</p>

<form
	method="POST"
	class="mt-8 space-y-5"
	use:enhance={() => {
		busy = true;
		return async ({ update }) => {
			await update({ reset: false });
			busy = false;
		};
	}}
>
	<NewPasswordFields error={form?.message} />
	<button class="btn btn-primary min-h-12 w-full text-base" disabled={busy}>Passwort speichern</button>
</form>

<form method="POST" action="/logout" class="mt-6 text-center">
	<button class="text-[0.9375rem] font-medium text-ink-2 hover:text-ink">Abmelden</button>
</form>
