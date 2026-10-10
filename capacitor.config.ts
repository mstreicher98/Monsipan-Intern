import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android-App: eine schlanke Hülle, die die laufende Webseite anzeigt.
 * Dadurch ist die App immer auf demselben Stand wie der Server; nur wenn sich
 * an der Hülle selbst etwas ändert, braucht es eine neue APK-Datei.
 *
 * Die Adresse lässt sich beim Bauen über APP_URL setzen (siehe Workflow).
 */
const config: CapacitorConfig = {
	appId: 'at.monsipan.intern',
	appName: 'Monsipan Portal',
	// Nur die Offline-Ersatzseite; die eigentliche App kommt vom Server
	webDir: 'capacitor/www',
	server: {
		url: process.env.APP_URL || 'https://intern.monsipan.at',
		// Nur HTTPS, damit Kamera und Anmeldung funktionieren
		cleartext: false
	},
	android: {
		backgroundColor: '#1B2027',
		allowMixedContent: false
	},
	plugins: {
		// Die Seite zeichnet von Rand zu Rand und hält den Abstand selbst ein
		SystemBars: {
			insetsHandling: 'css',
			initialViewportFitValueHint: 'cover'
		}
	}
};

export default config;
