/**
 * Benachrichtigungen zu Stundenzetteln: freigegeben (wartet auf die Prüfung),
 * wieder geöffnet, Arbeiter als Aushilfe übernommen. Im Hintergrund.
 */
import { notify } from '$lib/server/notifications';
import { isoWeek } from '../week';
import { sheetDetail, writerParty } from './timesheets';

const nameOf = (s: { firstName: string; lastName: string; username: string }) => [s.firstName, s.lastName].filter(Boolean).join(' ') || s.username;

export function notifySheet(event: 'stunden.freigegeben' | 'stunden.geoeffnet' | 'stunden.aushilfe', sheetId: number, actorId: number) {
	(async () => {
		const s = await sheetDetail(sheetId);
		if (!s) return;
		const week = `KW ${isoWeek(s.weekStart).week}`;
		const name = nameOf(s);
		if (event === 'stunden.aushilfe') {
			// An die eigene Partie des Arbeiters: der Zettel wird diese Woche woanders geschrieben
			notify({
				event,
				title: `${name} hilft bei ${s.writingPartyName ?? 'einer anderen Partie'} aus`,
				body: `${week} – den Stundenzettel schreibt diese Woche ${s.writingPartyName ?? 'die andere Partie'}`,
				url: `/stundenzettel/${s.id}`,
				partyId: s.partyId,
				actorId
			});
			return;
		}
		notify({
			event,
			title: `Stundenzettel ${name} ${event === 'stunden.freigegeben' ? 'freigegeben' : 'wieder geöffnet'}`,
			body: [week, s.writingPartyName ?? s.partyName].filter(Boolean).join(' · '),
			url: `/stundenzettel/${s.id}`,
			partyId: writerParty(s),
			actorId
		});
	})().catch((err) => console.error(`[benachrichtigung] ${event}`, err));
}
