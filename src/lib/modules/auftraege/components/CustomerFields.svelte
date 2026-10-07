<script lang="ts">
	/** Eingabefelder eines Kunden – im Kundenstamm und beim Anlegen direkt aus dem Angebot */
	interface Customer {
		name: string;
		addition: string;
		street: string;
		zip: string;
		city: string;
		uid: string;
		email: string;
		phone: string;
		contact: string;
		note: string;
	}
	let { customer }: { customer?: Partial<Customer> | null } = $props();
	const v = (k: keyof Customer) => customer?.[k] ?? '';
</script>

<div class="grid gap-3 sm:grid-cols-6">
	<label class="block sm:col-span-6">
		<span class="field-label">Firma bzw. Name *</span>
		<input class="input" name="name" required minlength="2" maxlength="160" value={v('name')} autocomplete="organization" />
	</label>
	<label class="block sm:col-span-6">
		<span class="field-label">Zusatz <span class="font-normal text-ink-3">(z. B. Abteilung)</span></span>
		<input class="input" name="addition" maxlength="160" value={v('addition')} />
	</label>
	<label class="block sm:col-span-6">
		<span class="field-label">Straße bzw. Postfach</span>
		<input class="input" name="street" maxlength="160" value={v('street')} autocomplete="street-address" />
	</label>
	<label class="block sm:col-span-2">
		<span class="field-label">PLZ</span>
		<input class="input num" name="zip" maxlength="12" value={v('zip')} autocomplete="postal-code" />
	</label>
	<label class="block sm:col-span-4">
		<span class="field-label">Ort</span>
		<input class="input" name="city" maxlength="120" value={v('city')} autocomplete="address-level2" />
	</label>
	<label class="block sm:col-span-3">
		<span class="field-label">UID-Nummer</span>
		<input class="input num" name="uid" maxlength="30" value={v('uid')} placeholder="ATU…" />
	</label>
	<label class="block sm:col-span-3">
		<span class="field-label">E-Mail <span class="font-normal text-ink-3">(für den Angebotslink)</span></span>
		<input class="input" type="email" name="email" maxlength="200" value={v('email')} autocomplete="email" />
	</label>
	<label class="block sm:col-span-3">
		<span class="field-label">Ansprechpartner</span>
		<input class="input" name="contact" maxlength="120" value={v('contact')} />
	</label>
	<label class="block sm:col-span-3">
		<span class="field-label">Telefon</span>
		<input class="input" type="tel" name="phone" maxlength="60" value={v('phone')} autocomplete="tel" />
	</label>
	<label class="block sm:col-span-6">
		<span class="field-label">Notiz</span>
		<textarea class="textarea" name="note" rows="2" maxlength="1000">{v('note')}</textarea>
	</label>
</div>
