/**
 * Benachrichtigungen zu Tagesberichten: freigegeben (wartet auf die Prüfung),
 * vom Kunden unterschrieben, wieder geöffnet. Im Hintergrund.
 */
import { notify } from '$lib/server/notifications';
import { reportDateLabel } from '../sheet';
import { reportDetail } from './reports';

type ReportEvent = 'tagesbericht.freigegeben' | 'tagesbericht.unterschrieben' | 'tagesbericht.geoeffnet';

const TITLE: Record<ReportEvent, (nr: string) => string> = {
	'tagesbericht.freigegeben': (nr) => `Tagesbericht ${nr} freigegeben`,
	'tagesbericht.unterschrieben': (nr) => `Tagesbericht ${nr} vom Kunden unterschrieben`,
	'tagesbericht.geoeffnet': (nr) => `Tagesbericht ${nr} wieder geöffnet`
};

export function notifyReport(event: ReportEvent, reportId: number, actorId?: number | null) {
	(async () => {
		const r = await reportDetail(reportId);
		if (!r) return;
		notify({
			event,
			title: TITLE[event](r.number || '–'),
			body: [r.site || r.road, reportDateLabel(r.date, r.dateTo), r.partyName, event === 'tagesbericht.unterschrieben' && r.customerName].filter(Boolean).join(' · '),
			url: `/tagesberichte/${r.id}`,
			partyId: r.partyId,
			actorId
		});
	})().catch((err) => console.error(`[benachrichtigung] ${event}`, err));
}
