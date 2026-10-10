Busch-Anlagenbuch Web 3.08

Fehlerbehebung: Die Geräteverbindung ist nun dauerhaft als sichtbare Schaltfläche im Drei-Striche-Menü (Einstellungen) eingebaut, statt erst dynamisch ergänzt zu werden.
- Windows-Begleiter verbinden (mit Windows 2.25)
- Android-Begleiter verbinden (mit Android 2.33)
- Update-Downloads sind auf Windows 2.25 EXE und Android 2.33 APK aktualisiert.
- Version 3.08 in Web-App, Server-Version und Service Worker.
- Erforderlich: Web-Anmeldung und unter der Domain erreichbare /api/companion/pair-code sowie /api/companion/device-exchange.
- Bestehende OneDrive-Daten und lokale Offline-Daten werden nicht absichtlich verändert.
- Vor Produktionsausrollung Geräteverbindung, Statusabfrage und Offline-Start praktisch testen.

Installation: Inhalte dieser ZIP ins bestehende Cloudflare-Pages-Projekt veröffentlichen, inklusive functions/ und server/ Verzeichnissen. Keine Web-Passwörter in den Download-Dateien hinterlegen.
