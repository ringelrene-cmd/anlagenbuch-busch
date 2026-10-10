
'use strict';
const VERSION='3.19';
const SHELL='anlagenbuch-shell-'+VERSION;
const CORE=["/index.html", "/app.html", "/login.html", "/web-bootstrap-onedrive.js"];
const ASSETS=["/index.html", "/app.html", "/login.html", "/web-bootstrap-onedrive.js", "/offline-store-235.js", "/login.js", "/web.css", "/style.css", "/equipment.css", "/settings-menu.css", "/sync-merge.js", "/onedrive-client.js", "/web-pdf-offline-249.js", "/seed-preview.js", "/btf-data.js", "/module1-data.js", "/annex-data.js", "/pump-unit-data.js", "/pump-serial-data-247.js", "/core.js", "/pump-serial-migration-247.js", "/default-psa-migration-242.js", "/equipment.js", "/units-248.js", "/qrcode-runtime.js", "/app-249.js", "/batch-search.js", "/onedrive-ui.js", "/pool-links.js", "/handling-multi-249.js", "/global-sync-247.js", "/help-data.js", "/help-image-viewer.js", "/help.js", "/widget.js", "/settings-menu.js", "/web-ui-249.js", "/manifest.webmanifest", "/busch-icon-192-v220.png", "/busch-favicon-v220.ico", "/busch-logo.png"];
async function cached(path){
 const keys=await caches.keys();
 for(const k of [SHELL,...keys.filter(x=>x.startsWith('anlagenbuch-shell-')&&x!==SHELL).reverse()]){
  const cache=await caches.open(k);
  const item=await cache.match(path,{ignoreSearch:true});if(item)return item;
 }
 return null;
}
async function store(path){
 try{
  const res=await fetch(new Request(path,{cache:'reload',credentials:'same-origin'}));
  if(!res.ok||res.redirected||res.type==='opaque')return false;
  const ct=(res.headers.get('content-type')||'').toLowerCase();
  if(path.endsWith('.js')&&!ct.includes('javascript'))return false;
  await (await caches.open(SHELL)).put(path,res);
  return true;
 }catch(_){return false;}
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Make the entry point available first: optional media must NEVER block SW activation.
 const ok=await Promise.all(CORE.map(store));
 if(ok.some(x=>!x))throw Error('Offline-Startseiten konnten nicht gespeichert werden');
 const home=await cached('/index.html');if(home)await(await caches.open(SHELL)).put('/',home);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 // Cache all app code after activation, without blocking navigation or deleting old offline data.
 const missing=ASSETS.filter(x=>!CORE.includes(x));
 for(let i=0;i<missing.length;i+=6)await Promise.all(missing.slice(i,i+6).map(store));
 // Keep old shell caches as offline fallback until the new cache is complete.
})()));
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/server/'))return;
 event.respondWith((async()=>{
  try{
   const network=await fetch(req);
   if(network.ok&&!network.redirected&&network.type==='basic'){
    const cache=await caches.open(SHELL);
    // Cache navigation and JS that loaded successfully.
    await cache.put(url.pathname,network.clone()).catch(()=>{});
   }
   return network;
  }catch(_){
   const hit=await cached(url.pathname==='/'?'/index.html':url.pathname);
   if(hit)return hit;
   if(req.mode==='navigate')return (await cached('/index.html'))||Response.error();
   return Response.error();
  }
 })());
});
self.addEventListener('message',event=>{
 if(event.data?.type==='activate-now')self.skipWaiting();
 if(event.data?.type==='cache-app')event.waitUntil((async()=>{
  for(let i=0;i<ASSETS.length;i+=6)await Promise.all(ASSETS.slice(i,i+6).map(store));
 })());
});
