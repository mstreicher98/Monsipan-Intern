<script lang="ts">
	/**
	 * Push auf diesem Gerät: Stand anzeigen, ein- und ausschalten, Test schicken.
	 * Im Browser über Web-Push, in der Android-App über deren Push-Dienst.
	 */
	import { onMount } from 'svelte';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import BellOff from '@lucide/svelte/icons/bell-off';
	import { inNativeApp } from '$lib/native';
	import { appHasPush, disablePush, enablePush, pushState, type PushState } from '$lib/push';
	import { toast } from '$lib/stores/toast.svelte';

	let { compact = false }: { compact?: boolean } = $props();

	let status = $state<PushState | 'laden'>('laden');
	let busy = $state(false);

	onMount(() => {
		pushState()
			.then((s) => (status = s))
			.catch(() => (status = 'unsupported'));
	});

	/** Warum es hier nicht geht – je nach Gerät */
	const unsupportedText = $derived(
		inNativeApp()
			? appHasPush()
				? 'Push in der App ist am Server noch nicht eingerichtet – bis dahin kommen Benachrichtigungen unter der Glocke an.'
				: 'Diese App-Version kann noch keine Push-Benachrichtigungen. Bitte die neue App installieren (Seite „App fürs Handy“).'
			: 'Dieser Browser kann keine Push-Benachrichtigungen. Am iPhone geht es, wenn die Seite über Teilen → „Zum Home-Bildschirm“ als App angelegt ist.'
	);

	async function run(action: () => Promise<PushState>, done: string) {
		busy = true;
		try {
			status = await action();
			if (status === 'on' || status === 'off') toast.success(done);
			if (status === 'denied') toast.error('Benachrichtigungen sind blockiert', 'Bitte in den Einstellungen des Geräts für diese Seite bzw. App erlauben.');
		} catch (err) {
			toast.error('Das hat nicht geklappt', (err as Error).message);
		} finally {
			busy = false;
		}
	}

	async function test() {
		busy = true;
		try {
			const res = await fetch('/api/push/test', { method: 'POST' });
			const body = (await res.json()) as { devices: number };
			toast.success(body.devices ? 'Test geschickt' : 'Kein Gerät angemeldet', body.devices ? 'Gleich sollte eine Benachrichtigung kommen.' : 'Erst Push einschalten.');
		} catch {
			toast.error('Test fehlgeschlagen');
		} finally {
			busy = false;
		}
	}
</script>

{#if status !== 'laden'}
	<div class="flex flex-wrap items-center gap-3 {compact ? 'card p-3' : 'rounded-xl bg-surface-2 p-3'}">
		<span class="grid size-10 shrink-0 place-items-center rounded-xl {status === 'on' ? 'bg-ok-soft text-ok' : 'bg-surface-3 text-ink-2'}">
			{#if status === 'on'}<BellRing size={20} aria-hidden="true" />{:else}<BellOff size={20} aria-hidden="true" />{/if}
		</span>
		<p class="min-w-[12rem] flex-1 text-sm">
			{#if status === 'on'}
				<span class="block font-medium">Push ist auf diesem Gerät an</span>
				<span class="block text-ink-3">Benachrichtigungen kommen auch, wenn die App zu ist.</span>
			{:else if status === 'off'}
				<span class="block font-medium">Push auf diesem Gerät einschalten</span>
				<span class="block text-ink-3">Dann meldet sich das Handy bzw. der PC, auch wenn die App zu ist.</span>
			{:else if status === 'denied'}
				<span class="block font-medium">Benachrichtigungen sind blockiert</span>
				<span class="block text-ink-3">In den Einstellungen des Browsers bzw. von Android für diese Seite erlauben, dann hier einschalten.</span>
			{:else}
				<span class="block font-medium">Push geht hier nicht</span>
				<span class="block text-ink-3">{unsupportedText}</span>
			{/if}
		</p>
		{#if status === 'on'}
			<button type="button" class="btn btn-ghost btn-sm" disabled={busy} onclick={test}>Test</button>
			<button type="button" class="btn btn-secondary btn-sm" disabled={busy} onclick={() => run(disablePush, 'Push ausgeschaltet')}>Ausschalten</button>
		{:else if status === 'off' || status === 'denied'}
			<button type="button" class="btn btn-primary btn-sm" disabled={busy} onclick={() => run(enablePush, 'Push eingeschaltet')}>Einschalten</button>
		{/if}
	</div>
{/if}
