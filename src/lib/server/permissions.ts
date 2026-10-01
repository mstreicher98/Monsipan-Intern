/**
 * Rechte-Matrix aus der Datenbank. Beim Start werden fehlende Paare aus den
 * Standardrechten im Code ergänzt – ein neuer Bereich bringt seine Rechte also
 * mit, ohne dass jemand nachträgt. Die geladene Matrix liegt im Modulzustand von
 * `$lib/permissions`, damit `can()` überall synchron bleibt.
 */
import {
	DEFAULT_PERMISSIONS,
	isLocked,
	PERMISSIONS,
	ROLES,
	setPermissionMatrix,
	type Permission,
	type PermissionMatrix,
	type Role
} from '$lib/permissions';
import { db } from './db';
import { rolePermissions } from './db/schema';

let loaded: Promise<void> | null = null;

/** Fehlende Rechte-Paare anlegen und die Matrix in den Speicher laden */
export function ensurePermissions(): Promise<void> {
	loaded ??= (async () => {
		const rows = await db.select().from(rolePermissions).all();
		const known = new Set(rows.map((r) => `${r.role}|${r.permission}`));
		const missing: { role: Role; permission: string; allowed: boolean }[] = [];
		for (const permission of PERMISSIONS) {
			for (const role of ROLES) {
				if (known.has(`${role}|${permission}`)) continue;
				const allowed = (DEFAULT_PERMISSIONS[permission] as readonly Role[]).includes(role);
				missing.push({ role, permission, allowed });
			}
		}
		if (missing.length) {
			await db.transaction(async (tx) => {
				for (const m of missing) await tx.insert(rolePermissions).values(m).onConflictDoNothing();
			});
			rows.push(...missing.map((m) => ({ ...m, updatedAt: null })));
		}
		// Rechte, die es im Code nicht mehr gibt, bleiben in der Tabelle liegen und werden ignoriert
		const matrix: PermissionMatrix = {};
		for (const permission of PERMISSIONS) matrix[permission] = [];
		for (const row of rows) {
			if (!row.allowed) continue;
			matrix[row.permission]?.push(row.role);
		}
		setPermissionMatrix(matrix);
	})();
	return loaded;
}

/** Nach einer Änderung neu einlesen */
export async function reloadPermissions(): Promise<void> {
	loaded = null;
	await ensurePermissions();
}

/** Eine Rolle setzen oder entziehen – gesperrte Paare bleiben unangetastet */
export async function setPermission(role: Role, permission: Permission, allowed: boolean) {
	if (isLocked(role, permission) && !allowed) return;
	await db
		.insert(rolePermissions)
		.values({ role, permission, allowed, updatedAt: new Date() })
		.onConflictDoUpdate({
			target: [rolePermissions.role, rolePermissions.permission],
			set: { allowed, updatedAt: new Date() }
		});
	await reloadPermissions();
}

/** Ganze Matrix aus dem Formular übernehmen */
export async function savePermissions(allowed: Set<string>) {
	await db.transaction(async (tx) => {
		for (const permission of PERMISSIONS) {
			for (const role of ROLES) {
				const on = allowed.has(`${role}|${permission}`) || isLocked(role, permission);
				await tx
					.insert(rolePermissions)
					.values({ role, permission, allowed: on, updatedAt: new Date() })
					.onConflictDoUpdate({
						target: [rolePermissions.role, rolePermissions.permission],
						set: { allowed: on, updatedAt: new Date() }
					});
			}
		}
	});
	await reloadPermissions();
}

/** Alles auf die Standardrechte im Code zurücksetzen */
export async function resetPermissions() {
	await db.delete(rolePermissions);
	await reloadPermissions();
}
