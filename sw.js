'use strict';
// 3.05: Offline-first shell. User/OneDrive data stays in existing local storage.
const CACHE='anlagenbuch-shell-3.05-winexe';
const SHELL=["/annex-data.js", "/annex-original.jpeg", "/app-249.js", "/app.html", "/batch-search.js", "/btf-data.js", "/busch-favicon-v220.ico", "/busch-icon-192-v220.png", "/busch-icon-512-v220.png", "/busch-logo.png", "/core.js", "/default-psa-migration-242.js", "/equipment.css", "/equipment.js", "/functions/api/[[path]].js", "/functions/companion-auth.js", "/functions/test.js", "/global-sync-247.js", "/handling-multi-249.js", "/help-data.js", "/help-image-asset.png", "/help-image-cloud.png", "/help-image-detail.png", "/help-image-fault.png", "/help-image-help.png", "/help-image-home.png", "/help-image-homecurrent.png", "/help-image-hours.png", "/help-image-linked.png", "/help-image-menu.png", "/help-image-menucurrent.png", "/help-image-multiunits.png", "/help-image-picker.png", "/help-image-pool.png", "/help-image-protocol.png", "/help-image-settings.png", "/help-image-setup.png", "/help-image-todaydone.png", "/help-image-todaylist.png", "/help-image-unitdetail.png", "/help-image-viewer.js", "/help-image-widgetcurrent.png", "/help-image-work.png", "/help.js", "/icon-192.png", "/icon-512.png", "/index.html", "/lageplan-gelaende.jpeg", "/login.html", "/login.js", "/manifest.webmanifest", "/migrate-local.js", "/modul1-original.jpeg", "/modul2-original.jpeg", "/module1-data.js", "/offline-store-235.js", "/onedrive-client.js", "/onedrive-ui.js", "/pc-widget.html", "/pool-links.js", "/psa/M001.jpg", "/psa/M003.jpg", "/psa/M004.jpg", "/psa/M008.jpg", "/psa/M009.jpg", "/psa/M010.jpg", "/psa/M011.jpg", "/psa/M012.jpg", "/psa/M013.jpg", "/psa/M014.jpg", "/psa/M015.jpg", "/psa/M017.jpg", "/psa/M018.jpg", "/psa/M020.jpg", "/psa/M021.jpg", "/psa/M022.jpg", "/psa/M023.jpg", "/psa/M024.jpg", "/psa/M026.jpg", "/psa/WSM001.jpg", "/pump-serial-data-247.js", "/pump-serial-migration-247.js", "/pump-unit-data.js", "/qrcode-runtime.js", "/repair-bootstrap.js", "/seed-preview.js", "/settings-menu.css", "/settings-menu.js", "/siren.wav", "/stoerungssirene.mp3", "/style.css", "/sw.js", "/sync-merge.js", "/units-248.js", "/vendor/jsQR.js", "/vendor/pdfjs/pdf.js", "/vendor/pdfjs/pdf.worker.js", "/web-bootstrap-onedrive.js", "/web-pdf-offline-249.js", "/web-ui-249.js", "/web.css", "/widget.js", "/windows-hilfe.html"];
self.addEventListener('install', event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Individual fetches prevent a single optional asset failure from losing the entire shell.
 await Promise.all(SHELL.map(async url=>{try{const r=await fetch(url,{cache:'reload'});if(r.ok&&!r.redirected&&r.type!=='opaque'&&!(url.endsWith('.js')&&!r.headers.get('content-type')?.includes('javascript')))await cache.put(url,r);}catch(e){console.warn('Offline-Vorbereitung:',url,e);}}));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(x=>x.startsWith('anlagenbuch-shell-')&&x!==CACHE).map(x=>caches.delete(x)));
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/server/')||url.pathname.startsWith('/companion/')||url.pathname==='/companion-auth')return;
 if(req.mode==='navigate'){
  event.respondWith((async()=>{
   try{const r=await fetch(req);if(r.ok&&r.type==='basic'){const c=await caches.open(CACHE);await c.put(url.pathname,r.clone());}return r;}
   catch(_){const c=await caches.open(CACHE);return await c.match(url.pathname)||await c.match('/index.html')||Response.error();}
  })());return;
 }
 event.respondWith((async()=>{
  const c=await caches.open(CACHE);
  // Static files never need network to launch. Query parameters are version stamps.
  const cached=await c.match(url.pathname);
  if(cached)return cached;
  try{const r=await fetch(req);if(r.ok&&r.type==='basic'&&!url.pathname.startsWith('/api/'))await c.put(url.pathname,r.clone());return r;}
  catch(_){return Response.error();}
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='activate-now')self.skipWaiting();
 if(event.data?.type==='fault-notification'&&self.registration.showNotification){
  event.waitUntil(self.registration.showNotification(event.data.title||'Neue Störung',{body:event.data.body||'',tag:event.data.tag||'anlagenbuch-fault'}));
 }
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/index.html?v=3.05'));});
