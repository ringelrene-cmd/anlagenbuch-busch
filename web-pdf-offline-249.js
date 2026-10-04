'use strict';
(()=>{
 const CACHE='anlagenbuch-media-2.83';
 const PDFJS_URL='/vendor/pdfjs/pdf.js';
 const PDFJS_WORKER_URL='/vendor/pdfjs/pdf.worker.js';
 let pdfJsPromise=null,activeDoc=null,renderToken=0;
 const safe=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const dist=t=>Math.hypot((t[0].clientX-t[1].clientX),(t[0].clientY-t[1].clientY));

 async function findCached(url){
  if(!('caches'in window))return null;
  const names=await caches.keys();
  const order=[CACHE,...names.filter(n=>n!==CACHE&&n.startsWith('anlagenbuch-media-')).sort().reverse()];
  for(const name of order){try{const c=await caches.open(name),hit=await c.match(url);if(hit){if(name!==CACHE)try{const now=await caches.open(CACHE);await now.put(url,hit.clone());}catch(_){}return hit;}}catch(_){} }
  return null;
 }
 async function requestPersistence(){try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch(_){} }
 const uriUrl=(uri,attachmentId='')=>{
  let url=window.webMediaUrl?window.webMediaUrl(uri):'/api/media?uri='+encodeURIComponent(uri);
  if(attachmentId)url+=(url.includes('?')?'&':'?')+'id='+encodeURIComponent(attachmentId);
  return url;
 };
 async function cachedResponse(uri,allowNetwork=true,attachmentId=''){
  if(!uri)throw Error('Für diese Hantierungsanweisung ist noch keine PDF-Datei verknüpft.');
  const url=uriUrl(uri,attachmentId);
  if(!('caches'in window)){
   if(!allowNetwork||navigator.onLine===false)throw Error('Die PDF ist auf diesem Gerät noch nicht offline gespeichert.');
   const r=await fetch(url,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('PDF konnte nicht geladen werden ('+r.status+').');return r;
  }
  // Online, refresh the file. Keep the last usable copy for offline/network failure.
  if(allowNetwork&&navigator.onLine!==false){
   try{
    const r=await fetch(url,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000)});
    if(r.ok){try{await(await caches.open(CACHE)).put(url,r.clone());}catch(_){}return r;}
    // Bei 404 kann die Datei nach der OneDrive-Umstellung auf dem Server fehlen,
    // obwohl auf diesem Gerät noch eine gültige Offline-Kopie vorhanden ist.
    // Deshalb erst den lokalen Cache prüfen, statt die PDF sofort abzulehnen.
    if(r.status<500&&r.status!==429&&r.status!==404)throw Object.assign(Error('PDF konnte nicht geladen werden ('+r.status+').'),{noFallback:true});
   }catch(e){if(e.noFallback)throw e;}
  }
  const hit=await findCached(url);if(hit){
   // Fehlende OneDrive-Medien aus einer vorhandenen lokalen Kopie selbst reparieren.
   // Der Upload ist best-effort; zum Öffnen genügt weiterhin die lokale Kopie.
   if(allowNetwork&&navigator.onLine!==false)repairRemote(uri,hit.clone()).catch(()=>{});
   return hit;
  }
  // The attachment ID describes the link, not a different file.
  if(attachmentId){const original=await findCached(uriUrl(uri));if(original)return original;}
  throw Error('PDF fehlt im gemeinsamen OneDrive-Speicher (404). Bitte diese PDF einmal auf dem Rechner öffnen, auf dem sie noch funktioniert. Version 2.83 überträgt die lokale Kopie dann automatisch nach OneDrive; danach am Handy erneut öffnen.');
 }

 async function repairRemote(uri,response){
  try{
   const bytes=new Uint8Array(await response.arrayBuffer());if(!bytes.length)return false;
   let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.slice(i,i+8192));
   const r=await fetch('/api/backup/media',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({media:{[uri]:btoa(raw)}})});
   return r.ok;
  }catch(_){return false;}
 }

 async function ensure(uri,attachmentId=''){await requestPersistence();await cachedResponse(uri,true,attachmentId);return true;}

 function loadClassicScript(src){
  return new Promise((resolve,reject)=>{
   const existing=[...document.scripts].find(s=>s.src&&new URL(s.src,location.href).pathname===src);
   if(existing&&window.pdfjsLib){resolve();return;}
   const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=()=>reject(Error('PDF-Viewer-Bibliothek konnte nicht geladen werden.'));document.head.appendChild(s);
  });
 }
 async function pdfJs(){
  if(!pdfJsPromise)pdfJsPromise=(async()=>{
   if(!window.pdfjsLib)await loadClassicScript(PDFJS_URL);
   if(!window.pdfjsLib||!window.pdfjsLib.getDocument)throw Error('Der kompatible PDF-Viewer konnte nicht gestartet werden.');
   window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER_URL;
   return window.pdfjsLib;
  })();
  return pdfJsPromise;
 }
 function setStatus(text,error=false){const n=document.getElementById('webPdfStatus');if(n){n.textContent=text||'';n.classList.toggle('pdfError',!!error);}}
 function modalClass(on){const d=document.getElementById('modal');if(d)d.classList.toggle('pdfViewerDialog',!!on);}

 async function open(uri,title='Hantierungsanweisung',attachmentId=''){
  const openToken=++renderToken;
  modalClass(false);
  if(typeof window.modal==='function')modal(`<div class="pdfViewerHead"><div><h2>${safe(title)}</h2><p id="webPdfStatus" class="hint">PDF wird geladen und lokal gespeichert …</p></div><button id="cancel" class="light" type="button">Schließen</button></div><div class="pdfToolbar" aria-label="PDF-Steuerung"><button id="pdfPrev" class="light" type="button">‹ Seite</button><strong id="pdfPageInfo">– / –</strong><button id="pdfNext" class="light" type="button">Seite ›</button><button id="pdfZoomOut" class="light" type="button">−</button><span id="pdfZoomInfo">100 %</span><button id="pdfZoomIn" class="light" type="button">+</button></div><div id="webPdfHost" class="webPdfHost"><div class="pdfLoading">PDF wird geladen …</div></div>`);
  modalClass(true);
  const dialog=document.getElementById('modal');
  const clean=()=>{modalClass(false);renderToken++;if(activeDoc){try{activeDoc.destroy();}catch(_){}activeDoc=null;}};
  if(dialog)dialog.addEventListener('close',clean,{once:true});
  try{
   await requestPersistence();
   const [lib,r]=await Promise.all([pdfJs(),cachedResponse(uri,true,attachmentId)]);
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(!bytes.length)throw Error('Die PDF-Datei ist leer.');
   if(openToken!==renderToken)return;
   if(activeDoc){try{await activeDoc.destroy();}catch(_){}activeDoc=null;}
   const task=lib.getDocument({data:bytes,useSystemFonts:true,isEvalSupported:false});
   const doc=await task.promise;
   if(openToken!==renderToken){try{await doc.destroy();}catch(_){}return;}
   activeDoc=doc;
   let pageNo=1,zoom=1,rendering=false,pending=false;
   const host=document.getElementById('webPdfHost'),info=document.getElementById('pdfPageInfo'),zoomInfo=document.getElementById('pdfZoomInfo');
   const prev=document.getElementById('pdfPrev'),next=document.getElementById('pdfNext'),zin=document.getElementById('pdfZoomIn'),zout=document.getElementById('pdfZoomOut');
   if(!host)throw Error('Der interne PDF-Bereich konnte nicht geöffnet werden.');

   const updateControls=()=>{if(info)info.textContent=`${pageNo} / ${doc.numPages}`;if(zoomInfo)zoomInfo.textContent=Math.round(zoom*100)+' %';if(prev)prev.disabled=pageNo<=1;if(next)next.disabled=pageNo>=doc.numPages;};
   const renderPage=async()=>{
    if(rendering){pending=true;return;} rendering=true;
    try{
     const token=++renderToken,page=await doc.getPage(pageNo);if(activeDoc!==doc)return;
     const base=page.getViewport({scale:1}),available=Math.max(260,(host.clientWidth||window.innerWidth||600)-20),fit=Math.min(2.2,available/base.width),viewport=page.getViewport({scale:Math.max(.35,fit*zoom)}),dpr=Math.min(2,window.devicePixelRatio||1);
     const canvas=document.createElement('canvas');canvas.className='webPdfCanvas';canvas.width=Math.max(1,Math.floor(viewport.width*dpr));canvas.height=Math.max(1,Math.floor(viewport.height*dpr));canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
     host.innerHTML='';host.appendChild(canvas);
     const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
     await page.render({canvasContext:ctx,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:null}).promise;
     if(token!==renderToken||activeDoc!==doc)return;
     updateControls();
    } finally {rendering=false;if(pending){pending=false;renderPage();}}
   };
   const changePage=delta=>{const n=clamp(pageNo+delta,1,doc.numPages);if(n!==pageNo){pageNo=n;host.scrollTop=0;host.scrollLeft=0;renderPage();}};
   const setZoom=z=>{const n=clamp(z,.5,3);if(Math.abs(n-zoom)<.01)return;zoom=n;renderPage();};
   if(prev)prev.onclick=()=>changePage(-1);
   if(next)next.onclick=()=>changePage(1);
   if(zin)zin.onclick=()=>setZoom(zoom+.2);
   if(zout)zout.onclick=()=>setZoom(zoom-.2);

   // Touch gestures: two-finger pinch zoom + one-finger horizontal page swipe.
   let sx=0,sy=0,lx=0,ly=0,st=0,pinch=false,pinchStart=0,pinchBase=1,pinchPreview=1,panned=false;
   host.addEventListener('touchstart',e=>{
    if(e.touches.length===2){pinch=true;pinchStart=dist(e.touches);pinchBase=zoom;pinchPreview=zoom;panned=false;e.preventDefault();return;}
    if(e.touches.length===1){sx=lx=e.touches[0].clientX;sy=ly=e.touches[0].clientY;st=Date.now();panned=false;}
   },{passive:false});
   host.addEventListener('touchmove',e=>{
    if(pinch&&e.touches.length===2){e.preventDefault();const d=dist(e.touches);if(pinchStart>0){pinchPreview=clamp(pinchBase*(d/pinchStart),.5,3);const c=host.querySelector('.webPdfCanvas');if(c){c.style.transformOrigin='50% 0';c.style.transform=`scale(${pinchPreview/zoom})`;}}return;}
    if(e.touches.length===1&&st){const t=e.touches[0],dx=t.clientX-sx,dy=t.clientY-sy;if(zoom>1.02){e.preventDefault();host.scrollLeft-=t.clientX-lx;host.scrollTop-=t.clientY-ly;lx=t.clientX;ly=t.clientY;panned=true;return;}if(Math.abs(dx)>18&&Math.abs(dx)>Math.abs(dy)*1.25)e.preventDefault();}
   },{passive:false});
   host.addEventListener('touchend',e=>{
    if(pinch){if(e.touches.length<2){pinch=false;const c=host.querySelector('.webPdfCanvas');if(c)c.style.transform='';const z=pinchPreview;pinchPreview=zoom;setZoom(z);}return;}
    if(!st||!e.changedTouches.length)return;const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy,dt=Date.now()-st;sx=sy=lx=ly=st=0;
    if(!panned&&zoom<=1.02&&dt<900&&Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.25)changePage(dx<0?1:-1);panned=false;
   },{passive:true});
   host.addEventListener('touchcancel',()=>{pinch=false;panned=false;sx=sy=lx=ly=st=0;const c=host.querySelector('.webPdfCanvas');if(c)c.style.transform='';},{passive:true});

   // Windows/macOS: Ctrl/Cmd + mouse wheel/trackpad zoom, arrow keys page navigation.
   host.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();setZoom(zoom+(e.deltaY<0?.15:-.15));}},{passive:false});
   const keyHandler=e=>{if(activeDoc!==doc)return;if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();changePage(-1);}else if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();changePage(1);}else if((e.ctrlKey||e.metaKey)&&(e.key==='+'||e.key==='=')){e.preventDefault();setZoom(zoom+.2);}else if((e.ctrlKey||e.metaKey)&&e.key==='-'){e.preventDefault();setZoom(zoom-.2);}};
   document.addEventListener('keydown',keyHandler);
   if(dialog)dialog.addEventListener('close',()=>document.removeEventListener('keydown',keyHandler),{once:true});

   setStatus(navigator.onLine===false?'Offline-Kopie geöffnet · Wischen = Seite · Zwei Finger = Zoom':'PDF intern geöffnet · lokal gespeichert · Wischen = Seite · Zwei Finger = Zoom');
   updateControls();
   await renderPage();
  }catch(e){const msg=e&&e.message?e.message:String(e);setStatus(msg,true);const host=document.getElementById('webPdfHost');if(host)host.innerHTML=`<div class="pdfErrorBox"><strong>PDF konnte nicht angezeigt werden.</strong><p>${safe(msg)}</p></div>`;}
 }

 async function prefetchState(s){
  if(!s)return;
  if(navigator.onLine!==false){const uris=[...new Set((s.instructionLibrary||[]).filter(x=>x&&x.attachmentOnly&&x.pdfUri).map(x=>x.pdfUri))];for(const uri of uris){try{await cachedResponse(uri,false);}catch(_){try{await ensure(uri);}catch(_){}} }}
  try{await pdfJs();await fetch(PDFJS_WORKER_URL,{credentials:'same-origin',cache:'no-store'});}catch(_){}
 }
 window.WebPdfOffline={ensure,open,prefetchState,cacheName:CACHE};
})();
