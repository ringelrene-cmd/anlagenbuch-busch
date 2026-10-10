Anlagenbuch Web 3.10 (Testfassung)
• Windows 2.22 EXE integriert; UTF-8-Umlaute korrigiert und sichere Geräteverbindung über die bereits angemeldete Web-App.
• Android 2.33 Quellprojekt: Widget-Klick öffnet Browser (statt zweiter WebView), Gerätenutzung über 60-Sekunden-Verbindungscode. Keine zusätzlichen Passwortfelder.
• Android 2.33 kann erst nach Kompilierung/Signatur installiert werden; Download in Web-App enthält weiterhin die bisherige signierte 2.32 und benennt sie klar.
• Server: kurz gültiger Verbindungscode, ein Jahr gültiger signierter Gerätetoken; keine Zugangspasswörter in öffentlich zugänglichen Dateien.
• Bei Änderung des WEB_PASSWORD werden bestehende Tokens ungültig. Individuelle Sperrung ist in dieser Fassung nicht implementiert.
• Mehrfachfenster-Schutz bleibt erhalten; kurzzeitiger Wechsel wird automatisch erneut versucht.
• Online-/Offline-Daten und OneDrive-Struktur unverändert. Vor Veröffentlichung auf einem Testgerät prüfen.
