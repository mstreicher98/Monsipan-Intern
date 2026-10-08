import { error, fail, redirect } from '@sveltejs/kit';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { movements, productCodes, products } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { categoryOptions, colorOptions } from '$lib/server/options';
import { CodeConflictError, refreshSearchText, syncCodes } from '$lib/modules/lager/server/products';
import { parseProductForm } from '$lib/modules/lager/server/product-form';
import { displayGtin } from '$lib/modules/lager/scan/parse';
import { totalSql } from '$lib/modules/lager/server/products';
import { can } from '$lib/permissions';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requirePermission(locals, 'lager.artikel.bearbeiten');
	const id = Number(params.id);
	const product = await db
		.select({
			id: products.id,
			name: products.name,
			articleNumber: products.articleNumber,
			manufacturer: products.manufacturer,
			categoryId: products.categoryId,
			colorId: products.colorId,
			packageSize: products.packageSize,
			unit: products.unit,
			minStock: products.minStock,
			targetStock: products.targetStock,
			notes: products.notes,
			active: products.active,
			total: totalSql.mapWith(Number)
		})
		.from(products)
		.where(eq(products.id, id))
		.get();
	if (!product) error(404, 'Artikel nicht gefunden');
	const [categories, colors, manufacturers, codes, moveCount] = await Promise.all([
		categoryOptions(),
		colorOptions(),
		db.selectDistinct({ m: products.manufacturer }).from(products).where(sql`${products.manufacturer} <> ''`).all(),
		db
			.select({ code: productCodes.code, normalized: productCodes.normalized, kind: productCodes.kind })
			.from(productCodes)
			.where(and(eq(productCodes.productId, id), ne(productCodes.kind, 'artikel')))
			.all(),
		db.select({ n: sql<number>`count(*)` }).from(movements).where(eq(movements.productId, id)).get()
	]);
	return {
		product,
		categories,
		colors,
		manufacturers: manufacturers.map((m) => m.m).sort(),
		codes: codes.map((c) => ({ code: c.kind === 'ean' ? displayGtin(c.normalized) : c.code, kind: c.kind })),
		hasMovements: Number(moveCount?.n ?? 0) > 0,
		canDelete: can(user.role, 'lager.artikel.loeschen')
	};
};

export const actions: Actions = {
	save: async ({ request, locals, params }) => {
		requirePermission(locals, 'lager.artikel.bearbeiten');
		const id = Number(params.id);
		const form = await request.formData();
		const parsed = parseProductForm(form);
		if (!parsed.ok) return fail(400, { values: parsed.values, errors: parsed.errors, codeConflict: null });
		const d = parsed.data;
		// „Trotzdem speichern“ nach der Rückfrage: Nummer darf zu mehreren Artikeln gehören
		const allowShared = form.get('allowSharedCodes') === '1';
		try {
			await db.transaction(async (tx) => {
				await tx
					.update(products)
					.set({
						name: d.name,
						articleNumber: d.articleNumber,
						manufacturer: d.manufacturer,
						categoryId: d.categoryId,
						colorId: d.colorId,
						packageSize: d.packageSize,
						unit: d.unit,
						minStock: d.minStock,
						targetStock: d.targetStock,
						notes: d.notes,
						active: d.active,
						// Warnung erneut erlauben, wenn sich der Mindestbestand ändert
						lowStockNotifiedAt: null,
						updatedAt: new Date()
					})
					.where(eq(products.id, id));
				await syncCodes(tx, id, d.articleNumber, d.codes, { allowShared });
				await refreshSearchText(tx, id);
			});
		} catch (err) {
			if (err instanceof CodeConflictError) return fail(400, { values: parsed.values, errors: {}, codeConflict: err.message });
			throw err;
		}
		redirect(303, `/lager/artikel/${id}`);
	},
	delete: async ({ locals, params }) => {
		requirePermission(locals, 'lager.artikel.loeschen');
		const id = Number(params.id);
		const used = await db.select({ n: sql<number>`count(*)` }).from(movements).where(eq(movements.productId, id)).get();
		if (Number(used?.n ?? 0) > 0) {
			return fail(400, { deleteError: 'Der Artikel hat Buchungen und kann nicht gelöscht werden. Deaktiviere ihn stattdessen.' });
		}
		await db.delete(products).where(eq(products.id, id));
		redirect(303, '/lager/bestand');
	}
};
