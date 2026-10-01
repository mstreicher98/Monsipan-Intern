<script lang="ts">
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Lock from '@lucide/svelte/icons/lock';
	import Dialog from '$lib/components/Dialog.svelte';
	import { isLocked, PERMISSION_GROUPS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Permission, type Role } from '$lib/permissions';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();

	// Arbeitsstand im Browser; gespeichert wird erst mit dem Knopf
	let allowed = $state(new Set<string>());
	let busy = $state(false);
	let confirmReset = $state(false);

	const key = (role: Role, permission: Permission) => `${role}|${permission}`;

	$effect(() => {
		const next = new Set<string>();
		for (const [permission, roles] of Object.entries(data.matrix)) {
			for (const role of roles) next.add(`${role}|${permission}`);
		}
		allowed = next;
	});

	function toggle(role: Role, permission: Permission) {
		if (isLocked(role, permission)) return;
		const k = key(role, permission);
		const next = new Set(allowed);
		if (next.has(k)) next.delete(k);
		else next.add(k);
		allowed = next;
	}

	/** Ganze Zeile für alle Rollen an- oder abwählen */
	function toggleRow(permission: Permission) {
		const all = ROLES.every((r) => allowed.has(key(r, permission)));
		const next = new Set(allowed);
		for (const r of ROLES) {
			if (isLocked(r, permission)) continue;
			if (all) next.delete(key(r, permission));
			else next.add(key(r, permission));
		}
		allowed = next;
	}

	const changed = $derived.by(() => {
		const saved = new Set<string>();
		for (const [permission, roles] of Object.entries(data.matrix)) for (const role of roles) saved.add(`${role}|${permission}`);
		if (saved.size !== allowed.size) return true;
		for (const k of allowed) if (!saved.has(k)) return true;
		return false;
	});
</script>

<svelte:head><title>{pageTitle('Berechtigungen')}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3 pt-2 pb-5">
	<div>
		<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><ShieldCheck size={26} aria-hidden="true" />Berechtigungen</h1>
		<p class="text-ink-2">Was jede Gruppe darf. Änderungen gelten sofort für alle angemeldeten Geräte.</p>
	</div>
	<button type="button" class="btn btn-ghost" onclick={() => (confirmReset = true)}>
		<RotateCcw size={18} aria-hidden="true" />Auf Standard zurücksetzen
	</button>
</div>

{#if form && 'message' in form && form.message}
	<p class="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">{form.message}</p>
{/if}

<form
	method="POST"
	action="?/save"
	use:enhance={() => {
		busy = true;
		return async ({ result, update }) => {
			busy = false;
			if (result.type === 'success') toast.success('Berechtigungen gespeichert');
			await update({ reset: false });
			await invalidateAll();
		};
	}}
>
	<div class="card overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full min-w-[46rem] border-collapse text-sm">
				<thead>
					<tr class="border-b border-line">
						<th scope="col" class="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-semibold">Recht</th>
						{#each ROLES as role (role)}
							<th scope="col" class="px-3 py-3 text-center align-bottom font-semibold">
								<span class="block" title={ROLE_DESCRIPTIONS[role]}>{ROLE_LABELS[role]}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each PERMISSION_GROUPS as group (group.title)}
						<tr class="bg-surface-2">
							<th colspan={ROLES.length + 1} scope="colgroup" class="px-4 py-2 text-left font-display text-[0.9375rem] font-semibold">
								{group.title}
							</th>
						</tr>
						{#each group.items as item (item.key)}
							<tr class="border-b border-line last:border-0 hover:bg-surface-2/60">
								<th scope="row" class="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-normal">
									<button type="button" class="text-left hover:underline" onclick={() => toggleRow(item.key)}>
										<span class="block font-medium">{item.label}</span>
										{#if item.hint}<span class="block text-[0.8125rem] text-ink-3">{item.hint}</span>{/if}
									</button>
								</th>
								{#each ROLES as role (role)}
									{@const locked = isLocked(role, item.key)}
									{@const on = allowed.has(key(role, item.key))}
									<td class="px-3 py-2.5 text-center">
										{#if locked}
											<span class="inline-grid size-5 place-items-center text-ink-3" title="Kann dem Admin nicht entzogen werden">
												<Lock size={14} aria-hidden="true" />
												<span class="sr-only">{ROLE_LABELS[role]}: immer erlaubt</span>
											</span>
											<input type="hidden" name="erlaubt" value={key(role, item.key)} />
										{:else}
											<input
												type="checkbox"
												class="size-5 accent-[var(--c-ink)]"
												name="erlaubt"
												value={key(role, item.key)}
												checked={on}
												onchange={() => toggle(role, item.key)}
												aria-label="{ROLE_LABELS[role]}: {item.label}"
											/>
										{/if}
									</td>
								{/each}
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<div class="mt-4 flex flex-wrap items-center gap-3">
		<button class="btn btn-primary" disabled={busy || !changed}>{busy ? 'Wird gespeichert …' : 'Änderungen speichern'}</button>
		{#if changed}<p class="text-sm text-ink-2">Es gibt ungespeicherte Änderungen.</p>{/if}
	</div>
	<p class="field-hint mt-3">
		Das Schloss markiert Rechte, die dem Admin nicht entzogen werden können – sonst käme niemand mehr an Benutzer und Einstellungen.
	</p>
</form>

<Dialog bind:open={confirmReset} title="Auf Standard zurücksetzen?">
	<p class="text-ink-2">Alle Haken werden auf die ausgelieferten Standardrechte gesetzt. Eigene Anpassungen gehen dabei verloren.</p>
	<form
		method="POST"
		action="?/reset"
		class="mt-5 flex justify-end gap-2"
		use:enhance={() => async ({ update }) => {
			confirmReset = false;
			toast.success('Berechtigungen zurückgesetzt');
			await update();
			await invalidateAll();
		}}
	>
		<button type="button" class="btn btn-ghost" onclick={() => (confirmReset = false)}>Abbrechen</button>
		<button class="btn btn-primary">Zurücksetzen</button>
	</form>
</Dialog>
