import type { ParsedScan } from '$lib/modules/lager/scan/parse';

export interface ProductSummary {
	id: number;
	name: string;
	articleNumber: string | null;
	manufacturer: string;
	packageSize: number | null;
	unit: string;
	minStock: number | null;
	targetStock: number | null;
	active: boolean;
	categoryId: number | null;
	categoryName: string | null;
	colorId: number | null;
	colorName: string | null;
	colorHex: string | null;
	colorRal: string | null;
	total: number;
}

export interface LocationQty {
	locationId: number;
	name: string;
	quantity: number;
}

export type ProductWithLocations = ProductSummary & { locations: LocationQty[] };

export interface LookupResult {
	/** Leer = unbekannter Code; mehrere = dieselbe Nummer gehört zu mehreren Artikeln */
	products: ProductWithLocations[];
	parsed: ParsedScan | null;
	matched: string | null;
}

export interface Option {
	id: number;
	name: string;
}

export interface PartyOption extends Option {
	kind: 'person' | 'gruppe';
}
