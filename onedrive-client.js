'use strict';
(()=>{
 const key='anlagenbuch-onedrive-v2',legacyKey='anlagenbuch-onedrive-v1',M=SyncMerge,S=OfflineStore,boot=window.__WEB_BOOTSTRAP__||{};
 let d=M.unpack(window.__OD_LOCAL_PACKED||'')||{base:null,local:null,revision:0,pending:null,conflicts:[]};
 let syncDbPromise=null,writeChain=Promise.resolve();
 function syncDb(){return syncDbPromise||(syncDbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('anlagenbuch-sync',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}));}
 function storePacked(packed){writeChain=writeChain.then(async()=>{const b=await syncDb();await new Promise((resolve,reject)=>{const t=b.transaction('state','readwrite');t.objectStore('state').put(packed,'onedrive-v2');t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}).catch(e=>{error='Lokaler IndexedDB-Speicherfehler: '+e.message;emit();});return writeChain;}
 // 2.85: Alte parallele Web-Speicher werden nach erfolgreicher Übernahme entfernt.
 // Der OneDrive-Sync ist damit die einzige lokale Arbeitskopie/Sync-Quelle.
 function cleanupLegacy(){try{if(d.local){localStorage.removeItem(key);localStorage.removeItem(legacyKey);localStorage.removeItem('anlagenbuch-v1');for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith('anlagenbuch-web-v230-'))localStorage.removeItem(k);}}}catch(_){}}
 // 2.85: Den beim Start frisch gelesenen Zentralstand sofort einbeziehen.
 // Bei vorhandener Basis bleiben lokale Offline-Änderungen erhalten und werden gemergt.
 if(boot.state){
  const remote=JSON.parse(boot.state);
  if(!d.local){d.local=M.copy(remote);d.base=M.copy(remote);d.revision=boot.revision||0;d.pending=null;d.conflicts=[];}
  else if(d.base){
   const start=M.merge(d.base,d.local,remote);
   if(start.conflicts.length)d={...d,local:start.state,base:M.copy(remote),revision:boot.revision||0,pending:null,conflicts:start.conflicts,conflictRemote:remote,conflictRevision:boot.revision||0};
   else d={...d,local:start.state,base:M.copy(remote),revision:boot.revision||0,pending:null,conflicts:[]};
  }else if(M.same(d.local,remote)){d={...d,base:M.copy(remote),revision:boot.revision||0,pending:null,conflicts:[]};}
  storePacked(M.pack(d));
 }
 cleanupLegacy();
 let busy=false,error='',waitUntil=0,retryMs=2000,applying=false,syncAgain=false;
 const emit=()=>window.cloudChanged?.();
 let mediaPrefetchTimer=null;
 function primeOfflineMedia(){
  if(navigator.onLine===false||!d.local||!('serviceWorker' in navigator))return;
  clearTimeout(mediaPrefetchTimer);
  mediaPrefetchTimer=setTimeout(()=>{
   const uris=refs(d.local);
   if(!uris.length)return;
   navigator.serviceWorker.ready.then(reg=>{
    (navigator.serviceWorker.controller||reg.active)?.postMessage({type:'offline-media-prefetch',uris});
   }).catch(()=>{});
  },1500);
 }
 function persist(next){
  const packed=M.pack(next);d=next;storePacked(packed);primeOfflineMedia();
 }
 function apply(){if(!d.local)return;applying=true;try{if(window.applyMergedWebState&&window.applyMergedWebState(JSON.stringify(d.local))===false)throw Error('Datenstand konnte nicht angezeigt werden.');window.dispatchEvent(new CustomEvent('anlagenbuch:remote-applied',{detail:{revision:Number(d.revision||0)}}));}finally{applying=false;}}
 const dirty=()=>!M.same(d.base,d.local);
 async function api(path,opt={}){
  if(navigator.onLine===false)throw Error('Offline – Änderungen bleiben auf diesem Gerät.');
  const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opt,signal:AbortSignal.timeout(60000)}),j=await r.json();
  if(!r.ok){if(r.status===429||r.status===503){const ra=Number(r.headers.get('Retry-After'));retryMs=Math.min(60000,Math.max(2000,ra?ra*1000:retryMs*2));waitUntil=Date.now()+retryMs;}throw Object.assign(Error(j.error||'Serverfehler'),{status:r.status,data:j});}retryMs=2000;waitUntil=0;return j;
 }
 function accept(remote,revision,base){
  const m=M.merge(base,d.local,remote);
  if(m.conflicts.length){persist({...d,local:m.state,base:M.copy(remote),revision,pending:null,conflicts:m.conflicts,conflictRemote:remote,conflictRevision:revision});apply();return;}
  persist({...d,local:m.state,base:remote,revision,pending:null,conflicts:[]});apply();
 }
 // Offline uploads retain their bytes locally until the cloud has accepted them.
 async function finishOfflineUploads(){
  if(!d.local||navigator.onLine===false)return;
  const pending=refs(d.local).filter(x=>/^(web-pdf|web-image):\/\/temp\//.test(x));
  if(!pending.length)return;
  const c=await caches.open('anlagenbuch-media-2.85');
  for(const uri of pending){
   const hit=await c.match(mediaUrl(uri));
   if(!hit)throw Error('Offline-Datei fehlt lokal: '+uri);
   const file=await hit.blob(),kind=uri.startsWith('web-pdf:')?'pdf':'image';
   const uploaded=await api('/api/media/upload?kind='+kind,{method:'POST',headers:{'X-File-Name':encodeURIComponent(uri.split('/').pop()+ (kind==='pdf'?'.pdf':'.jpg'))},body:file});
   const oldValue=uri,newValue=uploaded.uri;
   function replace(v){if(v===oldValue)return newValue;if(Array.isArray(v))return v.map(replace);if(v&&typeof v==='object'){const o={};for(const [k,x] of Object.entries(v))o[k]=replace(x);return o;}return v;}
   // Replacing a temporary URI is part of the pending local edit, not a server merge.
   persist({...d,local:replace(d.local),pending:null});
   await c.put(mediaUrl(newValue),hit.clone());
  }
  apply();
 }
 async function sync(){
  if(navigator.onLine===false||Date.now()<waitUntil)return;
  if(busy){syncAgain=true;return;}
  busy=true;syncAgain=false;error='';emit();
  try{
   await finishOfflineUploads();
   // 2.91: Offene Konflikte dürfen andere, unabhängige Änderungen nicht blockieren.
   // Der Server übernimmt bei /api/sync alle konfliktfreien Teile einer Transaktion
   // und lässt nur die tatsächlich widersprüchlichen Felder zur Auswahl offen.
   if(d.conflicts.length){
    if(d.pending||dirty()){
     if(!d.pending)persist({...d,pending:{id:crypto.randomUUID(),base:M.copy(d.base),local:M.copy(d.local)}});
     const pending=d.pending;
     try{
      const j=await api('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});
      accept(j.state,j.revision,pending.local);
     }catch(e){
      if(e.status===409&&e.data&&e.data.state){
       const remote=typeof e.data.state==='string'?JSON.parse(e.data.state):e.data.state;
       const m=M.merge(d.base,d.local,remote);
       persist({...d,local:m.state,base:M.copy(remote),pending:null,conflicts:m.conflicts,conflictRemote:remote,conflictRevision:e.data.revision,revision:e.data.revision});apply();
      }else throw e;
     }
    }else{
     // 2.96: Auch bei alten, noch nicht aufgeloesten Konflikten den Zentralstand
     // regelmaessig einlesen. Neue konfliktfreie Team-Aenderungen werden sofort
     // in die sichtbare Arbeitskopie uebernommen; die alten Konflikte bleiben offen.
     const j=await api('/api/bootstrap');
     if(j.state&&j.revision>=Number(d.revision||0)){
      const remote=JSON.parse(j.state),m=M.merge(d.base,d.local,remote);
      persist({...d,local:m.state,base:M.copy(remote),pending:null,conflicts:m.conflicts,conflictRemote:remote,conflictRevision:j.revision,revision:j.revision});
      apply();
     }
    }
    return;
   }
   if(d.restorePending){const b=await backupStore();await api('/api/backup/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({media:b.backup.media})});persist({...d,restorePending:false});}
   if(d.pending||dirty()){
    if(!d.pending)persist({...d,pending:{id:crypto.randomUUID(),base:M.copy(d.base),local:M.copy(d.local)}});
    const pending=d.pending,j=await api('/api/sync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});
    accept(j.state,j.revision,pending.local);
   }
   // 2.85: Nach jedem Upload (und auch ohne lokale Änderung) noch einmal den
   // aktuellen zentralen Stand holen. So sehen alle Online-Geräte denselben Stand,
   // auch wenn ein Kollege während unseres Uploads bereits weitergearbeitet hat.
   if(!d.conflicts.length){
    const j=await api('/api/bootstrap');
    if(j.state&&j.revision>=d.revision){const remote=JSON.parse(j.state);accept(remote,j.revision,d.base);}
   }
  }catch(e){error=e.message;if(e.status===409&&e.data.conflicts&&e.data.state){const remote=typeof e.data.state==='string'?JSON.parse(e.data.state):e.data.state;const m=M.merge(d.base,d.local,remote);persist({...d,local:m.state,base:M.copy(remote),revision:e.data.revision,pending:null,conflicts:m.conflicts.length?m.conflicts:e.data.conflicts,conflictRemote:remote,conflictRevision:e.data.revision});apply();}}
  finally{
   busy=false;emit();
   if(syncAgain&&navigator.onLine!==false)setTimeout(sync,0);
  }
 }
 function save(raw){if(applying)return true;try{const local=JSON.parse(raw);persist({...d,local});setTimeout(sync,0);emit();return true;}catch(e){error='Speichern fehlgeschlagen: '+e.message;emit();return false;}}
 async function db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('anlagenbuch-backup',1);r.onupgradeneeded=()=>r.result.createObjectStore('backup');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
 async function backupStore(value){const b=await db();try{return await new Promise((resolve,reject)=>{const t=b.transaction('backup',value?'readwrite':'readonly'),s=t.objectStore('backup'),r=value?s.put(value,'latest'):s.get('latest');t.oncomplete=()=>resolve(value||r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}finally{b.close();}}
 function refs(s){const set=new Set();const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image):/.test(x))set.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(s);return [...set];}
 const mediaUrl=uri=>uri.startsWith('asset-image://bundled/')?uri.slice('asset-image://bundled/'.length):'/api/media?uri='+encodeURIComponent(uri);
 async function mediaBytes(uri){const url=mediaUrl(uri);let r;if(navigator.onLine!==false)try{r=await fetch(url);if(!r.ok)r=null;}catch(_){}if(!r)for(const name of await caches.keys()){r=await(await caches.open(name)).match(url);if(r)break;}if(!r)throw Error('Datei vor dem Offline-Backup einmal öffnen: '+uri);return new Uint8Array(await r.arrayBuffer());}
 let backupBusy=false;
 async function makeBackup(){if(backupBusy)return;backupBusy=true;try{
  const snapshot=M.copy(d.local),media={};let size=0;
  for(const uri of refs(snapshot)){const b=await mediaBytes(uri);size+=b.length;if(size>60*1024*1024)throw Error('Backup größer als 60 MB.');let str='';for(let i=0;i<b.length;i+=8192)str+=String.fromCharCode(...b.slice(i,i+8192));media[uri]=btoa(str);}
  const backup={format:'anlagenbuch-backup-v1',at:Date.now(),state:snapshot,media};await backupStore({backup,pending:true});
  await uploadBackup();window.toast?.('Backup lokal erstellt.');
 }catch(e){error=e.message;window.nativeMessage?.(e.message);}finally{backupBusy=false;emit();}}
 let uploadingBackup=false;
 async function uploadBackup(){if(uploadingBackup||navigator.onLine===false)return;uploadingBackup=true;try{const b=await backupStore();if(!b?.pending)return;await api('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({backup:b.backup})});const now=await backupStore();if(now.backup.at===b.backup.at)await backupStore({...b,pending:false});error='';}catch(e){error='Backup lokal gespeichert; OneDrive ausstehend: '+e.message;}finally{uploadingBackup=false;emit();}}
 async function restoreBackup(){try{
  const local=await backupStore();let backup=local?.backup;
  if(navigator.onLine!==false){try{const remote=(await api('/api/backup/read')).backup;if(!backup||remote.at>backup.at)backup=remote;}catch(e){if(!backup)throw e;}}
  if(!backup)throw Error('Noch kein Backup vorhanden.');
  const next=AppCore.validate(backup.state);
  if(!confirm('Backup vom '+new Date(backup.at).toLocaleString('de-DE')+' wiederherstellen? Änderungen seit diesem Backup werden als bewusste Änderungen zum Abgleich vorgemerkt.'))return;
  const cache=await caches.open('anlagenbuch-media-2.85');for(const [uri,encoded] of Object.entries(backup.media||{})){const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));await cache.put(mediaUrl(uri),new Response(bytes,{headers:{'Content-Type':uri.includes('pdf:')?'application/pdf':'image/jpeg'}}));}
  await backupStore({backup,pending:false});persist({...d,restorePending:true});if(!save(JSON.stringify(next)))throw Error(error);apply();window.toast?.('Backup wiederhergestellt. Abgleich vorgemerkt.');
 }catch(e){window.nativeMessage?.(e.message);}}
 function resolveConflicts(choices,displayed){
  if(!d.conflictRemote||!Array.isArray(d.conflicts)||!d.conflicts.length)throw Error('Keine Konflikte vorhanden.');
  const rows=d.conflicts;let next=M.copy(d.conflictRemote);
  if(displayed&&!M.same(displayed,rows))throw Error('Die Werte haben sich inzwischen geändert. Bitte Konflikte erneut öffnen.');
  if(choices.length!==rows.length||choices.some(x=>!['local','remote'].includes(x)))throw Error('Bitte für jeden aktuellen Konflikt eine Variante auswählen.');
  rows.forEach((c,i)=>{if(choices[i]==='local')next=M.resolve(next,c.path,c.local,c.localMissing);});
  persist({...d,base:M.copy(d.conflictRemote),revision:d.conflictRevision,local:next,conflicts:[],conflictRemote:null,conflictRevision:0,pending:null});apply();sync();
 }
 window.OneDriveSync={sync,makeBackup,restoreBackup,resolveConflicts,getConflicts:()=>M.copy(d.conflicts||[]),status:()=>({provider:'onedrive',configured:true,signedIn:true,online:navigator.onLine!==false,pending:dirty()||!!d.pending,busy,error,conflicts:d.conflicts.length,revision:d.revision,backups:[]})};
 window.CompanionNative=window.Native||null;
 function pick(accept,callback){const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>{if(i.files[0])callback(i.files[0]).catch(e=>window.nativeMessage?.(e.message));};i.click();}
 function download(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 async function upload(file,kind){
  const c=await caches.open('anlagenbuch-media-2.85');
  if(navigator.onLine===false){
   const uri=(kind==='pdf'?'web-pdf://temp/':'web-image://temp/')+crypto.randomUUID();
   await c.put(mediaUrl(uri),new Response(file,{headers:{'Content-Type':file.type||'application/octet-stream'}}));
   return {uri,name:file.name};
  }
  try{const r=await api('/api/media/upload?kind='+kind,{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name)},body:file});await c.put(mediaUrl(r.uri),new Response(file,{headers:{'Content-Type':file.type||'application/octet-stream'}}));return r;}
  catch(e){if(navigator.onLine!==false)throw e;const uri=(kind==='pdf'?'web-pdf://temp/':'web-image://temp/')+crypto.randomUUID();await c.put(mediaUrl(uri),new Response(file,{headers:{'Content-Type':file.type||'application/octet-stream'}}));return {uri,name:file.name};}
 }
 window.Native={load:()=>d.local?JSON.stringify(d.local):'',seed:()=>window.SEED_TEXT||'',save,
  makeBackup:raw=>save(raw),backupStatus:()=>JSON.stringify(OneDriveSync.status()),retryCloud:()=>{sync();uploadBackup();return true;},
  queueFaultSync:()=>true,queueFaultSyncBatch:()=>true,queueWorkSync:()=>true,queueWorkSyncBatch:()=>true,syncFaults:()=>{sync();return true;},syncWork:()=>{sync();return true;},resetFaultSyncForRestore:()=>true,resetWorkSyncForRestore:()=>true,
  chooseInstructionPdf:target=>pick('.pdf',async f=>{const j=await upload(f,'pdf');window.instructionPdfSelected?.(target,j.uri,j.name);}),chooseSitePlanImage:()=>pick('image/*',async f=>{const j=await upload(f,'image');window.sitePlanImageSelected?.(j.uri,j.name);}),
  openInstructionPdf:uri=>WebPdfOffline.open(uri,'Hantierungsanweisung'),openSitePlanImage:uri=>openHelpImage(mediaUrl(uri),'Foto'),releaseInstructionPdf:()=>true,releaseSitePlanImage:()=>true,
  exportData:raw=>download('Anlagenbuch.json',raw,'application/json'),importData:()=>pick('.json',async f=>window.receiveImport?.(await f.text())),
  saveMonthlyProtocol:(month,raw)=>download('Protokoll-'+month+'.csv',raw,'text/csv;charset=utf-8'),printQr:()=>window.print(),copyText:t=>navigator.clipboard.writeText(t),scanQr:()=>window.webScanQr?.(),checkUpdates:()=>window.showCompanionInstall?.(),downloadUpdate:()=>false,
  saveGeneratedQr:async(id,name,y,x,matrix)=>{const rows=matrix.split('\n'),n=rows.length,c=document.createElement('canvas');c.width=c.height=(n+8)*8;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(rows[y][x]==='1')g.fillRect((x+4)*8,(y+4)*8,8,8);download('QR-'+String(name).replace(/[^A-Za-z0-9_-]/g,'_')+'.png',await new Promise(r=>c.toBlob(r,'image/png')),'image/png');},
  setupStatus:()=>JSON.stringify({updateInstallAllowed:true,dropboxSignedIn:true,notificationsAllowed:true,cameraAvailable:!!navigator.mediaDevices,online:navigator.onLine}),
  testFaultSiren:()=>new Audio('stoerungssirene.mp3').play().catch(()=>window.toast?.('Zum Abspielen zuerst in die Seite klicken.')),requestFaultNotifications:()=>{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission();},readBackup:()=>'',leave:()=>window.close()
 };
 window.webMediaUrl=mediaUrl;window.__webBridgeOwnsSnapshotSync=true;
 window.FaultAlerts={notifyNewFaults:raw=>{const rows=JSON.parse(raw||'[]');if(rows.length){Native.testFaultSiren();const x=rows.at(-1);navigator.serviceWorker?.controller?.postMessage({type:'fault-notification',title:'Neue Störung · '+x.asset.name,body:x.fault.description,tag:x.fault.id});}return true;}};
 window.WidgetBridge={update:()=>true,pin:()=>window.toast?.('Das Android-Widget wird über die Begleit-App eingerichtet.')};
 // 2.96: Automatischer OneDrive-Abgleich ohne F5. Sichtbare Seiten pruefen alle 8 s,
 // Hintergrund-Tabs sparsamer alle 60 s. Fokus, Rueckkehr und Online-Wechsel gleichen sofort ab.
 let revisionWatchBusy=false,revisionWatchSeen=Number(d.revision||0);
 async function revisionWatch(){
  if(revisionWatchBusy||document.hidden||navigator.onLine===false)return;revisionWatchBusy=true;
  try{
   const r=await fetch('/api/health',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!r.ok)return;const j=await r.json(),remote=Number(j.revision||0),local=Number(d.revision||0);
   if(remote>local){
    revisionWatchSeen=Math.max(revisionWatchSeen,remote);sync();
    setTimeout(()=>{if(!document.hidden&&navigator.onLine!==false&&Number(d.revision||0)<revisionWatchSeen)location.reload();},2500);
   }
  }catch(_){}finally{revisionWatchBusy=false;}
 }
 // 2.96: visible clients actively verify the central OneDrive revision. This is intentionally
 // independent of the normal merge timer so an already-open PC cannot remain on a stale UI.
 async function livePull(){
  if(document.hidden||navigator.onLine===false)return;
  try{
   const j=await api('/api/bootstrap');
   const remoteRev=Number(j.revision||0);
   if(j.state&&remoteRev>Number(d.revision||0)){
    const remote=JSON.parse(j.state);
    const m=M.merge(d.base,d.local,remote);
    persist({...d,local:m.state,base:M.copy(remote),pending:null,conflicts:m.conflicts,conflictRemote:m.conflicts.length?remote:null,conflictRevision:m.conflicts.length?remoteRev:0,revision:remoteRev});
    apply();
   }else if(j.state&&remoteRev===Number(d.revision||0)){
    // Re-apply current working copy as a UI heartbeat; fixes stale open dashboards.
    apply();
   }
  }catch(_){}
 }
 setInterval(()=>{if(document.hidden)return;livePull();sync();revisionWatch();},5000);setInterval(()=>{if(document.hidden)sync();},60000);setInterval(uploadBackup,120000);window.addEventListener('online',()=>{sync();uploadBackup();primeOfflineMedia();});window.addEventListener('offline',emit);window.addEventListener('focus',()=>{livePull();sync();});window.addEventListener('pageshow',()=>{livePull();sync();});document.addEventListener('visibilitychange',()=>{if(!document.hidden){livePull();sync();}});setTimeout(()=>{livePull();sync();primeOfflineMedia();},300);
})();
