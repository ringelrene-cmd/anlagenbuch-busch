'use strict';
const VERSION='3.21';
const CACHE='anlagenbuch-shell-'+VERSION;
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
const CRITICAL=['/index.html','/app.html','/login.html','/offline-store-235.js','/web-bootstrap-onedrive.js'];
const OPTIONAL=['/manifest.webmanifest','/busch-logo.png','/busch-icon-192-v220.png','/busch-icon-512-v220.png'];
function pathOf(url){const p=new URL(url,self.location.origin).pathname;return p==='/'?'/index.html':p;}
async function oldCacheKeys(){return (await caches.keys()).filter(k=>k.startsWith('anlagenbuch-shell-')&&k!==CACHE).reverse();}
async function cached(path){
 for(const key of [CACHE,...await oldCacheKeys()]){
  const res=await (await caches.open(key)).match(path,{ignoreSearch:true});
  if(res)return res;
 }
 return undefined;
}
async function download(path){
 const response=await fetch(new Request(path,{cache:'no-store',credentials:'same-origin'}));
 if(!response.ok||response.redirected||response.type==='opaque')throw Error('Offline-Ladefehler '+path+': HTTP '+response.status);
 const type=(response.headers.get('content-type')||'').toLowerCase();
 if(path.endsWith('.js')&&!(/javascript|ecmascript/.test(type)))throw Error('JavaScript-Antwort fehlt: '+path+' '+type);
 if(path.endsWith('.css')&&!type.includes('css'))throw Error('CSS-Antwort fehlt: '+path);
 await (await caches.open(CACHE)).put(path,response.clone());
 return response;
}
async function warmup(){
 const paths=[...ESSENTIAL,...OPTIONAL].filter(x=>!CRITICAL.includes(x));
 for(let n=0;n<paths.length;n+=5){
  await Promise.allSettled(paths.slice(n,n+5).map(download));
 }
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // The document and bootstrap are mandatory. Fail rather than install a broken blank offline app.
 await Promise.all(CRITICAL.map(download));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 // Warm up after activating; no failure in a media file can break the offline navigation.
 warmup().catch(()=>{});
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/server/'))return;
 event.respondWith((async()=>{
  const path=pathOf(req.url);
  // Give an offline navigation a local answer immediately when already known offline.
  if(self.navigator.onLine===false){
   const hit=await cached(path);
   if(hit)return hit;
  }
  try{
   const response=await fetch(req);
   if(response.ok&&!response.redirected&&response.type==='basic'){
    const copy=response.clone();
    await (await caches.open(CACHE)).put(path,copy).catch(()=>{});
   }
   return response;
  }catch(e){
   const hit=await cached(path);
   if(hit)return hit;
   if(req.mode==='navigate')return (await cached('/index.html'))||(await cached('/app.html'))||Response.error();
   return Response.error();
  }
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='activate-now')self.skipWaiting();
 if(event.data?.type==='offline-check')event.waitUntil((async()=>{
  const missing=[];
  for(const path of ESSENTIAL)if(!await cached(path))missing.push(path);
  event.source?.postMessage({type:'offline-check-result',version:VERSION,ready:missing.length===0,missing});
 })());
});
