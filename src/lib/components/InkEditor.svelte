<script lang="ts">
	/**
	 * Handschrift direkt auf dem Formular – fürs Tablet im Hochformat.
	 *
	 * Hintergrund ist das PDF des Dokuments (ohne Handschrift), gezeichnet mit
	 * pdf.js. Darüber liegt je Seite eine SVG-Ebene in den Koordinaten der
	 * PDF-Seite: Was hier geschrieben wird, steht im Ausdruck und im PDF genau
	 * an derselben Stelle.
	 *
	 * Nur Stift und Maus schreiben. Ein Finger verschiebt, zwei Finger zoomen;
	 * solange der Stift in der Nähe ist, zählen Finger nicht (Handballen).
	 */
	import { onMount, tick, type Snippet } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import Pen from '@lucide/svelte/icons/pen';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Redo from '@lucide/svelte/icons/redo-2';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import Maximize from '@lucide/svelte/icons/move-horizontal';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
	import { distanceToStroke, INK_COLORS, INK_WIDTH, strokePath, type InkPages, type InkStroke } from '$lib/ink';

	interface Props {
		/** PDF des Dokuments ohne Handschrift */
		background: string;
		ink: InkPages | null;
		/** PUT mit dem ganzen Stand als JSON */
		saveUrl: string;
		editable: boolean;
		/** Weitere Knöpfe rechts in der Leiste */
		actions?: Snippet;
	}
	let { background, ink: initial, saveUrl, editable, actions }: Props = $props();

	type Tool = 'stift' | 'radierer';
	type Color = keyof typeof INK_COLORS;

	// Der Stand gehört ab hier der Ansicht; ersetzt wird immer das ganze Objekt (kein tiefer Proxy)
	// svelte-ignore state_referenced_locally
	let ink = $state.raw<InkPages>(structuredClone(initial ?? {}));
	let undoStack: InkPages[] = [];
	let redoStack: InkPages[] = [];
	let canUndo = $state(false);
	let canRedo = $state(false);

	let tool = $state<Tool>('stift');
	let color = $state<Color>('blau');

	let pages = $state<{ w: number; h: number }[]>([]);
	let status = $state<'laden' | 'fertig' | 'fehler'>('laden');
	let saveState = $state<'gespeichert' | 'ungespeichert' | 'speichert' | 'fehler'>('gespeichert');

	let rootWidth = $state(0);
	let zoom = $state(1);
	/** Auflösung der Hintergrundbilder – folgt dem Zoom erst, wenn er zur Ruhe kommt */
	let renderZoom = $state(1);
	let hscroll = $state<HTMLDivElement>();
	let sheetBox = $state<HTMLDivElement>();
	let landscape = $state(false);
	/** Pixel je CSS-Pixel – erst im Browser bekannt */
	let dpr = $state(1);

	const MAX_ZOOM = 4;
	const fitWidth = $derived(Math.max(280, Math.min(rootWidth, 1000)));
	const sheetWidth = $derived(fitWidth * zoom);

	let doc: PDFDocumentProxy | null = null;
	let loading: PDFDocumentLoadingTask | null = null;

	onMount(() => {
		let cancelled = false;
		dpr = Math.min(3, window.devicePixelRatio || 1);
		const media = matchMedia('(orientation: landscape) and (pointer: coarse)');
		const orient = () => (landscape = media.matches);
		orient();
		media.addEventListener('change', orient);

		(async () => {
			try {
				const pdfjs = await import('pdfjs-dist');
				const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
				pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
				loading = pdfjs.getDocument({ url: background, withCredentials: true });
				const loaded = await loading.promise;
				if (cancelled) return;
				doc = loaded;
				const list: { w: number; h: number }[] = [];
				for (let n = 1; n <= loaded.numPages; n++) {
					const vp = (await loaded.getPage(n)).getViewport({ scale: 1 });
					list.push({ w: vp.width, h: vp.height });
				}
				pages = list;
				status = 'fertig';
			} catch (err) {
				console.error('[handschrift]', err);
				if (!cancelled) status = 'fehler';
			}
		})();

		// Ungespeichertes beim Verlassen der Seite noch losschicken
		const hide = () => {
			if (document.visibilityState === 'hidden' && saveState === 'ungespeichert') void save(true);
		};
		document.addEventListener('visibilitychange', hide);

		return () => {
			cancelled = true;
			media.removeEventListener('change', orient);
			document.removeEventListener('visibilitychange', hide);
			loading?.destroy();
			loading = null;
			doc = null;
		};
	});

	beforeNavigate(() => {
		if (saveState === 'ungespeichert') void save(true);
	});

	// Hintergrund schärfer zeichnen, sobald der Zoom eine Weile steht
	$effect(() => {
		const z = zoom;
		const t = setTimeout(() => (renderZoom = Math.min(z, 3)), 300);
		return () => clearTimeout(t);
	});

	/** Zeichnet eine PDF-Seite in die Leinwand, neu bei anderer Auflösung */
	function paint(canvas: HTMLCanvasElement, params: { n: number; px: number }) {
		let task: RenderTask | null = null;
		let current = { n: -1, px: 0 };
		async function draw(p: { n: number; px: number }) {
			if (!doc || (p.n === current.n && Math.abs(p.px - current.px) < 2)) return;
			current = p;
			task?.cancel();
			const page = await doc.getPage(p.n + 1);
			const vp = page.getViewport({ scale: p.px / page.getViewport({ scale: 1 }).width });
			const off = document.createElement('canvas');
			off.width = Math.round(vp.width);
			off.height = Math.round(vp.height);
			task = page.render({ canvas: off, viewport: vp });
			try {
				await task.promise;
				// Erst fertig zeichnen, dann tauschen – sonst flackert es beim Zoomen
				canvas.width = off.width;
				canvas.height = off.height;
				canvas.getContext('2d')!.drawImage(off, 0, 0);
			} catch {
				/* abgebrochen */
			}
		}
		void draw(params);
		return {
			update: (p: { n: number; px: number }) => void draw(p),
			destroy: () => task?.cancel()
		};
	}

	/* ------------------------------------------------------------ Speichern */

	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	function changed(next: InkPages) {
		undoStack.push(ink);
		if (undoStack.length > 60) undoStack.shift();
		redoStack = [];
		ink = next;
		canUndo = true;
		canRedo = false;
		scheduleSave();
	}

	function scheduleSave() {
		saveState = 'ungespeichert';
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => void save(), 800);
	}

	async function save(leaving = false) {
		clearTimeout(saveTimer);
		const body = JSON.stringify(ink);
		saveState = 'speichert';
		try {
			const res = await fetch(saveUrl, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body,
				// Beim Verlassen soll die Anfrage die Seite überleben (geht nur bis 64 KB)
				keepalive: leaving && body.length < 60_000
			});
			if (!res.ok) throw new Error(String(res.status));
			// Kam in der Zwischenzeit etwas dazu, bleibt es ungespeichert
			if (JSON.stringify(ink) === body) saveState = 'gespeichert';
			else scheduleSave();
		} catch {
			saveState = 'fehler';
		}
	}

	function undo() {
		const prev = undoStack.pop();
		if (!prev) return;
		redoStack.push(ink);
		ink = prev;
		canUndo = undoStack.length > 0;
		canRedo = true;
		scheduleSave();
	}
	function redo() {
		const next = redoStack.pop();
		if (!next) return;
		undoStack.push(ink);
		ink = next;
		canUndo = true;
		canRedo = redoStack.length > 0;
		scheduleSave();
	}

	/* -------------------------------------------------- Stift, Finger, Maus */

	/** Wann der Stift zuletzt aktiv war – Finger in dieser Zeit sind die Hand */
	let lastPen = 0;
	const PALM_MS = 900;

	/** Der Strich, der gerade entsteht (außerhalb des Zustands – sonst wäre jeder Punkt teuer) */
	let drawing: { page: number; pointerId: number; pts: number[] } | null = null;
	let livePath = $state('');
	let livePage = $state(-1);
	let erasing: { page: number; pointerId: number; before: InkPages; removed: boolean } | null = null;

	const touches = new Map<number, { x: number; y: number }>();
	let pinch: { dist: number; zoom: number; cx: number; cy: number } | null = null;

	function toPage(e: PointerEvent, page: number, svg: SVGSVGElement): [number, number] {
		const r = svg.getBoundingClientRect();
		const p = pages[page];
		return [((e.clientX - r.left) / r.width) * p.w, ((e.clientY - r.top) / r.height) * p.h];
	}

	function down(e: PointerEvent, page: number) {
		const svg = e.currentTarget as SVGSVGElement;
		if (e.pointerType === 'touch') {
			if (performance.now() - lastPen < PALM_MS || drawing) return;
			touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
			if (touches.size === 2) startPinch();
			return;
		}
		if (e.pointerType === 'pen') lastPen = performance.now();
		if (e.pointerType === 'mouse' && e.button !== 0) return;
		if (!editable) return;
		e.preventDefault();
		try {
			svg.setPointerCapture(e.pointerId);
		} catch {
			/* nicht jede Eingabe lässt sich einfangen */
		}
		// Radierer: Werkzeug gewählt oder Radier-Ende/-Taste am Stift
		if (tool === 'radierer' || (e.buttons & 32) === 32) {
			erasing = { page, pointerId: e.pointerId, before: ink, removed: false };
			eraseAt(e, page, svg);
			return;
		}
		const [x, y] = toPage(e, page, svg);
		drawing = { page, pointerId: e.pointerId, pts: [x, y] };
		livePage = page;
		livePath = strokePath(drawing.pts);
	}

	function move(e: PointerEvent, page: number) {
		const svg = e.currentTarget as SVGSVGElement;
		if (e.pointerType === 'pen') lastPen = performance.now();
		if (e.pointerType === 'touch') {
			const t = touches.get(e.pointerId);
			if (!t) return;
			if (touches.size === 1 && !pinch) {
				// Ein Finger verschiebt
				hscroll?.scrollBy({ left: t.x - e.clientX });
				window.scrollBy({ top: t.y - e.clientY });
			}
			t.x = e.clientX;
			t.y = e.clientY;
			if (pinch && touches.size === 2) updatePinch();
			return;
		}
		if (erasing && erasing.pointerId === e.pointerId) {
			eraseAt(e, page, svg);
			return;
		}
		if (!drawing || drawing.pointerId !== e.pointerId) return;
		e.preventDefault();
		const events = e.getCoalescedEvents?.() ?? [e];
		for (const ev of events.length ? events : [e]) {
			const [x, y] = toPage(ev, drawing.page, svg);
			const n = drawing.pts.length;
			// Kleinste Zitterer weglassen – das hält die Striche schlank
			if (Math.hypot(x - drawing.pts[n - 2], y - drawing.pts[n - 1]) < 0.35) continue;
			drawing.pts.push(x, y);
		}
		livePath = strokePath(drawing.pts);
	}

	function up(e: PointerEvent) {
		if (e.pointerType === 'touch') {
			touches.delete(e.pointerId);
			if (touches.size < 2) pinch = null;
			return;
		}
		if (e.pointerType === 'pen') lastPen = performance.now();
		if (erasing && erasing.pointerId === e.pointerId) {
			// Ein Radiervorgang ist ein Schritt zum Rückgängigmachen
			if (erasing.removed) {
				undoStack.push(erasing.before);
				redoStack = [];
				canUndo = true;
				canRedo = false;
				scheduleSave();
			}
			erasing = null;
			return;
		}
		if (!drawing || drawing.pointerId !== e.pointerId) return;
		const stroke: InkStroke = {
			c: INK_COLORS[color],
			w: INK_WIDTH,
			p: drawing.pts.map((v) => Math.round(v * 10) / 10)
		};
		const key = String(drawing.page);
		drawing = null;
		livePath = '';
		livePage = -1;
		changed({ ...ink, [key]: [...(ink[key] ?? []), stroke] });
	}

	/** Striche unter dem Radierer entfernen (Abstand in Punkt, beim Zoomen genauer) */
	function eraseAt(e: PointerEvent, page: number, svg: SVGSVGElement) {
		const [x, y] = toPage(e, page, svg);
		const key = String(page);
		const list = ink[key] ?? [];
		const reach = 5 / zoom;
		const keep = list.filter((s) => distanceToStroke(s, x, y) > reach + s.w);
		if (keep.length === list.length) return;
		ink = { ...ink, [key]: keep };
		if (erasing) erasing.removed = true;
	}

	function startPinch() {
		const [a, b] = [...touches.values()];
		pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
	}

	function updatePinch() {
		if (!pinch) return;
		const [a, b] = [...touches.values()];
		const dist = Math.hypot(a.x - b.x, a.y - b.y);
		const cx = (a.x + b.x) / 2;
		const cy = (a.y + b.y) / 2;
		void setZoom((pinch.zoom * dist) / Math.max(20, pinch.dist), cx, cy);
		// Mitbewegen mit zwei Fingern
		hscroll?.scrollBy({ left: pinch.cx - cx });
		window.scrollBy({ top: pinch.cy - cy });
		pinch.cx = cx;
		pinch.cy = cy;
	}

	/** Zoom um einen Punkt am Bildschirm, damit dieser Punkt stehen bleibt */
	async function setZoom(next: number, cx?: number, cy?: number) {
		next = Math.min(MAX_ZOOM, Math.max(1, next));
		if (!hscroll || !sheetBox || Math.abs(next - zoom) < 0.001) return;
		const box = sheetBox.getBoundingClientRect();
		const px = cx ?? window.innerWidth / 2;
		const py = cy ?? window.innerHeight / 2;
		const fx = (px - box.left) / box.width;
		const fy = (py - box.top) / box.height;
		zoom = next;
		await tick();
		const after = sheetBox.getBoundingClientRect();
		hscroll.scrollBy({ left: after.left + fx * after.width - px });
		window.scrollBy({ top: after.top + fy * after.height - py });
	}

	const saveLabel = $derived(
		{ gespeichert: 'Gespeichert', ungespeichert: 'Nicht gespeichert …', speichert: 'Speichert …', fehler: 'Nicht gespeichert – tippen zum Wiederholen' }[
			saveState
		]
	);
