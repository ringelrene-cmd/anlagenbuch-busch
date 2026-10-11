Anlagenbuch 3.15.4 – TESTPAKET
Grundlage: 3.15.3, Android-Begleiter 2.38 und Windows 2.26 unverändert.
- Die drei PDF-Originale liegen im Paketordner PDFs, einschließlich Test.pdf.
- Server-Upload neuer PDF-Dateien nutzt in OneDrive den Unterordner PDFs und den Originaldateinamen. Gleichnamige abweichende Inhalte werden NICHT überschrieben.
- Der OneDrive-Unterordner PDFs muss bereits vorhanden sein. Upload des Cloudflare-Pakets kopiert NICHT automatisch die drei Dateien in OneDrive; dort vorhandene Dateien bleiben unverändert.
- Alte Medienreferenzen werden weiterhin über ihren bisherigen Pfad gelesen, damit bestehende Verknüpfungen nicht verloren gehen; automatische Neuverknüpfung nicht umgesetzt.
- Sicherheitszeichen aus sieben Kategorien als lokale Bildassets. Bestehende Kennungen erhalten. ZIP-Archive ausgelassen.
- Die mitgelieferten PDFs werden nicht automatisch in eine Handlungsanweisung eingetragen. Bestehende Verknüpfungen werden nicht verändert.
- Offline-Medien: die im Programm gelieferten Sicherheitszeichen sind für den App-Cache vorbereitet; PDF-Dateien in OneDrive werden beim Öffnen lokal zwischengespeichert, vollständige Offline-Garantie bedarf Praxistest.
- Vor Cloudflare-Einsatz Datenstand sichern und mit Testdaten prüfen.
