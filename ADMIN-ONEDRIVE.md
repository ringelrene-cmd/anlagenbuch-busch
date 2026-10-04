# Einrichtung und Datenumzug

## Architektur

Browser → bestehende Pages-Adresse und Passwortprüfung → Durable Object `AnlagenbuchSync` → Microsoft Graph → privates OneDrive.

OneDrive enthält `state.json` (Datenstand, Revision, Wiederholungsbelege), eine `backup-latest.json` sowie unveränderlich benannte Mediendateien. Backups dienen nicht mehr als laufendes Synchronisationsprotokoll. Der Koordinator ist die einzige Schreibstelle für `state.json`. Nicht parallel direkt in diese Datei schreiben und nicht zwei Worker mit verschiedenen Objekt-Identitäten an denselben OneDrive-Ordner anbinden. Für einen Test einen getrennten Ordner und Preview-Worker verwenden.

Die öffentliche Pages-Anwendung erhält nur die `SYNC`-Bindung und `WEB_PASSWORD`. Microsoft-Tokens verbleiben im Worker; rotierte Refresh-Tokens werden im privaten Durable-Object-Speicher behalten. Die Konto-Freigabe wird mit einem öffentlichen Client und Microsofts Device-Code-Verfahren einmalig vom Kontoinhaber erteilt. Widerrufene Berechtigungen können eine erneute Freigabe erfordern.

## Einmalige Freigabe des privaten Microsoft-Kontos

1. In Microsoft Entra eine App-Registrierung anlegen, die persönliche Microsoft-Konten unterstützt. Delegierte Graph-Berechtigung `Files.ReadWrite` und `offline_access` verwenden. „Öffentliche Clientflows zulassen“ aktivieren. Es wird kein Browser- oder Client-Secret in die Web-App eingebaut.
2. Im Projektordner ausführen: `node scripts/connect-onedrive.mjs CLIENT-ID Anlagenbuch-Busch-Test`.
3. Der Kontoinhaber öffnet die angezeigte Microsoft-Seite, gibt den angezeigten einmaligen Code ein und erteilt die Freigabe. Das Skript legt den benannten Ordner an bzw. verwendet genau diesen vorhandenen Ordner.
4. `.onedrive-secrets.json` ist eine geheime lokale Datei. Nicht in Git, ZIP oder den Pages-Ausgabeordner aufnehmen. Sie ist im Projekt ignoriert. Für den Produktivumzug später einen eigenen Zielordner wählen.

## Cloudflare

Node.js 22+, Cloudflare-Wrangler und ein angemeldetes Cloudflare-Konto werden für die Bereitstellung benötigt. Die Worker-/Durable-Objects-Nutzung richtet sich nach dem vorhandenen Cloudflare-Tarif; es wurde kein Tarifwechsel oder Kauf durchgeführt.

Für einen isolierten Preview-Test:

```text
npx wrangler deploy --config server/wrangler.preview.toml
npx wrangler secret bulk .onedrive-secrets.json --config server/wrangler.preview.toml
```

Für leere Testdaten kann am Preview-Worker `ONEDRIVE_ALLOW_INITIALIZE=true` gesetzt werden. In Produktion ist dies nicht nötig: erst den vollständigen Nutzdatenexport importieren. Die neue Anwendung verweigert sonst das unbeabsichtigte Initialisieren einer leeren Cloud.

Pages-Preview erhält ein eigenes `WEB_PASSWORD`. Die mitgelieferte Pages-Konfiguration verweist für Preview auf `anlagenbuch-onedrive-preview`. Die Produktionsbindung verweist auf `anlagenbuch-onedrive`. Für beide Umgebungen die Bindung im Cloudflare-Dashboard prüfen. Niemals den Preview-Worker mit dem produktiven OneDrive-Ordner verbinden.

## Bestehende Daten übernehmen – vor dem Versionswechsel

