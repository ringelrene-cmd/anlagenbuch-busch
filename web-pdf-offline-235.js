'use strict';
(()=>{
 const CACHE='anlagenbuch-media-2.35';
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
  if(!uri)throw Error('Für diese Hantierungsanweisung ist noch keine PDF-Datei verknüpft.');
  const url=uriUrl(uri);
  if(!('caches'in window)){
   if(!allowNetwork||navigator.onLine===false)throw Error('Die PDF ist auf diesem Gerät noch nicht offline gespeichert.');
   const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('PDF konnte nicht geladen werden ('+r.status+').');return r;
  }
  const cache=await caches.open(CACHE),hit=await findCached(url);
  if(hit)return hit;
  if(!allowNetwork||navigator.onLine===false)throw Error('Die PDF ist auf diesem Gerät noch nicht offline gespeichert. Bitte die Web-App einmal mit Internet öffnen; danach bleibt sie lokal verfügbar.');
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('PDF konnte nicht geladen werden ('+r.status+').');
  try{await cache.put(url,r.clone());}catch(_){}
  return r;
 }
 async function ensure(uri){await requestPersistence();await cachedResponse(uri,true);return true;}
 function prepareWindow(title){
  let w=null;
  try{
   w=window.open('about:blank','anlagenbuchPdf');
   if(w){
    w.document.open();
    w.document.write('<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+String(title||'PDF').replace(/[<>&\"]/g,'')+'</title><style>body{font-family:system-ui,sans-serif;background:#122f35;color:#fff;padding:24px}p{font-size:18px}</style></head><body><p>PDF wird geladen …</p></body></html>');
    w.document.close();
   }
  }catch(_){w=null;}
  return w;
 }
 async function open(uri,title='Hantierungsanweisung'){
  // IMPORTANT: create the viewer window before the first await so Android/desktop browsers treat it as a direct user action.
  const popup=prepareWindow(title);
  if(typeof window.modal==='function')modal(`<h2>${esc(title)}</h2><p id="webPdfStatus" class="hint">PDF wird geladen und lokal gespeichert …</p><div id="webPdfHost"></div><div class="actions"><button id="cancel" class="light">Schließen</button></div>`);
  try{
   await requestPersistence();
   const r=await cachedResponse(uri,true),blob=await r.blob();
   if(!blob.size)throw Error('Die PDF-Datei ist leer.');
   if(lastBlob){try{URL.revokeObjectURL(lastBlob);}catch(_){}lastBlob='';}
   lastBlob=URL.createObjectURL(blob);
   const status=document.getElementById('webPdfStatus'),host=document.getElementById('webPdfHost');
   if(status)status.textContent=navigator.onLine===false?'Offline-Kopie geöffnet.':'PDF lokal gespeichert · ab jetzt auch ohne Empfang verfügbar.';
   if(host)host.innerHTML=`<iframe class="webPdfFrame" src="${lastBlob}#view=FitH" title="${esc(title)}"></iframe><p class="hint">Die PDF wurde lokal gespeichert. Falls die eingebettete Ansicht auf diesem Gerät nicht unterstützt wird, öffnet sich zusätzlich der systemeigene PDF-Viewer.</p><div class="actions"><a id="webPdfDirect" class="buttonLink" href="${lastBlob}" target="_blank" rel="noopener">PDF erneut groß öffnen</a></div>`;
   if(popup&&!popup.closed){try{popup.location.replace(lastBlob);}catch(_){try{popup.location.href=lastBlob;}catch(__){}}}
  }catch(e){
   const msg=e&&e.message?e.message:String(e),status=document.getElementById('webPdfStatus');if(status)status.textContent=msg;else if(window.toast)toast(msg);
   if(popup&&!popup.closed){try{popup.document.body.innerHTML='<p style="font-family:system-ui;padding:24px">'+msg.replace(/[<>&]/g,'')+'</p>';}catch(_){} }
  }
 }
 async function prefetchState(s){
  if(navigator.onLine===false||!s)return;
  const uris=[...new Set((s.instructionLibrary||[]).filter(x=>x&&x.attachmentOnly&&x.pdfUri).map(x=>x.pdfUri))];
  for(const uri of uris){try{await ensure(uri);}catch(_){} }
 }
 window.WebPdfOffline={ensure,open,prefetchState,cacheName:CACHE};
})();
