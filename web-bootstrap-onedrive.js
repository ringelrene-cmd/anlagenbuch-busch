'use strict';
(async()=>{
 const loading=document.getElementById('webLoading');
 // Register even for authenticated sessions which bypass the login screen.
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js?v=3.16.5-offline1',{scope:'/',updateViaCache:'none'}).catch(console.warn);
 try{
  if(!navigator.locks)console.warn('Web Locks nicht verfügbar: Mehrfachbearbeitung in Browser-Tabs vermeiden.');
  let release;const held=new Promise(r=>release=r);
  // A handoff from the Android companion can briefly overlap the old WebView.
  // Keep the exclusive edit lock so that two tabs never write concurrently.
  let locked=false;
  for(let attempt=0;navigator.locks&&attempt<7&&!locked;attempt++){
   locked=await new Promise((resolve,reject)=>{navigator.locks.request('anlagenbuch-edit',{ifAvailable:true},async lock=>{resolve(!!lock);if(lock)await held;}).catch(reject);});
   if(!locked)await new Promise(r=>setTimeout(r,350));
  }
  if(!navigator.locks)locked=true;
  if(!locked){
   loading.innerHTML='Das Anlagenbuch ist bereits geöffnet. Bitte zum vorhandenen Fenster wechseln oder es schließen. <button id="abRetryOpen" type="button">Erneut öffnen</button>';
   loading.querySelector('#abRetryOpen').onclick=()=>location.reload();
   return;
  }
  window.addEventListener('pagehide',()=>{if(release)release();});
  for(const src of ['sync-merge.js','migrate-local.js'])await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src+'?v=3.16.5-offline1';s.onload=resolve;s.onerror=reject;document.body.append(s);});
  await migrateLocalOneDrive();
  // 3.00: Bei jedem Online-Start den zentralen Stand und die Serverversion lesen.
  // Lokale Daten werden dabei nicht verworfen; OneDriveSync führt sie anschließend
  // per Drei-Wege-Merge mit diesem Stand zusammen.
  let boot={};
  if(navigator.onLine!==false){
   // 3.00: Der Serverabgleich darf den App-Start niemals blockieren. Wenn OneDrive,
   // Durable Object oder ein Cloud-Limit gerade nicht erreichbar ist, startet die
   // App mit der lokalen Arbeitskopie und synchronisiert später automatisch weiter.
   try{
    const [vr,r]=await Promise.all([
     fetch('/api/version',{credentials:'same-origin',cache:'no-store'}),
     fetch('/api/bootstrap',{credentials:'same-origin',cache:'no-store'})
    ]);
    if(r.status===401){console.warn('Online-Anmeldung abgelaufen. Lokale Arbeitskopie bleibt nutzbar; für den Cloud-Abgleich erneut anmelden.');window.__ANLAGENBUCH_AUTH_EXPIRED__=true;}
    const version=await vr.json().catch(()=>({}));
    const remote=await r.json().catch(()=>({}));
    if(r.ok)boot=remote;
    else console.warn('Zentraler Startabgleich vorübergehend nicht verfügbar:',remote.error||r.status);
    if(vr.ok&&version.version&&!String(version.version).startsWith('3.16.5'))console.warn('Serverversion:',version.version);
   }catch(e){console.warn('Offline-/Fallback-Start:',e);}
  }
  window.__WEB_BOOTSTRAP__=boot;
  for(const src of ["sync-merge.js","onedrive-client.js","web-pdf-offline-249.js","seed-preview.js","btf-data.js","module1-data.js","annex-data.js","pump-unit-data.js","pump-serial-data-247.js","core.js","pump-serial-migration-247.js","default-psa-migration-242.js","equipment.js","units-248.js","qrcode-runtime.js","app-249.js","batch-search.js","onedrive-ui.js","pool-links.js","handling-multi-249.js","global-sync-247.js","help-data.js","help-image-viewer.js","help.js","widget.js","settings-menu.js","web-ui-249.js"])await new Promise((resolve,reject)=>{const x=document.createElement('script');x.src=src+'?v=3.16.5-offline1';x.onload=resolve;x.onerror=()=>reject(Error(src+' konnte nicht geladen werden.'));document.body.append(x);});
  loading.hidden=true;
 }catch(e){loading.textContent=e.message;}
})();
