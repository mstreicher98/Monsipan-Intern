import { describe, expect, it } from 'vitest';
import { companyDomain, guessFromEmail } from './inquiry';

describe('guessFromEmail', () => {
	it('liest Kopfzeilen aus Outlook', () => {
		const g = guessFromEmail(
			[
				'Von: Muster, Max <max.muster@strabag.com>',
				'Gesendet: Mittwoch, 7. Oktober 2026 09:12',
				'An: office@monsipan.com',
				'Betreff: AW: Bodenmarkierung Parkplatz Süd',
				'',
				'Sehr geehrte Damen und Herren,',
				'bitte um ein Angebot für 400 lfm Leitlinie.',
				'',
				'Mit freundlichen Grüßen',
				'Max Muster',
				'Tel.: +43 664 123 45 67'
			].join('\n')
		);
		expect(g).toEqual({ subject: 'Bodenmarkierung Parkplatz Süd', name: 'Muster, Max', email: 'max.muster@strabag.com', phone: '+43 664 123 45 67' });
	});

	it('überspringt die eigene Adresse bei Weiterleitungen', () => {
		const g = guessFromEmail(
			[
				'Von: Office Monsipan <office@monsipan.com>',
				'Betreff: WG: Anfrage Markierung',
				'Tel. 01/706 2006 – Monsipan',
				'',
				'-----Ursprüngliche Nachricht-----',
				'From: "Anna Bau" [mailto:anna@baufirma.at]',
				'Subject: Anfrage Markierung',
				'Mobil 0699 11 22 33 44'
			].join('\n')
		);
		expect(g.email).toBe('anna@baufirma.at');
		expect(g.name).toBe('Anna Bau');
		expect(g.subject).toBe('Anfrage Markierung');
		expect(g.phone).toBe('0699 11 22 33 44');
	});

	it('nimmt ohne Kopfzeilen den Namen unter dem Gruß', () => {
		const g = guessFromEmail('Hallo,\nwir brauchen neue Parkplatzmarkierungen.\n\nLG\nPeter Huber\npeter@huber-bau.at');
		expect(g.name).toBe('Peter Huber');
		expect(g.email).toBe('peter@huber-bau.at');
		expect(g.subject).toBe('');
	});

	it('hält Datum und IBAN nicht für Telefonnummern', () => {
		const g = guessFromEmail('Termin am 08.10.2026\nIBAN AT47 1200 0006 1620 5407');
		expect(g.phone).toBe('');
	});

	it('kommt mit leerem Text zurecht', () => {
		expect(guessFromEmail('')).toEqual({ subject: '', name: '', email: '', phone: '' });
	});
});

describe('companyDomain', () => {
	it('liefert die Firmen-Domain, bei Freemail nichts', () => {
		expect(companyDomain('max@Strabag.com')).toBe('strabag.com');
		expect(companyDomain('max@gmail.com')).toBe('');
		expect(companyDomain('kaputt')).toBe('');
	});
});
