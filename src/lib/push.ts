/**
 * Push auf diesem Gerät ein- und ausschalten – im Browser über Web-Push, in
 * der Android-App über deren Push-Dienst (Firebase). Das Gerät meldet sich
 * beim Server unter der Person an, die gerade angemeldet ist.
 */
import { inNativeApp } from './native';

export type PushState =
	/** Geht hier nicht (alter Browser, alte App, am Server nicht eingerichtet) */
	| 'unsupported'
	/** Im Browser bzw. in Android blockiert – nur dort wieder erlauben */
	| 'denied'
	| 'off'
	| 'on';

interface PushInfo {
	vapidPublicKey: string;
	web: boolean;
	app: boolean;
}

/* ---------------------------------------------------- Android-App */

interface PushPlugin {
	checkPermissions(): Promise<{ receive: string }>;
	requestPermissions(): Promise<{ receive: string }>;
	register(): Promise<void>;
	unregister?(): Promise<void>;
	createChannel?(channel: { id: string; name: string; description?: string; importance: number; visibility?: number }): Promise<void>;
	addListener(event: string, fn: (data: never) => void): Promise<{ remove(): Promise<void> }>;
}

function appPlugin(): PushPlugin | null {
	if (typeof window === 'undefined') return null;
	const cap = (window as { Capacitor?: { Plugins?: { PushNotifications?: PushPlugin } } }).Capacitor;
	return cap?.Plugins?.PushNotifications ?? null;
}

const TOKEN_KEY = 'push-geraet';
const CHANNEL = 'benachrichtigungen';

function remember(token: string | null) {
	try {
		if (token) localStorage.setItem(TOKEN_KEY, token);
		else localStorage.removeItem(TOKEN_KEY);
	} catch {
		/* kein Speicher */
	}
}
function remembered(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY);
	} catch {
		return null;
	}
}

async function send(method: 'POST' | 'DELETE', body: object) {
	const res = await fetch('/api/push', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
	if (!res.ok) throw new Error('Push-Anmeldung fehlgeschlagen');
}

let listening = false;

/** Token holen: register() liefert ihn über ein Ereignis */
async function appToken(plugin: PushPlugin): Promise<string> {
	let resolve!: (token: string) => void;
	let reject!: (err: Error) => void;
	const answer = new Promise<string>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	const handles = await Promise.all([
		plugin.addListener('registration', ((t: { value: string }) => resolve(t.value)) as (d: never) => void),
		plugin.addListener('registrationError', ((e: { error: string }) => reject(new Error(e.error))) as (d: never) => void)
	]);
	const timer = setTimeout(() => reject(new Error('Keine Antwort vom Push-Dienst')), 15_000);
	try {
		await plugin.register();
		return await answer;
	} finally {
		clearTimeout(timer);
		for (const h of handles) h.remove().catch(() => {});
	}
}

/** Tipp auf eine Benachrichtigung in der App: zur Seite wechseln */
function listenForTaps(plugin: PushPlugin) {
	if (listening) return;
	listening = true;
	plugin.addListener('pushNotificationActionPerformed', ((a: { notification: { data?: { url?: string } } }) => {
		const url = a.notification.data?.url;
		if (url && url.startsWith('/')) window.location.href = url;
	}) as (d: never) => void);
}

/** Hat diese App-Version den Push-Baustein? Ältere APKs nicht */
export const appHasPush = () => !!appPlugin();

/* ------------------------------------------------------- Browser */

const webSupported = () =>
	typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;

async function webRegistration() {
	return navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
	const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
	const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'));
	const out = new Uint8Array(new ArrayBuffer(raw.length));
	for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
	return out;
}

async function info(): Promise<PushInfo> {
	const res = await fetch('/api/push');
	if (!res.ok) throw new Error('Push-Einstellungen nicht erreichbar');
	return res.json();
}

/* ------------------------------------------------------- Ablauf */

/** Wie steht es auf diesem Gerät? */
export async function pushState(): Promise<PushState> {
	if (inNativeApp()) {
		const plugin = appPlugin();
		if (!plugin) return 'unsupported';
		const { app } = await info();
		if (!app) return 'unsupported';
		const p = await plugin.checkPermissions();
		if (p.receive === 'denied') return 'denied';
		return p.receive === 'granted' && remembered() ? 'on' : 'off';
	}
	if (!webSupported()) return 'unsupported';
	if (Notification.permission === 'denied') return 'denied';
	const reg = await navigator.serviceWorker.getRegistration('/');
	const sub = await reg?.pushManager.getSubscription();
	return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Einschalten – fragt bei Bedarf nach der Erlaubnis */
export async function enablePush(): Promise<PushState> {
	if (inNativeApp()) {
		const plugin = appPlugin();
		if (!plugin) return 'unsupported';
		// Ohne Firebase am Server gibt es niemanden, der an das Gerät schickt
		if (!(await info()).app) return 'unsupported';
		let p = await plugin.checkPermissions();
		if (p.receive !== 'granted') p = await plugin.requestPermissions();
		if (p.receive !== 'granted') return 'denied';
		await plugin.createChannel?.({ id: CHANNEL, name: 'Benachrichtigungen', description: 'Neue Aufträge, Freigaben, Rechnungen …', importance: 4, visibility: 1 });
		listenForTaps(plugin);
		const token = await appToken(plugin);
		await send('POST', { kind: 'fcm', token });
		remember(token);
		return 'on';
	}
	if (!webSupported()) return 'unsupported';
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
	const { vapidPublicKey } = await info();
	const reg = await webRegistration();
	await navigator.serviceWorker.ready;
	const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey) }));
	const json = sub.toJSON();
	await send('POST', { kind: 'web', endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
	return 'on';
}

/** Ausschalten – nur für dieses Gerät */
export async function disablePush(): Promise<PushState> {
	if (inNativeApp()) {
		const plugin = appPlugin();
		const token = remembered();
		if (token) await send('DELETE', { endpoint: token }).catch(() => {});
		remember(null);
		await plugin?.unregister?.().catch(() => {});
		return 'off';
	}
	if (!webSupported()) return 'unsupported';
	const reg = await navigator.serviceWorker.getRegistration('/');
	const sub = await reg?.pushManager.getSubscription();
	if (sub) {
		await send('DELETE', { endpoint: sub.endpoint }).catch(() => {});
		await sub.unsubscribe().catch(() => {});
	}
	return 'off';
}

/**
 * Beim Start der App: Ist Push hier eingeschaltet, meldet sich das Gerät erneut
 * an – so gehört es der Person, die jetzt angemeldet ist, und der Server kennt
 * es auch nach einer wiederhergestellten Sicherung.
 */
export async function resyncPush(): Promise<void> {
	try {
		if (inNativeApp()) {
			const plugin = appPlugin();
			if (!plugin || !remembered()) return;
			listenForTaps(plugin);
			const p = await plugin.checkPermissions();
			if (p.receive !== 'granted') return;
			const token = await appToken(plugin);
			await send('POST', { kind: 'fcm', token });
			remember(token);
			return;
		}
		if (!webSupported() || Notification.permission !== 'granted') return;
		const reg = await navigator.serviceWorker.getRegistration('/');
		const sub = await reg?.pushManager.getSubscription();
		if (!sub) return;
		const json = sub.toJSON();
		await send('POST', { kind: 'web', endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth });
	} catch {
		/* still – beim nächsten Start wieder */
	}
}
