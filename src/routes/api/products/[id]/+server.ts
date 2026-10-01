import { error, json } from '@sveltejs/kit';
import { productWithLocations } from '$lib/modules/lager/server/products';
import type { RequestHandler } from './$types';

/** Artikel mit Bestand je Lagerort – für Buchungszeilen nach einer Suche */
export const GET: RequestHandler = async ({ params }) => {
	const product = await productWithLocations(Number(params.id));
	if (!product) error(404, 'Artikel nicht gefunden');
	return json(product);
};
