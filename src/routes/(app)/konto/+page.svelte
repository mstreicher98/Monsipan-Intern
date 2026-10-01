<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import ScanBarcode from '@lucide/svelte/icons/scan-barcode';
	import MonitorSmartphone from '@lucide/svelte/icons/monitor-smartphone';
	import PasswordInput from '$lib/components/PasswordInput.svelte';
	import NewPasswordFields from '$lib/components/NewPasswordFields.svelte';
	import { needsParty, ROLE_DESCRIPTIONS, ROLE_LABELS } from '$lib/permissions';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();

	const after =
		(message: string, reset = false) =>
		() =>
		async ({ result, update }: { result: { type: string }; update: (o?: { reset?: boolean }) => Promise<void> }) => {
			if (result.type === 'success') toast.success(message);
			await update({ reset: reset && result.type === 'success' });
		};
</script>

<svelte:head><title>{pageTitle('Mein Konto')}</title></svelte:head>

<div class="pt-2 pb-5">
	<h1 class="text-[2rem] leading-tight">Mein Konto</h1>
	<p class="text-ink-2">
		Angemeldet als <span class="font-medium text-ink">{data.user.username}</span>, Rolle {ROLE_LABELS[data.user.role]} – {ROLE_DESCRIPTIONS[data.user.role]}.
	</p>
	{#if data.partyName}
		<p class="mt-1 text-ink-2">Partie: <span class="font-medium text-ink">{data.partyName}</span> – wird beim Ausbuchen automatisch eingesetzt.</p>
	{:else if needsParty(data.user.role)}
		<p class="mt-1 font-medium text-danger">Dir ist noch keine Partie zugeordnet. Bitte an die Administration wenden.</p>
	{/if}
</div>

<div class="grid gap-4 lg:grid-cols-2">
	<section class="card p-4 lg:p-6" aria-labelledby="h-profile">
		<h2 id="h-profile" class="text-xl">Persönliche Daten</h2>
		<form method="POST" action="?/profile" class="mt-4 space-y-4" use:enhance={after('Gespeichert')}>
			<div class="grid gap-4 sm:grid-cols-2">
				<div>
					<label for="first" class="field-label">Vorname</label>
					<input id="first" name="firstName" class="input" required maxlength="60" value={data.user.firstName} autocomplete="given-name" />
				</div>
				<div>
					<label for="last" class="field-label">Nachname</label>
					<input id="last" name="lastName" class="input" maxlength="60" value={data.user.lastName} autocomplete="family-name" />
				</div>
			</div>
			<div>
				<label for="email" class="field-label">E-Mail</label>
				<input id="email" name="email" type="email" class="input" maxlength="120" value={data.user.email ?? ''} autocomplete="email" />
				<p class="field-hint">Damit kannst du dich anmelden und dein Passwort selbst zurücksetzen.</p>
			</div>
			{#if form?.form === 'profile' && form.message}<p class="field-error" role="alert">{form.message}</p>{/if}
			<button class="btn btn-primary">Speichern</button>
		</form>
	</section>

	<section class="card p-4 lg:p-6" aria-labelledby="h-pw">
		<h2 id="h-pw" class="text-xl">Passwort ändern</h2>
		<form method="POST" action="?/password" class="mt-4 space-y-4" use:enhance={after('Passwort geändert, andere Geräte wurden abgemeldet', true)}>
			<div>
				<label for="current" class="field-label">Aktuelles Passwort</label>
				<PasswordInput id="current" name="current" autocomplete="current-password" required />
			</div>
			<NewPasswordFields error={form?.form === 'password' ? form.message : null} />
			<button class="btn btn-primary">Passwort ändern</button>
		</form>
	</section>

	<section class="card p-4 lg:p-6" aria-labelledby="h-sessions">
		<h2 id="h-sessions" class="flex items-center gap-2 text-xl"><MonitorSmartphone size={20} aria-hidden="true" />Angemeldete Geräte</h2>
		<p class="mt-1 text-sm text-ink-2">Du bist auf {data.sessionCount} {data.sessionCount === 1 ? 'Gerät' : 'Geräten'} angemeldet.</p>
		<form method="POST" action="?/sessions" class="mt-4" use:enhance={after('Andere Geräte abgemeldet')}>
			<button class="btn btn-secondary" disabled={data.sessionCount <= 1}>Auf allen anderen Geräten abmelden</button>
		</form>
	</section>

	<section class="card p-4 lg:p-6" aria-labelledby="h-scan">
		<h2 id="h-scan" class="flex items-center gap-2 text-xl"><ScanBarcode size={20} aria-hidden="true" />Scanner</h2>
		<p class="mt-1 text-sm text-ink-2">Prüfe, ob Handscanner oder Kamera Codes richtig lesen – inklusive Tastaturlayout.</p>
		<a href="/lager/scanner-test" class="btn btn-secondary mt-4">Scanner testen</a>
	</section>
</div>
