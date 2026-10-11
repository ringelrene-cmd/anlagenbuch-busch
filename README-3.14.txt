ANLAGENBUCH WEB 3.15 – WIDGET-ZAEHLER

Die Werte für Störungen, In Bearbeitung und Tagesgeschäft stammen aus derselben zentralen state.json.
Der neue _worker.js enthält die Cloudflare-Schnittstelle als ausführbare Datei.

WICHTIG: Cloudflare Pages muss die bereits vorhandenen Umgebungsvariablen und das Durable-Object-Binding SYNC behalten.
Der bisherige direkte Upload unterstützt /functions NICHT, aber _worker.js.
Vor Deployment vorhandene Konfiguration prüfen; bei fehlender SYNC-Bindung ist die API nicht erreichbar.
Bei Git/Wrangler-Deployments alternativ functions und server verwenden.

Keine lokalen Speicher löschen! Keine Widgets neu installieren!
