<script lang="ts">
	/**
	 * Fotos zum Tagesbericht – nur intern. Am Handy direkt mit der Kamera
	 * aufnehmen oder aus der Galerie wählen; vor dem Hochladen werden sie am
	 * Gerät verkleinert. Antippen öffnet das Foto groß, wischen blättert.
	 */
	import { onMount, tick } from 'svelte';
	import Camera from '@lucide/svelte/icons/camera';
	import ImagePlus from '@lucide/svelte/icons/image-plus';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Trash from '@lucide/svelte/icons/trash';
	import X from '@lucide/svelte/icons/x';
	import { dateTime } from '$lib/format';
	import { toast } from '$lib/stores/toast.svelte';
	import { MAX_PHOTOS, PhotoError, shrinkPhoto } from '../photos';

	interface Photo {
		id: number;
		width: number;
		height: number;
		createdAt: Date | string;
		createdBy: string | null;
	}
	interface Props {
		reportId: number;
		photos: Photo[];
		/** Hinzufügen und Löschen */
		editable: boolean;
	}
	let { reportId, photos: initial, editable }: Props = $props();

	// Die Liste gehört ab hier der Ansicht – neue Fotos kommen ohne Neuladen dazu
	// svelte-ignore state_referenced_locally
	let photos = $state<Photo[]>(initial);
	let pending = $state(0);
	/** Kamera-Knopf nur, wo es eine Kamera zum Aufnehmen gibt (Handy, Tablet) */
	let touch = $state(false);
	onMount(() => (touch = matchMedia('(pointer: coarse)').matches));

	const src = (p: Photo, preview = false) => `/tagesberichte/${reportId}/fotos/${p.id}${preview ? '?vorschau' : ''}`;
	const room = $derived(MAX_PHOTOS - photos.length - pending);

	async function upload(e: Event & { currentTarget: HTMLInputElement }) {
		const input = e.currentTarget;
		const files = [...(input.files ?? [])];
		input.value = '';
		if (!files.length) return;
		if (files.length > room) toast.info(`Ein Bericht kann höchstens ${MAX_PHOTOS} Fotos haben.`);
		const list = files.slice(0, Math.max(0, room));
		pending += list.length;
		// Nacheinander – mehrere große Bilder gleichzeitig bringen ältere Handys ins Schwitzen
		for (const file of list) {
			try {
				const { photo, thumb } = await shrinkPhoto(file);
				const body = new FormData();
				body.set('foto', photo, 'foto.jpg');
				body.set('vorschau', thumb, 'vorschau.jpg');
				const res = await fetch(`/tagesberichte/${reportId}/fotos`, { method: 'POST', body });
				if (!res.ok) throw new PhotoError((await res.json().catch(() => null))?.message ?? 'Das Foto konnte nicht gespeichert werden.');
				photos = [...photos, await res.json()];
			} catch (err) {
				toast.error(err instanceof PhotoError ? err.message : 'Das Foto konnte nicht hochgeladen werden – bitte noch einmal versuchen.');
			} finally {
				pending--;
			}
		}
	}

	/* ---------------------------------------------------------- Großansicht */

	let dialog = $state<HTMLDialogElement>();
	let current = $state<number | null>(null);
	let confirmDelete = $state(false);
	let deleting = $state(false);
	const shown = $derived(current === null ? null : photos[current]);

	async function show(i: number) {
		current = i;
		confirmDelete = false;
		await tick();
		if (dialog && !dialog.open) dialog.showModal();
		// Fokus auf „Schließen" statt aufs Löschen
		dialog?.querySelector<HTMLElement>('[data-schliessen]')?.focus();
	}
	function step(by: number) {
		if (current === null || !photos.length) return;
		current = (current + by + photos.length) % photos.length;
		confirmDelete = false;
	}
	function onKey(e: KeyboardEvent) {
		if (e.key === 'ArrowLeft') step(-1);
		else if (e.key === 'ArrowRight') step(1);
	}

	/** Wischen nach links oder rechts blättert */
	let swipeX: number | null = null;
	function swipeStart(e: PointerEvent) {
		if (e.pointerType !== 'mouse') swipeX = e.clientX;
	}
	function swipeEnd(e: PointerEvent) {
		if (swipeX === null) return;
		const dx = e.clientX - swipeX;
		swipeX = null;
		if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
	}

	async function remove() {
		if (!shown || deleting) return;
		deleting = true;
		try {
			const res = await fetch(src(shown), { method: 'DELETE' });
			if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? '');
			photos = photos.filter((p) => p.id !== shown.id);
			confirmDelete = false;
			toast.info('Foto gelöscht');
			if (!photos.length) dialog?.close();
			else current = Math.min(current ?? 0, photos.length - 1);
		} catch (err) {
			toast.error((err instanceof Error && err.message) || 'Das Foto konnte nicht gelöscht werden.');
		} finally {
			deleting = false;
		}
	}
