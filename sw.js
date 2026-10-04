'use strict';
const CACHE='anlagenbuch-shell-2.89',MEDIA='anlagenbuch-media-2.89';
const CORE=['/','/index.html','/offline-store-235.js','/web-bootstrap-onedrive.js','/sync-merge.js','/migrate-local.js','/onedrive-client.js','/onedrive-ui.js','/web-pdf-offline-249.js','/vendor/pdfjs/pdf.js','/vendor/pdfjs/pdf.worker.js','/global-sync-247.js','/app-249.js','/web-ui-249.js','/pump-serial-data-247.js','/pump-serial-migration-247.js','/default-psa-migration-242.js','/seed-preview.js','/btf-data.js','/module1-data.js','/annex-data.js','/pump-unit-data.js','/core.js','/equipment.js','/units-248.js','/qrcode-runtime.js','/batch-search.js','/pool-links.js','/handling-multi-249.js','/help-data.js','/help-image-viewer.js','/help.js','/widget.js','/settings-menu.js','/style.css','/equipment.css','/settings-menu.css','/web.css','/manifest.webmanifest','/busch-icon-192-v220.png','/busch-icon-512-v220.png','/busch-favicon-v220.ico','/busch-logo.png','/icon-192.png','/icon-512.png','/stoerungssirene.mp3','/siren.wav','/data.txt','/lageplan-gelaende.jpeg','/modul1-original.jpeg','/modul2-original.jpeg','/annex-original.jpeg','/psa/M001.jpg','/psa/M003.jpg','/psa/M004.jpg','/psa/M008.jpg','/psa/M009.jpg','/psa/M010.jpg','/psa/M011.jpg','/psa/M012.jpg','/psa/M013.jpg','/psa/M014.jpg','/psa/M015.jpg','/psa/M017.jpg','/psa/M018.jpg','/psa/M020.jpg','/psa/M021.jpg','/psa/M022.jpg','/psa/M023.jpg','/psa/M024.jpg','/psa/M026.jpg','/psa/WSM001.jpg'];

async function shellCaches(){
 return (await caches.keys()).filter(k=>k.startsWith('anlagenbuch-shell-'));
}
async function currentMatch(path,req){
 const c=await caches.open(CACHE);
 return (await c.match(req||path,{ignoreSearch:true}))||(await c.match(path,{ignoreSearch:true}));
}
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const c=await caches.open(CACHE);
 // 2.86: Nur aktivieren, wenn die komplette neue Shell wirklich geladen wurde.
 // Damit kann keine halbe neue Version mit JavaScript einer alten Version entstehen.
 await Promise.all(CORE.map(async u=>{
  const r=await fetch(u,{cache:'no-store'});
  if(!r||!r.ok)throw Error('Update-Datei fehlt: '+u);
  await c.put(u,r.clone());
 }));
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 for(const k of await shellCaches())if(k!==CACHE)await caches.delete(k);
 await self.clients.claim();
 const rows=await self.clients.matchAll({type:'window',includeUncontrolled:true});for(const c of rows)c.postMessage({type:'anlagenbuch-version',version:'2.89'});
})()));
async function nav(req){
 const c=await caches.open(CACHE);
 // 2.89: Die Bedienoberfläche darf niemals durch eine Backend-/Quota-Antwort ersetzt werden.
 // Zuerst vorhandene lokale Shell verwenden; parallel nur echte HTML-Antworten aktualisieren.
 const cached=(await c.match('/index.html',{ignoreSearch:true}))||(await currentMatch('/index.html',req));
 try{
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),3500);
  const r=await fetch('/index.html',{signal:ac.signal,cache:'no-store',headers:{'Accept':'text/html'}});clearTimeout(t);
  const ct=(r.headers.get('content-type')||'').toLowerCase();
  if(r&&r.ok&&ct.includes('text/html')){
   await c.put('/index.html',r.clone());
   return r;
  }
  // 429/5xx/Quota-Text nie als App-Seite anzeigen.
  if(cached)return cached;
 }catch(_){if(cached)return cached;}
 return new Response('<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anlagenbuch</title><body style="font-family:sans-serif;background:#122f35;color:white;padding:2rem"><h1>Anlagenbuch</h1><p>Die Online-Verbindung ist momentan nicht verfügbar. Bitte die App erneut öffnen, sobald die statische Oberfläche erreichbar ist. Lokale Daten wurden nicht gelöscht.</p></body></html>',{status:200,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store'}});
}
async function staticAsset(req,u){
 const c=await caches.open(CACHE),dynamic=/\.(?:js|css|webmanifest)$/i.test(u.pathname);
 if(dynamic){
  try{
   const r=await fetch(req,{cache:'no-store'});
   if(r&&r.ok){await c.put(u.pathname,r.clone());return r;}
   const hit=await currentMatch(u.pathname,req);if(hit)return hit;
   return r;
  }catch(_){return (await currentMatch(u.pathname,req))||new Response('Offline nicht verfügbar',{status:503});}
 }
 const hit=await currentMatch(u.pathname,req);if(hit)return hit;
 try{const r=await fetch(req,{cache:'no-store'});if(r&&r.ok)await c.put(u.pathname,r.clone());return r;}catch(_){return new Response('Offline nicht verfügbar',{status:503});}
}
async function media(req){
 const c=await caches.open(MEDIA);
 try{const r=await fetch(req,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(r.ok){try{await c.put(req,r.clone());}catch(_){}return r;}if(r.status<500&&r.status!==429)return r;}catch(_){}
 const names=[MEDIA,...(await caches.keys()).filter(n=>n.startsWith('anlagenbuch-media-')&&n!==MEDIA).sort().reverse()];
 for(const name of names){const hit=await(await caches.open(name)).match(req);if(hit)return hit;}
 return new Response('Datei ist offline noch nicht verfügbar.',{status:503});
}
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==location.origin)return;
 if(req.mode==='navigate'&&(u.pathname==='/'||u.pathname==='/index.html')){e.respondWith(nav(req));return;}
 if(u.pathname==='/api/media'){e.respondWith(media(req));return;}
 if(u.pathname.startsWith('/api/')||u.pathname==='/login.html'||u.pathname==='/login.js'){return;}
 e.respondWith(staticAsset(req,u));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(rows=>{for(const c of rows){if('focus'in c)return c.focus();}return clients.openWindow('/');}));});
self.addEventListener('message',e=>{const d=e.data||{};if(d.type==='fault-notification'){e.waitUntil(self.registration.showNotification(d.title||'Neue Störung',{body:d.body||'Neue Störung im Anlagenbuch',icon:'/busch-icon-192-v220.png',badge:'/busch-icon-192-v220.png',tag:d.tag||'anlagenbuch-fault',renotify:true,requireInteraction:true,data:{url:'/'}}));}});

