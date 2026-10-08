<script lang="ts">
	/**
	 * Rechte je Gruppe: oben die Gruppe wählen, darunter je Bereich eine Zeile
	 * mit Sehen, Erstellen, Bearbeiten, Status und Löschen. Was zusammengehört,
	 * wird gleich mit gesetzt – wer etwas darf, darf den Bereich auch sehen.
	 */
	import { pageTitle } from '$lib/app';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import ShieldCheck from '@lucide/svelte/icons/shield-check';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Lock from '@lucide/svelte/icons/lock';
	import Dialog from '$lib/components/Dialog.svelte';
	import {
		areaActions,
		can,
		isLocked,
		PERMISSION_AREAS,
		ROLE_DESCRIPTIONS,
		ROLE_LABELS,
		ROLES,
		withImplied,
		type Permission,
		type PermissionArea,
		type PermissionLevel,
		type Role
	} from '$lib/permissions';
	import { toast } from '$lib/stores/toast.svelte';

	let { data, form } = $props();

	const canEdit = $derived(can(data.user.role, 'berechtigungen.bearbeiten'));

	// Arbeitsstand im Browser; gespeichert wird erst mit dem Knopf
	let allowed = $state(new Set<string>());
	let role = $state<Role>('bauleiter');
	let busy = $state(false);
	let confirmReset = $state(false);

	const fromMatrix = (matrix: Record<string, string[]>) => {
		const set = new Set<string>();
		for (const [permission, roles] of Object.entries(matrix)) for (const r of roles) set.add(`${r}|${permission}`);
		return set;
	};
	$effect(() => {
		allowed = fromMatrix(data.matrix);
	});

	const key = (p: Permission) => `${role}|${p}`;
	const has = (p: Permission | undefined) => !!p && allowed.has(key(p));
	const locked = (p: Permission | undefined) => !!p && isLocked(role, p);

	/** Rechte setzen und ergänzen, was dazugehört; gesperrte bleiben an */
	function change(on: Permission[], off: Permission[] = []) {
		const next = new Set(allowed);
		for (const p of off) if (!isLocked(role, p)) next.delete(key(p));
		for (const p of on) next.add(key(p));
		allowed = withImplied(next);
	}

	type Level = 'none' | 'self' | 'own' | 'all';
	const levelOf = (l: PermissionLevel): Level =>
		has(l.all) ? 'all' : l.own && has(l.own) ? 'own' : l.self && has(l.self) ? 'self' : 'none';
	const keysOf = (l: PermissionLevel) => [l.self, l.own, l.all].filter((p): p is Permission => !!p);

	function setLevel(area: PermissionArea, which: 'view' | 'edit' | 'remove', value: Level) {
		const l = area[which]!;
		if (which === 'view' && value === 'none') {
			// Wer nichts sieht, darf im Bereich auch sonst nichts
			change([], [...keysOf(l), ...areaActions(area)]);
			return;
		}
		if (which === 'view' && value === 'self' && l.self) {
			// Nur den eigenen Zettel ansehen – alles andere im Bereich setzt mehr voraus
			change([l.self], [l.own, l.all, ...areaActions(area)].filter((p): p is Permission => !!p));
			return;
		}
		if (value === 'none') change([], keysOf(l));
		else if (value === 'own' && l.own) change([l.own], [l.all]);
		else change([l.all]);
	}

	function toggle(p: Permission) {
		if (has(p)) change([], [p]);
		else change([p]);
	}

	const sections = $derived.by(() => {
		const out = new Map<string, PermissionArea[]>();
		for (const a of PERMISSION_AREAS) out.set(a.section, [...(out.get(a.section) ?? []), a]);
		return [...out.entries()];
	});

	const changed = $derived.by(() => {
		const saved = fromMatrix(data.matrix);
		if (saved.size !== allowed.size) return true;
		for (const k of allowed) if (!saved.has(k)) return true;
		return false;
	});
	/** Wie viele Rechte die Gruppe hat – als kleine Zahl an der Auswahl */
	const countFor = (r: Role) => [...allowed].filter((k) => k.startsWith(`${r}|`)).length;