</script>

<section class="card mt-4 p-4 lg:p-5">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="flex items-center gap-2 text-lg">
			<Camera size={18} aria-hidden="true" />Fotos{#if photos.length}<span class="num text-sm font-normal text-ink-3">{photos.length}</span>{/if}
		</h2>
		{#if editable}
			<div class="flex flex-wrap gap-2">
				{#if touch}
					<label class="upload btn btn-secondary btn-sm {room <= 0 ? 'pointer-events-none opacity-50' : ''}">
						<Camera size={16} aria-hidden="true" />Foto aufnehmen
						<input type="file" accept="image/*" capture="environment" class="sr-only" disabled={room <= 0} onchange={upload} />
					</label>
				{/if}
				<label class="upload btn btn-secondary btn-sm {room <= 0 ? 'pointer-events-none opacity-50' : ''}">
					<ImagePlus size={16} aria-hidden="true" />{touch ? 'Aus der Galerie' : 'Bilder hochladen'}
					<input type="file" accept="image/*" multiple class="sr-only" disabled={room <= 0} onchange={upload} />
				</label>
			</div>
		{/if}
	</div>
	<p class="field-hint">Nur intern – Fotos stehen nicht im PDF und nicht beim Kunden.</p>

	{#if photos.length || pending}
		<ul class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
			{#each photos as p, i (p.id)}
				<li>
					<button type="button" class="block aspect-square w-full overflow-hidden rounded-xl bg-surface-2" onclick={() => show(i)} aria-label="Foto {i + 1} groß ansehen">
						<img src={src(p, true)} alt="" loading="lazy" decoding="async" class="size-full object-cover" />
					</button>
				</li>
			{/each}
			{#each { length: pending } as _, i (i)}
				<li class="grid aspect-square place-items-center rounded-xl bg-surface-2" aria-label="Foto wird hochgeladen">
					<span class="size-6 animate-spin rounded-full border-2 border-line-strong border-t-ink"></span>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mt-3 text-sm text-ink-3">{editable ? 'Noch keine Fotos – zum Beispiel von der fertigen Markierung.' : 'Keine Fotos.'}</p>
	{/if}
</section>

<dialog bind:this={dialog} class="foto" aria-label="Foto" onclose={() => (current = null)} onkeydown={onKey}>
	{#if shown && current !== null}
		<div class="flex h-full flex-col">
			<header class="flex items-center gap-2 p-2 text-white">
				<p class="min-w-0 flex-1 truncate px-2 text-sm">
					<span class="num font-medium">Foto {current + 1} von {photos.length}</span>
					<span class="text-white/70"> · {[shown.createdBy, dateTime(shown.createdAt)].filter(Boolean).join(', ')}</span>
				</p>
				{#if editable}
					<button type="button" class="knopf" onclick={() => (confirmDelete = true)} aria-label="Foto löschen"><Trash size={20} /></button>
				{/if}
				<button type="button" class="knopf" data-schliessen onclick={() => dialog?.close()} aria-label="Schließen"><X size={22} /></button>
			</header>

			<div class="relative min-h-0 flex-1" onpointerdown={swipeStart} onpointerup={swipeEnd} role="presentation">
				<img src={src(shown)} alt="Foto {current + 1}" class="absolute inset-0 size-full object-contain" />
				{#if photos.length > 1}
					<button type="button" class="knopf blaettern left-2" onclick={() => step(-1)} aria-label="Voriges Foto"><ChevronLeft size={26} /></button>
					<button type="button" class="knopf blaettern right-2" onclick={() => step(1)} aria-label="Nächstes Foto"><ChevronRight size={26} /></button>
				{/if}
			</div>

			{#if confirmDelete}
				<div class="flex flex-wrap items-center justify-end gap-2 bg-black/60 p-3 text-white">
					<p class="mr-auto text-sm">Dieses Foto löschen?</p>
					<button type="button" class="btn btn-ghost btn-sm text-white" onclick={() => (confirmDelete = false)}>Abbrechen</button>
					<button type="button" class="btn btn-primary btn-sm" disabled={deleting} onclick={remove}><Trash size={16} aria-hidden="true" />Löschen</button>
				</div>
			{/if}
		</div>
	{/if}
</dialog>

<style>
	/* Der Knopf ist ein Label um das Dateifeld – den Fokus zeigt er selbst */
	.upload:has(input:focus-visible) {
		outline: 2px solid var(--c-focus);
		outline-offset: 2px;
	}
	.foto {
		width: 100vw;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
		border: 0;
		background: rgb(0 0 0 / 0.94);
	}
	.foto::backdrop {
		background: rgb(0 0 0 / 0.6);
	}
	.knopf {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border-radius: 999px;
		color: #fff;
	}
	.knopf:hover {
		background: rgb(255 255 255 / 0.12);
	}
	.blaettern {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		background: rgb(0 0 0 / 0.35);
	}
</style>
