<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import { fly } from 'svelte/transition';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import PasswordInput from '$lib/components/PasswordInput.svelte';

	let { data, form } = $props();
	let busy = $state(false);
</script>

<svelte:head><title>{pageTitle('Anmelden')}</title></svelte:head>

<h1 class="text-3xl">Anmelden</h1>
<p class="mt-1 text-ink-2">Mit Benutzername oder E-Mail-Adresse.</p>

{#if data.reset}
	<div class="mt-6 flex gap-2 rounded-xl bg-ok-soft px-4 py-3 text-ok" role="status">
		<CircleCheck size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
		<p class="font-medium">Passwort geändert. Du kannst dich jetzt anmelden.</p>
	</div>
{/if}

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
	<div>
		<label for="identifier" class="field-label">Benutzername oder E-Mail</label>
		<input
			id="identifier"
			name="identifier"
			class="input"
			autocomplete="username"
			autocapitalize="none"
			spellcheck="false"
			required
			value={form?.identifier ?? ''}
			aria-invalid={form?.message ? true : undefined}
		/>
	</div>
	<div>
		<label for="password" class="field-label">Passwort</label>
		<PasswordInput id="password" name="password" autocomplete="current-password" required invalid={Boolean(form?.message)} />
	</div>

	<label class="flex items-center gap-3 text-[0.9375rem]">
		<input type="checkbox" name="remember" class="size-5 accent-[var(--c-ink)]" checked />
		Angemeldet bleiben (30 Tage)
	</label>

	{#if form?.message}
		<div class="flex gap-2 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert" in:fly={{ y: -6, duration: 200 }}>
			<CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />
			<p class="font-medium">{form.message}</p>
		</div>
	{/if}

	<button class="btn btn-primary w-full min-h-12 text-base" disabled={busy}>
		{busy ? 'Wird angemeldet …' : 'Anmelden'}
	</button>
</form>

<p class="mt-6 text-center">
	<a href="/passwort-vergessen" class="text-[0.9375rem] font-medium text-ink-2 underline decoration-mark decoration-2 underline-offset-4 hover:text-ink">
		Passwort vergessen?
	</a>
</p>
