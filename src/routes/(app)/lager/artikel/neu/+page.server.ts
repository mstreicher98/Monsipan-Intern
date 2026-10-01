import { fail, redirect } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { products } from '$lib/server/db/schema';
import { requirePermission } from '$lib/server/guard';
import { categoryOptions, colorOptions } from '$lib/server/options';
import { CodeConflictError, refreshSearchText, syncCodes } from '$lib/modules/lager/server/products';
import { parseProductForm } from '$lib/modules/lager/server/product-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePermission(locals, 'lager.products.manage');
	const [categories, colors, manufacturers] = await Promise.all([
		categoryOptions(),
		colorOptions(),
		db.selectDistinct({ m: products.manufacturer }).from(products).where(sql`${products.manufacturer} <> ''`).all()
	]);
	return {
		categories,
		colors,
		manufacturers: manufacturers.map((m) => m.m).sort(),
		scan: url.searchParams.get('scan')?.slice(0, 1000) ?? null
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals, 'lager.products.manage');
		const form = await request.formData();
		const parsed = parseProductForm(form);
		if (!parsed.ok) return fail(400, { values: parsed.values, errors: parsed.errors, codeConflict: null });
		const d = parsed.data;
		// „Trotzdem speichern“ nach der Rückfrage: Nummer darf zu mehreren Artikeln gehören
		const allowShared = form.get('allowSharedCodes') === '1';
		let id: number;
		try {
			id = await db.transaction(async (tx) => {
				const row = await tx
					.insert(products)
					.values({
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
						active: true,
						updatedAt: new Date()
					})
					.returning({ id: products.id })
					.get();
				await syncCodes(tx, row.id, d.articleNumber, d.codes, { allowShared });
				await refreshSearchText(tx, row.id);
				return row.id;
			});
		} catch (err) {
			if (err instanceof CodeConflictError) return fail(400, { values: parsed.values, errors: {}, codeConflict: err.message });
			throw err;
		}
		if (form.get('intent') === 'next') return { created: { id, name: d.name } };
		redirect(303, `/lager/artikel/${id}`);
	}
};