</script>

<div class="ink-editor" bind:clientWidth={rootWidth}>
	<!-- Werkzeugleiste bleibt beim Scrollen oben -->
	<div class="sticky top-16 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-1.5 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-[var(--shadow-1)] backdrop-blur print:hidden">
		{#if editable}
			<div class="flex items-center gap-1 rounded-xl bg-surface-2 p-1" role="group" aria-label="Werkzeug">
				{#each [['blau', 'Blau'], ['schwarz', 'Schwarz']] as [key, label] (key)}
					<button
						type="button"
						class="tool {tool === 'stift' && color === key ? 'aktiv' : ''}"
						aria-pressed={tool === 'stift' && color === key}
						aria-label="Stift {label}"
						title="Stift {label}"
						onclick={() => ((tool = 'stift'), (color = key as Color))}
					>
						<Pen size={18} aria-hidden="true" />
						<span class="punkt" style:background={INK_COLORS[key as Color]}></span>
					</button>
				{/each}
				<button
					type="button"
					class="tool {tool === 'radierer' ? 'aktiv' : ''}"
					aria-pressed={tool === 'radierer'}
					aria-label="Radierer"
					title="Radierer – auch die Radiertaste am Stift"
					onclick={() => (tool = 'radierer')}
				>
					<Eraser size={18} aria-hidden="true" />
				</button>
			</div>
			<button type="button" class="tool" onclick={undo} disabled={!canUndo} aria-label="Rückgängig" title="Rückgängig"><Undo size={18} /></button>
			<button type="button" class="tool" onclick={redo} disabled={!canRedo} aria-label="Wiederholen" title="Wiederholen"><Redo size={18} /></button>
		{/if}
		<div class="flex items-center gap-0.5">
			<button type="button" class="tool" onclick={() => setZoom(zoom / 1.25)} disabled={zoom <= 1} aria-label="Verkleinern"><ZoomOut size={18} /></button>
			<span class="num w-11 text-center text-[0.8125rem] text-ink-2">{Math.round(zoom * 100)} %</span>
			<button type="button" class="tool" onclick={() => setZoom(zoom * 1.25)} disabled={zoom >= MAX_ZOOM} aria-label="Vergrößern"><ZoomIn size={18} /></button>
			<button type="button" class="tool" onclick={() => setZoom(1)} disabled={zoom === 1} aria-label="Auf Breite" title="Auf Breite"><Maximize size={18} /></button>
		</div>
		{#if editable}
			<button
				type="button"
				class="text-[0.8125rem] {saveState === 'fehler' ? 'font-medium text-danger' : 'text-ink-3'}"
				onclick={() => saveState === 'fehler' && save()}
				aria-live="polite"
			>
				{saveLabel}
			</button>
		{/if}
		<div class="ml-auto flex flex-wrap items-center gap-1.5">{@render actions?.()}</div>
	</div>

	{#if landscape}
		<p class="mb-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2 print:hidden">
			<Smartphone size={16} aria-hidden="true" />Zum Schreiben das Tablet am besten ins Hochformat drehen.
		</p>
	{/if}

	{#if status === 'laden'}
		<p class="py-16 text-center text-ink-3">Formular wird geladen …</p>
	{:else if status === 'fehler'}
		<p class="card p-6 text-center text-danger">Das Formular konnte nicht geladen werden.</p>
	{/if}

	<div class="overflow-x-auto" bind:this={hscroll}>
		<div class="mx-auto space-y-4" style:width="{sheetWidth}px" bind:this={sheetBox}>
			{#each pages as p, i (i)}
				<div class="seite" style:aspect-ratio="{p.w} / {p.h}">
					<canvas use:paint={{ n: i, px: Math.round(fitWidth * renderZoom * dpr) }} aria-hidden="true"></canvas>
					<svg
						viewBox="0 0 {p.w} {p.h}"
						class="ebene {editable ? (tool === 'radierer' ? 'radieren' : 'schreiben') : ''}"
						role="img"
						aria-label="Seite {i + 1} – Handschrift"
						onpointerdown={(e) => down(e, i)}
						onpointermove={(e) => move(e, i)}
						onpointerup={up}
						onpointercancel={up}
						onlostpointercapture={up}
					>
						{#each ink[String(i)] ?? [] as s (s)}
							<path d={strokePath(s.p)} fill="none" stroke={s.c} stroke-width={s.w} stroke-linecap="round" stroke-linejoin="round" />
						{/each}
						{#if livePage === i && livePath}
							<path d={livePath} fill="none" stroke={INK_COLORS[color]} stroke-width={INK_WIDTH} stroke-linecap="round" stroke-linejoin="round" />
						{/if}
					</svg>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.tool {
		position: relative;
		display: grid;
		height: 2.5rem;
		min-width: 2.5rem;
		place-items: center;
		border-radius: 0.75rem;
		color: var(--c-ink-2);
		transition: background-color 120ms;
	}
	.tool:hover:not(:disabled) {
		background: var(--c-surface-3);
		color: var(--c-ink);
	}
	.tool:disabled {
		opacity: 0.35;
	}
	.tool.aktiv {
		background: var(--c-ink);
		color: var(--c-surface);
	}
	.punkt {
		position: absolute;
		right: 0.35rem;
		bottom: 0.35rem;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		box-shadow: 0 0 0 1.5px var(--c-surface);
	}
	.seite {
		position: relative;
		width: 100%;
		background: #fff;
		box-shadow: var(--shadow-1);
		border: 1px solid var(--c-line);
	}
	.seite canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.ebene {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Finger, Stift und Maus kommen hier an – verschieben und zoomen macht die Ansicht selbst */
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.schreiben {
		cursor: crosshair;
	}
	.radieren {
		cursor: cell;
	}
</style>
