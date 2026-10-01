<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import UserRound from '@lucide/svelte/icons/user-round';
	import LogOut from '@lucide/svelte/icons/log-out';
	import Sun from '@lucide/svelte/icons/sun';
	import Moon from '@lucide/svelte/icons/moon';
	import Monitor from '@lucide/svelte/icons/monitor';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Dialog from './Dialog.svelte';
	import { allNavItems, bottomRightTab } from '$lib/nav';
	import { fullName, initials } from '$lib/format';
	import { ROLE_LABELS, type Role } from '$lib/permissions';
	import { install } from '$lib/install.svelte';
	import { setTheme, type Theme } from '$lib/theme';

	interface Props {
		open: boolean;
		user: { firstName: string; lastName: string; username: string; role: Role };
		lowStockCount: number;
		theme: Theme;
	}
	let { open = $bindable(), user, lowStockCount, theme }: Props = $props();

	const inBottomBar = $derived(['/', '/lager/bestand', bottomRightTab(user.role)?.href]);
	const items = $derived(allNavItems(user.role).filter((i) => !inBottomBar.includes(i.href)));

	const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
		{ value: 'light', label: 'Hell', icon: Sun },
		{ value: 'dark', label: 'Dunkel', icon: Moon },
		{ value: 'system', label: 'System', icon: Monitor }
	];
</script>

<Dialog bind:open title="Menü">
	<div class="-mx-2 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
		<span class="grid size-11 place-items-center rounded-full bg-ink font-display font-semibold text-surface">{initials(user)}</span>
		<div class="min-w-0 flex-1">
			<p class="truncate font-semibold">{fullName(user)}</p>
			<p class="text-sm text-ink-3">{ROLE_LABELS[user.role]}</p>
		</div>
		<a href="/konto" class="btn btn-secondary btn-sm" onclick={() => (open = false)}><UserRound size={16} aria-hidden="true" />Konto</a>
	</div>

	<ul class="-mx-2 mt-3">
		{#each items as n (n.href)}
			<li>
				<a href={n.href} class="flex h-13 items-center gap-3 rounded-xl px-3 hover:bg-surface-3" onclick={() => (open = false)}>
					<n.icon size={20} class="text-ink-2" aria-hidden="true" />
					<span class="flex-1 font-medium">{n.label}</span>
					{#if n.badge === 'lowStock' && lowStockCount > 0}
						<span class="badge badge-warn num">{lowStockCount}</span>
					{/if}
					<ChevronRight size={18} class="text-ink-3" aria-hidden="true" />
				</a>
			</li>
		{/each}
		{#if install.suggest}
			<li>
				<a href="/app" class="flex h-13 items-center gap-3 rounded-xl px-3 hover:bg-surface-3" onclick={() => (open = false)}>
					<Smartphone size={20} class="text-ink-2" aria-hidden="true" />
					<span class="flex-1 font-medium">App installieren</span>
					<ChevronRight size={18} class="text-ink-3" aria-hidden="true" />
				</a>
			</li>
		{/if}
	</ul>

	<p class="mt-4 mb-2 text-sm text-ink-3" id="m-theme">Darstellung</p>
	<div class="grid grid-cols-3 gap-1 rounded-xl bg-surface-3 p-1" role="group" aria-labelledby="m-theme">
		{#each themes as t (t.value)}
			<button
				class="flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium {theme === t.value ? 'bg-surface shadow-sm' : 'text-ink-2'}"
				aria-pressed={theme === t.value}
				onclick={async () => {
					setTheme(t.value);
					await invalidateAll();
				}}
			>
				<t.icon size={16} aria-hidden="true" />{t.label}
			</button>
		{/each}
	</div>

	<form method="POST" action="/logout" class="mt-5">
		<button class="btn w-full border-line text-danger hover:bg-danger-soft"><LogOut size={18} aria-hidden="true" />Abmelden</button>
	</form>
</Dialog>
