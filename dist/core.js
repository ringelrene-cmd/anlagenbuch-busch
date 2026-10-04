(function(root){
'use strict';
const clone=x=>JSON.parse(JSON.stringify(x));
const emptySettings=()=>({inlet:null,lines:[1,2,3].map(i=>({name:'Leitung '+i,value:null,unit:'bar'})),heaters:[{id:'heat-1',name:'Abgasrohr',value:null}],hint:''});
const emptyHandling=()=>({text:'',pdfName:'',pdfUri:'',libraryId:''});
const defaultSitePlan=()=>({imageName:'Lageplan Gelände.jpeg',imageUri:'asset-image://bundled/lageplan-gelaende.jpeg'});
const equipment=()=>({parts:[],hours:[],settings:emptySettings(),settingsHistory:[],handlingInstruction:emptyHandling(),faults:[],units:[]});
function decimal(raw,allowNegative=false){const t=String(raw).trim();if(!t)return null;if(!/^-?\d+(?:[.,]\d+)?$/.test(t))throw Error('Bitte eine Zahl eingeben, z. B. 1,5.');const n=Number(t.replace(',','.'));if(!Number.isFinite(n)||(!allowNegative&&n<0))throw Error('Bitte einen gültigen, nicht negativen Wert eingeben.');return n;}
function validate(s){
 if(!s||![1,2,3,4,5,6].includes(s.version)||!Array.isArray(s.modules)||!Array.isArray(s.assets)||!s.modules.length||s.modules.length>1000||s.assets.length>20000)throw Error('Keine gültige Anlagen-Sicherung.');
 s=clone(s);if(s.version===1){s.assets=s.assets.map(a=>({...a,...equipment()}));s.version=2;}if(s.version===2){s.instructionLibrary=[];for(const a of s.assets){if(a.handlingInstruction===undefined)a.handlingInstruction=emptyHandling();if(a.handlingInstruction.libraryId===undefined)a.handlingInstruction.libraryId='';}s.version=3;}if(s.version===3){s.sitePlan=defaultSitePlan();s.version=4;}if(s.version===4){for(const a of s.assets){for(const n of (a.notes||[])){if(n.workType===undefined)n.workType='sonstiges';if(n.technicians===undefined)n.technicians='';}}s.version=5;}if(s.version===5){for(const a of s.assets){if(!Array.isArray(a.faults))a.faults=[];}s.version=6;}if(s.workSyncMeta===undefined)s.workSyncMeta={};if(!s.workSyncMeta||typeof s.workSyncMeta!=='object'||Array.isArray(s.workSyncMeta)||Object.keys(s.workSyncMeta).length>100000)throw Error('Ungültige Synchronisierungsdaten.');if(s.faultSyncMeta===undefined)s.faultSyncMeta={};if(!s.faultSyncMeta||typeof s.faultSyncMeta!=='object'||Array.isArray(s.faultSyncMeta)||Object.keys(s.faultSyncMeta).length>100000)throw Error('Ungültige Störungs-Synchronisierungsdaten.');if(!Array.isArray(s.instructionLibrary)||s.instructionLibrary.length>1000)throw Error('Ungültige Anleitungsbibliothek.');
 const str=(x,n)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
 const optional=(x,n)=>typeof x==='string'&&x.length<=n;
 const pdfUri=x=>!x||x.startsWith('content://')||x.startsWith('app-pdf://backup/')||x.startsWith('web-pdf://temp/');
 const imageUri=x=>typeof x==='string'&&(x.startsWith('content://')||x.startsWith('app-image://backup/')||x.startsWith('web-image://temp/')||x.startsWith('asset-image://bundled/'));
 const number=(x,negative=false)=>typeof x==='number'&&Number.isFinite(x)&&(negative||x>=0);
 for(const [noteId,m] of Object.entries(s.workSyncMeta)){if(!str(noteId,100)||!m||typeof m!=='object'||Array.isArray(m)||!number(m.at)||!str(m.eventId,100)||typeof m.deleted!=='boolean'||!optional(m.assetId||'',100))throw Error('Ungültige Synchronisierungsdaten.');}for(const [faultId,m] of Object.entries(s.faultSyncMeta)){if(!str(faultId,100)||!m||typeof m!=='object'||Array.isArray(m)||!number(m.at)||!str(m.eventId,100)||typeof m.deleted!=='boolean'||!optional(m.assetId||'',100))throw Error('Ungültige Störungs-Synchronisierungsdaten.');}
 const value=(x,negative=false)=>x===null||number(x,negative);
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 function settings(v){
  if(!v||!value(v.inlet)||!Array.isArray(v.lines)||v.lines.length>100||!Array.isArray(v.heaters)||v.heaters.length>100||!optional(v.hint||'',10000))throw Error('Ungültige Anlagenwerte.');
  if(v.assetValues!==undefined){
   if(!Array.isArray(v.assetValues)||v.assetValues.length>100)throw Error('Ungültige Anlagenwerte.');
   const aids=new Set();for(const a of v.assetValues){if(!a||!str(a.id,100)||aids.has(a.id)||!str(a.label,100)||!optional(a.value===undefined||a.value===null?'':String(a.value),200)||!optional(a.unit||'',40))throw Error('Ungültiger Anlagenwert.');aids.add(a.id);}
  }
  const lids=new Set();for(const l of v.lines){if(!l||!str(l.name,100)||!value(l.value)||!optional(l.unit||'',40))throw Error('Ungültiger Leitungs-Sollwert oder Einheit.');if(l.id!==undefined){if(!str(String(l.id),100)||lids.has(String(l.id)))throw Error('Ungültiger oder doppelter Leitungswert.');lids.add(String(l.id));}}
  const ids=new Set();for(const h of v.heaters){if(!h||!str(h.id,100)||ids.has(h.id)||!str(h.name,100)||!value(h.value,true))throw Error('Ungültige Begleitheizung.');ids.add(h.id);}
 }
 function list(items,limit,check){if(!Array.isArray(items)||items.length>limit)throw Error('Ungültige Anlagen-Einträge.');const ids=new Set();for(const e of items){if(!e||!str(e.id,100)||ids.has(e.id)||!check(e))throw Error('Ungültiger oder doppelter Eintrag.');ids.add(e.id);}}
 if(s.modules.some(m=>!str(m,100))||new Set(s.modules).size!==s.modules.length)throw Error('Ungültige Module.');
 if(!s.sitePlan||typeof s.sitePlan!=='object'||Array.isArray(s.sitePlan))s.sitePlan=defaultSitePlan();
 else{const def=defaultSitePlan();if(!optional(s.sitePlan.imageName,500))s.sitePlan.imageName=def.imageName;if(!s.sitePlan.imageName.trim())s.sitePlan.imageName=def.imageName;if(!imageUri(s.sitePlan.imageUri)||s.sitePlan.imageUri.length>5000)s.sitePlan.imageUri=def.imageUri;}
 if(!optional(s.sitePlan.imageName,500)||!imageUri(s.sitePlan.imageUri)||s.sitePlan.imageUri.length>5000)throw Error('Ungültiger Lageplan.');
 const libIds=new Set();for(const i of s.instructionLibrary){if(!i||!str(i.id,100)||libIds.has(i.id)||!str(i.title,200)||!optional(i.pumpModel,200)||!optional(i.text,50000)||!optional(i.pdfName,500)||!optional(i.pdfUri,5000)||!pdfUri(i.pdfUri))throw Error('Ungültiger Eintrag in der Anleitungsbibliothek.');libIds.add(i.id);}
 const ids=new Set();
 for(const a of s.assets){
  if(a.pumpModel===undefined)a.pumpModel='';if(a.units===undefined)a.units=[];
  if(a.handlingInstruction===undefined)a.handlingInstruction=emptyHandling();if(a.handlingInstruction.libraryId===undefined)a.handlingInstruction.libraryId='';if(a.faults===undefined)a.faults=[];
  if(typeof a.pumpModel!=='string'||a.pumpModel.length>200)throw Error('Ungültiges Pumpenmodell.');
  for(const u of a.units){if(u.fieldConfig===undefined)u.fieldConfig={};if(!u.fieldConfig||typeof u.fieldConfig!=='object'||Array.isArray(u.fieldConfig))throw Error('Ungültige Unit-Feldkonfiguration.');for(const k of ['name','pumpModel','type','special','serial','barcode']){const x=u.fieldConfig[k];if(x!==undefined&&(!x||!str(x.label,100)||typeof x.visible!=='boolean'))throw Error('Ungültige Unit-Feldkonfiguration.');}if(u.psaSigns===undefined)u.psaSigns=[];if(!Array.isArray(u.psaSigns)||u.psaSigns.length>50||u.psaSigns.some(x=>typeof x!=='string'||x.length>40))throw Error('Ungültige Unit-PSA-Daten.');if(u.customFields===undefined)u.customFields=[];if(!Array.isArray(u.customFields)||u.customFields.length>100)throw Error('Ungültige Unit-Zusatzfelder.');const cfids=new Set();for(const f of u.customFields){if(!f||!str(f.id,100)||cfids.has(f.id)||!str(f.label,100)||!optional(f.value||'',1000))throw Error('Ungültiges Unit-Zusatzfeld.');cfids.add(f.id);}}
  list(a.units,10000,u=>str(u.name,100)&&optional(u.pumpModel||'',200)&&optional(u.type||'',200)&&optional(u.special||'',200)&&optional(u.serial||'',200)&&optional(u.barcode||'',300));
  const hi=a.handlingInstruction;if(!hi||!optional(hi.text,50000)||!optional(hi.pdfName,500)||!optional(hi.pdfUri,5000)||!optional(hi.libraryId,100)||!pdfUri(hi.pdfUri)||(hi.libraryId&&!libIds.has(hi.libraryId)))throw Error('Ungültige Hantierungsanweisung.');
  if(!a||!str(a.id,100)||ids.has(a.id)||!str(a.name,100)||!s.modules.includes(a.module)||!str(a.y,20)||!str(a.x,20)||typeof a.verified!=='boolean'||!Array.isArray(a.notes)||a.notes.length>5000)throw Error('Ungültige Anlage.');
  ids.add(a.id);
  const ns=new Set();for(const n of a.notes){if(n.workType===undefined)n.workType='sonstiges';if(n.technicians===undefined)n.technicians='';if(!n||!str(n.id,100)||ns.has(n.id)||!str(n.text,10000)||!/^\d{4}-\d{2}-\d{2}$/.test(n.date)||!Number.isFinite(Date.parse(n.date))||!['stoerung','turnus','sonstiges'].includes(n.workType)||!optional(n.technicians,500))throw Error('Ungültiger Notizeintrag.');ns.add(n.id);}
  if(!Array.isArray(a.faults)||a.faults.length>5000)throw Error('Ungültige Störungsdaten.');const fs=new Set();for(const f of a.faults){if(!f||!str(f.id,100)||fs.has(f.id)||!date(f.reportedDate)||!str(f.reportedAt,40)||!Number.isFinite(Date.parse(f.reportedAt))||!str(f.updatedAt,40)||!Number.isFinite(Date.parse(f.updatedAt))||!str(f.reportedBy,500)||!str(f.description,10000)||!['open','in_progress','resolved'].includes(f.status)||!optional(f.assignedTo||'',500)||!optional(f.resolvedAt||'',40)||((f.resolvedAt||'')&&!Number.isFinite(Date.parse(f.resolvedAt)))||!optional(f.resolutionNoteId||'',100))throw Error('Ungültiger Störungseintrag.');fs.add(f.id);}
  list(a.parts,5000,p=>str(p.name,200)&&optional(p.number,200)&&number(p.quantity)&&optional(p.note,10000));
  list(a.hours,5000,h=>number(h.value)&&date(h.date)&&optional(h.note,10000));
  settings(a.settings);
  list(a.settingsHistory,5000,h=>{if(!str(h.author,100)||!str(h.at,40)||!Number.isFinite(Date.parse(h.at)))return false;settings(h.values);return true;});
 }
 return clone(s);
}
function seed(text){return validate({version:1,modules:['Modul 2'],assets:text.trim().split(/\r?\n/).filter(l=>l.trim()).map((l,i)=>{const [name,y,x]=l.trim().split(/\s+/);return{id:'m2-'+i,name,module:'Modul 2',y,x,verified:false,notes:[]};})});}
const norm=s=>s.toUpperCase().replace(/\s+/g,'');
function search(s,q,m='',only=false){const terms=String(q||'').split(/[;,\n]+/).map(norm).filter(Boolean);const hit=(a,v)=>norm(a.name).includes(v)||(a.units||[]).some(u=>[u.name,`${a.name} ${u.name}`,`V-VA-${a.name} ${u.name}`,u.pumpModel,u.type,u.special,u.serial,u.barcode,...((u.customFields||[]).flatMap(f=>[f.label,f.value]))].some(x=>norm(String(x||'')).includes(v)));return s.assets.filter(a=>(!m||a.module===m)&&(!only||!a.verified)&&(!terms.length||terms.some(v=>hit(a,v)))).sort((a,b)=>{const exactA=terms.some(v=>norm(a.name)===v),exactB=terms.some(v=>norm(b.name)===v);return exactA===exactB?a.name.localeCompare(b.name,'de',{numeric:true}):exactA?-1:1;});}
root.AppCore={validate,seed,search,clone,equipment,emptySettings,emptyHandling,defaultSitePlan,decimal};if(typeof module!=='undefined')module.exports=root.AppCore;
})(typeof window==='undefined'?globalThis:window);
