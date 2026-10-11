Anlagenbuch Web 3.16.4 – Korrekturen und Grenzen

Geändert: Unit->Tagesgeschäft: Dialog schließt nach lokal bestätigtem Speichern oder bereits bestehendem Eintrag. OneDrive-Synchronisierung wird zusätzlich angestoßen.
Offline: Service-Worker bereitet alle lokal vorhandenen, referenzierten Dateien vor, fehlende kritische Dateien verhindern die Aktivierung des neuen Workers. Offline funktioniert erst, nachdem die App einmal online vollständig geladen und der Service-Worker erfolgreich installiert wurde. Offline-Zugriff auf bereits nicht heruntergeladene PDFs bleibt davon unberührt.
Login-Service-Worker Versionspfad aktualisiert.
ACHTUNG: Echte geräteübergreifende OneDrive-Synchronisation, Android-Widget-Status und Windows-Autostart sind NICHT live getestet und durch dieses Web-Update NICHT als behoben nachgewiesen.
Windows-Autostart muss lokal auf dem PC vom alten EXE-Pfad auf den neuen geändert werden. Lokale App-Daten bitte nicht löschen.
