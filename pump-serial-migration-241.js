'use strict';
(function(root){
const VERSION=2;
const norm=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'');
const hasText=v=>String(v||'').trim()!=='';
function ensureSerialField(u){
 if(!u.fieldConfig||typeof u.fieldConfig!=='object'||Array.isArray(u.fieldConfig))u.fieldConfig={};
 const old=u.fieldConfig.serial;
 if(!old){u.fieldConfig.serial={label:'Seriennummer',visible:true};return true;}
 let changed=false;
 const next={...old};
 if(!String(next.label||'').trim()){next.label='Seriennummer';changed=true;}
 if(next.visible!==true){next.visible=true;changed=true;}
 if(changed)u.fieldConfig.serial=next;
 return changed;
}
root.migratePumpSerials241=function(input){
 const C=root.AppCore,next=C.clone(input);
 if(Number(next.pumpSerialSeedVersion||0)>=VERSION)return {state:next,changed:false,imported:0,visibleEnabled:0,keptExisting:0,unmatched:0};
 const rows=Array.isArray(root.PUMP_SERIAL_DATA)?root.PUMP_SERIAL_DATA:[];
 const map=new Map(rows.map(r=>[norm(r.tool)+'|'+norm(r.unit),r]));
 let changed=false,imported=0,visibleEnabled=0,keptExisting=0,unmatched=0;
 for(const a of next.assets||[]){
  for(const u of a.units||[]){
   if(ensureSerialField(u)){changed=true;visibleEnabled++;}
   const r=map.get(norm(a.name)+'|'+norm(u.name));
   if(!r){unmatched++;continue;}
   if(hasText(u.serial)){keptExisting++;continue;}
   u.serial=String(r.serial||'').trim();
   if(u.serial){changed=true;imported++;}
  }
 }
 next.pumpSerialSeedVersion=VERSION;
 next.pumpSerialSeedImportedAt='2026-09-26';
 next.pumpSerialSeedSource=(root.PUMP_SERIAL_IMPORT_META&&root.PUMP_SERIAL_IMPORT_META.source)||'Pumpenbezeichnung.xlsx';
 changed=true;
 return {state:next,changed,imported,visibleEnabled,keptExisting,unmatched};
};
})(window);
