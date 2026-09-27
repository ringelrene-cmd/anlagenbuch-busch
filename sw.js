'use strict';
const CACHE='anlagenbuch-shell-2.69',MEDIA='anlagenbuch-media-2.69';
const CORE=['/','/index.html','/offline-store-235.js','/web-bootstrap-267.js','/web-bridge-267.js','/web-pdf-offline-249.js','/vendor/pdfjs/pdf.js','/vendor/pdfjs/pdf.worker.js','/global-sync-247.js','/app-249.js','/update-249.js','/web-ui-249.js','/pump-serial-data-247.js','/pump-serial-migration-247.js','/default-psa-migration-242.js','/seed-preview.js','/btf-data.js','/module1-data.js','/annex-data.js','/pump-unit-data.js','/core.js','/equipment.js','/units-248.js','/qrcode-runtime.js','/batch-search.js','/dropbox-ui.js','/cloud.js','/pool-links.js','/handling-multi-249.js','/help-data.js','/help-image-viewer.js','/help.js','/widget.js','/settings-menu.js','/style.css','/equipment.css','/settings-menu.css','/web.css','/manifest.webmanifest','/busch-icon-192-v220.png','/busch-icon-512-v220.png','/busch-favicon-v220.ico','/busch-logo.png','/icon-192.png','/icon-512.png','/stoerungssirene.mp3','/siren.wav','/data.txt','/lageplan-gelaende.jpeg','/modul1-original.jpeg','/modul2-original.jpeg','/annex-original.jpeg','/psa/M001.jpg','/psa/M003.jpg','/psa/M004.jpg','/psa/M008.jpg','/psa/M009.jpg','/psa/M010.jpg','/psa/M011.jpg','/psa/M012.jpg','/psa/M013.jpg','/psa/M014.jpg','/psa/M015.jpg','/psa/M017.jpg','/psa/M018.jpg','/psa/M020.jpg','/psa/M021.jpg','/psa/M022.jpg','/psa/M023.jpg','/psa/M024.jpg','/psa/M026.jpg','/psa/WSM001.jpg'];

async function shellCaches(){
 const keys=(await caches.keys()).filter(k=>k.startsWith('anlagenbuch-shell-'));
 const score=k=>{const m=k.match(/(\d+)\.(\d+)$/);return m?Number(m[1])*1000+Number(m[2]):0;};
 return keys.sort((a,b)=>score(b)-score(a));
}
async function oldShellMatch(path){
 for(const k of await shellCaches()){
  if(k===CACHE)continue;
  const c=await caches.open(k),r=await c.match(path,{ignoreSearch:true});
  if(r)return r;
 }
 return null;
}
async function currentOrOld(path,req){
 const c=await caches.open(CACHE);
 return (await c.match(req||path,{ignoreSearch:true}))||(await c.match(path,{ignoreSearch:true}))||(await oldShellMatch(path));
}
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const c=await caches.open(CACHE);
 await Promise.allSettled(CORE.map(async u=>{try{const r=await fetch(u,{cache:'reload'});if(r&&r.ok)await c.put(u,r.clone());}catch(_){}}));
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 // Keep the current shell plus the two most recent older shells as a safety net.
 // This prevents a temporary 5xx/network error directly after an update from making the app unstartable.
 const keys=await shellCaches();
 for(const k of keys.slice(3))await caches.delete(k);
 await self.clients.claim();
})()));
async function nav(req){
 const c=await caches.open(CACHE);
 try{
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),3500);
  const r=await fetch(req,{signal:ac.signal,cache:'no-store'});clearTimeout(t);
  if(r&&r.ok){if(new URL(r.url).origin===location.origin&&!r.url.includes('/login'))await c.put('/index.html',r.clone());return r;}
  const hit=await currentOrOld('/index.html',req);if(hit)return hit;
  return r;
 }catch(_){
  const hit=await currentOrOld('/index.html',req);if(hit)return hit;
  return new Response('Anlagenbuch ist offline noch nicht vollständig gespeichert.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
 }
}
async function staticAsset(req,u){
 const c=await caches.open(CACHE),dynamic=/\.(?:js|css|webmanifest)$/i.test(u.pathname);
 if(dynamic){
  try{
   const r=await fetch(req,{cache:'no-store'});
   if(r&&r.ok){await c.put(u.pathname,r.clone());return r;}
   const hit=await currentOrOld(u.pathname,req);if(hit)return hit;
   return r;
  }catch(_){return (await currentOrOld(u.pathname,req))||new Response('Offline nicht verfügbar',{status:503});}
 }
 const hit=await currentOrOld(u.pathname,req);if(hit)return hit;
 try{const r=await fetch(req);if(r&&r.ok)await c.put(u.pathname,r.clone());return r;}catch(_){return new Response('Offline nicht verfügbar',{status:503});}
}
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==location.origin)return;
 if(req.mode==='navigate'&&(u.pathname==='/'||u.pathname==='/index.html')){e.respondWith(nav(req));return;}
 if(u.pathname.startsWith('/api/media')){e.respondWith((async()=>{const c=await caches.open(MEDIA);try{const r=await fetch(req);if(r.ok)await c.put(req,r.clone());return r;}catch(_){return (await c.match(req))||new Response('Datei ist offline noch nicht verfügbar.',{status:503});}})());return;}
 if(u.pathname.startsWith('/api/')||u.pathname==='/login.html'||u.pathname==='/login.js'){return;}
 e.respondWith(staticAsset(req,u));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(rows=>{for(const c of rows){if('focus'in c)return c.focus();}return clients.openWindow('/');}));});
self.addEventListener('message',e=>{const d=e.data||{};if(d.type==='fault-notification'){e.waitUntil(self.registration.showNotification(d.title||'Neue Störung',{body:d.body||'Neue Störung im Anlagenbuch',icon:'/busch-icon-192-v220.png',badge:'/busch-icon-192-v220.png',tag:d.tag||'anlagenbuch-fault',renotify:true,requireInteraction:true,data:{url:'/'}}));}});
