<script lang="ts">
	/**
	 * Unterschreiben mit Finger, Stift oder Maus. Die Striche landen als
	 * SVG-Pfad in einem festen 600×200-Feld – unabhängig davon, wie groß die
	 * Fläche am Gerät gerade dargestellt wird.
	 */
	import Eraser from '@lucide/svelte/icons/eraser';
	import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, strokesToPath, type Point } from '../signature';

	interface Props {
		/** Ergebnis als SVG-Pfad; leer, solange nichts gezeichnet ist */
		path?: string;
		label?: string;
	}
	let { path = $bindable(''), label = 'Hier unterschreiben' }: Props = $props();

	// Die Striche bleiben eine einfache Liste: Svelte würde verschachtelte Arrays im
	// Zustand als eigene Kopie führen, und Punkte am Original kämen dort nie an.
	let strokes: Point[][] = [];
	let current: Point[] | null = null;
	let pad: SVGSVGElement;
	let preview = $state('');

	const empty = $derived(preview === '');

	function redraw() {
		preview = strokesToPath(strokes);
	}

	/** Bildschirmposition in Koordinaten des 600×200-Felds umrechnen */
	function toPoint(e: PointerEvent): Point {
		const r = pad.getBoundingClientRect();
		return {
			x: ((e.clientX - r.left) / r.width) * SIGNATURE_WIDTH,
			y: ((e.clientY - r.top) / r.height) * SIGNATURE_HEIGHT
		};
	}

	function down(e: PointerEvent) {
		e.preventDefault();
		try {
			// Strich bleibt bei uns, auch wenn der Finger kurz über den Rand rutscht
			pad.setPointerCapture(e.pointerId);
		} catch {
			/* manche Eingaben lassen sich nicht einfangen – zeichnen geht trotzdem */
		}
		current = [toPoint(e)];
		strokes.push(current);
		redraw();
	}

	function move(e: PointerEvent) {
		if (!current) return;
		e.preventDefault();
		const p = toPoint(e);
		const last = current[current.length - 1];
		// Kleinste Zitterer weglassen – das hält den Pfad kurz
		if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
		current.push(p);
		redraw();
	}

	function up(e: PointerEvent) {
		if (!current) return;
		// Endpunkt immer mitnehmen – manche Geräte melden schnelle Striche ohne Zwischenpunkte
		const p = toPoint(e);
		const last = current[current.length - 1];
		if (Math.hypot(p.x - last.x, p.y - last.y) >= 1.5) current.push(p);
		current = null;
		redraw();
		path = preview;
	}

	function clear() {
		strokes = [];
		current = null;
		preview = '';
		path = '';
	}
</script>

<div class="space-y-2">
	<div class="relative overflow-hidden rounded-xl border border-line-strong bg-white">
		<svg
			bind:this={pad}
			viewBox="0 0 {SIGNATURE_WIDTH} {SIGNATURE_HEIGHT}"
			class="block aspect-[3/1] w-full cursor-crosshair touch-none select-none"
			role="img"
			aria-label={label}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
			onpointerleave={up}
		>
			<!-- Unterschriftslinie wie auf Papier -->
			<line x1="30" y1="160" x2="570" y2="160" stroke="#c9ccd1" stroke-width="2" />
			<path d={preview} fill="none" stroke="#1d2127" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
		{#if empty}
			<span class="pointer-events-none absolute inset-x-0 bottom-[22%] text-center text-sm text-[#8a9099]">{label}</span>
		{/if}
	</div>
	<div class="flex justify-end">
		<button type="button" class="btn btn-ghost btn-sm" onclick={clear} disabled={empty}>
			<Eraser size={16} aria-hidden="true" />Löschen
		</button>
	</div>
</div>
