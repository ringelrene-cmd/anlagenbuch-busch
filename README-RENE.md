# Anlagenbuch Busch – Version 2.81 Test

Ausgangsbasis ist ausschließlich Anlagenbuch-OneDrive-2.80-Test.zip aus Busch_Anlagenbuch/Updates. Die Originale und die produktive Website wurden nicht verändert. Dies ist ein vollständiges, lokal testbares Web-/Server-Projekt, keine neu gebaute Android-APK.

## Start

ZIP vollständig in einen neuen Ordner entpacken. Node.js 22 oder neuer vorausgesetzt. Start-Test.cmd doppelklicken, Fenster offen lassen, http://localhost:8788 öffnen. Testpasswort: test-busch. Der Testserver verwendet nur lokale Beispieldaten und simuliert OneDrive. Zwei verschiedene Browser/Profile entsprechen zwei Geräten. Zwei Tabs desselben Profils sind gegen gleichzeitiges Schreiben gesperrt.

## Änderungen gegenüber 2.80

- PDF-Dateien werden online neu angefordert, statt dauerhaft eine alte Cache-Kopie zu verwenden. Bei Offlinebetrieb, Netzfehlern, Drosselung oder Serverausfall bleibt die vorhandene Kopie nutzbar. Authentifizierungsfehler und fehlende Dateien werden nicht durch alte Kopien verdeckt.
- PDFs und Fotos bleiben nach einem Versionswechsel aus älteren Medien-Caches erreichbar. Die PDF-Verknüpfungs-ID verhindert nicht mehr den Zugriff auf eine zuvor gespeicherte Datei ohne diese Zusatz-ID.
- Empfangsbestätigungen für Synchronisationsvorgänge werden nicht mehr nach 200 anderen Änderungen entfernt. Sehr späte Wiederholungen können dadurch nicht allein wegen dieser Begrenzung inzwischen gelöschte Datensätze wiederherstellen. Die Bestätigungsliste wächst mit der Zahl der Schreibvorgänge; eine spätere Bereinigung benötigt ein Verfahren mit bestätigten Gerätefortschritten.
- Konfliktauswahl prüft, ob die angezeigten Werte noch aktuell sind, und verlangt eine gültige Auswahl für jeden aktuellen Konflikt.
- Serverseitig erzeugte Backups speichern Medien unter denselben URI-Schlüsseln wie die Wiederherstellung erwartet.
- Die Gesundheitsprüfung meldet zusätzlich initialized; ein erreichbarer OneDrive-Ordner ist damit vom tatsächlich initialisierten Datenbestand unterscheidbar.
- Packen funktioniert relativ zum Skriptstandort oder mit einem ausdrücklich angegebenen neuen Zielordner. Nur benannte Skripte werden kopiert; lokale Zugangsdaten und Migrationsdateien werden nicht mitgenommen. Vorhandene Ausgabeordner werden nicht überschrieben.
- Versionsanzeigen, API und App-Cache sind auf 2.81 aktualisiert. Der lokale Datenspeicherschlüssel bleibt erhalten.

## Erhalten

Fachmodule, Units, Störungen, PSA, Tagesprotokolle, interner PDF-Viewer mit Zoom/Seitenwechsel/Touch-Gesten, Foto-Viewer, Widget-Code, Alarmdateien und Begleiter-Pakete stammen weiterhin aus der 2.80-ZIP. Android-Begleiter 2.30 und Windows-Begleiter 2.20 sind unverändert enthalten; deren Quellen fehlen in der Ausgangs-ZIP.

## Prüfung und Grenzen

Automatische Tests: node --test tests/*.test.mjs. Build: node scripts/build.mjs. Die ursprünglichen 12 Tests und ergänzte Regressionstests für Medien, Konfliktauswahl, Backup, Initialisierung und späte Wiederholungen wurden ausgeführt. Anmeldung und Start der 2.81-Oberfläche mit 1869 mitgelieferten Beispielanlagen wurden im lokalen Browser geprüft. Weitere Browseraktionen scheiterten an Zeitüberschreitungen der Browsersteuerung; vollständige interaktive PDF-/Offline-/Mehrgeräteprüfungen dieser Version sind daher noch offen. tests/browser.mjs ist für einen gesonderten Durchlauf mit Playwright und Edge enthalten, wurde in diesem Durchlauf nicht ausgeführt.

Echte Microsoft-Graph-/Cloudflare-Synchronisation, Widget/Hintergrundalarm auf Hardware und mobile Touch-Gesten sind nicht als erfolgreich getestet bestätigt. Neue Medienuploads benötigen weiterhin Internet; bereits gespeicherte Medien und lokale Änderungen funktionieren offline. Backupgrenze unverändert 60 MB. Der einzelne Koordinator muss die einzige Schreibstelle für state.json bleiben; kein zweiter Worker oder manuelles paralleles Schreiben in diese Datei.

## Bestehende Einrichtung

ABGLEICH-2.81.md beschreibt den Vergleich mit den später benutzten lokalen Ordnern. Die vorhandenen Zugangsdaten und Migrationsdateien bleiben am bisherigen Ort und sind absichtlich nicht im Paket. ADMIN-ONEDRIVE.md dokumentiert die Einrichtung. Bereits erteilte Freigaben und Worker-Secrets nicht unnötig neu erzeugen. Vor einer produktiven Bereitstellung müssen der aktive Cloudflare-Worker, die Bindung und der vorhandene Datenstand geprüft werden. Das Ablegen einer ZIP in OneDrive aktualisiert die Website nicht.
