(function(root){
'use strict';
const VERSION=4;
const norm=v=>String(v||'').trim().toUpperCase().replace(/^V-VA-\s*/,'').replace(/[^A-Z0-9]+/g,'');
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
root.migratePumpSerials244=function(input){
 const C=root.AppCore,next=C.clone(input);
 const rows=Array.isArray(root.PUMP_SERIAL_DATA)?root.PUMP_SERIAL_DATA:[];
 const map=new Map(rows.map(r=>[norm(r.tool)+'|'+norm(r.unit),r]));
 let changed=false,imported=0,visibleEnabled=0,keptExisting=0,unmatched=0,alreadySeeded=0,manualProtected=0;
 for(const a of next.assets||[]){
  for(const u of a.units||[]){
   if(ensureSerialField(u)){changed=true;visibleEnabled++;}
   const r=map.get(norm(a.name)+'|'+norm(u.name));
   const unitSeed=Number(u.serialSeedVersion||0);
   // Eine spätere bewusste Benutzeränderung (auch Leeren) darf nie durch den Excel-Import ersetzt werden.
   if(u.serialManual===true){manualProtected++;if(unitSeed<VERSION){u.serialSeedVersion=VERSION;changed=true;}continue;}
   if(hasText(u.serial)){
    keptExisting++;
    if(unitSeed<VERSION){u.serialSeedVersion=VERSION;changed=true;}
    continue;
   }
   // 2.44 repariert ausdrücklich die leeren Felder aus 2.40-2.43 erneut.
   // Erst nach diesem Durchlauf gilt VERSION=4 als abgeschlossen.
   if(unitSeed>=VERSION){alreadySeeded++;continue;}
   if(r&&hasText(r.serial)){
    u.serial=String(r.serial).trim();
    imported++;
   }else unmatched++;
   u.serialSeedVersion=VERSION;
   changed=true;
  }
 }
 if(Number(next.pumpSerialSeedVersion||0)<VERSION){next.pumpSerialSeedVersion=VERSION;changed=true;}
 next.pumpSerialSeedImportedAt='2026-09-26';
 next.pumpSerialSeedSource=(root.PUMP_SERIAL_IMPORT_META&&root.PUMP_SERIAL_IMPORT_META.source)||'Pumpenbezeichnung.xlsx';
 return {state:next,changed,imported,visibleEnabled,keptExisting,unmatched,alreadySeeded,manualProtected};
};
})(window);
