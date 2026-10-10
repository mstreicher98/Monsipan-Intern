/**
 * Push an Geräte: im Browser und als Web-App über Web-Push (VAPID), in der
 * Android-App über Firebase Cloud Messaging.
 *
 * Web-Push braucht nur ein Schlüsselpaar – das erzeugt der Server beim ersten
 * Bedarf selbst und legt es in der Datenbank ab (damit es auch in den
 * Sicherungen steckt). Wer eigene Schlüssel will, setzt VAPID_PUBLIC_KEY und
 * VAPID_PRIVATE_KEY.
 *
 * Firebase braucht ein Dienstkonto: die JSON-Datei aus der Firebase-Konsole.
 * Am einfachsten lädt der Admin sie unter Verwaltung → Benachrichtigungen hoch
 * (sie liegt dann in der Datenbank und geht nie zurück an den Browser); sonst
 * FIREBASE_SERVICE_ACCOUNT als Text, Base64 oder Dateipfad. Ohne sie bleibt
 * Push in der App aus; alles andere läuft weiter.
 */
import fs from 'node:fs';
import { createSign } from 'node:crypto';
import webpush from 'web-push';
import { and, eq, inArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { pushSubscriptions, settings } from './db/schema';

export interface PushPayload {
	title: string;
	body: string;
	url: string;
	/** Gleiche Kennung ersetzt die ältere Meldung auf dem Gerät */
	tag?: string;
}

/* ------------------------------------------------------------ Web-Push */

const VAPID_KEY = 'pushVapidKeys';
let vapid: { publicKey: string; privateKey: string } | null = null;

export async function vapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
	if (vapid) return vapid;
	if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
		vapid = { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
		return vapid;
	}
	const read = async () => {
		const row = await db.select().from(settings).where(eq(settings.key, VAPID_KEY)).get();
		try {
			const parsed = row ? JSON.parse(row.value) : null;
			return parsed?.publicKey && parsed?.privateKey ? (parsed as { publicKey: string; privateKey: string }) : null;
		} catch {
			return null;
		}
	};
	let keys = await read();
	if (!keys) {
		// Laufen zwei Anfragen gleichzeitig hier herein, gewinnt die erste – beide lesen danach dasselbe
		await db.insert(settings).values({ key: VAPID_KEY, value: JSON.stringify(webpush.generateVAPIDKeys()) }).onConflictDoNothing();
		keys = await read();
	}
	vapid = keys!;
	return vapid;
}

/** Absender-Angabe für die Push-Dienste: die Adresse der App */
function subject(): string {
	const origin = env.ORIGIN ?? '';
	return /^https:\/\//.test(origin) ? origin : 'mailto:office@monsipan.com';
}

type Result = 'ok' | 'gone' | 'error';

async function sendWeb(sub: { endpoint: string; p256dh: string | null; auth: string | null }, payload: PushPayload): Promise<Result> {
	if (!sub.p256dh || !sub.auth) return 'gone';
	const keys = await vapidKeys();
	try {
		await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
			TTL: 24 * 60 * 60,
			urgency: 'high',
			vapidDetails: { subject: subject(), publicKey: keys.publicKey, privateKey: keys.privateKey }
		});
		return 'ok';
	} catch (err) {
		const code = (err as { statusCode?: number }).statusCode;
		// Abgemeldet oder abgelaufen – dieses Gerät gibt es so nicht mehr
		if (code === 404 || code === 410) return 'gone';
		console.warn('[push] Web-Push fehlgeschlagen', code ?? (err as Error).message);
		return 'error';
	}
}

/* ------------------------------------------------------------ Firebase */

interface ServiceAccount {
	project_id: string;
	client_email: string;
	private_key: string;
}

const FIREBASE_KEY = 'pushFirebaseAccount';

/** Dienstkonto aus der JSON-Datei – oder eine Meldung, was daran nicht stimmt */
export function parseServiceAccount(text: string): ServiceAccount | { message: string } {
	let parsed: Partial<ServiceAccount> & { type?: string };
	try {
		parsed = JSON.parse(text);
	} catch {
		return { message: 'Die Datei ist keine JSON-Datei.' };
	}
	if (parsed.type !== 'service_account' || !parsed.project_id || !parsed.client_email || !parsed.private_key?.includes('PRIVATE KEY')) {
		return { message: 'Das ist kein Dienstkonto-Schlüssel aus Firebase (Projekteinstellungen → Dienstkonten → Neuen privaten Schlüssel generieren).' };
	}
	return { project_id: parsed.project_id, client_email: parsed.client_email, private_key: parsed.private_key };
}

let account: { sa: ServiceAccount | null; source: 'env' | 'upload' | null } | undefined;

async function serviceAccount(): Promise<ServiceAccount | null> {
	return (await firebaseAccount()).sa;
}

/** Dienstkonto samt Herkunft: aus der Umgebung (Vorrang) oder hochgeladen */
async function firebaseAccount() {
	if (account) return account;
	const raw = (env.FIREBASE_SERVICE_ACCOUNT ?? '').trim();
	if (raw) {
		let text = raw;
		try {
			if (!raw.startsWith('{')) text = fs.existsSync(raw) ? fs.readFileSync(raw, 'utf8') : Buffer.from(raw, 'base64').toString('utf8');
		} catch {
			/* unten als unlesbar gemeldet */
		}
		const parsed = parseServiceAccount(text);
		if ('message' in parsed) console.warn('[push] FIREBASE_SERVICE_ACCOUNT:', parsed.message);
		else return (account = { sa: parsed, source: 'env' });
	}
	const row = await db.select().from(settings).where(eq(settings.key, FIREBASE_KEY)).get();
	const parsed = row ? parseServiceAccount(row.value) : null;
	account = parsed && !('message' in parsed) ? { sa: parsed, source: 'upload' } : { sa: null, source: null };
	return account;
}

