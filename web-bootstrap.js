'use strict';
(async()=>{
 const loading=document.getElementById('webLoading');
 const fail=msg=>{if(loading){loading.textContent=msg;loading.hidden=false;}};
 const S=window.OfflineStore;
 const scripts=['web-bridge.js','seed-preview.js','btf-data.js','module1-data.js','annex-data.js','pump-unit-data.js','core.js','equipment.js','units.js','qrcode-runtime.js','app.js','batch-search.js','dropbox-ui.js','cloud.js','pool-links.js','handling-multi.js','global-sync.js','update.js','help-data.js','help-image-viewer.js','help.js','widget.js','settings-menu.js','web-ui.js'];
 async function loadScripts(){for(const src of scripts)await new Promise((resolve,reject)=>{const x=document.createElement('script');x.src=src+'?v=2.30';x.async=false;x.onload=resolve;x.onerror=()=>reject(Error(src+' konnte nicht geladen werden.'));document.body.appendChild(x);});}
 async function remoteBootstrap(){
  const ac=new AbortController(),timer=setTimeout(()=>ac.abort(),4500);
  try{const r=await fetch('/api/bootstrap',{cache:'no-store',credentials:'same-origin',signal:ac.signal});const j=await r.json().catch(()=>null);return {r,j};}finally{clearTimeout(timer);}
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
     const baseRaw=S.getBaseRaw?.()||'';
     const merged=S.mergeThreeWay?.(baseRaw,localRaw,String(j.state||''))||localRaw;
     boot.state=merged;S.setStateRaw?.(merged,{dirty:true});S.setNeedsReconcile?.(true);
    }else if(j.state){
     const raw=String(j.state);S?.setStateRaw?.(raw,{dirty:false});S?.setBaseRaw?.(raw);S?.markClean?.(raw);
    }else if(localRaw){boot.state=localRaw;}
   }catch(e){offline=true;}
  }else offline=true;
  if(!boot){
   if(!localRaw)throw Error('Keine Internetverbindung und noch kein lokaler Anlagenbuch-Datenstand vorhanden. Bitte einmal mit Empfang öffnen.');
   boot={ok:true,...(S?.getBootstrap?.()||{}),state:localRaw,offline:true,latestAt:S?.getUploadedAt?.()||0,faultCursor:S?.getCursor?.('fault')||'',workCursor:S?.getCursor?.('work')||'',backupCursor:S?.getCursor?.('backup')||'',backups:(S?.getBootstrap?.()?.backups)||[]};
  }
  window.__WEB_BOOTSTRAP__=boot;window.__WEB_OFFLINE_BOOTSTRAP__=offline;window.__WEB_AUTH_EXPIRED_OFFLINE__=authExpired;
  await loadScripts();
  if(loading)loading.hidden=true;
  if(offline&&window.toast)setTimeout(()=>toast(authExpired?'Offline-Modus: lokale Daten bleiben verfügbar. Für die Cloud-Synchronisierung später erneut anmelden.':'Offline-Modus aktiv · Änderungen werden lokal gespeichert und später automatisch synchronisiert.'),250);
 }catch(e){fail('Anlagenbuch konnte nicht gestartet werden: '+String(e?.message||e));}
})();
