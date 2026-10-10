<script lang="ts">
	/**
	 * Wer welche Benachrichtigung bekommt: je Ereignis die Gruppen anhaken und
	 * bei Bedarf einzelne Personen dazunehmen. Ankommen kann nur, was die Person
	 * auch sehen darf; bei Ereignissen einer Partie nur die eigene Partie.
	 */
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import BellRing from '@lucide/svelte/icons/bell-ring';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import X from '@lucide/svelte/icons/x';
	import Users from '@lucide/svelte/icons/users';
	import Dialog from '$lib/components/Dialog.svelte';
	import PushToggle from '$lib/components/PushToggle.svelte';
	import { fullName } from '$lib/format';
	import { can, ROLE_LABELS, ROLES, type Role } from '$lib/permissions';
	import { eventSections, NOTIFICATION_EVENTS, type NotificationEvent, type NotificationEventDef } from '$lib/notifications';
	import { toast } from '$lib/stores/toast.svelte';

	let { data } = $props();

	const fromSettings = () => {
		const roles = new Set<string>();
		const people = new Set<string>();
		for (const [event, list] of Object.entries(data.settings.roles)) for (const r of list) roles.add(`${event}|${r}`);
		for (const [event, list] of Object.entries(data.settings.people)) for (const id of list) people.add(`${event}|${id}`);
		return { roles, people };
	};
	// Arbeitsstand im Browser – gespeichert wird erst mit dem Knopf
	let current = $derived(fromSettings());
	const saved = $derived(fromSettings());

	let busy = $state(false);
	let resetOpen = $state(false);

	const sections = eventSections();
	const def = (e: NotificationEvent): NotificationEventDef => NOTIFICATION_EVENTS[e];
	const personName = (id: number) => {
		const p = data.people.find((x) => x.id === id);
		return p ? fullName(p) : `#${id}`;
	};

	function toggleRole(event: NotificationEvent, role: Role) {
		const next = new Set(current.roles);
		const key = `${event}|${role}`;
		if (next.has(key)) next.delete(key);
		else next.add(key);
		current = { ...current, roles: next };
	}
	function addPerson(event: NotificationEvent, id: string) {
		if (!id) return;
		current = { ...current, people: new Set([...current.people, `${event}|${id}`]) };
	}
	function removePerson(event: NotificationEvent, id: number) {
		const next = new Set(current.people);
		next.delete(`${event}|${id}`);
		current = { ...current, people: next };
	}
	const peopleOf = (event: NotificationEvent) =>
		[...current.people].filter((k) => k.startsWith(`${event}|`)).map((k) => Number(k.split('|')[1]));

	const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((k) => b.has(k));
	const changed = $derived(!same(current.roles, saved.roles) || !same(current.people, saved.people));
</script>

<svelte:head><title>{pageTitle('Benachrichtigungen')}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3 pt-2 pb-5">
	<div>
		<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><BellRing size={26} aria-hidden="true" />Benachrichtigungen</h1>
		<p class="text-ink-2">Wer bei welchem Schritt Bescheid bekommt – unter der Glocke und als Push aufs Handy bzw. den PC.</p>
	</div>
	{#if data.canEdit}
		<button type="button" class="btn btn-ghost" onclick={() => (resetOpen = true)}><RotateCcw size={18} aria-hidden="true" />Auf Standard zurücksetzen</button>
	{/if}
</div>

<section class="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:p-5">
	<div class="text-sm">
		<p class="font-medium">Push im Browser und als Web-App</p>
		<p class="text-ink-2">Bereit · {data.push.webDevices} {data.push.webDevices === 1 ? 'Gerät' : 'Geräte'} angemeldet</p>
	</div>
	<div class="text-sm">
		<p class="font-medium">Push in der Android-App</p>
		<p class={data.push.appReady ? 'text-ink-2' : 'text-warn'}>
			{data.push.appReady
				? `Bereit · ${data.push.appDevices} ${data.push.appDevices === 1 ? 'Gerät' : 'Geräte'} angemeldet`
				: 'Noch nicht eingerichtet – dafür braucht es ein Firebase-Projekt (siehe README). Bis dahin kommt alles unter der Glocke an.'}
		</p>
	</div>
	<div class="sm:col-span-2"><PushToggle /></div>
</section>

<form
	method="POST"
	action="?/save"
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') toast.success('Benachrichtigungen gespeichert');
			await update({ reset: false });
			await invalidateAll();
		};
	}}
