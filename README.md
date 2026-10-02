# Monsipan Intern

Die interne Anwendung von Monsipan Bautenschutz: alle Bereiche des Betriebs in einer
Oberfläche, auf dem Handy wie am PC. Die übrigen Bereiche kommen nach und nach dazu.

| Bereich | Stand |
|---|---|
| Übersicht | fertig – Einstieg in alle Bereiche, Kennzahlen aus dem Lager |
| Stundenzettel | fertig – Lohnwoche je Mitarbeiter, Freigabe und Prüfung |
| Tagesberichte | fertig – Leistung je Tag und Baustelle, zum Unterschreiben |
| Lagermanagement | fertig – Bestand, Buchen, Inventur, Bewegungen, Bestellliste, Berichte, Artikel |
| Benutzer | fertig – Zugänge, Gruppen, Berechtigungen |
| Administration | fertig – Stammdaten, Einstellungen, Sicherungen |
| Aufträge, Planung, Partien | geplant |
| Bestellungen, Dokumente, Auswertungen | geplant |

Welche Bereiche es gibt und welche davon freigeschaltet sind, steht an einer Stelle:
[`src/lib/modules.ts`](src/lib/modules.ts). Ein neuer Bereich bekommt dort einen Eintrag,
seine Seiten unter `src/routes/(app)/<bereich>/` und seinen Code unter
`src/lib/modules/<bereich>/`.

## Lagermanagement

Lagerverwaltung für die Bodenmarkierung: Bestand je Lagerort, Ein-/Ausbuchen per Scan,
Umlagern, Rückgaben, Inventur, Bestellliste mit Warn-Mails und Auswertungen.

- **Scannen** mit USB-/Bluetooth-Handscanner am PC oder mit der Handykamera
  (EAN, GTIN-14, Code 128, GS1, die Kansai-DataMatrix mit `bez:`/`art:`/`inh:` … und SWARCO-Palettenetiketten)
- **Handy und PC**, als App installierbar: Android-App zum Herunterladen oder als Web-App, Hell- und Dunkelmodus
- **Live**: Buchungen auf einem Gerät erscheinen sofort auf allen anderen
- **Drucken**: Bestand und Bewegungen aufs Papier, mit Zählspalte für die Inventur
- **Ein Container** plus Caddy für HTTPS, Datenbank ist eine einzige SQLite-Datei

**Inventur:** Ein eigener Bereich neben Buchen. Lagerort wählen, dann stehen alle Artikel
mit Bestand dort als Zählliste bereit: links der Bestand laut System, daneben ein Feld für die
gezählte Menge, rechts die Abweichung. **Alle übernehmen** füllt alle leeren Felder mit dem
Systembestand – praktisch, wenn nur wenige Zeilen abweichen. Gescannte Artikel springen in die
Liste und zählen je Scan ein Stück hoch; was am Lagerort gar nicht geführt wird, hängt sich
beim Scannen unten an. Gebucht wird nur, was eingetragen ist – jede gezählte Zeile wird als
Inventur-Buchung festgehalten, auch wenn sie stimmt.

---

## Inhalt

