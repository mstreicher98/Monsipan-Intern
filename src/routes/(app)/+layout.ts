import { setPermissionMatrix } from '$lib/permissions';
import type { LayoutLoad } from './$types';

/**
 * Läuft auf dem Server und im Browser vor dem ersten Rendern: Die vom Admin
 * gepflegte Rechte-Matrix landet im Speicher, damit `can()` in allen
 * Komponenten dieselbe Antwort gibt wie der Server.
 */
export const load: LayoutLoad = async ({ data }) => {
	setPermissionMatrix(data.permissions);
	return data;
};
