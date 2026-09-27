'use strict';
(function(){
// Web 2.34: the web bridge is the only owner of full-snapshot synchronization.
// This file only provides UI state application + an explicit push hook. The old
// automatic Dropbox restore loop was removed because it could race an offline commit.
function knownOpenFaultIds(){const s=new Set();try{for(const a of state.assets||[])for(const f of a.faults||[])if(f&&f.id&&f.status==='open')s.add(f.id);}catch(_){}return s;}
window.applyMergedWebState=raw=>{
 try{
  const before=knownOpenFaultIds();
  let next=C.validate(JSON.parse(String(raw||'')));
  if(typeof migrateModule1==='function')next=migrateModule1(next).state;
  if(typeof migrateAnnex==='function')next=migrateAnnex(next).state;
  if(typeof migrateExcelUnits==='function')next=migrateExcelUnits(next).state;
  if(typeof migrateModules234==='function')next=migrateModules234(next).state;
  if(typeof migratePumpSerials241==='function')next=migratePumpSerials241(next).state;
  if(typeof migrateDefaultPsa242==='function')next=migrateDefaultPsa242(next).state;
  next=C.validate(next);
  const ok=persist(next);if(!ok)return false;
  render();refreshFaultOverview();
  const newFaults=[];for(const a of state.assets||[])for(const f of a.faults||[])if(f&&f.id&&!before.has(f.id)&&f.status==='open')newFaults.push({asset:a,fault:f});
  if(newFaults.length&&window.alertNewFaultsOnce)window.alertNewFaultsOnce(newFaults);
  return true;
 }catch(_){return false;}
};
window.globalSyncPushNow=()=>{try{if(window.Native&&Native.makeBackup)Native.makeBackup(JSON.stringify(state));}catch(_){} };
})();
