# Abgleich vor Version 2.81 – 4. Oktober 2026

## Gesicherte Ausgangsbasis

Verwendet wurde die ZIP im Ordner C:\Users\ringe\OneDrive\Busch_Anlagenbuch\Updates. Sie wurde in den Arbeitsordner kopiert und dort entpackt. Keine Änderung an Original-ZIP, PDF-Ordner, Zugangsdaten, Nutzdaten oder laufender Website.

## Ergebnis des Datei-Vergleichs

Alle in der ZIP enthaltenen Dateien wurden anhand SHA-256 mit folgenden Projektständen verglichen:

- Im früheren ChatGPT-Projekt unter work/anlagenbuch-busch und release/Anlagenbuch-OneDrive-2.80-Test: keine Unterschiede bei den enthaltenen Dateien.
- C:\Users\ringe\OneDrive\Dokumente\GitHub\release\Anlagenbuch-OneDrive-2.80-Test: ebenfalls keine Unterschiede.
- C:\Users\ringe\OneDrive\Dokumente\GitHub\Anlagenbuch-OneDrive-2.80-Test\Anlagenbuch-OneDrive-2.80-Test sowie dessen paralleler release-Ordner: ausschließlich scripts/package.mjs weicht von den ZIP-Dateien ab.

Die manuelle Änderung am Packskript verschiebt das Ausgabeziel von ../../release nach ../release und entfernt nach dem Kopieren scripts/.onedrive-secrets.json. 2.81 ersetzt dies durch eine Auswahl ausdrücklich benötigter Skripte, sodass sowohl Zugangsdaten als auch migration-private.json gar nicht erst kopiert werden. Der Zielpfad ist nicht mehr vom aktuellen CMD-Arbeitsordner abhängig.

Die Synchronisationsdateien onedrive-client.js, sync-merge.js sowie server/coordinator.js, server/onedrive.js und server/gateway.js und die Wrangler-Konfigurationen stimmen in diesen 2.80-Kopien mit der ZIP überein. Es wurde kein davon abweichender lokaler Sync-Patch gefunden.

## Zusätzliche Dateien außerhalb der ZIP

Im später verwendeten Projektordner liegen scripts/.onedrive-secrets.json, scripts/migration-private.json sowie zwei PDF-Kopien. Unter Busch_Anlagenbuch liegt backup-latest.json im Format anlagenbuch-backup-v1 mit zwei Medieneinträgen. Dies belegt zusätzliche Einrichtung/Migrationsvorbereitung außerhalb des ursprünglichen Projektpakets, nicht die vollständige Funktionsfähigkeit der Cloud-Verbindung. Geheimwerte wurden nicht ausgegeben und nicht in dieses Paket übernommen.

Im lokal synchronisierten Busch_Anlagenbuch-Ordner wurde keine state.json gefunden. Ob OneDrive noch ausstehende Synchronisation hat oder der produktive Koordinator einen anderen Ordner verwendet, wurde nicht online geprüft. Vor einem Import oder einer Veröffentlichung muss der tatsächlich aktive Zielordner kontrolliert werden. Kein neues leeres Datenmodell darüber schreiben.

## PDFs

Die beiden Dateien im PDF-Ordner stimmen per SHA-256 mit den vorhandenen legacy-Migrationsdateien im Hauptordner überein:

- A_C_Version_Control_Basic.pdf.pdf: 3472CE7E61CF51796993CE9C795D19A0D5FBBADF3C2E5011C6153B8ACA951D66
- Cobra_Hardware_Basic.pdf.pdf: 19017F451B2B36896B4EB724276D3F90BD2F88C282FE2D122B160408CDB97D55

Die Originalnamen einschließlich der doppelten Endung wurden beibehalten. Ordnernamen allein erzeugen keine Zuordnung in der App; vorhandene Medienverweise müssen weiter erhalten bleiben. Keine zusätzlichen Nutzdaten wurden in den öffentlichen Web-Build eingebaut.

## Chat-Abgleich und verbleibende Unsicherheit

Der verfügbare Abruf des Chats „OneDrive Einrichtung fortsetzen“ lieferte nur die letzten fünf Gesprächsschritte und keinen Cursor für ältere Schritte. Darin wird ein PDF-Cache-Fix vorgeschlagen. Dieser ist in keiner der verglichenen PDF-Viewer-Dateien enthalten. 2.81 setzt eine geprüfte Variante mit Online-Aktualisierung und Offline-Rückfall um.

Ältere CMD-Schritte aus diesem Chat konnten darüber nicht vollständig eingesehen werden. Vorhandene Dateien wurden deshalb direkt verglichen. Online gespeicherte Worker-Secrets, Freigaben und Deployments sind keine Projektdateien und durch einen ZIP-Vergleich nicht vollständig verifizierbar. Es wurde kein vollständiger historischer Befehlsabgleich behauptet.
