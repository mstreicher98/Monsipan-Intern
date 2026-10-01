import ArrowDownToLine from '@lucide/svelte/icons/arrow-down-to-line';
import ArrowUpFromLine from '@lucide/svelte/icons/arrow-up-from-line';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import Undo2 from '@lucide/svelte/icons/undo-2';
import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
import type { Component } from 'svelte';
import { MOVEMENT_LABELS, MOVEMENT_NOUNS } from '$lib/format';

export type MovementType = 'IN' | 'OUT' | 'TRANSFER' | 'RETURN' | 'INVENTORY';

export const MOVEMENT_META: Record<MovementType, { noun: string; verb: string; icon: Component; tone: string; soft: string }> = {
	IN: { noun: MOVEMENT_NOUNS.IN, verb: MOVEMENT_LABELS.IN, icon: ArrowDownToLine, tone: 'text-ok', soft: 'bg-ok-soft text-ok' },
	OUT: { noun: MOVEMENT_NOUNS.OUT, verb: MOVEMENT_LABELS.OUT, icon: ArrowUpFromLine, tone: 'text-ink', soft: 'bg-surface-3 text-ink' },
	TRANSFER: { noun: MOVEMENT_NOUNS.TRANSFER, verb: MOVEMENT_LABELS.TRANSFER, icon: ArrowLeftRight, tone: 'text-info', soft: 'bg-info-soft text-info' },
	RETURN: { noun: MOVEMENT_NOUNS.RETURN, verb: MOVEMENT_LABELS.RETURN, icon: Undo2, tone: 'text-ok', soft: 'bg-ok-soft text-ok' },
	INVENTORY: { noun: MOVEMENT_NOUNS.INVENTORY, verb: MOVEMENT_LABELS.INVENTORY, icon: ClipboardCheck, tone: 'text-warn', soft: 'bg-warn-soft text-warn' }
};

interface RowLike {
	type: MovementType;
	quantity: number;
	countedQuantity: number | null;
	previousQuantity: number | null;
	fromLocation: string | null;
	toLocation: string | null;
	partyName: string | null;
	recipientName?: string | null;
	recipientUsername?: string | null;
}

/** Partie oder – bei Buchungen ohne Partie – die Person */
export function counterpart(r: RowLike): string | null {
	return r.partyName ?? r.recipientName ?? r.recipientUsername ?? null;
}

/** "+12", "−3", "3", "±0" */
export function signedQty(r: RowLike): string {
	switch (r.type) {
		case 'IN':
		case 'RETURN':
			return `+${r.quantity}`;
		case 'OUT':
			return `−${r.quantity}`;
		case 'TRANSFER':
			return `${r.quantity}`;
		case 'INVENTORY': {
			const d = (r.countedQuantity ?? 0) - (r.previousQuantity ?? 0);
			return d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0';
		}
	}
}

/** Woher → wohin, als lesbarer Text */
export function routeParts(r: RowLike): [string | null, string | null] {
	switch (r.type) {
		case 'IN':
			return [null, r.toLocation];
		case 'OUT':
			return [r.fromLocation, counterpart(r)];
		case 'TRANSFER':
			return [r.fromLocation, r.toLocation];
		case 'RETURN':
			return [counterpart(r), r.toLocation];
		case 'INVENTORY':
			return [null, r.toLocation];
	}
}
