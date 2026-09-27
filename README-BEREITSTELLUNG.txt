ANLAGENBUCH WEB 2.49 – CLOUDFLARE PAGES – 405 FIX

Diese ZIP direkt bei Cloudflare Pages als neue Bereitstellung hochladen.

Korrektur:
- Cloudflare-Worker-Routing explizit aktiviert (_routes.json).
- /api/*-POST-Anfragen werden dadurch an _worker.js geleitet und nicht als statische Dateien behandelt.
- Keine Excel-, Anlagen- oder Unit-Daten geändert.
- Oberfläche und Funktionen der Version 2.49 bleiben unverändert.

Wichtig:
Die ZIP selbst hochladen bzw. den Inhalt so bereitstellen, dass _worker.js und _routes.json im Stammverzeichnis liegen.
