<script lang="ts">
	import { pageTitle } from '$lib/app';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import ProductForm from '$lib/modules/lager/components/ProductForm.svelte';

	let { data, form } = $props();

	const empty = {
		name: '',
		articleNumber: '',
		manufacturer: '',
		categoryId: '',
		colorId: '',
		packageSize: '',
		unit: 'kg',
		minStock: '',
		targetStock: '',
		notes: '',
		active: true
	};
	const initial = $derived(form?.values ? { ...empty, ...(form.values as Partial<typeof empty>) } : empty);
</script>

<svelte:head><title>{pageTitle('Neuer Artikel')}</title></svelte:head>

<a href="/lager/bestand" class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />Bestand</a>
<h1 class="mt-3 mb-5 text-[2rem] leading-tight">Neuer Artikel</h1>

{#key form}
	<ProductForm
		mode="new"
		{initial}
		initialCodes={(form?.values?.codes as { code: string; kind: 'ean' | 'artikel' | 'sonstige' }[] | undefined) ?? []}
		categories={data.categories}
		colors={data.colors}
		manufacturers={data.manufacturers}
		errors={form?.errors ?? {}}
		codeConflict={form?.codeConflict ?? null}
		scan={form ? null : data.scan}
	/>
{/key}
