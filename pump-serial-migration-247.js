(function(root){
'use strict';
const VERSION=5;
const norm=v=>String(v||'').trim().toUpperCase().replace(/^V-VA-\s*/,'').replace(/[^A-Z0-9]+/g,'');
const hasText=v=>String(v||'').trim()!=='';
function ensureSerialField(u){
 if(!u.fieldConfig||typeof u.fieldConfig!=='object'||Array.isArray(u.fieldConfig))u.fieldConfig={};
 const old=u.fieldConfig.serial;
 if(!old){u.fieldConfig.serial={label:'Seriennummer',visible:true};return true;}
 let changed=false;const next={...old};
 if(!String(next.label||'').trim()){next.label='Seriennummer';changed=true;}
 if(next.visible!==true){next.visible=true;changed=true;}
 if(changed)u.fieldConfig.serial=next;
 return changed;
}
root.migratePumpSerials247=function(input){
 const C=root.AppCore,next=C.clone(input),rows=Array.isArray(root.PUMP_SERIAL_DATA_247)?root.PUMP_SERIAL_DATA_247:[];
 const map=new Map(rows.map(r=>[norm(r.tool)+'|'+norm(r.unit),r]));
 let changed=false,imported=0,corrected=0,visibleEnabled=0,manualProtected=0,unmatched=0,unchanged=0;
 for(const a of next.assets||[])for(const u of a.units||[]){
  if(ensureSerialField(u)){changed=true;visibleEnabled++;}
  const r=map.get(norm(a.name)+'|'+norm(u.name));
  if(u.serialManual===true){manualProtected++;if(Number(u.serialSeedVersion||0)<VERSION){u.serialSeedVersion=VERSION;changed=true;}continue;}
  if(r&&hasText(r.serial)){
   const desired=String(r.serial).trim(),current=String(u.serial||'').trim();
   if(current!==desired){if(current)corrected++;else imported++;u.serial=desired;changed=true;}else unchanged++;
  }else unmatched++;
  if(Number(u.serialSeedVersion||0)!==VERSION){u.serialSeedVersion=VERSION;changed=true;}
 }
 if(Number(next.pumpSerialSeedVersion||0)!==VERSION){next.pumpSerialSeedVersion=VERSION;changed=true;}
 next.pumpSerialSeedImportedAt='2026-09-26';
 next.pumpSerialSeedSource='Pumpenbezeichnung.xlsx · Spalte H → Spalte F';
 return {state:next,changed,imported,corrected,visibleEnabled,manualProtected,unmatched,unchanged};
};
})(window);