0. [Bereiche und Adressen](#bereiche-und-adressen)
1. [Rollen](#rollen)
2. [Stundenzettel](#stundenzettel)
3. [Tagesberichte](#tagesberichte)
4. [Lokale Entwicklung](#lokale-entwicklung)
3. [Betrieb auf dem Server](#betrieb-auf-dem-server)
4. [Datensicherung](#datensicherung)
5. [Alles zurücksetzen](#alles-zurücksetzen)
6. [Drucken, PDF und CSV](#drucken-pdf-und-csv)
7. [Materialbeschreibungen (PDF)](#materialbeschreibungen-pdf)
8. [App fürs Handy](#app-fürs-handy)
9. [Scanner einrichten](#scanner-einrichten)
10. [Technik und Projektstruktur](#technik-und-projektstruktur)

---

## Bereiche und Adressen

Jeder Bereich hat seinen eigenen Pfad. Das Lager liegt unter `/lager/…`, Benutzer und
Administration unter `/verwaltung/…`:

| Seite | Adresse |
|---|---|
| Übersicht | `/` |
| Stundenzettel | `/stundenzettel` |
| Tagesberichte | `/tagesberichte` |
| Bestand, Buchen, Bewegungen, Bestellliste, Berichte | `/lager/bestand` usw. |
| Inventur | `/lager/inventur` |
| Artikel | `/lager/artikel/<id>` |
| Scanner testen | `/lager/scanner-test` |
| Stammdaten, Benutzer, Einstellungen | `/verwaltung/…` |

Die alten Adressen (`/bestand`, `/buchen`, `/artikel/5`, `/benutzer` …) leiten dauerhaft
auf die neuen weiter – gespeicherte Lesezeichen und Verknüpfungen am Handy funktionieren
weiter. Die Weiterleitung steht in [`src/hooks.server.ts`](src/hooks.server.ts).

## Rollen

| Rolle | Darf |
|---|---|
| Admin | alles, zusätzlich Benutzer, Berechtigungen und Einstellungen |
| Bauleiter | buchen, Inventur, Korrekturen, Artikel und Stammdaten pflegen, Berichte, Stunden und Tagesberichte |
| Buchhaltung/Sekretariat | Stundenzettel prüfen, Tagesberichte und Berichte einsehen, Stammdaten pflegen – ohne Lagerbuchungen |
| Partieführer | Bestand und Bewegungen ansehen, buchen, Stundenzettel und Tagesberichte der eigenen Partie |
| Arbeiter | wie Partieführer, sieht aber keine Bewegungen (weder Liste noch Verlauf am Artikel) |
| Nur ansehen | alles ansehen außer Stammdaten, Benutzer und Einstellungen – keine Änderungen |

**Partieführer und Arbeiter** gehören immer zu einer Partie (Pflichtfeld unter Benutzer).
Beim Ausbuchen („Ausgabe an“) und bei Rückgaben („Zurück von“) ist ihre Partie vorausgewählt.
Wer zu keiner Partie gehört (z. B. Bauleiter, Admin), bucht standardmäßig auf sich selbst –
in der Bewegungsliste steht dann der eigene Name. Eine Partie lässt sich jederzeit auswählen.

**Benutzer löschen:** Wer nie gebucht hat, wird vollständig entfernt. Wer schon gebucht hat,
kann sich danach nicht mehr anmelden und verschwindet aus der Liste; der Name bleibt in der
Historie erhalten, Benutzername und E-Mail werden frei.

**Inhaber:** Genau ein Konto ist Inhaber – zu Beginn der erste Admin. Nur der Inhaber darf
Admins löschen, deaktivieren oder herabstufen; alle übrigen Benutzer verwaltet jeder Admin
wie bisher, und das Passwort eines anderen Admins darf auch jeder Admin zurücksetzen –
nur beim Inhaber-Konto nicht. Das Inhaber-Konto selbst kann niemand löschen,
deaktivieren oder herabstufen, auch der Inhaber nicht. Unter **Benutzer → Inhaber-Konto**
lässt sich die Inhaberschaft mit Passwortbestätigung an einen anderen aktiven Admin
übergeben; der bisherige Inhaber bleibt Admin. Beim Zurücksetzen aller Daten bleibt das
Inhaber-Konto immer erhalten. Die Regeln stehen in
[`src/lib/user-rules.ts`](src/lib/user-rules.ts).

**Berechtigungen:** Was eine Gruppe darf, steht unter **Benutzer → Berechtigungen** – eine
Tabelle mit allen Rechten je Gruppe, zum Anhaken. Änderungen gelten sofort, auch für bereits
angemeldete Geräte. Die ausgelieferten Standardrechte stehen in
[`src/lib/permissions.ts`](src/lib/permissions.ts); ein neuer Bereich bringt seine Rechte dort
mit und sie werden beim Start automatisch ergänzt. Mit **Auf Standard zurücksetzen** geht es
jederzeit zurück. Drei Haken sind fest: Benutzer, Berechtigungen und Einstellungen bleiben beim
Admin, damit sich niemand aussperrt.

## Stundenzettel

Eine Woche je Mitarbeiter, aufgebaut wie der Lohnzettel auf Papier: Montag bis Sonntag mit
Kostenstelle, Baustelle/Tätigkeit, Zeit von/bis und den Stundenarten Norm, Überstunden 50 %
und 100 %, Urlaub, Feiertag, Regen und Efzg (Entgeltfortzahlung). Dazu Auslöse (Tage und
Betrag) und VAZ. Die Summen je Spalte und die Gesamtstunden rechnet die Seite mit, während
getippt wird.

Stunden werden als Zahl eingetragen, nicht als Uhrzeit: `8,5` sind acht Stunden dreißig.
`8:30` versteht die Eingabe ebenfalls.

**Monatlich getrennt:** Der Lohn wird monatsweise abgerechnet, deshalb endet ein
Stundenzettel immer am Monatsende. Geht eine Woche über den Monatswechsel, gibt es zwei
Zettel – einen je Monat, jeder mit den Tagen, die in diesen Monat fallen. In der
Wochenübersicht steht dann je Person eine Zeile pro Monatsteil, und im Zettel führt ein
Link zum anderen Teil. Ausdruck und PDF zeigen trotzdem alle sieben Tageszeilen wie der
Vordruck; die Tage des anderen Monats bleiben leer.

**Ablauf:** In Arbeit → freigegeben → geprüft.

- Der **Partieführer** erfasst die Woche für sich und seine Partie und gibt sie frei.
- **Buchhaltung und Bauleitung** prüfen und setzen den Haken; danach ist die Woche zu.
- **Wieder öffnen** macht sie erneut änderbar.
- Jeder sieht den eigenen Zettel, auch ohne Erfassungsrecht.

**Drucken** gibt das Blatt im Formularlayout aus, inklusive der Zeilen für Unterschrift
Vorarbeiter und überprüft.

## Tagesberichte

Ein Bericht je Tag und Baustelle, wie der Block im Auto: Nummer, Datum, Bundesstraße,
Baustelle und Kostenstelle im Kopf, darunter bis zu acht LB-Positionen mit Einheit und
beliebig vielen Zeilen „Ortsbezeichnungen und Markierungsarten" mit den Mengen je Position.
Die Einheitssumme je Spalte wird mitgerechnet. Dazu der Materialblock (gelb, weiß,
Reflexkörper mit Kenn-Nr. und Filmdicke), Tagesleistung und LV-Position Nr.

Die Nummer schlägt die App als nächste freie vor, bleibt aber frei änderbar – so passt sie
zum Papierblock. Berichte lassen sich abschließen (nur Bauleitung und Admin) und wieder
öffnen. **Drucken** gibt den Bericht mit beiden Unterschriftszeilen aus.

Wer kein Recht auf „alle sehen" hat, sieht die Berichte der eigenen Partie und die selbst
angelegten.

## Lokale Entwicklung

Voraussetzung: Node.js 22.12 oder neuer.

```bash
npm install
npm run dev
```

Beim ersten Start wird die Datenbank in `./data/lager.db` angelegt. Mit `DEMO_DATA=true`
in der `.env` kommen Beispielartikel (u. a. die fotografierten Kansai- und 3M-Etiketten),
Partien und ein halbes Jahr Buchungen dazu. Grund- und Demodaten werden nur bei einer
leeren Datenbank angelegt – nach einem Zurücksetzen kommen sie nicht von selbst wieder.

| Zugang (nur Entwicklung) | Passwort |
|---|---|
| `admin` | `admin1234` |
| `bauleiter` (ohne Partie), `partie` (Partieführer, Partie Nord), `arbeiter` (Partie Nord), `buero` (nur ansehen) | `demo1234` |

Die Handykamera braucht HTTPS. Zum Testen im WLAN ein lokales Zertifikat erzeugen,
z. B. mit [mkcert](https://github.com/FiloSottile/mkcert) für `localhost` und die
IP-Adresse des PCs, und in `vite.config.ts` unter `server.https` eintragen. Auf dem Handy
muss die mkcert-Stammzertifizierungsstelle (`mkcert -CAROOT` → `rootCA.pem`) installiert
und vertraut sein, sonst blockiert der Browser die Kamera.

Weitere Befehle:

```bash
npm run check      # Typprüfung
npm test           # Tests (Scan-Parser, Tastaturlayouts, Scanner-Erkennung)
npm run build      # Produktions-Build nach ./build
npm run db:generate  # nach Änderungen am Schema: neue Migration erzeugen
```

## Betrieb auf dem Server

Zwei Wege: fertiges Image aus GitHub über Portainer (wenn schon ein Cloudflare Tunnel
läuft) oder selbst bauen mit Docker Compose und Caddy.

### Mit Portainer und Cloudflare Tunnel

Bei jedem Push auf `main` baut GitHub Actions
([`.github/workflows/docker.yml`](.github/workflows/docker.yml)) erst Typprüfung und
Tests, dann das Image für `linux/amd64` und `linux/arm64`:

```
ghcr.io/mstreicher98/monsipan-intern:latest
```

Dazu gibt es Tags mit dem Commit (`sha-…`) und, bei einem Git-Tag wie `v1.0.1`, mit der
Version. In Portainer **Stacks → Add stack → Repository**, Repository-URL des Projekts,
Compose path `portainer-stack.yml`. Die Datei ist kommentiert; nötig ist nur:

| Variable | Wert |
|---|---|
| `ORIGIN` | `https://intern.monsipan.at` – muss exakt der öffentlichen Adresse entsprechen, sonst lehnt die App alle Formulare ab |
| `INITIAL_ADMIN_PASSWORD` | Passwort des ersten Admins (leer lassen: die App erzeugt eines und zeigt es im Log) |
| `SMTP_*`, `MAIL_FROM` | nur falls E-Mail gewünscht |

Der Tunnel zeigt auf `http://<Server-IP>:3000`. Läuft `cloudflared` als Container in
einem eigenen Docker-Netz, stattdessen in `portainer-stack.yml` Variante B aktivieren
und im Tunnel `http://app:3000` eintragen. TLS macht Cloudflare, Caddy wird dann nicht
gebraucht.

Das Paket ist derzeit öffentlich, Portainer braucht also keine Zugangsdaten. Wird es auf
GitHub unter **Packages → Package settings** auf privat gestellt, in Portainer unter
**Registries** eine GHCR-Registry mit GitHub-Benutzer und einem Token mit
`read:packages` hinterlegen.

**Update:** Änderungen pushen, Actions abwarten, in Portainer **Pull and redeploy**.
Die Datenbank liegt im Volume `lager-data` und bleibt dabei erhalten; Migrationen laufen
beim Start automatisch. Volume und Dateiname heißen weiterhin „lager“ – beim Umbenennen
der Anwendung wurden sie bewusst nicht angefasst, damit keine Daten verloren gehen.

**Umzug von `lager.monsipan.at` auf `intern.monsipan.at`:** Im Cloudflare-Tunnel die neue
Hostname-Route auf denselben Container legen und `ORIGIN` auf die neue Adresse setzen.
Für die alte Adresse in Cloudflare unter **Rules → Redirect Rules** eine Weiterleitung
auf `intern.monsipan.at` anlegen (Pfad und Query übernehmen). Das muss in Cloudflare
passieren, nicht in der App: Mit gesetztem `ORIGIN` sieht die Anwendung den alten
Hostnamen gar nicht mehr. Innerhalb der Anwendung leiten die alten Pfade von selbst
weiter (siehe [Bereiche und Adressen](#bereiche-und-adressen)).

### Selbst bauen mit Docker Compose und Caddy

Benötigt: ein Linux-Server mit Docker, Ports 80 und 443 offen, und ein DNS-Eintrag
(A-Record) von `intern.monsipan.at` auf die Server-IP.

```bash
git clone <repo> monsipan-intern && cd monsipan-intern
cp .env.example .env        # Domain, SMTP und ersten Admin eintragen
docker compose up -d --build
docker compose logs app     # zeigt das Passwort des ersten Admins, falls keines gesetzt wurde
```

Caddy holt das HTTPS-Zertifikat automatisch und erneuert es. Beim ersten Login muss das
Admin-Passwort geändert werden.

**Update:** `git pull && docker compose up -d --build` – Datenbank-Migrationen laufen beim
Start automatisch.

**Wichtige Umgebungsvariablen** (siehe [`.env.example`](.env.example)):

| Variable | Zweck |
|---|---|
| `DOMAIN` | Domain für HTTPS und Links in E-Mails |
| `INITIAL_ADMIN_*` | erster Admin, nur beim allerersten Start |
| `SMTP_*`, `MAIL_FROM` | E-Mail für „Passwort vergessen“, Einladungen, Warnungen |
| `DEMO_DATA` | `true` legt Beispieldaten an – im Echtbetrieb `false` lassen |

Ohne SMTP funktioniert alles außer E-Mail; Mails landen dann nur im Log. Den Versand
testet ein Admin unter **Einstellungen → Test senden**.

## Datensicherung

- Jede Nacht ab 2 Uhr entsteht automatisch eine Sicherung in `/data/backups`
  (Docker-Volume `lager-data`), die letzten 14 bleiben erhalten. Sicherungen werden nie
  überschrieben; entsteht eine zweite in derselben Sekunde, bekommt sie ein `-2` angehängt.
- Unter **Einstellungen → Datensicherung** lassen sich Sicherungen sofort erstellen und herunterladen.

**Wiederherstellen (in der App, nur Admin):** In der Liste der Sicherungen auf das
Verlaufs-Symbol klicken oder über **Sicherungsdatei hochladen** eine `.db`-Datei von
außerhalb einspielen (bis 200 MB, deshalb steht `BODY_SIZE_LIMIT` im Container auf 210M).
Bestätigt wird mit dem eigenen Passwort. Ablauf: Datei prüfen (SQLite, Schema, Zustand),
bei Bedarf auf den aktuellen Schemastand migrieren, Sicherung des jetzigen Standes anlegen
(`-vor-restore` im Namen) und dann den gesamten Inhalt in einer Transaktion ersetzen –
entweder ganz oder gar nicht. Die Datenbankdatei selbst wird nicht getauscht, damit
laufende Anfragen nicht ins Leere greifen. Anmeldungen kommen danach aus der Sicherung;
wer dadurch abgemeldet wird, meldet sich einfach neu an.
Der Code steht in [`src/lib/server/restore.ts`](src/lib/server/restore.ts).

**Wiederherstellen von Hand** (z. B. wenn die App nicht startet): Container stoppen,
gewünschte Sicherung als `lager.db` in das Volume kopieren, Container starten.

```bash
docker compose stop app
docker compose run --rm --no-deps --entrypoint sh app -c "rm -f /data/lager.db-wal /data/lager.db-shm"
docker compose cp ./lager-2026-09-18-020000.db app:/data/lager.db
docker compose start app
```

Für echte Ausfallsicherheit die Sicherungen zusätzlich außerhalb des Servers ablegen
(z. B. nächtliches `rsync` des Volumes oder Download über die Oberfläche).

## Alles zurücksetzen

Unter **Einstellungen → Alles zurücksetzen** (nur Admin) lässt sich das Lager komplett leeren:
Artikel und Codes, Bestand, alle Bewegungen, Lagerorte, Partien, Materialarten und Farben.

- **Doppelte Bestätigung:** `ALLES LÖSCHEN` eintippen (Groß-/Kleinschreibung egal) und
  das eigene Passwort eingeben. Nach 5 Fehlversuchen ist die Aktion kurz gesperrt.
- Das eigene Admin-Konto bleibt immer erhalten. Optional werden alle anderen Benutzer
  mitgelöscht, sonst verlieren sie nur ihre Partie-Zuordnung. Bereits gelöschte Benutzer
  werden endgültig entfernt.
- Optional werden die Standard-Materialarten und RAL-Verkehrsfarben gleich wieder angelegt.
- **Vorher entsteht automatisch eine Sicherung** mit `-vor-reset` im Namen. Sie ist in der
  Liste gekennzeichnet, wird getrennt aufbewahrt (die letzten 10) und verdrängt keine der
  14 regulären Sicherungen. Wiederherstellen wie oben beschrieben.

## Drucken, PDF und CSV

**Bestand** und **Bewegungen** haben je einen Knopf **Drucken**. Er öffnet eine eigene
Druckansicht, die den aktuellen Filter übernimmt und alle Treffer enthält – nicht nur die
angezeigte Seite, sondern bis zu 2000 Zeilen. Das Druckfenster öffnet sich von selbst;
sonst hilft der Knopf auf der Seite.

- Eingestellt auf A4 mit Kopfzeile: Firma, Titel, Filter und Zeitpunkt des Ausdrucks.
  Der Tabellenkopf wiederholt sich auf jeder Seite, Zeilen werden nicht umgebrochen.
  Navigation, Filter und Knöpfe kommen nicht aufs Papier.
- **Bestandsliste:** je Artikel Nummer, Hersteller und die Mengen der einzelnen Lagerorte.
  Bestände auf oder unter dem Mindestbestand stehen fett mit dem Hinweis „unter
  Mindestbestand“. Ganz rechts ist eine leere Spalte **gezählt** zum Eintragen bei der Inventur.
- **Bewegungen:** Zeitpunkt, Art, Artikel, Menge mit Vorzeichen, Von/Nach und wer gebucht
  hat. Stornierte Buchungen sind durchgestrichen. Nur für Rollen, die Bewegungen sehen dürfen.

**Als PDF herunterladen:** Überall, wo es Drucken oder CSV gibt, gibt es auch **PDF**. Die
Datei entsteht am Server (pdfkit, keine Browser-Druckfunktion nötig), übernimmt die
eingestellten Filter und eignet sich zum Weiterschicken oder Ablegen:

| Dokument | Adresse |
|---|---|
| Bestandsliste | `/export/bestand.pdf` |
| Bewegungen | `/export/bewegungen.pdf` |
| Bestellliste (nach Hersteller gruppiert, mit Unterschriftszeile) | `/export/bestellliste.pdf` |
| Verbrauch je Monat | `/export/verbrauch.pdf` |
| Lohnzettel einer Woche (im Aufbau des Formulars aus dem Block) | `/stundenzettel/<id>/pdf` |
| Tagesbericht | `/tagesberichte/<id>/pdf` |

**Lohnzettel:** Druckansicht und PDF sind dem Vordruck nachgebaut – Briefkopf mit
Lohnwoche, das Raster mit je einer Zeile pro Tag und einer schmalen für Zeit von/bis,
Gesamtstunden, VAZ, Auslöse und die beiden Unterschriftszeilen mit dem KV-Satz dazwischen.
Mit `?nodruck=1` lässt sich eine Druckansicht ohne Druckfenster anschauen.

Jede Seite hat Kopf (Titel, Filter) und Fuß (Anwendung, Ausdruckzeitpunkt, Seite x von y);
der Tabellenkopf wiederholt sich beim Seitenumbruch. Lohnzettel und Tagesbericht bringen
ihre Unterschriftszeilen mit. **CSV** gibt es unverändert daneben – für Excel.

## Materialbeschreibungen (PDF)

Am Artikel lassen sich PDFs hinterlegen – Materialbeschreibungen, Sicherheitsdatenblätter
und Sonstiges. **Hochladen und entfernen** dürfen nur Admin und Bauleiter, **ansehen**
alle Angemeldeten. Bis 25 MB je Datei; der Titel wird aus dem Dateinamen vorgeschlagen.

Angezeigt werden die PDFs direkt auf der Seite (pdf.js, wird erst beim Öffnen geladen) –
auch am Android-Handy und in der Android-App, wo der Browser PDFs sonst nur herunterlädt.
Im Browser gibt es zusätzlich „Im Browser öffnen“ und „Herunterladen“.

**Ablage:** Die Datenbank kennt nur Titel, Art und Prüfsumme, die Dateien liegen im Volume
unter `/data/dokumente/<sha256>.pdf`. Dieselbe Datei an mehreren Artikeln liegt nur einmal da.
Die Sicherungen der Datenbank bleiben dadurch klein.

**Sicherungen:** Wird ein PDF entfernt oder alles zurückgesetzt, bleibt die Datei noch
90 Tage liegen. Eine in dieser Zeit eingespielte Sicherung findet ihre PDFs also wieder.
Danach räumt die tägliche Wartung unbenutzte Dateien weg. Für den Umzug auf einen anderen
Server das ganze Volume mitnehmen (Datenbank **und** `/data/dokumente`) – eine
hochgeladene Sicherung allein enthält die PDFs nicht.

## App fürs Handy

Im Lager erscheint am Handy unter **Mehr → App installieren** (und als Hinweis auf der
Übersicht) die Seite [`/app`](src/routes/(app)/app/+page.svelte). Sie zeigt je nach Gerät
den passenden Weg. Am PC steht dort nur, dass die Seite am Handy zu öffnen ist – der
Download-Knopf erscheint ausschließlich am Handy und nur angemeldet.

**Android:** echte App (Capacitor), die die laufende Webseite anzeigt. Beim ersten Mal
fragt Android, ob Apps aus dieser Quelle installiert werden dürfen, weil die Datei nicht
aus dem Play Store kommt.

> **Einmalig beim Umstieg auf Monsipan Intern:** Die App hat eine neue Kennung
> (`at.monsipan.intern` statt `at.monsipan.lager`). Android hält sie deshalb für eine
> andere App – die neue muss installiert und die alte „Lagermanagement" danach
> deinstalliert werden. Ein Update über die alte Installation ist nicht möglich.

Fester Download-Link:

```
https://github.com/mstreicher98/Monsipan-Intern/releases/download/app/monsipan-intern.apk
```

**iPhone und iPad:** Apple erlaubt kein Installieren per Datei. Safari legt das Lager
stattdessen über **Teilen → Zum Home-Bildschirm** als App an – mit eigenem Symbol,
Vollbild und Kamera-Scan. Die Seite zeigt die drei Schritte mit Symbolen.

Die App ist nur eine Hülle: Inhalte, Anmeldung und Updates kommen vom Server. Eine neue
APK-Datei braucht es nur, wenn sich an der Hülle etwas ändert (Adresse, Symbol, Berechtigungen).

**Bauen:** [`.github/workflows/android.yml`](.github/workflows/android.yml) baut die APK
bei Änderungen an `android/`, `capacitor/` oder `capacitor.config.ts` und hängt sie an das
Release mit dem Tag `app`. Über **Actions → Android-App (APK) → Run workflow** lässt sich
auch eine andere Adresse mitgeben; dauerhaft geht das über die Repository-Variable `APP_URL`.
Liegt die Datei woanders, zeigt die Umgebungsvariable `APK_URL` im Container auf den
eigenen Download.

**Signatur:** Ohne hinterlegten Schlüssel wird mit dem Debug-Schlüssel signiert. Die App
lässt sich damit installieren, aber Updates über eine neue APK scheitern, weil sich die
Signatur ändert. Für den Dauerbetrieb einmalig einen Schlüssel anlegen:

```bash
keytool -genkeypair -v -keystore lager.jks -alias lager -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 lager.jks > lager.jks.base64
```

Danach unter **Settings → Secrets and variables → Actions** hinterlegen:
`ANDROID_KEYSTORE_BASE64` (Inhalt der base64-Datei), `ANDROID_KEYSTORE_PASSWORD`,
`ANDROID_KEY_ALIAS` (`lager`) und `ANDROID_KEY_PASSWORD`. Die Datei `lager.jks` gut
aufbewahren – ohne sie sind keine Updates mehr möglich.

**Icons:** `npm run app:icons` erzeugt die Symbole für Webseite und Android aus einer
Zeichenvorschrift, ohne Zusatzpakete. `npm run app:sync` überträgt Adresse und
Offline-Seite ins Android-Projekt.

## Scanner einrichten

**Handscanner am PC** (USB oder Bluetooth im Tastaturmodus):

- Suffix auf **Enter** stellen (Werkseinstellung bei fast allen Geräten).
- Tastaturlayout am besten auf **Deutsch (QWERTZ)**. Steht es auf US, rechnet die App
  die Eingabe automatisch um – `y`/`z`, `:`, `|` und `=` kommen trotzdem richtig an,
  Umlaute aber meist nicht.
- Einfach auf einer beliebigen Seite scannen: Die App erkennt Scanner am typischen
  Zeichenabstand (höchstens 50 ms). Auf **Buchen** landet jeder Scan in der Liste – auch
  wenn gerade ein Mengen- oder Notizfeld aktiv ist, die Menge bleibt dann unverändert.
  Sonst öffnet sich der Artikel; in normalen Formularfeldern landet der Code als Text.
- **Bluetooth** (z. B. Inateck BCST-36, eingestellt über die App „Inateck Office“):
  Zeichen kommen oft stoßweise. Aussetzer bis 0,6 s werden überbrückt, Enter mitten im
  Code (mehrzeilige DataMatrix), CR+LF, Gruppentrenner (Strg+]) und Alt-Codes für
  Umlaute werden verstanden. Scanner ohne Enter am Ende werden nach einer kurzen Pause
  erkannt (ab 8 Zeichen). Fehlen trotzdem Zeichen, die Übertragungsgeschwindigkeit am
  Scanner verringern.
- **Scanner testen** (unter Mein Konto) zeigt, was genau ankommt und wie es zerlegt wird.
  Das **Tastenprotokoll** dort listet jede Taste mit Abstand in ms – auch bei Eingaben,
  die nicht als Scan erkannt wurden – und lässt sich zur Fehlersuche kopieren.
  Die Erkennung selbst steckt in [`src/lib/scan/detector.ts`](src/lib/scan/detector.ts).

**Handykamera:** gelber Knopf unten in der Mitte. Funktioniert in Chrome (Android) und
Safari (iPhone), nur über HTTPS. Die Erkennung läuft vollständig auf dem Gerät; die
Scanner-Bibliothek (~1 MB) wird erst geladen, wenn die Kamera zum ersten Mal geöffnet wird.

**Unbekannter Code:** Bauleitung und Admin können direkt einen Artikel anlegen – bei
Kansai-DataMatrix werden Bezeichnung, Artikelnummer, Inhalt, Farbe und Materialart
automatisch ausgefüllt – oder den Code einem bestehenden Artikel zuordnen.

**SWARCO-Palettenetiketten:** Die DataMatrix enthält vier Felder mit `$` dazwischen,
z. B. `1524603$30016618$2450240$1000,000` – Liefer-/Palettennummer, Artikelnummer,
Charge und Menge der Palette. Gesucht wird über die Artikelnummer, damit jede Lieferung
denselben Artikel findet, egal welche Palette und Charge. Beim Anlegen wird nur die
Artikelnummer übernommen; Bezeichnung, Hersteller und Inhalt je Stück trägt man selbst
ein (die Menge im Code gilt für die ganze Palette). Die Materialnummer wird mit und ohne
führende Nullen gefunden – auf dem Etikett steht `30016618`, in der Materialliste des
Lieferanten `000000000030016618`.

**Dieselbe Nummer bei zwei Artikeln:** Manche Lieferanten drucken auf verschiedene
Produkte dieselbe Nummer. Beim Speichern kommt deshalb erst die Rückfrage „gehört schon
zu …“; mit **Trotzdem speichern** wird die Nummer doppelt vergeben. Beim Scannen zeigt
die App dann alle Artikel mit dieser Nummer zur Auswahl – auch beim Buchen – statt
stillschweigend den falschen zu nehmen. Auf der Artikelseite steht unter dem Code, zu
welchen anderen Artikeln er ebenfalls gehört.

**Farben und RAL:** Unter **Stammdaten → Farben** wird eine Farbe über ihre RAL-Nummer
oder den RAL-Namen gewählt (alle 215 RAL-Classic-Farben, z. B. `6024` oder „Verkehrsgrün“);
das Farbmuster wird übernommen und lässt sich per Hex-Wert anpassen. Farben ohne
RAL-Nummer (z. B. Transparent) bekommen nur ein Hex-Farbmuster. Steht auf dem Etikett
eine RAL-Angabe wie `R6024`, ordnet der Scan die passende Farbe automatisch zu.
Die Artikelsuche findet Artikel auch über die RAL-Nummer.

## Technik und Projektstruktur

- [SvelteKit](https://svelte.dev) mit Svelte 5, serverseitig gerendert, Node-Adapter
- Tailwind CSS 4, Schrift Barlow (selbst gehostet)
- SQLite über libsql und [Drizzle ORM](https://orm.drizzle.team), Migrationen in `drizzle/`
- Kamera: native BarcodeDetector-API, sonst [zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
- E-Mail: Nodemailer, Live-Updates: Server-Sent Events

```
src/
  lib/
    modules.ts     Alle Bereiche: Beschriftung, Symbol, Pfad, Recht, aktiv oder geplant
    permissions.ts Rollen und Rechte, ein Block je Bereich (lager.*, verwaltung.*)
    app.ts         Name der Anwendung und Seitentitel
    nav.ts         Navigation, gefiltert nach Rolle
    components/    Geteilte Bausteine (Dialog, Tabelle, Diagramm, PDF-Ansicht, Navigation)
    server/        Geteilt: Datenbank, Anmeldung, Mail, Sicherungen, Dokumente, Ereignisse
    server/db/schema/   core.ts (Benutzer, Partien, Einstellungen) + je Bereich eine Datei
    modules/
      lager/       Alles zum Lager: server/ (Bestand, Buchungen, Warnungen),
                   components/, scan/ (Parser, Tastaturlayouts, Handscanner, Kamera)
      stunden/     Lohnwoche: Wochenrechnung und server/ (Zettel, Freigabe, Prüfung)
      tagesberichte/ server/ (Berichte, Positionen, Zeilen, Material)
  routes/
    (auth)/        Anmelden, Passwort vergessen/zurücksetzen
    (app)/         Übersicht, lager/…, verwaltung/…, Konto, App fürs Handy
    api/           Code-Suche, Artikelsuche, Live-Ereignisse
    export/        CSV-Exporte (Excel-kompatibel) und Backup-Download
```

**Ein neuer Bereich** braucht: einen Eintrag in `modules.ts` (zunächst `status: 'geplant'`),
seinen Rechte-Block in `permissions.ts`, seine Tabellen in `server/db/schema/<bereich>.ts`,
seinen Code unter `lib/modules/<bereich>/` und seine Seiten unter `routes/(app)/<bereich>/`.
Sobald er läuft, wird aus `'geplant'` ein `'aktiv'` – dann erscheint er in der Navigation
und auf der Übersicht.

**Buchungslogik:** Jede Buchung ist eine unveränderliche Bewegung. Korrekturen stornieren
die alte Bewegung und legen eine neue an – der Bestand je Lagerort wird in derselben
Transaktion fortgeschrieben, gleichzeitige Buchungen können sich nicht überschneiden.
