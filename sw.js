
'use strict';
const CACHE='anlagenbuch-shell-3.17';
const REQUIRED=["/annex-data.js", "/app-249.js", "/app.html", "/batch-search.js", "/btf-data.js", "/busch-icon-192-v220.png", "/busch-logo.png", "/core.js", "/default-psa-migration-242.js", "/equipment.css", "/equipment.js", "/global-sync-247.js", "/handling-multi-249.js", "/help-data.js", "/help-image-viewer.js", "/help.js", "/icon-192.png", "/index.html", "/login.html", "/login.js", "/manifest.webmanifest", "/migrate-local.js", "/module1-data.js", "/offline-store-235.js", "/onedrive-client.js", "/onedrive-ui.js", "/pc-widget.html", "/pool-links.js", "/pump-serial-data-247.js", "/pump-serial-migration-247.js", "/pump-unit-data.js", "/qrcode-runtime.js", "/repair-bootstrap.js", "/seed-preview.js", "/settings-menu.css", "/settings-menu.js", "/style.css", "/sw.js", "/sync-merge.js", "/units-248.js", "/vendor/jsQR.js", "/vendor/pdfjs/pdf.js", "/web-bootstrap-onedrive.js", "/web-pdf-offline-249.js", "/web-ui-249.js", "/web.css", "/widget.js", "/windows-hilfe.html"];
const ROOT=['/','/index.html','/app.html','/login.html'];
async function getCached(path){
 const names=await caches.keys();
 for(const name of [CACHE,...names.filter(x=>x.startsWith('anlagenbuch-shell-')&&x!==CACHE).reverse()]){
  const c=await caches.open(name);
  const r=await c.match(path)||await c.match(path,{ignoreSearch:true});
  if(r)return r;
 }
 return null;
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 // Prepare all code before activating. No large photos/media delay the activation.
 const failures=[];
 for(let i=0;i<REQUIRED.length;i+=12){
  await Promise.all(REQUIRED.slice(i,i+12).map(async path=>{
   try{
    const r=await fetch(path,{cache:'no-store'});
    if(!r.ok||r.redirected||r.type==='opaque')throw Error('HTTP '+r.status);
    const t=(r.headers.get('content-type')||'').toLowerCase();
    if(path.endsWith('.js')&&!/(javascript|ecmascript)/.test(t))throw Error('not JavaScript');
    if(path.endsWith('.html')&&!t.includes('text/html'))throw Error('not HTML');
    await cache.put(path,r);
   }catch(e){failures.push(path+': '+e.message);}
  }));
 }
 if(failures.length){console.error('Offline shell incomplete',failures);throw Error('Offline shell incomplete');}
 const index=await cache.match('/index.html');if(index)await cache.put('/',index);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 const cache=await caches.open(CACHE);
 if(await cache.match('/index.html')){
  const names=await caches.keys();
  await Promise.all(names.filter(x=>x.startsWith('anlagenbuch-shell-')&&x!==CACHE).map(x=>caches.delete(x)));
 }
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/server/'))return;
 event.respondWith((async()=>{
  try{
   const r=await fetch(req);
   if(r.ok&&!r.redirected&&r.type==='basic'){
    const cache=await caches.open(CACHE);
    // Cache JS/CSS/pages and resources viewed while online for later offline use.
    await cache.put(url.pathname,r.clone());
   }
   return r;
  }catch(e){
   const match=await getCached(url.pathname==='/'?'/index.html':url.pathname);
   if(match)return match;
   if(req.mode==='navigate'){
    const page=await getCached('/index.html');if(page)return page;
   }
   return Response.error();
  }
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='activate-now')self.skipWaiting();});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.openWindow('/index.html'));});
