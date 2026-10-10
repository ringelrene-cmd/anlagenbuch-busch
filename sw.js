'use strict';
// 3.16: Offline-Shell mit vollstaendiger Vorablage; bestehende Anlagen-Daten bleiben erhalten.
const CACHE='anlagenbuch-shell-3.16-winexe';
const SHELL=["/annex-data.js", "/annex-original.jpeg", "/app-249.js", "/app.html", "/batch-search.js", "/btf-data.js", "/busch-favicon-v220.ico", "/busch-icon-192-v220.png", "/busch-icon-512-v220.png", "/busch-logo.png", "/core.js", "/default-psa-migration-242.js", "/equipment.css", "/equipment.js", "/global-sync-247.js", "/handling-multi-249.js", "/help-data.js", "/help-image-asset.png", "/help-image-cloud.png", "/help-image-detail.png", "/help-image-fault.png", "/help-image-help.png", "/help-image-home.png", "/help-image-homecurrent.png", "/help-image-hours.png", "/help-image-linked.png", "/help-image-menu.png", "/help-image-menucurrent.png", "/help-image-multiunits.png", "/help-image-picker.png", "/help-image-pool.png", "/help-image-protocol.png", "/help-image-settings.png", "/help-image-setup.png", "/help-image-todaydone.png", "/help-image-todaylist.png", "/help-image-unitdetail.png", "/help-image-viewer.js", "/help-image-widgetcurrent.png", "/help-image-work.png", "/help.js", "/icon-192.png", "/icon-512.png", "/index.html", "/lageplan-gelaende.jpeg", "/login.html", "/login.js", "/manifest.webmanifest", "/migrate-local.js", "/modul1-original.jpeg", "/modul2-original.jpeg", "/module1-data.js", "/offline-store-235.js", "/onedrive-client.js", "/onedrive-ui.js", "/pc-widget.html", "/pool-links.js", "/psa/M001.jpg", "/psa/M003.jpg", "/psa/M004.jpg", "/psa/M008.jpg", "/psa/M009.jpg", "/psa/M010.jpg", "/psa/M011.jpg", "/psa/M012.jpg", "/psa/M013.jpg", "/psa/M014.jpg", "/psa/M015.jpg", "/psa/M017.jpg", "/psa/M018.jpg", "/psa/M020.jpg", "/psa/M021.jpg", "/psa/M022.jpg", "/psa/M023.jpg", "/psa/M024.jpg", "/psa/M026.jpg", "/psa/WSM001.jpg", "/pump-serial-data-247.js", "/pump-serial-migration-247.js", "/pump-unit-data.js", "/qrcode-runtime.js", "/repair-bootstrap.js", "/seed-preview.js", "/settings-menu.css", "/settings-menu.js", "/siren.wav", "/stoerungssirene.mp3", "/style.css", "/sync-merge.js", "/units-248.js", "/vendor/jsQR.js", "/vendor/pdfjs/pdf.js", "/vendor/pdfjs/pdf.worker.js", "/web-bootstrap-onedrive.js", "/web-pdf-offline-249.js", "/web-ui-249.js", "/web.css", "/widget.js", "/windows-hilfe.html"];
// Stabile Offline-Shell. Nur erfolgreiche Antworten speichern, bestehende Caches behalten,
// bis die neue App vollstaendig vorbereitet wurde.
const REQUIRED=['/index.html','/app.html','/login.html','/style.css','/equipment.css','/settings-menu.css','/web.css',
 '/offline-store-235.js','/web-bootstrap-onedrive.js',
 '/sync-merge.js','/migrate-local.js','/onedrive-client.js','/web-pdf-offline-249.js',
 '/core.js','/equipment.js','/units-248.js','/app-249.js','/web-ui-249.js'];
async function storeAsset(cache,url){
 try{
  const response=await fetch(new Request(url,{cache:'no-store',credentials:'same-origin',redirect:'follow'}));
  const mime=(response.headers.get('content-type')||'').toLowerCase();
  const isJS=url.endsWith('.js');
  const isHTML=url.endsWith('.html');
  if(!response.ok||response.redirected||response.type==='opaque')return false;
  if(isJS && !/(javascript|ecmascript)/.test(mime))return false;
  if(isHTML && !mime.includes('text/html'))return false;
  await cache.put(url,response.clone());
  return true;
 }catch(err){console.warn('Offline-Datei nicht erreichbar',url,err);return false;}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Alle statischen Dateien vorbereiten, aber einzeln abarbeiten: keine Flut von
 // gleichzeitigen Anfragen. Eine fehlende Datei darf den App-Start nicht zerstoeren.
 for(const url of REQUIRED)await storeAsset(cache,url);
 const optional=SHELL.filter(url=>!REQUIRED.includes(url));
 for(let i=0;i<optional.length;i+=5){
  await Promise.all(optional.slice(i,i+5).map(url=>storeAsset(cache,url)));
 }
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const current=await caches.open(CACHE);
 const hasCore=(await current.match('/index.html'))&&(await current.match('/web-bootstrap-onedrive.js'));
 if(hasCore){
  const keys=await caches.keys();
  await Promise.all(keys.filter(x=>x.startsWith('anlagenbuch-shell-')&&x!==CACHE).map(x=>caches.delete(x)));
 }
 await self.clients.claim();
})()));
async function cachedAsset(path){
 const current=await caches.open(CACHE);
 const cached=await current.match(path);
 if(cached)return cached;
 // Bei fehlender neuer Datei bleibt die Kopie der vorherigen Version verfuegbar.
 const keys=(await caches.keys()).filter(x=>x.startsWith('anlagenbuch-shell-')&&x!==CACHE).reverse();
 for(const name of keys){const r=await (await caches.open(name)).match(path);if(r)return r;}
 return undefined;
}
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/server/')||url.pathname.startsWith('/companion/')||url.pathname==='/companion-auth')return;
 event.respondWith((async()=>{
  const navigation=req.mode==='navigate';
  try{
   const live=await fetch(req,{cache:'no-store'});
   if(live.ok && !live.redirected && live.type==='basic'){
    const mime=(live.headers.get('content-type')||'').toLowerCase();
    if((!url.pathname.endsWith('.js')||/(javascript|ecmascript)/.test(mime))&&
       (!navigation||mime.includes('text/html'))){
     const cache=await caches.open(CACHE);
     await cache.put(navigation?url.pathname:(url.pathname||'/'),live.clone());
    }
   }
   return live;
  }catch(_){
   const path=url.pathname==='/'?'/index.html':url.pathname;
   const saved=await cachedAsset(path);
   if(saved)return saved;
   if(navigation){
    const fallback=await cachedAsset('/index.html');
    if(fallback)return fallback;
   }
   return Response.error();
  }
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='activate-now')self.skipWaiting();
 if(event.data?.type==='fault-notification'&&self.registration.showNotification){
  event.waitUntil(self.registration.showNotification(event.data.title||'Neue Störung',{body:event.data.body||'',tag:event.data.tag||'anlagenbuch-fault'}));
 }
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/index.html?v=3.16'));});
