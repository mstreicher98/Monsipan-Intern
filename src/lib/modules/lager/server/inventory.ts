/**
 * Zähl-Liste für die Inventur: alle Artikel eines Lagerorts mit ihrem Bestand.
 * Bewusst eine einzige Abfrage – eine Inventur zählt schnell hunderte Zeilen.
 */
import { and, asc, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { categories, colors, products, stock } from '$lib/server/db/schema';

export interface InventoryItem {
	id: number;
	name: string;
	articleNumber: string | null;
	packageSize: number | null;
	unit: string;
	categoryName: string | null;
	colorHex: string | null;
	/** Bestand laut System an diesem Lagerort */
	quantity: number;
}

export async function inventoryList(locationId: number): Promise<InventoryItem[]> {
	return db
		.select({
			id: products.id,
			name: products.name,
			articleNumber: products.articleNumber,
			packageSize: products.packageSize,
			unit: products.unit,
			categoryName: categories.name,
			colorHex: colors.hex,
			quantity: stock.quantity
		})
		.from(stock)
		.innerJoin(products, eq(products.id, stock.productId))
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.leftJoin(colors, eq(colors.id, products.colorId))
		.where(and(eq(stock.locationId, locationId), ne(stock.quantity, 0)))
		.orderBy(asc(products.name))
		.all();
}

/** Einzelner Artikel für die Zählliste – für Artikel, die am Lagerort (noch) keinen Bestand haben */
export async function inventoryItem(productId: number, locationId: number): Promise<InventoryItem | null> {
	const row = await db
		.select({
			id: products.id,
			name: products.name,
			articleNumber: products.articleNumber,
			packageSize: products.packageSize,
			unit: products.unit,
			categoryName: categories.name,
			colorHex: colors.hex,
			quantity: stock.quantity
		})
		.from(products)
		.leftJoin(categories, eq(categories.id, products.categoryId))
		.leftJoin(colors, eq(colors.id, products.colorId))
		.leftJoin(stock, and(eq(stock.productId, products.id), eq(stock.locationId, locationId)))
		.where(eq(products.id, productId))
		.get();
	return row ? { ...row, quantity: row.quantity ?? 0 } : null;
}
