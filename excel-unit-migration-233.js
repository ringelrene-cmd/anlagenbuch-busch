'use strict';
(function(root){
const VERSION=2;
const clone=x=>JSON.parse(JSON.stringify(x));
const norm=v=>String(v||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'');
const hasText=v=>String(v||'').trim()!=='';
function isKuerzelField(f){const label=String(f&&f.label||'').trim().toUpperCase().replace(/Ü/g,'U').replace(/UE/g,'U');return label==='KURZEL';}
function removeKuerzelFromAllUnits(state){let removed=0;for(const a of state.assets||[])for(const u of a.units||[]){if(!Array.isArray(u.customFields))continue;const before=u.customFields.length;u.customFields=u.customFields.filter(f=>!isKuerzelField(f));removed+=before-u.customFields.length;}return removed;}
function uniqueById(rows){const out=[],seen=new Set();for(const row of rows||[]){if(!row||!row.id||seen.has(row.id))continue;seen.add(row.id);out.push(clone(row));}return out;}
function mergedArray(matches,key){return uniqueById(matches.flatMap(u=>Array.isArray(u&&u[key])?u[key]:[]));}
function mergedPsa(matches){return [...new Set(matches.flatMap(u=>Array.isArray(u&&u.psaSigns)?u.psaSigns:[]).map(String).filter(Boolean))];}
function bestHandling(matches){for(const u of matches){const h=u&&u.handlingInstruction;if(h&&(hasText(h.text)||hasText(h.pdfName)||hasText(h.pdfUri)||hasText(h.libraryId)))return clone(h);}return {libraryId:'',text:'',pdfName:'',pdfUri:''};}
function bestSettingsText(matches){for(const u of matches)if(hasText(u&&u.settingsText))return String(u.settingsText);return '';}
function coordKnown(v){return v&&v!=='?'&&String(v).toLowerCase()!=='unbekannt';}
function idForAsset(tool){let h=2166136261;for(const c of norm(tool)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return 'excel-'+(h>>>0).toString(36);}
function findAsset(rows,toolKey){const candidates=rows.filter(a=>norm(a&&a.name)===toolKey);return candidates[0]||null;}
function patchReferences(state,asset,oldIds,newId,row){
 const old=new Set(oldIds.filter(Boolean));if(!old.size)return;
 if(Array.isArray(state.dailyBusiness))for(const d of state.dailyBusiness)if(d&&d.assetId===asset.id&&old.has(d.unitId))d.unitId=newId;
 for(const n of (asset.notes||[]))if(n&&old.has(n.unitId)){n.unitId=newId;n.unitName=row.unit;}
 for(const f of (asset.faults||[]))if(f&&old.has(f.unitId)){f.unitId=newId;f.unitName=row.unit;f.unitBarcode=('V-VA-'+asset.name+' '+row.unit).trim();f.unitPumpModel=row.pumpModel||'';}
}

function richness(u){return [u&&u.pumpModel,u&&u.type,u&&u.special,u&&u.serial,u&&u.barcode,...(Array.isArray(u&&u.customFields)?u.customFields.map(f=>f&&f.value):[])].filter(hasText).length;}
function dedupeLegacyUnits(state,asset){
 const rows=Array.isArray(asset.units)?asset.units:[],groups=new Map(),order=[];
 for(const u of rows){const k=norm(u&&u.name);if(!k){order.push({single:u});continue;}if(!groups.has(k)){groups.set(k,[]);order.push({key:k});}groups.get(k).push(u);}
 let removed=0;const out=[];
 for(const slot of order){if(slot.single){out.push(slot.single);continue;}const matches=groups.get(slot.key)||[];if(!matches.length)continue;if(matches.length===1){out.push(matches[0]);continue;}
  const first=matches[0],best=[...matches].sort((a,b)=>richness(b)-richness(a))[0]||first,merged={...clone(best),id:first.id};
  merged.parts=mergedArray(matches,'parts');merged.hours=mergedArray(matches,'hours');merged.notes=mergedArray(matches,'notes');merged.handlingInstruction=bestHandling(matches);merged.settingsText=bestSettingsText(matches);merged.psaSigns=mergedPsa(matches);
  const oldIds=matches.map(u=>u&&u.id).filter(Boolean);patchReferences(state,asset,oldIds,merged.id,{unit:merged.name,pumpModel:merged.pumpModel||''});out.push(merged);removed+=matches.length-1;
 }
 asset.units=out;return removed;
}
function canonicalUnit(row,matches){
 const first=matches[0]||{}, id=first.id||row.id;
 return {
  ...clone(first),
  id,
  name:row.unit,
  pumpModel:row.pumpModel||'',
  type:'',special:'',serial:'',
  barcode:row.barcode||'',
  fieldConfig:{
   name:{label:'Unit',visible:true},
   pumpModel:{label:'Type',visible:true},
   type:{label:'Typ',visible:false},
   special:{label:'Special',visible:false},
   serial:{label:'Seriennummer',visible:false},
   barcode:{label:'QR_Code',visible:true}
  },
  customFields:clone(row.customFields||[]).filter(f=>!isKuerzelField(f)),
  settingsText:bestSettingsText(matches),
  parts:mergedArray(matches,'parts'),
  hours:mergedArray(matches,'hours'),
  handlingInstruction:bestHandling(matches),
  notes:mergedArray(matches,'notes'),
  psaSigns:mergedPsa(matches)
 };
}
root.migrateExcelUnits=function(input){
 const C=root.AppCore,next=C.clone(input);if(Number(next.excelUnitSeedVersion||0)>=VERSION)return {state:next,changed:false,replaced:0,addedUnits:0,addedAssets:0,removedDuplicates:0,removedKuerzel:0};
 const rows=Array.isArray(root.EXCEL_UNIT_DATA)?root.EXCEL_UNIT_DATA:[];if(!rows.length)return {state:next,changed:false,replaced:0,addedUnits:0,addedAssets:0,removedDuplicates:0,removedKuerzel:0};
 const pending='Noch nicht vorhanden';if(!next.modules.includes(pending))next.modules.push(pending);
 let replaced=0,addedUnits=0,addedAssets=0,removedDuplicates=0;
 const grouped=new Map();for(const r of rows){if(!r||!r.toolKey||!r.unitKey)continue;if(!grouped.has(r.toolKey))grouped.set(r.toolKey,[]);grouped.get(r.toolKey).push(r);}
 for(const [toolKey,toolRows] of grouped){
  let asset=findAsset(next.assets,toolKey);
  if(!asset){const src=toolRows[0];asset={id:idForAsset(src.tool),name:String(src.tool||'').trim()||src.toolKey,module:pending,y:coordKnown(src.y)?String(src.y):'?',x:coordKnown(src.x)?String(src.x):'?',verified:false,pumpModel:'',notes:[],...C.equipment()};next.assets.push(asset);addedAssets++;}
  const firstRow=toolRows[0];
  if(asset.module!=='Noch nicht vorhanden'&&firstRow.module&&firstRow.module!=='unbekannt'&&next.modules.includes(firstRow.module))asset.module=firstRow.module;
  if(coordKnown(firstRow.x))asset.x=String(firstRow.x);if(coordKnown(firstRow.y))asset.y=String(firstRow.y);
  if(!Array.isArray(asset.units))asset.units=[];
  for(const row of toolRows){
   const matches=asset.units.filter(u=>norm(u&&u.name)===row.unitKey),oldIds=matches.map(u=>u.id).filter(Boolean);
   const unit=canonicalUnit(row,matches);
   if(matches.length){replaced++;if(matches.length>1)removedDuplicates+=matches.length-1;}else addedUnits++;
   asset.units=asset.units.filter(u=>norm(u&&u.name)!==row.unitKey);asset.units.push(unit);
   patchReferences(next,asset,oldIds,unit.id,row);
  }
 }
 for(const asset of next.assets)removedDuplicates+=dedupeLegacyUnits(next,asset);
 const removedKuerzel=removeKuerzelFromAllUnits(next);
 next.excelUnitSeedVersion=VERSION;next.excelUnitSeedImportedAt='2026-09-26';next.excelUnitSeedSource=(root.EXCEL_UNIT_IMPORT_META&&root.EXCEL_UNIT_IMPORT_META.source)||'Excel';
 return {state:next,changed:true,replaced,addedUnits,addedAssets,removedDuplicates,removedKuerzel};
};
})(window);
