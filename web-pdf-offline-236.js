'use strict';
(()=>{
 const CACHE='anlagenbuch-media-2.36';
 const PDFJS_URL='/vendor/pdfjs/pdf.mjs';
 const PDFJS_WORKER_URL='/vendor/pdfjs/pdf.worker.mjs';
 let pdfJsPromise=null,activeDoc=null,renderSeq=0;
 const safe=s=>String(s==null?'':s).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
 async function findCached(url){
  if(!('caches'in window))return null;
  const names=await caches.keys();
  const order=[CACHE,...names.filter(n=>n!==CACHE&&n.startsWith('anlagenbuch-media-')).sort().reverse()];
  for(const name of order){try{const c=await caches.open(name),hit=await c.match(url);if(hit){if(name!==CACHE)try{const now=await caches.open(CACHE);await now.put(url,hit.clone());}catch(_){}return hit;}}catch(_){} }
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
 async function pdfJs(){
  if(!pdfJsPromise)pdfJsPromise=import(PDFJS_URL).then(m=>{m.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_URL;return m;});
  return pdfJsPromise;
 }
 function setStatus(text,error=false){const n=document.getElementById('webPdfStatus');if(n){n.textContent=text||'';n.classList.toggle('pdfError',!!error);}}
 function modalClass(on){const d=document.getElementById('modal');if(d)d.classList.toggle('pdfViewerDialog',!!on);}
 async function open(uri,title='Hantierungsanweisung'){
  const seq=++renderSeq;
  modalClass(false);
  if(typeof window.modal==='function')modal(`<div class="pdfViewerHead"><div><h2>${safe(title)}</h2><p id="webPdfStatus" class="hint">PDF wird geladen und lokal gespeichert …</p></div><button id="cancel" class="light" type="button">Schließen</button></div><div class="pdfToolbar" aria-label="PDF-Steuerung"><button id="pdfPrev" class="light" type="button">‹ Seite</button><strong id="pdfPageInfo">– / –</strong><button id="pdfNext" class="light" type="button">Seite ›</button><button id="pdfZoomOut" class="light" type="button">−</button><span id="pdfZoomInfo">100 %</span><button id="pdfZoomIn" class="light" type="button">+</button></div><div id="webPdfHost" class="webPdfHost"><div class="pdfLoading">PDF wird geladen …</div></div>`);
  modalClass(true);
  const dialog=document.getElementById('modal');
  const clean=()=>{modalClass(false);renderSeq++;if(activeDoc){try{activeDoc.destroy();}catch(_){}activeDoc=null;}};
  if(dialog)dialog.addEventListener('close',clean,{once:true});
  try{
   await requestPersistence();
   const [lib,r]=await Promise.all([pdfJs(),cachedResponse(uri,true)]);
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(!bytes.length)throw Error('Die PDF-Datei ist leer.');
   if(seq!==renderSeq)return;
   if(activeDoc){try{await activeDoc.destroy();}catch(_){}activeDoc=null;}
   const task=lib.getDocument({data:bytes,useSystemFonts:true,isEvalSupported:false});
   const doc=await task.promise;
   if(seq!==renderSeq){try{await doc.destroy();}catch(_){}return;}
   activeDoc=doc;
   let pageNo=1,zoom=1;
   const host=document.getElementById('webPdfHost'),info=document.getElementById('pdfPageInfo'),zoomInfo=document.getElementById('pdfZoomInfo');
   const prev=document.getElementById('pdfPrev'),next=document.getElementById('pdfNext'),zin=document.getElementById('pdfZoomIn'),zout=document.getElementById('pdfZoomOut');
   if(!host)throw Error('Der interne PDF-Bereich konnte nicht geöffnet werden.');
   const renderPage=async()=>{
    const my=++renderSeq,page=await doc.getPage(pageNo);if(activeDoc!==doc)return;
    const base=page.getViewport({scale:1}),available=Math.max(260,(host.clientWidth||window.innerWidth||600)-20),fit=Math.min(2.2,available/base.width),viewport=page.getViewport({scale:Math.max(.35,fit*zoom)}),dpr=Math.min(2,window.devicePixelRatio||1);
    const canvas=document.createElement('canvas');canvas.className='webPdfCanvas';canvas.width=Math.max(1,Math.floor(viewport.width*dpr));canvas.height=Math.max(1,Math.floor(viewport.height*dpr));canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
    host.innerHTML='';host.appendChild(canvas);
    const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
    if(my!==renderSeq||activeDoc!==doc)return;
    if(info)info.textContent=`${pageNo} / ${doc.numPages}`;if(zoomInfo)zoomInfo.textContent=Math.round(zoom*100)+' %';if(prev)prev.disabled=pageNo<=1;if(next)next.disabled=pageNo>=doc.numPages;
   };
   if(prev)prev.onclick=()=>{if(pageNo>1){pageNo--;renderPage();}};
   if(next)next.onclick=()=>{if(pageNo<doc.numPages){pageNo++;renderPage();}};
   if(zin)zin.onclick=()=>{zoom=Math.min(2.5,zoom+.2);renderPage();};
   if(zout)zout.onclick=()=>{zoom=Math.max(.5,zoom-.2);renderPage();};
   setStatus(navigator.onLine===false?'Offline-Kopie geöffnet.':'PDF intern geöffnet · lokal gespeichert · ab jetzt auch offline verfügbar.');
   await renderPage();
  }catch(e){const msg=e&&e.message?e.message:String(e);setStatus(msg,true);const host=document.getElementById('webPdfHost');if(host)host.innerHTML=`<div class="pdfErrorBox"><strong>PDF konnte nicht angezeigt werden.</strong><p>${safe(msg)}</p></div>`;}
 }
 async function prefetchState(s){
  if(navigator.onLine===false||!s)return;
  const uris=[...new Set((s.instructionLibrary||[]).filter(x=>x&&x.attachmentOnly&&x.pdfUri).map(x=>x.pdfUri))];
  for(const uri of uris){try{await ensure(uri);}catch(_){} }
  try{await Promise.all([pdfJs(),fetch(PDFJS_WORKER_URL,{credentials:'same-origin',cache:'no-store'})]);}catch(_){}
 }
 window.WebPdfOffline={ensure,open,prefetchState,cacheName:CACHE};
})();