1. Einen Umstellungszeitpunkt vereinbaren. Alle bisherigen Geräte online bringen und ausstehende Änderungen abgleichen. Danach während des Exports nicht weiter ändern. Offline gebliebene Geräte behalten ihre lokalen Änderungen; ihre spätere Zusammenführung muss geprüft werden.
2. Im lokalen Terminal das bisherige Anlagenbuch-Passwort als Umgebungsvariable `WEB_PASSWORD` setzen. Es nicht in eine Datei im Projekt oder in einen Chat schreiben.
3. Solange die alte Website noch läuft: `node scripts/migrate.mjs export`. Standardquelle ist die bestehende Pages-Adresse; eine andere Quelle lässt sich mit `SOURCE_URL` angeben. Der Export liest den vom alten Server zusammengesetzten Datenstand und lädt jede referenzierte PDF-/Fotodatei. Bei einer fehlenden Datei bricht er ab. Dropbox wird dabei nicht verändert.
4. `migration-private.json` sicher verwahren; sie enthält Nutzdaten und alle Medien. Ihre Anlagenzahl und Dateianzahl prüfen. Die Datei wird nicht veröffentlicht.
5. OneDrive für den **produktiven, leeren Zielordner** freigeben: `node scripts/connect-onedrive.mjs CLIENT-ID Anlagenbuch-Busch`.
6. `node scripts/migrate.mjs import`. Dies lädt zuerst die Medien, dann Backup und Zustand hoch und liest den Zustand zur Kontrolle zurück. Ein bereits vorhandener `state.json` führt zum Abbruch statt zum Überschreiben.
7. Produktiv-Worker bereitstellen und danach die aktuellen Secrets importieren:

```text
npx wrangler deploy --config server/wrangler.toml
npx wrangler secret bulk .onedrive-secrets.json --config server/wrangler.toml
node scripts/build.mjs
npx wrangler pages deploy dist --project-name anlagenbuch-busch --branch main
```

Der Projektname muss beim **bereits vorhandenen** Pages-Projekt bleiben. `WEB_PASSWORD` im Pages-Projekt beibehalten; so funktionieren die vorhandenen Sitzungen und Begleiter weiter. Die Functions liegen im Projektordner `functions/` und werden von Wrangler mitgebaut. `dist/` enthält ausschließlich öffentliche Dateien, keine Serverquellen, Secrets oder Nutzdatenexporte. Bei Git-Integration den Build-Befehl `node scripts/build.mjs` und Ausgabeordner `dist` einstellen.

8. `/api/version` muss `2.81-test` und `onedrive` melden. Nach Anmeldung `/api/health` prüfen. Dann die Prüfliste in `README-RENE.md` mit zwei echten Geräten durchführen. Erst danach den Teststand für alle freigeben. Diese Schritte wurden hier nicht gegen die Konten ausgeführt.

## Wiederherstellung, Grenzen und Betrieb

- Ein Restore ist eine normale lokale Änderung gegenüber dem bisherigen Ausgangsstand. Gleichzeitige fremde Änderungen werden beim folgenden Abgleich geprüft. Der Import restauriert fehlende Medien, überschreibt aber keine abweichenden Bytes unter derselben Datei-ID.
- Ein Backup wird erst ersetzt, nachdem seine Daten vollständig vorliegen. Offline erstellte ältere Backups ersetzen kein Backup mit neuerem Erstellungsdatum. Dafür müssen die Geräteuhren stimmen.
- Die aktuellen Media-Dateien werden nicht automatisch gelöscht: andere Geräte, lokale Backups oder noch offene Änderungen können sie referenzieren. Nur der Backup-Slot wird ersetzt. OneDrive-Dateiversionen und das lokale Migrationsarchiv bleiben erhalten.
- Fehlende Migrationsdateien, OneDrive-401/429/5xx, unterbrochene Uploads und widerrufene Token müssen beim Pilotbetrieb geprüft werden. Drosselung führt zu einer Pause, nicht zum Löschen lokaler Änderungen. Gegen Graph wurden bisher Adaptertests mit simulierten Antworten durchgeführt.
- Das Schreibmodell setzt den einzelnen Koordinator voraus; die Grenzen eines Worker-Neustarts während einer laufenden echten Graph-Anfrage sind im Pilotbetrieb zu prüfen. Es gibt keine zugesagte atomare Transaktion über Cloudflare und OneDrive. Eine erfolgreiche Antwort wird erst nach der OneDrive-Schreibbestätigung gesendet.
- Backup-Erzeugung ist derzeit im Arbeitsspeicher, kein Streaming. Bei großen Dateien nahe dem 60-MB-Limit muss die Cloudflare-Speichergrenze im Pilot geprüft werden; produktiv gegebenenfalls das Limit reduzieren oder Streaming ergänzen. Lokale Tests ersetzen diesen Lasttest nicht.
- Ein direkter Rückwechsel zur alten Dropbox-Version nach neuen OneDrive-Änderungen würde zwei Datenstände erzeugen. Vor einem Rollback Daten exportieren und abgleichen; niemals die alten Cloud-Dateien einfach wieder zur Wahrheit erklären.

## Quellen

- [Microsoft: Device-Code-Verfahren mit persönlichen Konten](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code)
- [Microsoft: Refresh-Token-Erneuerung](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Microsoft: OneDrive-Dateiinhalte übertragen](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0)
- [Cloudflare: Durable Objects an Pages binden](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare: Regeln für Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/)