</script>

{#snippet level(area: PermissionArea, which: 'view' | 'edit' | 'remove', l: PermissionLevel, title: string)}
	{#if l.own}
		<select
			class="select min-h-9 py-1 text-sm"
			value={levelOf(l)}
			disabled={!canEdit || (locked(l.all) && levelOf(l) === 'all')}
			onchange={(e) => setLevel(area, which, e.currentTarget.value as Level)}
			aria-label="{area.title}: {title}"
		>
			<option value="none">Nein</option>
			{#if l.self}<option value="self">{l.selfLabel ?? 'Nur eigene'}</option>{/if}
			<option value="own">{l.ownLabel ?? 'Eigene'}</option>
			<option value="all">Alle</option>
		</select>
	{:else if locked(l.all)}
		<span class="inline-grid size-6 place-items-center text-ink-3" title="Kann dem Admin nicht entzogen werden"><Lock size={15} aria-hidden="true" /></span>
	{:else}
		<input
			type="checkbox"
			class="size-5 accent-[var(--c-ink)]"
			checked={has(l.all)}
			disabled={!canEdit}
			onchange={() => (which === 'view' && has(l.all) ? setLevel(area, 'view', 'none') : toggle(l.all))}
			aria-label="{area.title}: {title}"
		/>
	{/if}
	{#if l.hint}<span class="mt-0.5 block text-[0.75rem] leading-tight text-ink-3">{l.hint}</span>{/if}
{/snippet}

<svelte:head><title>{pageTitle('Berechtigungen')}</title></svelte:head>

<div class="flex flex-wrap items-end justify-between gap-3 pt-2 pb-5">
	<div>
		<h1 class="flex items-center gap-2 text-[2rem] leading-tight"><ShieldCheck size={26} aria-hidden="true" />Berechtigungen</h1>
		<p class="text-ink-2">Was jede Gruppe darf – je Bereich Sehen, Erstellen, Bearbeiten, Status und Löschen.</p>
	</div>
	{#if canEdit}
		<button type="button" class="btn btn-ghost" onclick={() => (confirmReset = true)}>
			<RotateCcw size={18} aria-hidden="true" />Auf Standard zurücksetzen
		</button>
	{/if}
</div>

{#if form && 'message' in form && form.message}
	<p class="card mb-4 border-danger/40 p-3 text-sm text-danger" role="alert">{form.message}</p>
{/if}

<!-- Gruppe wählen -->
<div class="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Gruppe">
	{#each ROLES as r (r)}
		<button
			type="button"
			role="tab"
			aria-selected={role === r}
			class="shrink-0 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors {role === r
				? 'border-ink bg-ink text-surface'
				: 'border-line-strong bg-surface text-ink-2 hover:bg-surface-3'}"
			onclick={() => (role = r)}
		>
			{ROLE_LABELS[r]}<span class="num ml-1.5 text-[0.75rem] opacity-60">{countFor(r)}</span>
		</button>
	{/each}
</div>
<p class="mb-4 text-sm text-ink-2"><span class="font-medium text-ink">{ROLE_LABELS[role]}:</span> {ROLE_DESCRIPTIONS[role]}</p>

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
	<!-- Der ganze Stand aller Gruppen geht mit – sichtbar ist immer nur eine -->
	{#each [...allowed] as k (k)}<input type="hidden" name="erlaubt" value={k} />{/each}

	{#each sections as [section, areas] (section)}
		<section class="card mb-4 overflow-hidden">
			<div class="overflow-x-auto">
				<table class="w-full min-w-[58rem] border-collapse text-sm">
					<thead>
						<tr class="border-b border-line bg-surface-2">
							<th scope="col" class="sticky left-0 z-10 w-[13rem] bg-surface-2 px-4 py-2.5 text-left font-display text-[0.9375rem] font-semibold">{section}</th>
							<th scope="col" class="w-[10.5rem] px-3 py-2.5 text-left font-semibold">Sehen</th>
							<th scope="col" class="w-[7rem] px-3 py-2.5 text-left font-semibold">Erstellen</th>
							<th scope="col" class="w-[10.5rem] px-3 py-2.5 text-left font-semibold">Bearbeiten</th>
							<th scope="col" class="px-3 py-2.5 text-left font-semibold">Status</th>
							<th scope="col" class="w-[10rem] px-3 py-2.5 text-left font-semibold">Löschen</th>
						</tr>
					</thead>
					<tbody>
						{#each areas as area (area.key)}
							<tr class="border-b border-line align-top last:border-0">
								<th scope="row" class="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-normal">
									<span class="block font-medium">{area.title}</span>
									{#if area.hint}<span class="block text-[0.8125rem] text-ink-3">{area.hint}</span>{/if}
								</th>
								<td class="px-3 py-3">{@render level(area, 'view', area.view, 'Sehen')}</td>
								<td class="px-3 py-3">
									{#if area.create}
										<label class="inline-flex items-center gap-2">
											<input
												type="checkbox"
												class="size-5 accent-[var(--c-ink)]"
												checked={has(area.create.key)}
												disabled={!canEdit}
												onchange={() => toggle(area.create!.key)}
												aria-label="{area.title}: {area.create.label ?? 'Erstellen'}"
											/>
											{#if area.create.label}<span>{area.create.label}</span>{/if}
										</label>
										{#if area.create.hint}<span class="mt-0.5 block text-[0.75rem] leading-tight text-ink-3">{area.create.hint}</span>{/if}
									{:else}<span class="text-ink-3">–</span>{/if}
								</td>
								<td class="px-3 py-3">
									{#if area.edit}
										{#if area.edit.label}<span class="mb-1 block text-[0.8125rem]">{area.edit.label}</span>{/if}
										{@render level(area, 'edit', area.edit, area.edit.label ?? 'Bearbeiten')}
									{:else}<span class="text-ink-3">–</span>{/if}
								</td>
								<td class="px-3 py-3">
									{#if area.status?.length}
										<div class="grid gap-1.5 sm:grid-cols-2">
											{#each area.status as st (st.key)}
												<label class="flex items-start gap-2" title={st.hint}>
													<input
														type="checkbox"
														class="mt-0.5 size-[1.125rem] shrink-0 accent-[var(--c-ink)]"
														checked={has(st.key)}
														disabled={!canEdit}
														onchange={() => toggle(st.key)}
													/>
													<span class="leading-snug">{st.label}</span>
												</label>
											{/each}
										</div>
									{:else}<span class="text-ink-3">–</span>{/if}
								</td>
								<td class="px-3 py-3">
									{#if area.remove}{@render level(area, 'remove', area.remove, 'Löschen')}{:else}<span class="text-ink-3">–</span>{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	{/each}

	{#if canEdit}
		<div class="sticky bottom-24 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-[var(--shadow-1)] backdrop-blur lg:bottom-6">
			<button class="btn btn-primary" disabled={busy || !changed}>{busy ? 'Wird gespeichert …' : 'Änderungen speichern'}</button>
			{#if changed}<p class="text-sm text-ink-2">Es gibt ungespeicherte Änderungen.</p>{/if}
		</div>
	{/if}
	<p class="field-hint mt-3">
		Wer in einem Bereich etwas darf, darf ihn auch sehen – das wird gleich mit gesetzt. „Eigene Partie“ heißt: nur die der eigenen Partie
		(bei Tagesberichten auch die selbst angelegten). „Nur eigene“ bei Stundenzetteln heißt: nur den Zettel der Person selbst, ohne etwas daran zu ändern. Das Schloss markiert Rechte, die dem Admin nicht entzogen werden können – sonst käme niemand mehr an
		Benutzer, Berechtigungen und Einstellungen.
	</p>
</form>

<Dialog bind:open={confirmReset} title="Auf Standard zurücksetzen?">
	<p class="text-ink-2">Alle Gruppen bekommen wieder die ausgelieferten Standardrechte. Eigene Anpassungen gehen dabei verloren.</p>
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
