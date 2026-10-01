import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { productDocuments, products } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const productId = Number(params.id);
	const docId = Number(params.docId);
	if (!Number.isInteger(productId) || !Number.isInteger(docId)) error(404, 'Dokument nicht gefunden');
	const row = await db
		.select({
			id: productDocuments.id,
			kind: productDocuments.kind,
			title: productDocuments.title,
			fileName: productDocuments.fileName,
			size: productDocuments.size,
			productId: products.id,
			productName: products.name
		})
		.from(productDocuments)
		.innerJoin(products, eq(products.id, productDocuments.productId))
		.where(and(eq(productDocuments.id, docId), eq(productDocuments.productId, productId)))
		.get();
	if (!row) error(404, 'Dokument nicht gefunden');
	return { document: row };
};
