<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import NewPasswordFields from '$lib/components/NewPasswordFields.svelte';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Neues Passwort')}</title></svelte:head>

{#if data.valid}
	<h1 class="text-3xl">Neues Passwort</h1>
	<p class="mt-1 text-ink-2">Für das Konto <span class="font-medium text-ink">{data.username}</span>.</p>
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
{:else}
	<h1 class="text-3xl">Link ungültig</h1>
	<p class="mt-2 text-ink-2">Der Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.</p>
	<a href="/passwort-vergessen" class="btn btn-primary mt-8 w-full">Neuen Link anfordern</a>
{/if}
