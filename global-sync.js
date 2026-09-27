'use strict';
(function(){
const SYNC_VERSION=1;
const POLL_MS=10000;
let lastFingerprint='', scanTimer=0, pollTimer=0, listBusy=false, restoreBusy=false, pendingRemote=null, suppressLocal=false, localPushTimer=0, lastPushStarted=0;

function metaOf(s){
 if(!s.globalSyncMeta||typeof s.globalSyncMeta!=='object'||Array.isArray(s.globalSyncMeta))s.globalSyncMeta={version:SYNC_VERSION,seenDropboxAt:0,lastLocalAt:0,lastUploadAt:0,lastEventId:''};
 const m=s.globalSyncMeta;
 if(!Number.isFinite(Number(m.seenDropboxAt)))m.seenDropboxAt=0;
 if(!Number.isFinite(Number(m.lastLocalAt)))m.lastLocalAt=0;
 if(!Number.isFinite(Number(m.lastUploadAt)))m.lastUploadAt=0;
 if(typeof m.lastEventId!=='string')m.lastEventId='';
 m.version=SYNC_VERSION;
 return m;
}
function normalizedForCompare(src){
 const s=C.clone(src);
 delete s.globalSyncMeta;const handlingDeletes=s.handlingSyncMeta?.deleted||{};s.handlingSyncMeta={deleted:handlingDeletes};delete s.workSyncMeta;delete s.faultSyncMeta;
 if(s.sitePlan&&typeof s.sitePlan.imageUri==='string'&&s.sitePlan.imageUri.startsWith('app-image://backup/'))s.sitePlan.imageUri='app-image://backup/__LOCAL__';
 for(const i of (s.instructionLibrary||[]))if(i&&typeof i.pdfUri==='string'&&i.pdfUri.startsWith('app-pdf://backup/'))i.pdfUri='app-pdf://backup/__LOCAL__';
 for(const a of (s.assets||[]))if(a&&a.handlingInstruction&&typeof a.handlingInstruction.pdfUri==='string'&&a.handlingInstruction.pdfUri.startsWith('app-pdf://backup/'))a.handlingInstruction.pdfUri='app-pdf://backup/__LOCAL__';
 return s;
}
function fingerprint(s){try{return JSON.stringify(normalizedForCompare(s));}catch(_){return '';}}
function reconcileHandlingDeletes(local,remote){return PoolLinks.merge(local,remote);}
function status(){try{return backupStatus();}catch(_){return null;}}
function saveMeta(mut){try{const s=C.clone(state),m=metaOf(s);mut(m);s.globalSyncMeta=m;suppressLocal=true;const ok=persist(s);suppressLocal=false;if(ok)lastFingerprint=fingerprint(state);return ok;}catch(_){suppressLocal=false;return false;}}
function pushNow(){
 if(!window.Native||!Native.makeBackup)return;
 clearTimeout(localPushTimer);
 if(window.__fastFaultSyncUntil&&Date.now()<window.__fastFaultSyncUntil){localPushTimer=setTimeout(pushNow,Math.max(250,window.__fastFaultSyncUntil-Date.now()+100));return;}
 try{
  const before=status();
  if(before&&(before.pending||before.busy)){localPushTimer=setTimeout(pushNow,800);return;}
  const now=Date.now();
  if(lastPushStarted&&now-lastPushStarted<600){localPushTimer=setTimeout(pushNow,600-(now-lastPushStarted));return;}
  lastPushStarted=now;
  const t=Date.now(),eid=t.toString(36)+'-'+Math.random().toString(36).slice(2);
  saveMeta(m=>{m.lastLocalAt=t;m.lastEventId=eid;});
  Native.makeBackup(JSON.stringify(state));
  const st=status();if(st&&st.online&&Native.retryCloud)setTimeout(()=>{try{Native.retryCloud();}catch(_){}},250);
 }catch(_){ }
}
function detectLocalChange(force=false){
 if(suppressLocal)return;
 const fp=fingerprint(state);if(!lastFingerprint){lastFingerprint=fp;return;}
 if(fp===lastFingerprint)return;
 lastFingerprint=fp;
 clearTimeout(localPushTimer);localPushTimer=setTimeout(pushNow,force?0:180);
}
window.globalSyncPushNow=()=>{detectLocalChange(true);};

function applyRemoteSnapshot(remote,dropboxAt){
 try{
  const knownFaultIds=new Set();for(const a of state.assets||[])for(const f of a.faults||[])if(f&&f.id)knownFaultIds.add(f.id);
  const incomingFingerprint=fingerprint(remote);
  remote=mergeFaultHistory(remote,state);
  remote=reconcileHandlingDeletes(C.clone(state),remote);
  const needsMergeUpload=incomingFingerprint!==fingerprint(remote);
  if(typeof migrateModule1==='function')remote=migrateModule1(remote).state;
  if(typeof migrateAnnex==='function')remote=migrateAnnex(remote).state;
  remote=C.validate(remote);
  const localFp=fingerprint(state),remoteFp=fingerprint(remote);
  if(localFp===remoteFp){if(JSON.stringify(state.faultSyncMeta||{})!==JSON.stringify(remote.faultSyncMeta||{})){const next=C.clone(state);next.faultSyncMeta=C.clone(remote.faultSyncMeta||{});suppressLocal=true;const ok=persist(next);suppressLocal=false;if(!ok)return false;}if(needsMergeUpload)setTimeout(pushNow,250);saveMeta(m=>{m.seenDropboxAt=Math.max(Number(m.seenDropboxAt)||0,dropboxAt||0);});return false;}
  const st=status();
  if(st&&(st.pending||st.busy)){setTimeout(pollRemote,1000);return false;}
  const next=C.clone(remote),rm=metaOf(next),lm=metaOf(C.clone(state));
  rm.seenDropboxAt=Math.max(Number(rm.seenDropboxAt)||0,Number(lm.seenDropboxAt)||0,dropboxAt||0);
  rm.lastUploadAt=Math.max(Number(rm.lastUploadAt)||0,Number(lm.lastUploadAt)||0);
  next.globalSyncMeta=rm;
  suppressLocal=true;const ok=persist(next);suppressLocal=false;
  if(!ok)return false;
  lastFingerprint=fingerprint(state);render();refreshFaultOverview();
  const newFaults=[];for(const a of state.assets||[])for(const f of a.faults||[])if(f&&f.id&&!knownFaultIds.has(f.id)&&f.status==='open')newFaults.push({asset:a,fault:f});
  if(window.alertNewFaultsOnce)window.alertNewFaultsOnce(newFaults);
  if(needsMergeUpload)setTimeout(pushNow,250);
  toast('Änderungen eines Kollegen wurden automatisch übernommen.');
  return true;
 }catch(_){suppressLocal=false;return false;}
}


window.applyMergedWebState=raw=>{
 try{
  let next=C.validate(JSON.parse(String(raw||'')));
  if(typeof migrateModule1==='function')next=migrateModule1(next).state;
  if(typeof migrateAnnex==='function')next=migrateAnnex(next).state;
  next=C.validate(next);
  suppressLocal=true;const ok=persist(next);suppressLocal=false;
  if(!ok)return false;
  lastFingerprint=fingerprint(state);render();refreshFaultOverview();
  return true;
 }catch(_){suppressLocal=false;return false;}
};

const previousBackups=window.dropboxBackups;
const previousReady=window.dropboxBackupReady;
window.dropboxBackups=r=>{
 try{
  // Keep the Cloud dialog current without starting the old handling-only restore path.
  window.dropboxRemoteState={loading:false,backups:r&&Array.isArray(r.backups)?r.backups:[],error:r&&r.error||'',restoring:false};
  if($('cloudPanel')&&$('modal').open&&typeof paintDropboxPanel==='function')paintDropboxPanel(backupStatus());
  listBusy=false;
  if(!r||r.error||!Array.isArray(r.backups)||!r.backups.length)return;
  const b=[...r.backups].sort((a,z)=>(Number(z.at)||0)-(Number(a.at)||0))[0];
  const m=metaOf(C.clone(state)),seen=Number(m.seenDropboxAt)||0,at=Number(b.at)||0;
  if(!b.path||at<=seen+250)return;
  const st=status();if(st&&(st.pending||st.busy)){setTimeout(pollRemote,1000);return;}
  pendingRemote={path:b.path,at};restoreBusy=true;window.__manualDropboxRestore=false;window.dropboxRemoteState.restoring=true;
  Native.restoreDropboxBackup(b.path);
 }catch(_){listBusy=false;restoreBusy=false;pendingRemote=null;}
};
window.dropboxBackupReady=r=>{
 if(!restoreBusy){
  if(window.__manualDropboxRestore){window.__manualDropboxRestore=false;if(previousReady)previousReady(r);}
  return;
 }
 restoreBusy=false;window.dropboxRemoteState.restoring=false;
 const p=pendingRemote;pendingRemote=null;
 try{
  if(!r||r.error||!r.id){setTimeout(pollRemote,1800);return;}
  const raw=Native.readBackup(r.id),remote=JSON.parse(raw);
  applyRemoteSnapshot(remote,p&&p.at||Date.now());
 }catch(_){setTimeout(pollRemote,1800);}
};

function pollRemote(){
 clearTimeout(pollTimer);
 try{
  detectLocalChange();
  if(!window.Native||!Native.refreshDropboxBackups){pollTimer=setTimeout(pollRemote,POLL_MS);return;}
  const st=status();
  if(!st||!st.signedIn||!st.online||restoreBusy||listBusy){pollTimer=setTimeout(pollRemote,POLL_MS);return;}
  if(st.pending||st.busy){if(Native.retryCloud)try{Native.retryCloud();}catch(_){}pollTimer=setTimeout(pollRemote,1000);return;}
  listBusy=true;Native.refreshDropboxBackups();
  setTimeout(()=>{listBusy=false;},1800);
 }catch(_){listBusy=false;}
 pollTimer=setTimeout(pollRemote,POLL_MS);
}
const previousCloudChanged=window.cloudChanged;
window.cloudChanged=()=>{
 if(previousCloudChanged)previousCloudChanged();
 try{const st=status();if(st&&st.uploadedAt)saveMeta(m=>{m.lastUploadAt=Math.max(Number(m.lastUploadAt)||0,Number(st.uploadedAt)||0);m.seenDropboxAt=Math.max(Number(m.seenDropboxAt)||0,Number(st.uploadedAt)||0);});}catch(_){}
 setTimeout(pollRemote,200);
};
window.addEventListener('online',()=>{try{if(window.Native&&Native.retryCloud)Native.retryCloud();}catch(_){}setTimeout(pollRemote,300);});
window.addEventListener('focus',()=>setTimeout(pollRemote,150));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(pollRemote,150);});
scanTimer=setInterval(()=>detectLocalChange(false),250);
setTimeout(()=>{metaOf(state);lastFingerprint=fingerprint(state);if(window.module1MigrationChanged)setTimeout(pushNow,600);pollRemote();},300);
})();

