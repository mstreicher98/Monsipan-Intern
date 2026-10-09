/**
 * Anfragen: aus einer hineinkopierten E-Mail Betreff, Absender, E-Mail-Adresse
 * und Telefon herauslesen – nur als Vorschlag, alles bleibt änderbar. Eigene
 * Adressen (monsipan) zählen nicht: bei weitergeleiteten Mails steht oben oft
 * die eigene, darunter die des Kunden.
 */

export interface InquiryGuess {
	subject: string;
	name: string;
	email: string;
	phone: string;
}

/** Eine eingefügte E-Mail darf lang sein, aber nicht beliebig */
export const MAX_INQUIRY_TEXT = 20000;

const OWN = /monsipan/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const HEADER_FROM = /^[ \t>*]*(?:von|from|absender)[ \t]*:[ \t]*(.+)$/gim;
const HEADER_SUBJECT = /^[ \t>*]*(?:betreff|subject|betr\.?)[ \t]*:[ \t]*(.+)$/im;
/** Vorsilben beim Antworten und Weiterleiten */
const REPLY_PREFIX = /^(?:(?:aw|re|wg|fw|fwd|antw|weitergeleitet)\s*:\s*)+/i;
/** Telefon mit Beschriftung davor: „Tel.: 01 234 56", „Mobil +43 664 …" */
const PHONE_LABELED = /(?:tel(?:efon)?|mobil|handy|mob|phone|fon)\.?[ \t]*(?:nr\.?)?[ \t]*[:.]?[ \t]*(\+?\d[\d \t/()-]{5,}\d)/i;
/**
 * Telefon ohne Beschriftung: österreichisch mit +43, 0043 oder führender 0 vor
 * der Vorwahl. Punkte gehören nicht dazu – sonst wären Datumsangaben Telefonnummern.
 */
const PHONE_PLAIN = /(?:\+43|0043|(?<!\d)0(?=[1-9]))[ \t]?\(?\d[\d \t/()-]{5,}\d/;
/** Grußformeln – darunter steht meist der Name */
const CLOSING = /^(?:mit\s+)?(?:freundlichen|besten|lieben|herzlichen|schönen|viele|liebe|beste|freundliche)?\s*grü(?:ß|ss)en?\b.*$|^(?:mfg|lg|vg|bg)\b.*$/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

/** „Max Muster <max@firma.at>", „"Muster, Max" [mailto:max@firma.at]" oder nur die Adresse */
function splitSender(value: string): { name: string; email: string } {
	const email = (value.match(EMAIL) ?? [])[0] ?? '';
	const name = clean(
		value
			.replace(/\[mailto:[^\]]*\]/gi, '')
			.replace(/<[^>]*>/g, '')
			.replace(EMAIL, '')
			.replace(/["'()]/g, '')
	).replace(/[;,]$/, '');
	return { name, email };
}

/** Name unter der Grußformel – eine kurze Zeile ohne Ziffern und ohne @ */
function nameAfterClosing(lines: string[]): string {
	for (let i = 0; i < lines.length; i++) {
		if (!CLOSING.test(lines[i].trim())) continue;
		for (const next of lines.slice(i + 1, i + 4)) {
			const t = next.trim();
			if (!t) continue;
			if (t.length <= 60 && !/[\d@:]/.test(t)) return clean(t);
			break;
		}
	}
	return '';
}

export function guessFromEmail(text: string): InquiryGuess {
	const body = String(text ?? '').slice(0, MAX_INQUIRY_TEXT);
	const subjectHit = HEADER_SUBJECT.exec(body);
	const subject = subjectHit ? clean(subjectHit[1].replace(REPLY_PREFIX, '')).slice(0, 300) : '';

	let name = '';
	let email = '';
	for (const hit of body.matchAll(HEADER_FROM)) {
		const sender = splitSender(hit[1]);
		if (OWN.test(sender.email) || (!sender.email && OWN.test(sender.name))) continue;
		name = sender.name;
		email = sender.email;
		break;
	}
	if (!email) email = (body.match(EMAIL) ?? []).find((e) => !OWN.test(e)) ?? '';
	if (!name) name = nameAfterClosing(body.split(/\r?\n/));

	// Telefon aus dem Text ohne die eigenen Zeilen (Signatur von Monsipan in Weiterleitungen)
	const foreign = body
		.split(/\r?\n/)
		.filter((l) => !OWN.test(l))
		.join('\n');
	const phoneHit = PHONE_LABELED.exec(foreign) ?? PHONE_PLAIN.exec(foreign);
	const phone = phoneHit ? clean(phoneHit[1] ?? phoneHit[0]).slice(0, 40) : '';

	return { subject, name: name.slice(0, 160), email: email.slice(0, 200), phone };
}

/** Freemail-Anbieter – bei denen sagt die Domain nichts über die Firma */
const FREEMAIL = new Set([
	'gmail.com',
	'gmx.at',
	'gmx.net',
	'gmx.de',
	'aon.at',
	'a1.net',
	'chello.at',
	'hotmail.com',
	'outlook.com',
	'live.com',
	'live.at',
	'yahoo.com',
	'yahoo.de',
	'icloud.com',
	'me.com',
	'web.de',
	'kabsi.at',
	'drei.at',
	'utanet.at'
]);

/** Domain einer Firmen-Adresse – bei Freemail-Adressen leer */
export function companyDomain(email: string): string {
	const domain = email.split('@')[1]?.trim().toLowerCase() ?? '';
	return domain && !FREEMAIL.has(domain) ? domain : '';
}
