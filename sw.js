 'use strict';
const VERSION='3.24';
const CACHE='anlagenbuch-shell-'+VERSION;
const MEDIA_CACHE='anlagenbuch-media-2.85';
const SHELL=["/annex-data.js","/annex-original.jpeg","/app-249.js","/app.html","/batch-search.js","/btf-data.js","/busch-favicon-v220.ico","/busch-icon-192-v220.png","/busch-icon-512-v220.png","/busch-logo.png","/core.js","/default-psa-migration-242.js","/equipment.css","/equipment.js","/global-sync-247.js","/handling-multi-249.js","/help-data.js","/help-image-asset.png","/help-image-cloud.png","/help-image-detail.png","/help-image-fault.png","/help-image-help.png","/help-image-home.png","/help-image-homecurrent.png","/help-image-hours.png","/help-image-linked.png","/help-image-menu.png","/help-image-menucurrent.png","/help-image-multiunits.png","/help-image-picker.png","/help-image-pool.png","/help-image-protocol.png","/help-image-settings.png","/help-image-setup.png","/help-image-todaydone.png","/help-image-todaylist.png","/help-image-unitdetail.png","/help-image-viewer.js","/help-image-widgetcurrent.png","/help-image-work.png","/help.js","/icon-192.png","/icon-512.png","/index.html","/lageplan-gelaende.jpeg","/login.html","/login.js","/manifest.webmanifest","/migrate-local.js","/modul1-original.jpeg","/modul2-original.jpeg","/module1-data.js","/offline-store-235.js","/onedrive-client.js","/onedrive-ui.js","/pc-widget.html","/pool-links.js","/psa/M001.jpg","/psa/M003.jpg","/psa/M004.jpg","/psa/M008.jpg","/psa/M009.jpg","/psa/M010.jpg","/psa/M011.jpg","/psa/M012.jpg","/psa/M013.jpg","/psa/M014.jpg","/psa/M015.jpg","/psa/M017.jpg","/psa/M018.jpg","/psa/M020.jpg","/psa/M021.jpg","/psa/M022.jpg","/psa/M023.jpg","/psa/M024.jpg","/psa/M026.jpg","/psa/WSM001.jpg","/pump-serial-data-247.js","/pump-serial-migration-247.js","/pump-unit-data.js","/qrcode-runtime.js","/repair-bootstrap.js","/seed-preview.js","/settings-menu.css","/settings-menu.js","/siren.wav","/stoerungssirene.mp3","/style.css","/sync-merge.js","/units-248.js","/vendor/jsQR.js","/vendor/pdfjs/pdf.js","/vendor/pdfjs/pdf.worker.js","/web-bootstrap-onedrive.js","/web-pdf-offline-249.js","/web-ui-249.js","/web.css","/widget.js","/windows-hilfe.html"];
const START=['/index.html','/app.html','/login.html','/web-bootstrap-onedrive.js','/offline-store-235.js','/sw.js'];
const OLD_PREFIX='anlagenbuch-shell-';
const onlineReq=path=>new Request(path,{credentials:'same-origin',cache:'reload'});
function pathOf(u){const p=new URL(u,self.location.origin).pathname;return p==='/'?'/index.html':p;}
async function stored(path){
 const current=await caches.open(CACHE),x=await current.match(path,{ignoreSearch:true});if(x)return x;
 const names=(await caches.keys()).filter(x=>x.startsWith(OLD_PREFIX)&&x!==CACHE).reverse();
 for(const n of names){const r=await(await caches.open(n)).match(path,{ignoreSearch:true});if(r)return r;}
 return null;
}
async function fetchStore(path){
 const r=await fetch(onlineReq(path));
 if(!r.ok||r.redirected||r.type==='opaque')throw Error('Offline-Datei nicht verfügbar: '+path+' HTTP '+r.status);
 const ct=(r.headers.get('content-type')||'').toLowerCase();
 if(path.endsWith('.js')&&!/javascript|ecmascript/.test(ct))throw Error('Ungültige JavaScript-Datei: '+path);
 if(path.endsWith('.css')&&!ct.includes('css'))throw Error('Ungültige CSS-Datei: '+path);
 await(await caches.open(CACHE)).put(path,r.clone());return r;
}
async function prepare(paths,concurrency=5){
 let index=0;const failures=[];
 const workers=Array.from({length:Math.min(concurrency,paths.length)},async()=>{
  while(index<paths.length){const path=paths[index++];try{await fetchStore(path);}catch(e){
   if(!await stored(path))failures.push(path);
  }}
 });await Promise.all(workers);return failures;
}
self.addEventListener('install',e=>e.waitUntil((async()=>{
 // Always install the new worker if the app start documents were already cached in a prior version.
 const missing=await prepare(START);
 if(missing.length)throw Error('Offline-Start fehlt: '+missing.join(','));
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
async function media(req){
 const cache=await caches.open(MEDIA_CACHE),existing=await cache.match(req);
 try{const r=await fetch(req);if(r.ok){await cache.put(req,r.clone()).catch(()=>{});return r;}return existing||r;}
 catch(_){return existing||Response.error();}
}
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const url=new URL(req.url);if(url.origin!==self.location.origin)return;
 if(url.pathname==='/api/media'){e.respondWith(media(req));return;}
 if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/server/')||url.pathname==='/companion-auth')return;
 e.respondWith((async()=>{
  const path=pathOf(url.href);
  // Avoid the network entirely when Android says offline, but also handle radio blackholes
  // in the catch path. Never cache redirected login or error responses as program assets.
  if(self.navigator?.onLine===false){const cached=await stored(path);if(cached)return cached;}
  try{
   const result=await fetch(req);
   if(result.ok&&!result.redirected&&result.type==='basic'){
    await(await caches.open(CACHE)).put(path,result.clone()).catch(()=>{});
   }
   return result;
  }catch(_){
   const fallback=await stored(path);if(fallback)return fallback;
   if(req.mode==='navigate')return await stored('/index.html')||Response.error();
   return Response.error();
  }
 })());
});
self.addEventListener('message',e=>{
 const msg=e.data||{};
 if(msg.type==='activate-now')e.waitUntil(self.skipWaiting());
 if(msg.type==='offline-warmup')e.waitUntil((async()=>{
  const missing=await prepare(SHELL);
  e.source?.postMessage({type:'offline-warmup-result',version:VERSION,ready:missing.length===0,missing});
 })());
 if(msg.type==='offline-media-prefetch')e.waitUntil((async()=>{
  const cache=await caches.open(MEDIA_CACHE),uris=Array.isArray(msg.uris)?msg.uris:[];
  let ok=0,failed=0;
  for(const uri of [...new Set(uris)].slice(0,2000)){
   if(typeof uri!=='string'||!/^(app-pdf|app-image|web-pdf|web-image):/.test(uri))continue;
   const url='/api/media?uri='+encodeURIComponent(uri);
   if(await cache.match(url))continue;
   try{const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw Error(String(r.status));await cache.put(url,r.clone());ok++;}catch(_){failed++;}
  }
  e.source?.postMessage({type:'offline-media-result',downloaded:ok,failed});
 })());
});
