'use strict';
(()=>{
 const CACHE='anlagenbuch-media-2.34';
 let lastBlob='';
 async function findCached(url){
  if(!('caches'in window))return null;
  const names=await caches.keys();
  const order=[CACHE,...names.filter(n=>n!==CACHE&&n.startsWith('anlagenbuch-media-')).sort().reverse()];
  for(const name of order){try{const c=await caches.open(name),hit=await c.match(url);if(hit){if(name!==CACHE)try{const now=await caches.open(CACHE);await now.put(url,hit.clone());}catch(_){}return hit;}}catch(_){}}
  return null;
 }
 async function requestPersistence(){try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch(_){} }
 const uriUrl=uri=>window.webMediaUrl?window.webMediaUrl(uri):'/api/media?uri='+encodeURIComponent(uri);
 async function cachedResponse(uri,allowNetwork=true){
  if(!uri)throw Error('Für diese PDF ist kein Dateiverweis gespeichert.');
  if(!('caches'in window)){
   if(!allowNetwork||navigator.onLine===false)throw Error('Die PDF ist auf diesem Gerät noch nicht offline gespeichert.');
   const r=await fetch(uriUrl(uri),{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('PDF konnte nicht geladen werden.');return r;
  }
  const cache=await caches.open(CACHE),url=uriUrl(uri),hit=await findCached(url);
  if(hit)return hit;
  if(!allowNetwork||navigator.onLine===false)throw Error('Die PDF ist auf diesem Gerät noch nicht offline gespeichert. Bitte die Web-App einmal mit Internet öffnen; danach wird sie automatisch lokal gesichert.');
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('PDF konnte nicht geladen werden ('+r.status+').');
  try{await cache.put(url,r.clone());}catch(_){}
  return r;
 }
 async function ensure(uri){await requestPersistence();await cachedResponse(uri,true);return true;}
 async function open(uri,title='Hantierungsanweisung'){
  await requestPersistence();
  if(lastBlob){try{URL.revokeObjectURL(lastBlob);}catch(_){}lastBlob='';}
  if(typeof window.modal==='function')modal(`<h2>${esc(title)}</h2><p id="webPdfStatus" class="hint">PDF wird aus der lokalen Offline-Kopie geöffnet …</p><div id="webPdfHost"></div><div class="actions"><button id="cancel" class="light">Schließen</button></div>`);
  try{
   const r=await cachedResponse(uri,true),blob=await r.blob();lastBlob=URL.createObjectURL(blob);
   const host=document.getElementById('webPdfHost'),status=document.getElementById('webPdfStatus');
   if(status)status.textContent=navigator.onLine===false?'Offline-Kopie geöffnet.':'PDF lokal gespeichert · auch ohne Empfang verfügbar.';
   if(host)host.innerHTML=`<iframe class="webPdfFrame" src="${lastBlob}" title="${esc(title)}"></iframe><p class="hint">Falls der Browser die PDF im eingebetteten Fenster nicht darstellt, kannst du sie zusätzlich in einem eigenen Tab öffnen.</p><button id="webPdfNewTab" class="light" type="button">PDF in eigenem Tab öffnen</button>`;
   const b=document.getElementById('webPdfNewTab');if(b)b.onclick=()=>window.open(lastBlob,'_blank','noopener');
  }catch(e){const status=document.getElementById('webPdfStatus');if(status)status.textContent=e.message||String(e);else if(window.toast)toast(e.message||String(e));}
 }
 async function prefetchState(s){
  if(navigator.onLine===false||!s)return;
  const uris=[...new Set((s.instructionLibrary||[]).filter(x=>x&&x.attachmentOnly&&x.pdfUri).map(x=>x.pdfUri))];
  for(const uri of uris){try{await ensure(uri);}catch(_){} }
 }
 window.WebPdfOffline={ensure,open,prefetchState,cacheName:CACHE};
})();
