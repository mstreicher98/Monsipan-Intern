import { error, fail } from '@sveltejs/kit';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { DOCUMENT_KINDS, productCodes, productDocuments, products } from '$lib/server/db/schema';
import { DocumentError, listDocuments, storeDocument } from '$lib/server/documents';
import { requirePermission, requireUser, str } from '$lib/server/guard';
import { titleFromFileName, type DocumentKind } from '$lib/documents';
import { consumptionByMonth, countMovements, listMovements } from '$lib/modules/lager/server/movements';
import { productWithLocations, refreshSearchText, sharedCodeOwners } from '$lib/modules/lager/server/products';
import { displayGtin } from '$lib/modules/lager/scan/parse';
import { can } from '$lib/permissions';
import type { Actions, PageServerLoad } from './$types';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ params, url, depends, locals }) => {
	depends('app:stock');
	const user = requirePermission(locals, 'lager.artikel.sehen');
	const id = Number(params.id);
	if (!Number.isInteger(id)) error(404, 'Artikel nicht gefunden');
	const product = await productWithLocations(id);
	if (!product) error(404, 'Artikel nicht gefunden');

	// Arbeiter sehen keine Bewegungen; Verbrauchszahlen nur mit Berichte-Recht
	const showMovements = can(user.role, 'lager.bewegungen.sehen');
	const showReports = can(user.role, 'lager.berichte.sehen');
	const page = Math.max(1, Number(url.searchParams.get('seite')) || 1);
	const [codes, full, history, historyCount, consumption, documents] = await Promise.all([
		db
			.select({ id: productCodes.id, code: productCodes.code, normalized: productCodes.normalized, kind: productCodes.kind })
			.from(productCodes)
			.where(eq(productCodes.productId, id))
			.orderBy(asc(productCodes.kind), asc(productCodes.code))
			.all(),
		db.select({ notes: products.notes, createdAt: products.createdAt }).from(products).where(eq(products.id, id)).get(),
		showMovements ? listMovements({ productId: id, includeCancelled: true }, PAGE_SIZE, (page - 1) * PAGE_SIZE) : null,
		showMovements ? countMovements({ productId: id, includeCancelled: true }) : 0,
		showReports ? consumptionByMonth(12, { productId: id }) : null,
		listDocuments(id)
	]);

	// Dieselbe Nummer kann zu mehreren Artikeln gehören – das gehört hier sichtbar hin
	const shared = await sharedCodeOwners(
		id,
		codes.map((c) => c.normalized)
	);

	return {
		product,
		notes: full?.notes ?? '',
		codes: codes.map((c) => ({
			...c,
			display: c.kind === 'ean' ? displayGtin(c.normalized) : c.code,
			sharedWith: shared.get(c.normalized) ?? []
		})),
		history,
		historyCount,
		page,
		pageSize: PAGE_SIZE,
		consumption,
		documents
	};
};

export const actions: Actions = {
	/** PDF hochladen – nur Admin und Bauleiter */
	uploadDocument: async ({ request, params, locals }) => {
		const me = requirePermission(locals, 'lager.artikel.bearbeiten');
		const productId = Number(params.id);
		const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get();
		if (!product) return fail(404, { docError: 'Artikel nicht gefunden.' });

		const f = await request.formData();
		const file = f.get('file');
		if (!(file instanceof File) || file.size === 0) return fail(400, { docError: 'Bitte eine PDF-Datei auswählen.' });
		const rawKind = String(f.get('kind') ?? '');
		const kind: DocumentKind = (DOCUMENT_KINDS as readonly string[]).includes(rawKind) ? (rawKind as DocumentKind) : 'materialbeschreibung';
		const title = str(f.get('title'), 120) || titleFromFileName(file.name) || 'Dokument';
		const fileName = (file.name || 'dokument.pdf').slice(0, 200);

		try {
			const stored = await storeDocument(file);
			await db.insert(productDocuments).values({
				productId,
				kind,
				title,
				fileName: /\.pdf$/i.test(fileName) ? fileName : `${fileName}.pdf`,
				sha256: stored.sha256,
				size: stored.size,
				uploadedBy: me.id
			});
			return { documentAdded: title };
		} catch (err) {
			if (err instanceof DocumentError) return fail(400, { docError: err.message });
			throw err;
		}
	},

	/** Dokument entfernen; die Datei bleibt noch eine Weile für Sicherungen liegen */
	deleteDocument: async ({ request, params, locals }) => {
		requirePermission(locals, 'lager.artikel.bearbeiten');
		const documentId = Number((await request.formData()).get('documentId'));
		if (!Number.isInteger(documentId)) return fail(400, { docError: 'Dokument fehlt.' });
		await db
			.delete(productDocuments)
			.where(and(eq(productDocuments.id, documentId), eq(productDocuments.productId, Number(params.id))));
		return { documentRemoved: true };
	},

	removeCode: async ({ request, params, locals }) => {
		requirePermission(locals, 'lager.artikel.bearbeiten');
		const codeId = Number((await request.formData()).get('codeId'));
		if (!Number.isInteger(codeId)) return fail(400, { message: 'Ungültiger Code' });
		await db.delete(productCodes).where(and(eq(productCodes.id, codeId), eq(productCodes.productId, Number(params.id))));
		await refreshSearchText(db, Number(params.id));
		return { removed: true };
	}
};
