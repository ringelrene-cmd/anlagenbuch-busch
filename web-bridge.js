'use strict';
(()=>{
 const companionNative=window.Native||null;window.CompanionNative=companionNative;window.__anlagenbuchWebNativeFallback=!companionNative;
 const S=window.OfflineStore,boot=window.__WEB_BOOTSTRAP__||{},remoteBackups=new Map();
 let currentRaw=typeof boot.state==='string'?boot.state:(S?.getStateRaw?.()||'');
 let faultCursor=S?.getCursor?.('fault')||String(boot.faultCursor||''),workCursor=S?.getCursor?.('work')||String(boot.workCursor||''),backupCursor=S?.getCursor?.('backup')||String(boot.backupCursor||'');
 let saveTimer=0,backupBusy=false,backupQueued=!!S?.isDirty?.(),lastUploaded=Math.max(Number(boot.latestAt||0),S?.getUploadedAt?.()||0),lastError='',remoteList=Array.isArray(boot.backups)?boot.backups:[],rateLimitUntil=0,reconciling=false;
 const APP_ROOT='/Busch Group/Anlagenbuch';
 const online=()=>navigator.onLine!==false;
 const rateWait=()=>Math.max(0,rateLimitUntil-Date.now());
 const emit=(name,...args)=>{try{if(typeof window[name]==='function')window[name](...args);}catch(_){}};
 const queueCount=()=>((S?.getQueue?.('fault')||[]).length+(S?.getQueue?.('work')||[]).length+(S?.isDirty?.()?1:0));
 const status=()=>({provider:'dropbox',direct:true,registered:true,signedIn:true,configured:true,handedAt:0,joining:false,online:online(),pending:!!(backupQueued||S?.isDirty?.()||queueCount()),busy:backupBusy,error:lastError,localAt:S?.localAt?.()||0,uploadedAt:lastUploaded,queueCount:queueCount(),target:APP_ROOT,backups:remoteList});
 async function api(path,opt={}){
  if(!online()){S?.setNeedsReconcile?.(true);const e=Error('Offline – Änderungen bleiben lokal gespeichert.');e.offline=true;throw e;}
  if(rateWait()>0){const e=Error('Dropbox-Abgleich ist kurz pausiert.');e.rateLimited=true;throw e;}
  let r;try{r=await fetch(path,{cache:'no-store',credentials:'same-origin',...opt});}catch(err){S?.setNeedsReconcile?.(true);const e=Error('Keine stabile Internetverbindung. Änderungen bleiben lokal gespeichert.');e.offline=true;throw e;}
  const ct=r.headers.get('content-type')||'',j=ct.includes('application/json')?await r.json().catch(()=>null):null;
  if(r.status===401){const e=Error('Web-Sitzung abgelaufen. Deine lokalen Änderungen bleiben erhalten. Bitte bei stabiler Verbindung die Web-Version neu öffnen und anmelden.');e.authExpired=true;throw e;}
  if(!r.ok){if(r.status===429){const h=Number(r.headers.get('Retry-After')||0),b=Number(j?.retryAfter||0),seconds=Math.max(10,Math.min(300,h||b||30));rateLimitUntil=Math.max(rateLimitUntil,Date.now()+seconds*1000);const e=Error('Dropbox drosselt den Abgleich kurz. Die Web-Version wartet automatisch.');e.rateLimited=true;throw e;}throw Error(j?.error||('Serverfehler '+r.status));}
  return j;
 }
 async function reconcileBeforeUpload(){
  if(reconciling||!S?.needsReconcile?.()||!online())return currentRaw;
  reconciling=true;
  try{
   const j=await api('/api/bootstrap');
   if(j?.state){
    const base=S.getBaseRaw?.()||'',merged=S.mergeThreeWay?.(base,currentRaw,String(j.state))||currentRaw;
    currentRaw=merged;S.setStateRaw?.(merged,{dirty:true});S.cacheBootstrap?.(j);
    remoteList=Array.isArray(j.backups)?j.backups:remoteList;
    if(typeof window.applyMergedWebState==='function'){
     try{window.__offlineReconcileApplying=true;window.applyMergedWebState(merged);}finally{window.__offlineReconcileApplying=false;clearTimeout(saveTimer);saveTimer=0;backupQueued=false;}
    }
   }
   return currentRaw;
  }finally{reconciling=false;}
 }
 async function doBackup(raw){
  currentRaw=String(raw||currentRaw||'');
  if(backupBusy){backupQueued=true;return;}
  if(!online()){backupQueued=true;S?.setNeedsReconcile?.(true);emit('cloudChanged');return;}
  if(rateWait()>0){backupQueued=true;setTimeout(()=>{if(backupQueued&&!backupBusy)doBackup(currentRaw);},Math.max(1000,rateWait()+250));return;}
  backupBusy=true;backupQueued=false;lastError='';emit('cloudChanged');
  let uploadRaw=currentRaw;
  try{
   if(S?.needsReconcile?.())uploadRaw=await reconcileBeforeUpload();
   const j=await api('/api/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({raw:uploadRaw,at:Date.now()})});
   lastUploaded=Number(j.at)||Date.now();S?.setUploadedAt?.(lastUploaded);remoteList=j.backups||remoteList;
   if(currentRaw===uploadRaw){S?.markClean?.(uploadRaw);backupQueued=false;}else backupQueued=true;
   lastError='';emit('cloudChanged');
  }catch(e){
   if(e.offline)S?.setNeedsReconcile?.(true);
   lastError=e.rateLimited?'Dropbox-Abgleich pausiert kurz und wird automatisch fortgesetzt.':e.message;backupQueued=true;
   if(!e.rateLimited&&!e.offline)emit('nativeMessage',e.message);emit('cloudChanged');
  }finally{
   backupBusy=false;
   if(backupQueued&&online())setTimeout(()=>doBackup(currentRaw),Math.max(1000,rateWait()+250));
  }
 }
 function scheduleBackup(raw,delay=350){currentRaw=String(raw||'');S?.setStateRaw?.(currentRaw,{dirty:true,localAt:Date.now()});backupQueued=true;clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=0;doBackup(currentRaw);},delay);}
 function parseEvents(raw){try{const x=JSON.parse(raw);return (Array.isArray(x)?x:[x]).filter(e=>e&&typeof e.eventId==='string');}catch(_){return [];}}
 function enqueueEvents(type,raw){
  const incoming=parseEvents(raw);if(!incoming.length)return;
  const old=S?.getQueue?.(type)||[],m=new Map(old.map(e=>[e.eventId,e]));for(const e of incoming)m.set(e.eventId,e);S?.setQueue?.(type,[...m.values()]);
  if(!online()){S?.setNeedsReconcile?.(true);emit('cloudChanged');return;}
  setTimeout(()=>flushEvents(type),20);
 }
 async function flushEvents(type){
  if(!online()||rateWait()>0)return false;
  const rows=S?.getQueue?.(type)||[];if(!rows.length){pullEvents(type);return true;}
  const sending=rows.slice();
  try{
   await api('/api/events/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,events:sending})});
   const ids=new Set(sending.map(e=>e.eventId)),left=(S?.getQueue?.(type)||[]).filter(e=>!ids.has(e.eventId));S?.setQueue?.(type,left);lastError='';emit('cloudChanged');setTimeout(()=>pullEvents(type),200);return true;
  }catch(e){if(e.offline)S?.setNeedsReconcile?.(true);lastError=e.rateLimited?'Dropbox-Abgleich pausiert kurz und wird automatisch fortgesetzt.':e.message;if(!e.rateLimited&&!e.offline)emit('nativeMessage',e.message);emit('cloudChanged');return false;}
 }
 async function pullEvents(type){
  if(!online()||rateWait()>0)return;
  try{const cursor=type==='fault'?faultCursor:workCursor,j=await api('/api/events/pull?type='+encodeURIComponent(type)+(cursor?'&cursor='+encodeURIComponent(cursor):''));if(type==='fault')faultCursor=String(j.cursor||'');else workCursor=String(j.cursor||'');S?.setCursor?.(type,type==='fault'?faultCursor:workCursor);if(Array.isArray(j.events)&&j.events.length)emit(type==='fault'?'receiveFaultSync':'receiveWorkSync',j.events);lastError='';}catch(e){if(e.offline)S?.setNeedsReconcile?.(true);lastError=e.rateLimited?'Dropbox-Abgleich pausiert kurz und wird automatisch fortgesetzt.':e.message;}
 }
 function pick(accept,cb){const i=document.createElement('input');i.type='file';i.accept=accept;i.onchange=async()=>{const f=i.files&&i.files[0];if(!f)return;try{await cb(f);}catch(e){emit('nativeMessage',e.message);}};i.click();}
 function dl(name,data,type='application/octet-stream'){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000);}
 function qrPng(matrix){const rows=matrix.split('\n'),n=rows.length,c=document.createElement('canvas');c.width=c.height=(n+8)*8;const g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,c.width,c.height);g.fillStyle='black';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(rows[y][x]==='1')g.fillRect((x+4)*8,(y+4)*8,8,8);return new Promise(r=>c.toBlob(b=>r(b),'image/png'));}
 async function uploadMedia(file,kind){if(!online())throw Error('PDFs und Bilder können erst mit Internet hochgeladen werden. Alle Texteingaben und Änderungen bleiben trotzdem lokal erhalten.');if(file.size>50*1024*1024)throw Error('Datei ist größer als 50 MB.');const r=await fetch('/api/media/upload?kind='+kind,{method:'POST',body:file,headers:{'X-File-Name':encodeURIComponent(file.name)},cache:'no-store',credentials:'same-origin'});const j=await r.json().catch(()=>null);if(r.status===401)throw Error('Sitzung abgelaufen. Bitte bei stabiler Verbindung neu anmelden.');if(!r.ok||!j?.ok)throw Error(j?.error||'Datei konnte nicht hochgeladen werden.');return j;}
 function mediaUrl(uri){if(!uri)return'';try{const u=new URL(uri);if(u.protocol==='asset-image:'&&u.hostname==='bundled')return decodeURIComponent(u.pathname.slice(1));}catch(_){}return '/api/media?uri='+encodeURIComponent(uri);}
 const Native={
  load:()=>currentRaw,seed:()=>window.SEED_TEXT||'',save:raw=>{currentRaw=String(raw||'');scheduleBackup(currentRaw,500);if(!online())S?.setNeedsReconcile?.(true);return true;},backupStatus:()=>JSON.stringify(status()),
  makeBackup:raw=>{currentRaw=String(raw||currentRaw);S?.setStateRaw?.(currentRaw,{dirty:true,localAt:Date.now()});clearTimeout(saveTimer);saveTimer=0;backupQueued=true;doBackup(currentRaw);return true;},
  retryCloud:()=>{if(!online())return true;flushEvents('fault');flushEvents('work');if((backupQueued||S?.isDirty?.())&&!backupBusy)doBackup(currentRaw);else{pullEvents('fault');pullEvents('work');}return true;},
  queueFaultSync:r=>{enqueueEvents('fault',r);return true;},queueFaultSyncBatch:r=>{enqueueEvents('fault',r);return true;},queueWorkSync:r=>{enqueueEvents('work',r);return true;},queueWorkSyncBatch:r=>{enqueueEvents('work',r);return true;},
  syncFaults:()=>{flushEvents('fault');pullEvents('fault');return true;},syncWork:()=>{flushEvents('work');pullEvents('work');return true;},resetFaultSyncForRestore:()=>{faultCursor='';S?.setCursor?.('fault','');pullEvents('fault');return true;},resetWorkSyncForRestore:()=>{workCursor='';S?.setCursor?.('work','');pullEvents('work');return true;},
  refreshDropboxBackups:()=>{if(!online()||rateWait()>0)return true;const path=backupCursor?'/api/backups/changes?cursor='+encodeURIComponent(backupCursor):'/api/backups';api(path).then(j=>{if(Object.prototype.hasOwnProperty.call(j,'cursor')){backupCursor=String(j.cursor||'');S?.setCursor?.('backup',backupCursor);}if(Array.isArray(j.backups))remoteList=j.backups;else if(Array.isArray(j.changes)&&j.changes.length){const map=new Map(remoteList.map(x=>[x.id,x]));for(const x of j.changes)map.set(x.id,x);remoteList=[...map.values()].sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0)).slice(0,50);}S?.cacheBootstrap?.({...boot,backups:remoteList,backupCursor});emit('dropboxBackups',{backups:remoteList});}).catch(e=>{if(!e.offline)emit('dropboxBackups',{error:e.message});});return true;},
  restoreDropboxBackup:p=>{if(!online()){emit('dropboxBackupReady',{error:'Offline – Dropbox-Sicherungen können erst mit Internet geladen werden.'});return true;}api('/api/backup/read?path='+encodeURIComponent(p)).then(j=>{remoteBackups.set(j.id,j.raw);emit('dropboxBackupReady',{id:j.id});}).catch(e=>emit('dropboxBackupReady',{error:e.message}));return true;},
  readBackup:id=>remoteBackups.get(id)||'',
  selectCloud:p=>{if(p!=='dropbox')emit('nativeMessage','Die Web-Version verwendet für den gemeinsamen Abgleich ausschließlich Dropbox.');return true;},connectCloud:()=>{emit('nativeMessage','Dropbox ist in der Web-Version serverseitig verbunden.');return true;},disconnectCloud:()=>{emit('nativeMessage','Die serverseitige Dropbox-Verbindung kann nicht aus dem Browser getrennt werden.');return true;},
  signInDropbox:()=>{emit('nativeMessage','Dropbox ist serverseitig verbunden. Falls die Sitzung abgelaufen ist, die Web-Version bei stabiler Verbindung neu öffnen.');return true;},importTeamSetup:()=>{emit('nativeMessage','Der Firmenzugang ist auf dem Webserver eingerichtet.');return true;},teamSetupCode:()=>JSON.stringify({ok:false,error:'Der Firmenzugang wird in der Web-Version nicht an den Browser ausgegeben.'}),saveTeamSetup:()=>false,
  setupStatus:()=>JSON.stringify({updateInstallAllowed:true,dropboxSignedIn:true,notificationsAllowed:true,cameraAvailable:!!navigator.mediaDevices,online:online()}),openUpdatePermission:()=>true,
  chooseInstructionPdf:target=>pick('.pdf,application/pdf',async f=>{const j=await uploadMedia(f,'pdf');window.instructionPdfSelected?.(target,j.uri,j.name);}),chooseSitePlanImage:()=>pick('.png,.jpg,.jpeg,.webp,image/*',async f=>{const j=await uploadMedia(f,'image');window.sitePlanImageSelected?.(j.uri,j.name);}),
  openInstructionPdf:uri=>window.open(mediaUrl(uri),'_blank','noopener'),openSitePlanImage:uri=>window.openHelpImage?openHelpImage(mediaUrl(uri),'Lageplan'):window.open(mediaUrl(uri),'_blank','noopener'),releaseInstructionPdf:()=>true,releaseSitePlanImage:()=>true,
  exportData:raw=>dl('Anlagenbuch-'+new Date().toISOString().slice(0,10)+'.json',raw,'application/json'),importData:()=>pick('.json,application/json',async f=>{if(f.size>20*1024*1024)throw Error('Sicherung ist zu groß.');window.receiveImport?.(await f.text());}),
  saveMonthlyProtocol:(month,raw)=>dl('Anlagenbuch-Monatsprotokoll-'+month+'.csv',raw,'text/csv;charset=utf-8'),saveGeneratedQr:async(id,name,y,x,matrix)=>dl('QR-'+String(name).replace(/[^A-Za-z0-9_-]/g,'_')+'.png',await qrPng(matrix),'image/png'),printQr:()=>window.print(),copyText:t=>navigator.clipboard.writeText(t),leave:()=>window.close(),
  scanQr:()=>window.webScanQr?.(),checkUpdates:()=>{emit('nativeMessage','Die Web-Version wird zentral aktualisiert. Beim nächsten Öffnen ist automatisch der aktuelle Stand verfügbar.');return true;},downloadUpdate:()=>false,
  requestFaultNotifications:()=>{if('Notification'in window&&Notification.permission==='default')Notification.requestPermission();return true;},testFaultSiren:()=>{const a=new Audio('stoerungssirene.mp3');a.play().catch(()=>emit('nativeMessage','Der Browser hat die Tonwiedergabe blockiert. Bitte einmal in die Seite klicken.'));return true;}
 };
 window.Native=Native;window.webMediaUrl=mediaUrl;
 window.FaultAlerts={notifyNewFaults:raw=>{try{const list=JSON.parse(raw||'[]');const a=new Audio('stoerungssirene.mp3');a.play().catch(()=>{});if('Notification'in window&&Notification.permission==='granted'&&list.length){const x=list[list.length-1],title='Neue Störung · '+(x.asset?.name||'Anlage'),body=x.fault?.description||'Neue Störung';if(navigator.serviceWorker?.controller)navigator.serviceWorker.controller.postMessage({type:'fault-notification',title,body,tag:'fault-'+(x.fault?.id||Date.now())});else navigator.serviceWorker?.ready.then(r=>r.showNotification(title,{body,icon:'/icon-192.png',badge:'/icon-192.png',tag:'fault-'+(x.fault?.id||Date.now()),renotify:true,requireInteraction:true})).catch(()=>new Notification(title,{body}));}return true;}catch(_){return false;}}};
 window.WidgetBridge={update:()=>true,pin:()=>{emit('nativeMessage','Die Web-Version verwendet die Übersicht direkt im Browser.');return true;}};
 window.addEventListener('offline',()=>{S?.setNeedsReconcile?.(true);emit('cloudChanged');});
 window.addEventListener('online',()=>setTimeout(()=>Native.retryCloud(),250));
 window.addEventListener('pagehide',()=>{if(currentRaw)S?.setStateRaw?.(currentRaw,{dirty:S?.isDirty?.()===true,localAt:S?.localAt?.()||Date.now()});});
})();
