'use strict';
(async()=>{
 const loading=document.getElementById('webLoading');
 const fail=msg=>{if(loading){loading.textContent=msg;loading.hidden=false;}};
 const S=window.OfflineStore;
 const scripts=['web-bridge-235.js','web-pdf-offline-239.js','seed-preview.js','btf-data.js','module1-data.js','annex-data.js','pump-unit-data.js','excel-unit-data.js','pump-serial-data-240.js','core.js','excel-unit-migration-235.js','pump-serial-migration-243.js','default-psa-migration-242.js','equipment.js','units-243.js','qrcode-runtime.js','app-243.js','batch-search.js','dropbox-ui.js','cloud.js','pool-links.js','handling-multi-235.js','global-sync-243.js','update-243.js','help-data.js','help-image-viewer.js','help.js','widget.js','settings-menu.js','web-ui-243.js'];
 async function loadScripts(){for(const src of scripts)await new Promise((resolve,reject)=>{const x=document.createElement('script');x.src=src+'?v=2.43';x.async=false;x.onload=resolve;x.onerror=()=>reject(Error(src+' konnte nicht geladen werden.'));document.body.appendChild(x);});}
 async function remoteBootstrap(){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),6000);
  try{const r=await fetch('/api/bootstrap?ts='+Date.now(),{cache:'no-store',credentials:'same-origin',signal:ac.signal});const j=await r.json().catch(()=>null);return {r,j};}finally{clearTimeout(timer);}
 }
 try{
  const localRaw=S?.getStateRaw?.()||'',dirty=!!S?.isDirty?.();
  let boot=null,offline=false,authExpired=false;
  if(navigator.onLine!==false){
   try{
    const {r,j}=await remoteBootstrap();
    if(r.status===401){if(!localRaw){location.replace('/login.html');return;}authExpired=true;throw Error('Sitzung abgelaufen');}
    if(!r.ok||!j?.ok)throw Error(j?.error||'Dropbox-Daten konnten nicht geladen werden.');
    boot=j;S?.cacheBootstrap?.(j);
    if(localRaw&&dirty){
     const remoteRaw=String(j.state||'');
     const baseRaw=S.getBaseRaw?.()||remoteRaw;
     const merged=remoteRaw?(S.mergeThreeWay?.(baseRaw,localRaw,remoteRaw)||localRaw):localRaw;
     boot.state=merged;
     if(remoteRaw){S.setBaseRaw?.(remoteRaw);S.setBaseAt?.(j.latestAt||0);}
     S.setStateRaw?.(merged,{dirty:true,localAt:S.localAt?.()||Date.now()});
     S.setNeedsReconcile?.(true);
     S.setSyncNote?.('Lokale Änderungen warten auf bestätigte Cloud-Synchronisierung.');
    }else if(j.state){
     const raw=String(j.state);S?.setStateRaw?.(raw,{dirty:false});S?.setBaseRaw?.(raw);S?.setBaseAt?.(j.latestAt||0);S?.markClean?.(raw,j.latestAt||0);S?.setUploadedAt?.(j.latestAt||0);
    }else if(localRaw){boot.state=localRaw;}
   }catch(e){offline=true;}
  }else offline=true;
  if(!boot){
   if(!localRaw)throw Error('Keine Internetverbindung und noch kein lokaler Anlagenbuch-Datenstand vorhanden. Bitte einmal mit Empfang öffnen.');
   const cached=S?.getBootstrap?.()||{};
   boot={ok:true,...cached,state:localRaw,offline:true,latestAt:S?.getUploadedAt?.()||S?.getBaseAt?.()||0,faultCursor:S?.getCursor?.('fault')||'',workCursor:S?.getCursor?.('work')||'',backupCursor:S?.getCursor?.('backup')||'',backups:cached.backups||[]};
  }
  window.__WEB_BOOTSTRAP__=boot;window.__WEB_OFFLINE_BOOTSTRAP__=offline;window.__WEB_AUTH_EXPIRED_OFFLINE__=authExpired;
  await loadScripts();
  if(loading)loading.hidden=true;
  if(offline&&window.toast)setTimeout(()=>toast(authExpired?'Offline-Modus: lokale Daten bleiben geschützt. Für die Synchronisierung später erneut anmelden.':'Offline-Modus aktiv · Änderungen bleiben lokal geschützt, bis Dropbox sie nachweislich übernommen hat.'),250);
 }catch(e){fail('Anlagenbuch konnte nicht gestartet werden: '+String(e?.message||e));}
})();
