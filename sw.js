
'use strict';
const VERSION='3.20';
const CACHE='anlagenbuch-shell-'+VERSION;
// The bootstrap injects these scripts dynamically. Cache them BEFORE declaring offline ready.
const ESSENTIAL=[
 '/index.html','/app.html','/login.html',
 '/web-bootstrap-onedrive.js','/offline-store-235.js','/login.js',
 '/sync-merge.js','/migrate-local.js','/onedrive-client.js','/web-pdf-offline-249.js',
 '/seed-preview.js','/btf-data.js','/module1-data.js','/annex-data.js',
 '/pump-unit-data.js','/pump-serial-data-247.js','/core.js',
 '/pump-serial-migration-247.js','/default-psa-migration-242.js',
 '/equipment.js','/units-248.js','/qrcode-runtime.js','/app-249.js',
 '/batch-search.js','/onedrive-ui.js','/pool-links.js','/handling-multi-249.js',
 '/global-sync-247.js','/help-data.js','/help-image-viewer.js','/help.js',
 '/widget.js','/settings-menu.js','/web-ui-249.js',
 '/style.css','/equipment.css','/settings-menu.css','/web.css'
];
const OPTIONAL=['/manifest.webmanifest','/busch-logo.png','/busch-icon-192-v220.png','/busch-icon-512-v220.png','/busch-favicon-v220.ico'];
const shells=async()=>[CACHE,...(await caches.keys()).filter(k=>k.startsWith('anlagenbuch-shell-')&&k!==CACHE).reverse()];
async function offline(path){
 for(const key of await shells()){
  const hit=await (await caches.open(key)).match(path,{ignoreSearch:true});
  if(hit)return hit;
 }
 return undefined;
}
async function save(path){
 const res=await fetch(new Request(path,{cache:'no-store',credentials:'same-origin',redirect:'follow'}));
 if(!res.ok||res.redirected||res.type==='opaque')throw Error('Offline-Datei fehlt: '+path);
 const ct=(res.headers.get('content-type')||'').toLowerCase();
 if(path.endsWith('.js')&&!(/javascript|ecmascript/.test(ct)))throw Error('Falscher MIME-Type: '+path);
 if(path.endsWith('.css')&&!ct.includes('css'))throw Error('Falscher MIME-Type: '+path);
 await (await caches.open(CACHE)).put(path,res);
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // An incomplete cache must NEVER replace a working older offline version.
 // Cache ALL necessary scripts before the new worker is activated.
 const missing=[];
 for(let i=0;i<ESSENTIAL.length;i+=6){
  const batch=ESSENTIAL.slice(i,i+6);
  const results=await Promise.allSettled(batch.map(save));
  results.forEach((r,j)=>{if(r.status==='rejected')missing.push(batch[j]+': '+r.reason);});
 }
 if(missing.length)throw Error('Offline-Installation unvollständig: '+missing.join('; '));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 for(const asset of OPTIONAL){try{await save(asset);}catch(_){}}
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const u=new URL(req.url);
 if(u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/server/'))return;
 event.respondWith((async()=>{
  // Offline navigation doesn't depend on the latest cache-busting ?v= parameter.
  const path=u.pathname==='/'?'/index.html':u.pathname;
  if(!navigator.onLine){const hit=await offline(path);if(hit)return hit;}
  try{
   const response=await fetch(req);
   if(response.ok&&!response.redirected&&response.type==='basic'){
    const cache=await caches.open(CACHE);
    await cache.put(path,response.clone()).catch(()=>{});
   }
   return response;
  }catch(err){
   const hit=await offline(path);
   if(hit)return hit;
   if(req.mode==='navigate')return (await offline('/index.html'))||(await offline('/app.html'))||Response.error();
   return Response.error();
  }
 })());
});
self.addEventListener('message',event=>{
 const data=event.data||{};
 if(data.type==='activate-now')self.skipWaiting();
 if(data.type==='offline-check')event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  const ready=(await Promise.all(ESSENTIAL.map(p=>cache.match(p,{ignoreSearch:true})))).every(Boolean);
  event.source?.postMessage({type:'offline-check-result',version:VERSION,ready});
 })());
});
