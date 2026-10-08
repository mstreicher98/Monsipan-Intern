import { lowStockCount } from '$lib/modules/lager/server/alerts';
import { requireUser } from '$lib/server/guard';
import { can, permissionMatrix } from '$lib/permissions';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:stock');
	depends('app:permissions');
	const user = requireUser(locals);
	return {
		user,
		theme: locals.theme,
		// Die vom Admin gepflegte Rechte-Matrix, damit `can()` im Browser dasselbe sagt
		permissions: permissionMatrix(),
		lowStockCount: can(user.role, 'lager.warnungen.sehen') || can(user.role, 'lager.berichte.sehen') ? await lowStockCount() : 0
	};
};
