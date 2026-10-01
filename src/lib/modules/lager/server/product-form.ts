import { z } from 'zod';
import { UNITS } from '$lib/format';

const optInt = z
	.string()
	.trim()
	.transform((s) => (s === '' ? null : Number(s)))
	.refine((n) => n === null || (Number.isInteger(n) && n >= 0 && n <= 1_000_000), 'Bitte eine ganze Zahl ab 0 eingeben.');

const optId = z
	.string()
	.trim()
	.transform((s) => (s === '' ? null : Number(s)))
	.refine((n) => n === null || (Number.isInteger(n) && n > 0), 'Ungültige Auswahl');

const ProductSchema = z.object({
	name: z.string().trim().min(1, 'Bitte einen Namen eingeben.').max(200),
	articleNumber: z
		.string()
		.trim()
		.max(60)
		.transform((s) => s || null),
	manufacturer: z.string().trim().max(120),
	categoryId: optId,
	colorId: optId,
	packageSize: z
		.string()
		.trim()
		.transform((s) => (s === '' ? null : Number(s.replace(',', '.'))))
		.refine((n) => n === null || (Number.isFinite(n) && n > 0 && n < 1_000_000), 'Bitte eine Zahl größer 0 eingeben.'),
	unit: z.enum(UNITS.map((u) => u.value) as [string, ...string[]]),
	minStock: optInt,
	targetStock: optInt,
	notes: z.string().trim().max(2000),
	active: z.boolean(),
	codes: z
		.array(z.object({ code: z.string().trim().min(1).max(120), kind: z.enum(['ean', 'artikel', 'sonstige']) }))
		.max(20)
});

export type ProductInput = z.infer<typeof ProductSchema>;

export function parseProductForm(form: FormData) {
	let codes: unknown = [];
	try {
		codes = JSON.parse(String(form.get('codes') ?? '[]'));
	} catch {
		codes = [];
	}
	const raw = {
		name: String(form.get('name') ?? ''),
		articleNumber: String(form.get('articleNumber') ?? ''),
		manufacturer: String(form.get('manufacturer') ?? ''),
		categoryId: String(form.get('categoryId') ?? ''),
		colorId: String(form.get('colorId') ?? ''),
		packageSize: String(form.get('packageSize') ?? ''),
		unit: String(form.get('unit') ?? 'stk'),
		minStock: String(form.get('minStock') ?? ''),
		targetStock: String(form.get('targetStock') ?? ''),
		notes: String(form.get('notes') ?? ''),
		active: form.has('active') ? form.get('active') === 'on' : true,
		codes
	};
	const result = ProductSchema.safeParse(raw);
	if (result.success) {
		const d = result.data;
		if (d.minStock != null && d.targetStock != null && d.targetStock < d.minStock) {
			return { ok: false as const, values: raw, errors: { targetStock: 'Der Sollbestand sollte nicht unter dem Mindestbestand liegen.' } };
		}
		return { ok: true as const, data: d, values: raw };
	}
	const errors: Record<string, string> = {};
	for (const issue of result.error.issues) {
		const key = String(issue.path[0] ?? 'form');
		errors[key] ??= issue.message;
	}
	return { ok: false as const, values: raw, errors };
}
