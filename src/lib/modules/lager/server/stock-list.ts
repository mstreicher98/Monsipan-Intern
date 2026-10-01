import { and, asc, desc, eq, gt, sql, type SQL } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { col } from '$lib/server/db/sql';
import { categories, colors, products, stock } from '$lib/server/db/schema';
import { searchCondition, summaryQuery, totalSql } from './products';

export type StockStatusFilter = 'aktiv' | 'nachbestellen' | 'leer' | 'inaktiv' | 'alle';
export type StockSort = 'name' | 'bestand' | 'bestand-ab' | 'nummer';

export interface StockFilter {
	q: string;
	locationId: number | null;
	categoryId: number | null;
	colorId: number | null;
	status: StockStatusFilter;
	sort: StockSort;
}

export function parseStockFilter(url: URL): StockFilter {
	const n = (k: string) => {
		const v = Number(url.searchParams.get(k));
		return Number.isInteger(v) && v > 0 ? v : null;
	};
	const status = url.searchParams.get('status') as StockStatusFilter;
	const sort = url.searchParams.get('sort') as StockSort;
	return {
		q: (url.searchParams.get('q') ?? '').slice(0, 200),
		locationId: n('ort'),
		categoryId: n('kat'),
		colorId: n('farbe'),
		status: ['aktiv', 'nachbestellen', 'leer', 'inaktiv', 'alle'].includes(status) ? status : 'aktiv',
		sort: ['name', 'bestand', 'bestand-ab', 'nummer'].includes(sort) ? sort : 'name'
	};
}

const locQtySql = (locationId: number) =>
	sql<number>`coalesce((select ${col(stock.quantity)} from ${stock} where ${col(stock.productId)} = ${col(products.id)} and ${col(stock.locationId)} = ${locationId}), 0)`;

async function conditions(f: StockFilter): Promise<SQL | undefined> {
	const c: (SQL | undefined)[] = [await searchCondition(f.q)];
	if (f.categoryId) c.push(eq(products.categoryId, f.categoryId));
	if (f.colorId) c.push(eq(products.colorId, f.colorId));
	if (f.locationId) c.push(sql`${locQtySql(f.locationId)} > 0`);
	switch (f.status) {
		case 'aktiv':
			c.push(eq(products.active, true));
			break;
		case 'nachbestellen':
			c.push(eq(products.active, true), gt(products.minStock, 0), sql`${totalSql} <= ${products.minStock}`);
			break;
		case 'leer':
			c.push(eq(products.active, true), sql`${totalSql} <= 0`);
			break;
		case 'inaktiv':
			c.push(eq(products.active, false));
			break;
	}
	const list = c.filter(Boolean) as SQL[];
	return list.length ? and(...list) : undefined;
}

export async function listStock(f: StockFilter, limit: number, offset: number) {
	const where = await conditions(f);
	const order =
		f.sort === 'bestand'
			? [asc(totalSql), asc(products.name)]
			: f.sort === 'bestand-ab'
				? [desc(totalSql), asc(products.name)]
				: f.sort === 'nummer'
					? [asc(products.articleNumber), asc(products.name)]
					: [asc(products.name)];
	const base = summaryQuery();
	const rows = await (where ? base.where(where) : base)
		.orderBy(...order)
		.limit(limit)
		.offset(offset)
		.all();
	const countQ = db
		.select({ n: sql<number>`count(*)` })
		.from(products)
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.leftJoin(colors, eq(colors.id, products.colorId));
	const count = Number((await (where ? countQ.where(where) : countQ).get())?.n ?? 0);
	return { rows, count };
}
