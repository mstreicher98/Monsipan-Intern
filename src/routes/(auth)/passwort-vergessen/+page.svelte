<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import { fade } from 'svelte/transition';
	import MailCheck from '@lucide/svelte/icons/mail-check';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';

	let { form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Passwort vergessen')}</title></svelte:head>

{#if form?.sent}
	<div in:fade={{ duration: 200 }}>
		<span class="grid size-12 place-items-center rounded-2xl bg-ok-soft text-ok"><MailCheck size={24} aria-hidden="true" /></span>
		<h1 class="mt-5 text-3xl">Prüfe dein Postfach</h1>
		<p class="mt-2 text-ink-2">
			Wenn zu diesem Konto eine E-Mail-Adresse hinterlegt ist, ist ein Link zum Zurücksetzen unterwegs. Er ist 60 Minuten gültig.
		</p>
		<p class="mt-4 text-ink-2">Keine E-Mail-Adresse hinterlegt? Dann kann ein Admin dein Passwort zurücksetzen.</p>
	</div>
{:else}
	<h1 class="text-3xl">Passwort vergessen</h1>
	<p class="mt-1 text-ink-2">Wir schicken dir einen Link, mit dem du ein neues Passwort festlegst.</p>
	<form
		method="POST"
		class="mt-8 space-y-5"
		use:enhance={() => {
			busy = true;
			return async ({ update }) => {
				await update();
				busy = false;
			};
		}}
	>
		<div>
			<label for="identifier" class="field-label">Benutzername oder E-Mail</label>
			<input id="identifier" name="identifier" class="input" autocomplete="username" autocapitalize="none" required value={form?.identifier ?? ''} />
			{#if form?.message}<p class="field-error" role="alert">{form.message}</p>{/if}
		</div>
		<button class="btn btn-primary min-h-12 w-full text-base" disabled={busy}>{busy ? 'Wird gesendet …' : 'Link senden'}</button>
	</form>
{/if}

<p class="mt-8">
	<a href="/login" class="inline-flex items-center gap-2 font-medium text-ink-2 hover:text-ink"><ArrowLeft size={18} aria-hidden="true" />Zur Anmeldung</a>
</p>