>
	{#each [...current.roles] as k (k)}<input type="hidden" name="rolle" value={k} />{/each}
	{#each [...current.people] as k (k)}<input type="hidden" name="person" value={k} />{/each}

	<section class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[56rem] border-collapse text-sm">
				<thead>
					<tr class="border-b border-line bg-surface-2">
						<th scope="col" class="sticky left-0 z-10 w-[19rem] bg-surface-2 px-4 py-2.5 text-left font-semibold">Ereignis und Personen</th>
						{#each ROLES as r (r)}
							<th scope="col" class="px-2 py-2.5 text-center align-bottom text-[0.8125rem] font-semibold">{ROLE_LABELS[r]}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each sections as [section, events] (section)}
						<tr class="border-b border-line">
							<th colspan={ROLES.length + 1} scope="colgroup" class="px-4 pt-4 pb-1.5 text-left font-display text-[0.9375rem] font-semibold">
								<span class="sticky left-4">{section}</span>
							</th>
						</tr>
						{#each events as e (e)}
							{@const d = def(e)}
							<tr class="border-b border-line align-top last:border-0">
								<th scope="row" class="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal">
									<span class="block font-medium">{d.label}</span>
									{#if d.hint || d.all}
										<span class="block text-[0.75rem] text-ink-3">{[d.hint, d.all ? 'Ohne „alle sehen“ nur die eigene Partie' : ''].filter(Boolean).join(' · ')}</span>
									{/if}
									<!-- Einzelne Personen gleich hier – die Spalte bleibt beim seitlichen Scrollen stehen -->
									<div class="mt-1.5 flex flex-wrap items-center gap-1">
										{#each peopleOf(e) as id (id)}
											<span class="badge h-auto gap-1 py-0.5 pr-1">
												{personName(id)}
												{#if data.canEdit}
													<button type="button" class="grid size-4 place-items-center rounded-full hover:bg-surface-3" aria-label="{personName(id)} entfernen" onclick={() => removePerson(e, id)}>
														<X size={12} />
													</button>
												{/if}
											</span>
										{/each}
										{#if data.canEdit}
											<select
												class="select h-8 min-h-0 w-auto max-w-[9rem] py-0 text-[0.8125rem]"
												aria-label="{d.label}: Person dazunehmen"
												value=""
												onchange={(ev) => {
													addPerson(e, ev.currentTarget.value);
													ev.currentTarget.value = '';
												}}
											>
												<option value="">+ Person</option>
												{#each data.people.filter((p) => !peopleOf(e).includes(p.id)) as p (p.id)}
													<option value={String(p.id)}>{fullName(p)} ({ROLE_LABELS[p.role]})</option>
												{/each}
											</select>
										{/if}
									</div>
								</th>
								{#each ROLES as r (r)}
									{@const allowed = can(r, d.requires)}
									<td class="px-2 py-2.5 text-center">
										<input
											type="checkbox"
											class="size-5 accent-[var(--c-ink)] disabled:opacity-30"
											checked={allowed && current.roles.has(`${e}|${r}`)}
											disabled={!data.canEdit || !allowed}
											title={allowed ? '' : `${ROLE_LABELS[r]} darf das nicht sehen – siehe Berechtigungen`}
											aria-label="{d.label}: {ROLE_LABELS[r]}"
											onchange={() => toggleRole(e, r)}
										/>
									</td>
								{/each}
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	{#if data.canEdit && (changed || busy)}
		<div class="sticky bottom-24 mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-1)] backdrop-blur lg:bottom-6">
			<button class="btn btn-primary" disabled={busy}>{busy ? 'Wird gespeichert …' : 'Änderungen speichern'}</button>
			<button type="button" class="btn btn-ghost" disabled={busy} onclick={() => (current = fromSettings())}>Verwerfen</button>
			<p class="text-sm text-ink-2">Ungespeichert</p>
		</div>
	{/if}

	<p class="field-hint mt-3 flex gap-2">
		<Users size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
		<span>
			Ankommen kann nur, was die Person auch öffnen darf – ausgegraute Gruppen dürfen das unter Berechtigungen nicht sehen. Bei Ereignissen einer Partie
			bekommen Partieführer und Arbeiter es nur für ihre eigene Partie. Wer einen Schritt selbst macht, bekommt dazu keine Benachrichtigung. Jede Person
			kann einzelne unter „Mein Konto“ für sich abschalten.
		</span>
	</p>
</form>

<Dialog bind:open={resetOpen} title="Auf Standard zurücksetzen?">
	<p class="text-ink-2">Alle Ereignisse bekommen wieder die ausgelieferten Gruppen; einzeln eingetragene Personen werden entfernt.</p>
	<form
		method="POST"
		action="?/reset"
		class="mt-5 flex justify-end gap-2"
		use:enhance={() => async ({ update }) => {
			resetOpen = false;
			toast.success('Zurückgesetzt');
			await update();
			await invalidateAll();
		}}
	>
		<button type="button" class="btn btn-ghost" onclick={() => (resetOpen = false)}>Abbrechen</button>
		<button class="btn btn-primary">Zurücksetzen</button>
	</form>
</Dialog>
