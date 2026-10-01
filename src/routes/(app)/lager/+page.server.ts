import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Der Bereich selbst hat keine eigene Seite – er beginnt beim Bestand */
export const load: PageServerLoad = async () => {
	redirect(302, '/lager/bestand');
};
