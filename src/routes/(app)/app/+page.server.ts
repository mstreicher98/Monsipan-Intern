import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';

/** Feste Adresse der APK-Datei; per APK_URL überschreibbar (z. B. eigener Download) */
const DEFAULT_APK = 'https://github.com/mstreicher98/Monsipan-Intern/releases/download/app/monsipan-portal.apk';

export const load: PageServerLoad = ({ url }) => ({
	apkUrl: env.APK_URL || DEFAULT_APK,
	// Zum Abtippen oder für den QR-Code am PC
	siteUrl: `${url.origin}/app`
});