/** Hochgeladenen Schlüssel speichern bzw. entfernen – gilt sofort */
export async function saveFirebaseAccount(sa: ServiceAccount | null) {
	if (sa) {
		const value = JSON.stringify({ type: 'service_account', ...sa });
		await db.insert(settings).values({ key: FIREBASE_KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
	} else {
		await db.delete(settings).where(eq(settings.key, FIREBASE_KEY));
	}
	account = undefined;
	accessToken = null;
}

/** Für die Einstellungen: ob und woher – ohne den Schlüssel selbst */
export async function firebaseInfo() {
	const a = await firebaseAccount();
	return a.sa ? { source: a.source, projectId: a.sa.project_id, clientEmail: a.sa.client_email } : null;
}

let accessToken: { value: string; expires: number } | null = null;

/** Zugriffsschlüssel für Firebase: mit dem Dienstkonto signiert, eine Stunde gültig */
async function firebaseToken(sa: ServiceAccount): Promise<string> {
	if (accessToken && accessToken.expires > Date.now() + 60_000) return accessToken.value;
	const now = Math.floor(Date.now() / 1000);
	const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
	const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({
		iss: sa.client_email,
		scope: 'https://www.googleapis.com/auth/firebase.messaging',
		aud: 'https://oauth2.googleapis.com/token',
		iat: now,
		exp: now + 3600
	})}`;
	const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` })
	});
	if (!res.ok) throw new Error(`Firebase-Anmeldung fehlgeschlagen (${res.status})`);
	const json = (await res.json()) as { access_token: string; expires_in: number };
	accessToken = { value: json.access_token, expires: Date.now() + json.expires_in * 1000 };
	return accessToken.value;
}

/** Kanal der App für Benachrichtigungen – legt die App beim Einschalten an */
export const ANDROID_CHANNEL = 'benachrichtigungen';

async function sendFcm(deviceToken: string, payload: PushPayload): Promise<Result> {
	const sa = await serviceAccount();
	if (!sa) return 'error';
	try {
		const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
			method: 'POST',
			headers: { authorization: `Bearer ${await firebaseToken(sa)}`, 'content-type': 'application/json' },
			body: JSON.stringify({
				message: {
					token: deviceToken,
					notification: { title: payload.title, body: payload.body },
					data: { url: payload.url },
					android: { priority: 'HIGH', notification: { channel_id: ANDROID_CHANNEL, ...(payload.tag ? { tag: payload.tag } : {}) } }
				}
			})
		});
		if (res.ok) return 'ok';
		const text = await res.text();
		if (res.status === 404 || /UNREGISTERED|registration-token-not-registered/.test(text)) return 'gone';
		console.warn('[push] Firebase', res.status, text.slice(0, 200));
		return 'error';
	} catch (err) {
		console.warn('[push] Firebase nicht erreichbar', (err as Error).message);
		return 'error';
	}
}

/* ------------------------------------------------------------ Versand */

/** Was der Server kann – für die Einstellungen und die Seite der Person */
export async function pushStatus() {
	return { web: true, app: !!(await serviceAccount()) };
}

/**
 * An alle Geräte dieser Personen – je Person mit eigenem Inhalt (etwa dem Link
 * auf ihren Eintrag in der Glocke). Abgemeldete Geräte fliegen dabei raus.
 */
export async function pushTo(items: { userId: number; payload: PushPayload }[]): Promise<void> {
	if (!items.length) return;
	const byUser = new Map(items.map((i) => [i.userId, i.payload]));
	const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, [...byUser.keys()])).all();
	await Promise.all(
		subs.map(async (s) => {
			const payload = byUser.get(s.userId)!;
			const result = s.kind === 'web' ? await sendWeb(s, payload) : await sendFcm(s.endpoint, payload);
			if (result === 'gone') await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
			else if (result === 'ok') await db.update(pushSubscriptions).set({ lastUsedAt: new Date() }).where(eq(pushSubscriptions.id, s.id));
		})
	);
}

export type SubscriptionInput =
	| { kind: 'web'; endpoint: string; p256dh: string; auth: string }
	| { kind: 'fcm'; token: string };

/**
 * Gerät anmelden. Ein Gerät gehört immer der Person, die gerade angemeldet ist
 * – meldet sich jemand anderes am selben Browser an, wandert es mit.
 */
export async function saveSubscription(userId: number, input: SubscriptionInput, userAgent: string | null) {
	const values =
		input.kind === 'web'
			? { kind: 'web' as const, endpoint: input.endpoint, p256dh: input.p256dh, auth: input.auth }
			: { kind: 'fcm' as const, endpoint: input.token, p256dh: null, auth: null };
	await db
		.insert(pushSubscriptions)
		.values({ ...values, userId, userAgent: userAgent?.slice(0, 250) ?? null })
		.onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { ...values, userId, userAgent: userAgent?.slice(0, 250) ?? null } });
}

export async function removeSubscription(userId: number, endpoint: string) {
	await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}

/** Wie viele Geräte eine Person für Push angemeldet hat */
export async function deviceCount(userId: number): Promise<number> {
	const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
	return rows.length;
}
