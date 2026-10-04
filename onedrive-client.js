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
   if(start.conflicts.length)d={...d,pending:null,conflicts:start.conflicts,conflictRemote:remote,conflictRevision:boot.revision||0};
   else d={...d,local:start.state,base:M.copy(remote),revision:boot.revision||0,pending:null,conflicts:[]};
  }else if(M.same(d.local,remote)){d={...d,base:M.copy(remote),revision:boot.revision||0,pending:null,conflicts:[]};}
  storePacked(M.pack(d));
 }
 cleanupLegacy();
 let busy=false,error='',waitUntil=0,retryMs=2000,applying=false,syncAgain=false;
 const emit=()=>window.cloudChanged?.();
 function persist(next){
  const packed=M.pack(next);d=next;storePacked(packed);
 }
 function apply(){if(!d.local)return;applying=true;try{if(window.applyMergedWebState&&window.applyMergedWebState(JSON.stringify(d.local))===false)throw Error('Datenstand konnte nicht angezeigt werden.');}finally{applying=false;}}
 const dirty=()=>!M.same(d.base,d.local);
 async function api(path,opt={}){
  if(navigator.onLine===false)throw Error('Offline – Änderungen bleiben auf diesem Gerät.');
  const r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opt,signal:AbortSignal.timeout(60000)}),j=await r.json();
  if(!r.ok){if(r.status===429||r.status===503){const ra=Number(r.headers.get('Retry-After'));retryMs=Math.min(60000,Math.max(2000,ra?ra*1000:retryMs*2));waitUntil=Date.now()+retryMs;}throw Object.assign(Error(j.error||'Serverfehler'),{status:r.status,data:j});}retryMs=2000;waitUntil=0;return j;
 }
 function accept(remote,revision,base){
  const m=M.merge(base,d.local,remote);
  if(m.conflicts.length){persist({...d,base,pending:null,conflicts:m.conflicts,conflictRemote:remote,conflictRevision:revision});return;}
  persist({...d,local:m.state,base:remote,revision,pending:null,conflicts:[]});apply();
 }
 async function sync(){
  if(navigator.onLine===false||Date.now()<waitUntil)return;
  if(busy){syncAgain=true;return;}
  busy=true;syncAgain=false;error='';emit();
  try{
   // 2.90: Offene Konflikte dürfen andere, unabhängige Änderungen nicht blockieren.
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
       persist({...d,pending:null,conflicts:m.conflicts,conflictRemote:remote,conflictRevision:e.data.revision,revision:e.data.revision});
      }else throw e;
     }
    }else{
     const j=await api('/api/bootstrap');
     if(j.state&&j.revision>=Number(d.conflictRevision||d.revision||0)){
      const remote=JSON.parse(j.state),m=M.merge(d.base,d.local,remote);
      if(!m.conflicts.length){persist({...d,local:m.state,base:remote,revision:j.revision,pending:null,conflicts:[],conflictRemote:null,conflictRevision:0});apply();}
      else persist({...d,pending:null,conflicts:m.conflicts,conflictRemote:remote,conflictRevision:j.revision,revision:j.revision});
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
   if(!d.conflicts){
    const j=await api('/api/bootstrap');
    if(j.state&&j.revision>=d.revision){const remote=JSON.parse(j.state);accept(remote,j.revision,d.base);}
   }
  }catch(e){error=e.message;if(e.status===409&&e.data.conflicts){persist({...d,pending:null,conflicts:e.data.conflicts,conflictRemote:e.data.state,conflictRevision:e.data.revision});}}
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
  // Recompute against current local edits; choices apply only to the displayed values.
  const m=M.merge(d.base,d.local,d.conflictRemote);let next=m.state;
  if(displayed&&!M.same(displayed,m.conflicts))throw Error('Die Werte haben sich inzwischen geändert. Bitte Konflikte erneut öffnen.');
  if(choices.length!==m.conflicts.length||choices.some(x=>!['local','remote'].includes(x)))throw Error('Bitte für jeden aktuellen Konflikt eine Variante auswählen.');
  m.conflicts.forEach((c,i)=>{if(choices[i]==='local')next=M.resolve(next,c.path,c.local,c.localMissing);});
  persist({...d,base:d.conflictRemote,revision:d.conflictRevision,local:next,conflicts:[],pending:null});apply();sync();
 }
 window.OneDriveSync={sync,makeBackup,restoreBackup,resolveConflicts,getConflicts:()=>M.merge(d.base,d.local,d.conflictRemote||d.base).conflicts,status:()=>({provider:'onedrive',configured:true,signedIn:true,online:navigator.onLine!==false,pending:dirty()||!!d.pending,busy,error,conflicts:d.conflicts.length,revision:d.revision,backups:[]})};
 window.CompanionNative=window.Native||null;
 function pick(accept,callback){const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=()=>{if(i.files[0])callback(i.files[0]).catch(e=>window.nativeMessage?.(e.message));};i.click();}
 function download(name,data,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 async function upload(file,kind){const r=await api('/api/media/upload?kind='+kind,{method:'POST',headers:{'X-File-Name':encodeURIComponent(file.name)},body:file});const c=await caches.open('anlagenbuch-media-2.85');await c.put(mediaUrl(r.uri),new Response(file,{headers:{'Content-Type':file.type||'application/octet-stream'}}));return r;}
 window.Native={load:()=>d.local?JSON.stringify(d.local):'',seed:()=>window.SEED_TEXT||'',save,
  makeBackup:raw=>save(raw),backupStatus:()=>JSON.stringify(OneDriveSync.status()),retryCloud:()=>{sync();uploadBackup();return true;},
  queueFaultSync:()=>true,queueFaultSyncBatch:()=>true,queueWorkSync:()=>true,queueWorkSyncBatch:()=>true,syncFaults:()=>{sync();return true;},syncWork:()=>{sync();return true;},resetFaultSyncForRestore:()=>true,resetWorkSyncForRestore:()=>true,
  chooseInstructionPdf:target=>pick('.pdf',async f=>{const j=await upload(f,'pdf');window.instructionPdfSelected?.(target,j.uri,j.name);}),chooseSitePlanImage:()=>pick('image/*',async f=>{const j=await upload(f,'image');window.sitePlanImageSelected?.(j.uri,j.name);}),
  openInstructionPdf:uri=>WebPdfOffline.open(uri,'Hantierungsanweisung'),openSitePlanImage:uri=>openHelpImage(mediaUrl(uri),'Foto'),releaseInstructionPdf:()=>true,releaseSitePlanImage:()=>true,
  exportData:raw=>download('Anlagenbuch.json',raw,'application/json'),importData:()=>pick('.json',async f=>window.receiveImport?.(await f.text())),
  saveMonthlyProtocol:(month,raw)=>download('Protokoll-'+month+'.csv',raw,'text/csv;charset=utf-8'),printQr:()=>window.print(),copyText:t=>navigator.clipboard.writeText(t),scanQr:()=>window.webScanQr?.(),checkUpdates:()=>window.nativeMessage?.('Updates werden zentral bereitgestellt.'),downloadUpdate:()=>false,
  saveGeneratedQr:async(id,name,y,x,matrix)=>{const rows=matrix.split('\n'),n=rows.length,c=document.createElement('canvas');c.width=c.height=(n+8)*8;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(rows[y][x]==='1')g.fillRect((x+4)*8,(y+4)*8,8,8);download('QR-'+String(name).replace(/[^A-Za-z0-9_-]/g,'_')+'.png',await new Promise(r=>c.toBlob(r,'image/png')),'image/png');},
  setupStatus:()=>JSON.stringify({updateInstallAllowed:true,dropboxSignedIn:true,notificationsAllowed:true,cameraAvailable:!!navigator.mediaDevices,online:navigator.onLine}),
  testFaultSiren:()=>new Audio('stoerungssirene.mp3').play().catch(()=>window.toast?.('Zum Abspielen zuerst in die Seite klicken.')),requestFaultNotifications:()=>{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission();},readBackup:()=>'',leave:()=>window.close()
 };
 window.webMediaUrl=mediaUrl;window.__webBridgeOwnsSnapshotSync=true;
 window.FaultAlerts={notifyNewFaults:raw=>{const rows=JSON.parse(raw||'[]');if(rows.length){Native.testFaultSiren();const x=rows.at(-1);navigator.serviceWorker?.controller?.postMessage({type:'fault-notification',title:'Neue Störung · '+x.asset.name,body:x.fault.description,tag:x.fault.id});}return true;}};
 window.WidgetBridge={update:()=>true,pin:()=>window.toast?.('Das Android-Widget wird über die Begleit-App eingerichtet.')};
 // 2.90: Kein Dauer-Polling im 2-Sekunden-Takt mehr. Lokale Änderungen werden sofort
 // synchronisiert; zusätzlich gibt es nur einen sparsamen Abgleich alle 60 Sekunden.
 setInterval(sync,60000);setInterval(uploadBackup,120000);window.addEventListener('online',()=>{sync();uploadBackup();});window.addEventListener('offline',emit);window.addEventListener('focus',sync);window.addEventListener('pageshow',sync);document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});setTimeout(sync,300);
})();
