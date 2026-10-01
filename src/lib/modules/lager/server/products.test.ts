import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'lager-codes-'));

vi.mock('$env/dynamic/private', () => ({ env: { DATA_DIR: TMP, DEMO_DATA: 'false' } }));
vi.mock('$app/environment', () => ({ dev: true, browser: false, building: false, version: 'test' }));

const { db, ensureDatabase } = await import('$lib/server/db');
const { products } = await import('$lib/server/db/schema');
const { addCode, CodeConflictError, lookupByCandidates, sharedCodeOwners, syncCodes } = await import('./products');
const { allCandidates } = await import('$lib/modules/lager/scan/parse');

/** Die beiden Palettenetiketten mit derselben Artikelnummer */
const PALETTE_A = '1524603$30016618$2450240$1000,000';
const PALETTE_B = '1647879$30016618$2650002$1000,000';

async function createProduct(name: string, articleNumber: string | null, allowShared = false) {
	const row = await db
		.insert(products)
		.values({ name, unit: 'kg', articleNumber, searchText: name.toLowerCase() })
		.returning({ id: products.id })
		.get();
	await db.transaction((tx) => syncCodes(tx, row.id, articleNumber, [], { allowShared }));
	return row.id;
}

beforeAll(async () => {
	await ensureDatabase();
});

afterAll(() => {
	try {
		fs.rmSync(TMP, { recursive: true, force: true });
	} catch {
		// Windows gibt die geöffnete Datenbankdatei erst nach dem Prozessende frei
	}
});

describe('Codes mehrerer Artikel', () => {
	it('findet einen Artikel über seine Artikelnummer', async () => {
		await createProduct('Glasperlen 200-800', '30016618');
		const hit = await lookupByCandidates(allCandidates([PALETTE_A]));
		expect(hit?.matched).toBe('30016618');
		expect(hit?.products.map((p) => p.name)).toEqual(['Glasperlen 200-800']);
	});

	it('warnt, bevor dieselbe Nummer an einen zweiten Artikel geht', async () => {
		await expect(createProduct('Glasperlen 100-600', '30016618')).rejects.toBeInstanceOf(CodeConflictError);
	});

	it('gibt nach Bestätigung beide Artikel zurück – der Scan muss nachfragen', async () => {
		await createProduct('Glasperlen 100-600', '30016618', true);
		const hit = await lookupByCandidates(allCandidates([PALETTE_B]));
		expect(hit?.matched).toBe('30016618');
		expect(hit?.products.map((p) => p.name)).toEqual(['Glasperlen 100-600', 'Glasperlen 200-800']);
	});

	it('nennt auf der Artikelseite den anderen Artikel mit derselben Nummer', async () => {
		const hit = await lookupByCandidates(['30016618']);
		const [first, second] = hit!.products;
		const shared = await sharedCodeOwners(first.id, ['30016618']);
		expect(shared.get('30016618')).toEqual([{ id: second.id, name: second.name }]);
	});

	it('hängt einen fremden Code nur nach Bestätigung an', async () => {
		const id = await createProduct('Reinigungsmittel', '77001');
		await expect(addCode(id, '30016618', 'artikel')).rejects.toBeInstanceOf(CodeConflictError);
		await addCode(id, '30016618', 'artikel', { allowShared: true });
		const hit = await lookupByCandidates(['30016618']);
		expect(hit?.products).toHaveLength(3);
	});

	it('legt denselben Code bei einem Artikel nicht zweimal an', async () => {
		const hit = await lookupByCandidates(['77001']);
		const id = hit!.products[0].id;
		await addCode(id, '77001', 'artikel');
		expect((await lookupByCandidates(['77001']))?.products).toHaveLength(1);
	});

	it('findet den Artikel über beide Schreibweisen der Materialnummer', async () => {
		await createProduct('SWARCOLUX 30 TypIII', '30016705');
		expect((await lookupByCandidates(['000000000030016705']))?.products.map((p) => p.name)).toEqual(['SWARCOLUX 30 TypIII']);
		// Andersherum genauso: lange Nummer hinterlegt, kurze gescannt
		await createProduct('Reaktivperlen 100-600', '000000000030016319');
		expect((await lookupByCandidates(['30016319']))?.products.map((p) => p.name)).toEqual(['Reaktivperlen 100-600']);
	});

	it('meldet unbekannte Codes weiterhin als nicht gefunden', async () => {
		expect(await lookupByCandidates(['9999999999'])).toBeNull();
	});
});
