/*
 * Service Worker nur für Push-Benachrichtigungen: zeigt sie an und öffnet beim
 * Antippen die passende Seite. Er speichert nichts zwischen – die App kommt
 * immer frisch vom Server.
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
	let data = {};
	try {
		data = event.data ? event.data.json() : {};
	} catch {
		data = { body: event.data ? event.data.text() : '' };
	}
	const title = data.title || 'Monsipan Intern';
	event.waitUntil(
		self.registration.showNotification(title, {
			body: data.body || '',
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			tag: data.tag || undefined,
			renotify: Boolean(data.tag),
			data: { url: data.url || '/' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
	event.waitUntil(
		(async () => {
			// Ist die App schon offen, dorthin wechseln – sonst ein neues Fenster
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				if (new URL(client.url).origin !== self.location.origin) continue;
				try {
					await client.focus();
					return await client.navigate(url);
				} catch {
					// Fenster gehört (noch) nicht zu diesem Worker – dann eben ein neues
					break;
				}
			}
			return self.clients.openWindow(url);
		})()
	);
});
