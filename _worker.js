// Anlagenbuch 3.28 – Cloudflare Pages advanced-mode Worker
// core.js
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

// sync-merge.js
(function(root){
'use strict';
const copy=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const same=(a,b)=>{
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((x,i)=>same(x,b[i]));
 if(object(a)&&object(b)){const k=Object.keys(a);return k.length===Object.keys(b).length&&k.every(x=>Object.hasOwn(b,x)&&same(a[x],b[x]));}
 return false;
};
const forbidden=new Set(['__proto__','constructor','prototype']);
function merge(base,local,remote){
 const conflicts=[];
 function walk(b,l,r,path){
  if(same(l,b))return copy(r);
  if(same(r,b)||same(l,r))return copy(l);
  if(path.length===1&&['globalSyncMeta','faultSyncMeta','workSyncMeta','handlingSyncMeta'].includes(path[0]))return copy(r);
  if(path.at(-1)==='updatedAt'&&typeof l===typeof r&&['string','number'].includes(typeof l))return l>r?l:r;
  if(object(l)&&object(r)&&(object(b)||b===undefined)){
   const out={};for(const k of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){
    if(forbidden.has(k))throw Error('Ungültiger Feldname.');
    const v=walk(b?.[k],l[k],r[k],[...path,k]);if(v!==undefined)out[k]=v;
   }return out;
  }
  if(Array.isArray(l)&&Array.isArray(r)&&(Array.isArray(b)||b===undefined)){
   const all=[...(b||[]),...l,...r];
   if(all.every(x=>object(x)&&typeof x.id==='string')){
    const map=a=>{const m=new Map();for(const x of a||[]){if(m.has(x.id))throw Error('Doppelte Datensatz-ID.');m.set(x.id,x);}return m;};
    const bm=map(b),lm=map(l),rm=map(r),out=[];
    for(const id of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const v=walk(bm.get(id),lm.get(id),rm.get(id),[...path,{id}]);if(v!==undefined)out.push(v);}return out;
   }
   // Tagesgeschäft hatte historisch keine id. Für den Geräteabgleich wird jeder
   // Eintrag deshalb stabil über Datum + Anlage + Unit identifiziert. Dadurch
   // können verschiedene Rechner Einträge hinzufügen/erledigen/löschen, ohne
   // dass die komplette Tagesliste als ein Konflikt behandelt wird.
   if(path.at(-1)==='dailyBusiness'&&all.every(x=>object(x)&&typeof x.date==='string'&&typeof x.assetId==='string'&&typeof x.unitId==='string')){
    const key=x=>x.date+'\u0000'+x.assetId+'\u0000'+x.unitId;
    const map=a=>{const m=new Map();for(const x of a||[]){const k=key(x);if(m.has(k))throw Error('Doppelter Tagesgeschäft-Eintrag.');m.set(k,x);}return m;};
    const bm=map(b),lm=map(l),rm=map(r),out=[];
    for(const id of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const v=walk(bm.get(id),lm.get(id),rm.get(id),[...path,{id,key:'dailyBusiness'}]);if(v!==undefined)out.push(v);}return out;
   }
   // Ältere Änderungsverläufe können ebenfalls noch ohne id vorliegen.
   if(path.at(-1)==='settingsHistory'&&all.every(x=>object(x)&&typeof x.at==='string'&&typeof x.author==='string')){
    const key=x=>x.at+'\u0000'+x.author;
    const map=a=>{const m=new Map();for(const x of a||[]){const k=key(x);if(m.has(k))throw Error('Doppelter Änderungsverlauf.');m.set(k,x);}return m;};
    const bm=map(b),lm=map(l),rm=map(r),out=[];
    for(const id of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const v=walk(bm.get(id),lm.get(id),rm.get(id),[...path,{id,key:'settingsHistory'}]);if(v!==undefined)out.push(v);}return out;
   }
   if(all.every(x=>object(x)&&typeof x.name==='string')&&[b||[],l,r].every(a=>new Set(a.map(x=>x.name)).size===a.length)){
    const bm=new Map((b||[]).map(x=>[x.name,x])),lm=new Map(l.map(x=>[x.name,x])),rm=new Map(r.map(x=>[x.name,x])),out=[];
    for(const id of new Set([...rm.keys(),...lm.keys(),...bm.keys()])){const v=walk(bm.get(id),lm.get(id),rm.get(id),[...path,{id,key:'name'}]);if(v!==undefined)out.push(v);}return out;
   }
   if(all.every(x=>typeof x==='string')){
    const bs=new Set(b||[]),ls=new Set(l),rs=new Set(r);
    return [...new Set([...r,...l])].filter(x=>bs.has(x)?ls.has(x)&&rs.has(x):true);
   }
  }
  conflicts.push({path,base:copy(b),local:copy(l),remote:copy(r),localMissing:l===undefined,remoteMissing:r===undefined});
  return copy(r); // Conflicts never silently replace a colleague's value.
 }
 return {state:walk(base,local,remote,[]),conflicts};
}
function resolve(state,path,value,missing){
 const out=copy(state);let node=out;
 for(let i=0;i<path.length-1;i++){const key=path[i];node=typeof key==='object'?node.find(x=>x[key.key||'id']===key.id):node[key];if(node===undefined)throw Error('Datensatz wurde inzwischen entfernt.');}
 const key=path.at(-1);if(typeof key==='object'){const at=node.findIndex(x=>x[key.key||'id']===key.id);if(missing){if(at>=0)node.splice(at,1);}else if(at<0)node.push(copy(value));else node[at]=copy(value);}
 else {if(forbidden.has(key))throw Error('Ungültiger Feldname.');if(missing)delete node[key];else node[key]=copy(value);}
 return out;
}
function delta(a,b,path=[],out=[]){
 if(same(a,b))return out;
 if(object(a)&&object(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(forbidden.has(k))throw Error('Ungültiger Feldname.');delta(a[k],b[k],[...path,k],out);}return out;}
 if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length){for(let i=0;i<a.length;i++)delta(a[i],b[i],[...path,i],out);return out;}
 out.push({path,value:copy(b),missing:b===undefined});return out;
}
function patch(base,changes){let out=copy(base);for(const c of changes){if(!c.path.length){out=copy(c.value);continue;}let node=out;for(const k of c.path.slice(0,-1))node=node[k];const k=c.path.at(-1);if(forbidden.has(k))throw Error('Ungültiger Feldname.');if(c.missing)delete node[k];else node[k]=copy(c.value);}return out;}
function pack(d){const x={...d,packed:1,localDelta:delta(d.base,d.local)};delete x.local;if(d.conflictRemote){x.remoteDelta=delta(d.base,d.conflictRemote);delete x.conflictRemote;}if(d.pending)x.pending={id:d.pending.id,baseDelta:delta(d.base,d.pending.base),localDelta:delta(d.base,d.pending.local)};return JSON.stringify(x);}
function unpack(raw){if(!raw)return null;const x=JSON.parse(raw);if(!x.packed)return x;x.local=patch(x.base,x.localDelta);if(x.remoteDelta)x.conflictRemote=patch(x.base,x.remoteDelta);if(x.pending)x.pending={id:x.pending.id,base:patch(x.base,x.pending.baseDelta),local:patch(x.base,x.pending.localDelta)};delete x.packed;delete x.localDelta;delete x.remoteDelta;return x;}
root.SyncMerge={merge,same,copy,resolve,pack,unpack};
})(typeof window==='undefined'?globalThis:window);

// server/onedrive.js
const GRAPH='https://graph.microsoft.com/v1.0';
class OneDrive {
 constructor(env,storage){this.env=env;this.storage=storage;this.cached=null;}
 async token(){
  if(this.cached?.until>Date.now()+60000)return this.cached.value;
  const e=this.env;
  for(const k of ['ONEDRIVE_CLIENT_ID','ONEDRIVE_REFRESH_TOKEN','ONEDRIVE_DRIVE_ID','ONEDRIVE_FOLDER_ID'])if(!e[k])throw Object.assign(Error('OneDrive-Einrichtung fehlt: '+k),{status:503});
  const tokenKey='refresh-token-'+(e.ONEDRIVE_TOKEN_VERSION||'1');
  const refresh=await this.storage?.get(tokenKey)||e.ONEDRIVE_REFRESH_TOKEN;
  const body=new URLSearchParams({client_id:e.ONEDRIVE_CLIENT_ID,refresh_token:refresh,grant_type:'refresh_token',scope:'https://graph.microsoft.com/Files.ReadWrite offline_access'});
  const r=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',body,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Object.assign(Error('OneDrive-Serveranmeldung fehlgeschlagen ('+r.status+').'),{status:503});
  const j=await r.json();if(j.refresh_token)await this.storage?.put(tokenKey,j.refresh_token);this.cached={value:j.access_token,until:Date.now()+j.expires_in*1000};return j.access_token;
 }
 path(name){if(!/^[A-Za-z0-9._-]+$/.test(name)||name==='.'||name==='..')throw Error('Ungültiger Dateiname.');return '/drives/'+encodeURIComponent(this.env.ONEDRIVE_DRIVE_ID)+'/items/'+encodeURIComponent(this.env.ONEDRIVE_FOLDER_ID)+':/'+name;}
 async request(path,opt={}){
  const r=await fetch(GRAPH+path,{...opt,headers:{Authorization:'Bearer '+await this.token(),...opt.headers},signal:AbortSignal.timeout(20000)});
  if(!r.ok){const e=Object.assign(Error('OneDrive-Anfrage fehlgeschlagen ('+r.status+').'),{status:r.status===404?404:503,retryAfter:r.headers.get('Retry-After')||'30'});if(r.status===429)e.status=429;throw e;}return r;
 }
 async get(name){try{return new Uint8Array(await(await this.request(this.path(name)+':/content')).arrayBuffer());}catch(e){if(e.status===404)return null;throw e;}}
 async exists(name){try{await this.request(this.path(name));return true;}catch(e){if(e.status===404)return false;throw e;}}
 async put(name,bytes){return (await this.request(this.path(name)+':/content',{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes})).json();}
 async read(name){const b=await this.get(name);return b?JSON.parse(new TextDecoder().decode(b)):null;}
 async write(name,data){return this.put(name,new TextEncoder().encode(JSON.stringify(data)));}
}

// server/coordinator.js



const M=globalThis.SyncMerge;
const response=(j,status=200)=>new Response(JSON.stringify(j),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const empty=()=>({schema:1,revision:0,state:null,receipts:{}});
class Coordinator {
 constructor(store){this.store=store;this.knownMedia=new Set();}
 async read(){return await this.store.read('state.json')||empty();}
 async mediaPresent(s){
  const refs=new Set();const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image|content):/.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(s);
  const names=[...refs].map(mediaName).filter(n=>!this.knownMedia.has(n));
  for(let i=0;i<names.length;i+=6)await Promise.all(names.slice(i,i+6).map(async name=>{if(!(this.store.exists?await this.store.exists(name):await this.store.get(name)))throw Error('Zugeordnete Datei fehlt in OneDrive: '+name+'. Zuerst Medien migrieren.');this.knownMedia.add(name);}));
 }
 async handle(req){
  const u=new URL(req.url),path=u.pathname;
  if(path==='/api/media/upload'&&req.method==='POST'){
   const kind=u.searchParams.get('kind');if(!['pdf','image'].includes(kind))throw Error('Ungültiger Medientyp.');
   const bytes=new Uint8Array(await req.arrayBuffer());if(!bytes.length||bytes.length>50*1024*1024)throw Error('Datei leer oder größer als 50 MB.');
   const name=decodeURIComponent(req.headers.get('X-File-Name')||'Datei');const ext=kind==='pdf'?'pdf':(name.match(/\.(png|jpe?g|webp)$/i)?.[1]||'jpg').toLowerCase();
   if(kind==='pdf'&&!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('Ungültige PDF-Datei.');
   const file=crypto.randomUUID()+'.'+ext;await this.store.put('media-'+file,bytes);return response({ok:true,uri:'web-'+kind+'://temp/'+file,name});
  }
  if(path==='/api/media'&&req.method==='GET'){
   const uri=u.searchParams.get('uri'),name=mediaName(uri);let bytes=await this.store.get(name);
   // OneDrive-Migration: Falls bei der OneDrive-Migration nur der Datenstand/Backup vorhanden ist,
   // eine fehlende Mediendatei automatisch aus dem letzten Backup zurückholen.
   if(!bytes){
    const backup=await this.store.read('backup-latest.json');const encoded=backup?.media?.[uri];
    if(typeof encoded==='string'&&encoded){try{bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(bytes.length)await this.store.put(name,bytes);}catch(_){bytes=null;}}
   }
   if(!bytes)return response({error:'Datei fehlt im gemeinsamen OneDrive-Speicher. PDF auf einem Gerät mit vorhandener Offline-Kopie einmal öffnen.'},404);
   const ext=name.split('.').pop();return new Response(bytes,{headers:{'Content-Type':ext==='pdf'?'application/pdf':ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg','Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'}});
  }
  if(path==='/api/backup/read'&&req.method==='GET'){const b=await this.store.read('backup-latest.json');if(!b)return response({error:'Noch kein Backup vorhanden.'},404);return response({ok:true,backup:b});}
  if(path==='/api/backup/media'&&req.method==='POST'){
   const {media}=await req.json();let total=0;for(const [uri,data] of Object.entries(media||{})){const name=mediaName(uri);if(typeof data!=='string')throw Error('Ungültige Mediendaten.');total+=data.length;if(total>84*1024*1024)throw Error('Dateien zu groß.');const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),existing=await this.store.get(name);if(existing){if(existing.length!==bytes.length||existing.some((v,i)=>v!==bytes[i]))throw Error('Datei-ID enthält abweichende Daten. Wiederherstellung abgebrochen.');}else await this.store.put(name,bytes);}return response({ok:true});
  }
  const doc=await this.read();
  if(path==='/api/bootstrap'&&req.method==='GET')return response({ok:true,state:doc.state?JSON.stringify(doc.state):'',revision:doc.revision,latestAt:doc.at||0});
  if(path==='/api/health'&&req.method==='GET')return response({ok:true,onedrive:true,initialized:!!doc.state,revision:doc.revision});
  if(path==='/api/companion/status'&&req.method==='GET'){
   const open=[],progress=[];for(const a of doc.state?.assets||[])for(const f of a.faults||[]){const row={id:f.id,assetId:a.id,assetName:a.name,description:f.description,reportedAt:f.reportedAt,unitName:f.unitBarcode||f.unitName||''};if(f.status==='open')open.push(row);if(f.status==='in_progress')progress.push(row);}
   // Formatiere das Datum unabhaengig vom Locale in YYYY-MM-DD.
   // Intl 'en-CA'.format() kann auf verschiedenen Laufzeitumgebungen auch MM/DD/YYYY liefern;
   // der lexikografische Vergleich mit Tagesgeschaeft-Daten im ISO-Format ergibt dann immer 0.
   const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
   const today=`${parts.year}-${parts.month}-${parts.day}`;
   const allToday=Array.isArray(doc.state?.dailyBusiness)?doc.state.dailyBusiness:[];
   const activeToday=allToday.filter(r=>r&&r.done!==true&&typeof r.date==='string'&&r.date<=today); // Alle unerledigten Tagesgeschaefte bleiben bis zur Erledigung offen, unabhaengig vom Datum.
   return response({ok:true,serverTime:Date.now(),revision:Number(doc.revision||0),openCount:open.length,progressCount:progress.length,todayCount:activeToday.length,dailyBusinessTotal:allToday.length,dailyBusinessOpen:allToday.filter(r=>r&&!r.done).length,serverTodayDate:today,openFaultIds:open.map(x=>x.id),openFaults:open.slice(-20),latestAt:doc.at||0});
  }
  if(path==='/api/sync'&&req.method==='POST'){
   const body=await req.json();if(typeof body.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(body.id))throw Error('Ungültige Vorgangs-ID.');
   if(doc.receipts[body.id])return response({ok:true,state:doc.state,revision:doc.revision,at:doc.at});
   const local=AppCore.validate(body.local),base=body.base===null?null:AppCore.validate(body.base);
   if(!doc.state&&!this.store.allowInitialize)return response({error:'Migration noch nicht freigegeben. ONEDRIVE_ALLOW_INITIALIZE einmalig aktivieren.'},409);
   if(doc.state&&!base)return response({error:'Lokaler Ausgangsstand fehlt. Vor der Migration den lokalen Bestand sichern und abgleichen.'},409);
   // 2.91: Konflikte blockieren nicht mehr die gesamte Transaktion. SyncMerge setzt
   // an Konfliktstellen bewusst den vorhandenen Zentralwert ein, enthält aber alle
   // unabhängigen lokalen Änderungen. Diese konfliktfreien Teile werden sofort
   // gespeichert; nur die widersprüchlichen Felder bleiben zur Auswahl offen.
   const merged=doc.state?M.merge(base,local,doc.state):{state:local,conflicts:[]};
   const next=AppCore.validate(merged.state);await this.mediaPresent(next);
   if(merged.conflicts.length){
    let revision=doc.revision,at=doc.at||Date.now(),state=doc.state;
    if(!M.same(next,doc.state)){
     revision=doc.revision+1;at=Date.now();state=next;
     await this.store.write('state.json',{...doc,state,revision,at});
    }
    return response({ok:false,error:'Widersprüchliche Änderungen bitte auswählen. Andere Änderungen wurden bereits synchronisiert.',conflicts:merged.conflicts,state,revision,at},409);
   }
   const receipt={state:next,revision:doc.revision+1,at:Date.now()};
   // Receipt and state share one OneDrive write: lost responses can safely retry.
   // An offline client may retry long after 200 other edits. Keep its receipt,
   // otherwise a delayed retry could resurrect a record deleted in the meantime.
   doc.receipts[body.id]={revision:receipt.revision};
   await this.store.write('state.json',{...doc,...receipt});return response({ok:true,...receipt});
  }
  if(path==='/api/backup'&&req.method==='POST'){
   const supplied=await req.clone().json();
   if(supplied.backup){
    const b=supplied.backup;if(b.format!=='anlagenbuch-backup-v1'||!Number.isFinite(b.at))throw Error('Ungültiges Backup.');AppCore.validate(b.state);
    const refs=new Set();const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image):/.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(b.state);
    let total=0;for(const uri of refs){mediaName(uri);if(typeof b.media?.[uri]!=='string')throw Error('Backup unvollständig: '+uri);total+=b.media[uri].length;if(total>84*1024*1024)throw Error('Backup zu groß.');atob(b.media[uri]);}
    const previous=await this.store.read('backup-latest.json');if(previous&&previous.at>b.at)return response({ok:true,superseded:true});
    await this.store.write('backup-latest.json',b);return response({ok:true});
   }
   const body=await req.json();if(!doc.state||body.revision!==doc.revision)return response({error:'Datenstand hat sich geändert. Bitte erneut sichern.'},409);
   const media={};const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image):/.test(x))media[x]=null;else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(doc.state);
   let total=0;for(const uri of Object.keys(media)){const name=mediaName(uri),b=await this.store.get(name);if(!b)throw Error('Backup abgebrochen: Datei fehlt '+name);total+=b.length;if(total>60*1024*1024)throw Error('Backup größer als 60 MB. Administrator muss das Speicherlimit erweitern.');let str='';for(let i=0;i<b.length;i+=8192)str+=String.fromCharCode(...b.slice(i,i+8192));media[uri]=btoa(str);}
   const backup={format:'anlagenbuch-backup-v1',at:Date.now(),revision:doc.revision,state:doc.state,media};await this.store.write('backup-latest.json',backup);return response({ok:true,backup});
  }
  return response({error:'API-Endpunkt nicht verfügbar.',path},404);
 }
}
function mediaName(uri){
 const u=new URL(uri),bits=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
 if(['web-pdf:','web-image:'].includes(u.protocol)&&u.hostname==='temp'&&bits.length===1&&/^[A-Za-z0-9._-]+$/.test(bits[0]))return 'media-'+bits[0];
 if(['app-pdf:','app-image:'].includes(u.protocol)&&u.hostname==='backup'&&bits.length===2&&bits.every(x=>/^[A-Za-z0-9._-]+$/.test(x)))return 'legacy-'+bits.join('--');
 throw Error('Dateiverweis muss vor der Umstellung migriert werden: '+uri);
}
class AnlagenbuchSync {
 constructor(ctx,env){const store=new OneDrive(env,ctx.storage);store.allowInitialize=env.ONEDRIVE_ALLOW_INITIALIZE==='true';this.engine=new Coordinator(store);this.queue=Promise.resolve();}
 fetch(req){const job=this.queue.then(()=>this.engine.handle(req));this.queue=job.catch(()=>{});return job.catch(e=>{const r=response({error:e.message},e.status||400);if(e.retryAfter)r.headers.set('Retry-After',e.retryAfter);return r;});}
}


// server/gateway.js
const enc=new TextEncoder();
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
async function hmac(password,text){const key=await crypto.subtle.importKey('raw',enc.encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text)));return [...sig].map(b=>b.toString(16).padStart(2,'0')).join('');}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const p of raw.split(';')){const [k,...v]=p.trim().split('=');if(k===name)return v.join('=');}return'';}
async function authorized(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return false;const t=cookie(req,'ab_session'),m=t.match(/^(\d+)\.([0-9a-f]{64})$/);if(!m||Number(m[1])<Date.now())return false;return (await hmac(pw,m[1]))===m[2];}

async function companionAuthorized(req,env){
 const pw=String(env.WEB_PASSWORD||'');
 const got=String(req.headers.get('X-Anlagenbuch-Password')||'');
 if(pw&&got===pw)return true; // Upgrade compatibility with existing 2.32 and 2.21 companions.
 const token=String(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 return verifySignedDeviceToken(token,env,'device');
}
function randomId(){const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function issueSignedDeviceToken(env,type,duration){
 const pw=String(env.WEB_PASSWORD||'');if(!pw)throw Error('WEB_PASSWORD fehlt');
 const exp=Date.now()+duration,nonce=randomId(),payload=[type,exp,nonce].join('.');
 return payload+'.'+await hmac(pw,'companion-v304:'+payload);
}
async function verifySignedDeviceToken(token,env,type){
 const pw=String(env.WEB_PASSWORD||''),m=String(token||'').match(/^(device|pair)\.(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/);
 if(!pw||!m||m[1]!==type)return false;
 const exp=Number(m[2]);if(!Number.isFinite(exp)||exp<Date.now()||exp>Date.now()+366*86400000)return false;
 const raw=m[1]+'.'+m[2]+'.'+m[3];
 return (await hmac(pw,'companion-v304:'+raw))===m[4];
}
async function persistentSessionCookie(env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return'';const maxAge=365*24*3600,exp=Date.now()+maxAge*1000,t=exp+'.'+await hmac(pw,String(exp));return `ab_session=${t}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;}
async function companionHandoffUrl(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)throw Error('WEB_PASSWORD ist noch nicht eingerichtet.');const exp=Date.now()+90000,sig=await hmac(pw,'handoff:'+exp),u=new URL('/companion-auth','https://anlagenbuch-busch.pages.dev/');u.searchParams.set('token',exp+'.'+sig);return u.toString();}
async function verifyCompanionHandoff(token,env){const pw=String(env.WEB_PASSWORD||''),m=String(token||'').match(/^(\d+)\.([0-9a-f]{64})$/);if(!pw||!m)return false;const exp=Number(m[1]),now=Date.now();if(!Number.isFinite(exp)||exp<now||exp>now+120000)return false;return (await hmac(pw,'handoff:'+m[1]))===m[2];}
async function login(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return json({ok:false,error:'WEB_PASSWORD ist noch nicht eingerichtet.'},503);let body;try{body=await req.json();}catch(_){return json({ok:false,error:'Ungültige Anmeldung.'},400);}if(String(body.password||'')!==pw)return json({ok:false,error:'Passwort ist nicht richtig.'},401);return json({ok:true},200,{'Set-Cookie':await persistentSessionCookie(env)});}

async function gateway(req,env){
 const u=new URL(req.url),p=u.pathname;
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('Origin');if(origin&&origin!==u.origin)return json({error:'Fremder Ursprung.'},403);}
 if(p==='/api/version')return json({ok:true,version:'3.28',provider:'onedrive'});
 // Pairing is only authorized through the existing authenticated web session.
 if(p==='/api/companion/device-token'&&req.method==='GET'){
  if(!await authorized(req,env))return json({error:'Bitte einmal in der Web-App anmelden.'},401);
  return json({ok:true,token:await issueSignedDeviceToken(env,'device',365*86400000)});
 }
 if(p==='/api/companion/pair-code'&&req.method==='GET'){
  if(!await authorized(req,env))return json({error:'Bitte einmal in der Web-App anmelden.'},401);
  return json({ok:true,code:await issueSignedDeviceToken(env,'pair',60000)});
 }
 if(p==='/api/companion/device-exchange'&&req.method==='POST'){
  let data={};try{data=await req.json();}catch(_){return json({error:'Ungültiger Verbindungscode.'},400)}
  if(!await verifySignedDeviceToken(data.code,env,'pair'))return json({error:'Verbindungscode abgelaufen.'},401);
  return json({ok:true,token:await issueSignedDeviceToken(env,'device',365*86400000)});
 }

 if(p==='/api/login'&&req.method==='POST')return login(req,env);
 if(p==='/companion-auth'){
  if(!await verifyCompanionHandoff(u.searchParams.get('token'),env))return json({error:'Ungültiger Begleiter-Zugang.'},401);
  return new Response(null,{status:302,headers:{Location:'/app.html?v=3.28', 'Set-Cookie':await persistentSessionCookie(env),'Cache-Control':'no-store'}});
 }
 if(p==='/api/companion/handoff'&&req.method==='GET'){
  if(!await companionAuthorized(req,env))return json({error:'Anmeldung erforderlich.'},401);
  return json({ok:true,url:await companionHandoffUrl(req,env)});
 }
 const companion=p==='/api/companion/status'&&req.method==='GET';
 if(!(companion?await companionAuthorized(req,env):await authorized(req,env)))return json({error:'Anmeldung erforderlich. Lokale Änderungen bleiben gespeichert.'},401);
 if(p==='/api/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':'ab_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});
 if(!env.SYNC)return json({error:'OneDrive-Koordinator noch nicht eingerichtet.'},503);
 const sync=env.SYNC.get(env.SYNC.idFromName('anlagenbuch-main'));
 if(companion){
  // Same central snapshot that the web client fetches through /api/bootstrap.
  // Do not call an older Durable Object /api/companion/status implementation.
  const bootstrapUrl=new URL(req.url);bootstrapUrl.pathname='/api/bootstrap';
  const source=await sync.fetch(new Request(bootstrapUrl.toString(),{method:'GET'}));
  if(!source.ok)return source;
  let loaded;
  try{loaded=await source.json();}catch(_){return json({error:'Ungültiger Anlagen-Datenstand.'},502);}
  let state;
  try{state=typeof loaded.state==='string'?(loaded.state?JSON.parse(loaded.state):null):loaded.state;}
  catch(_){return json({error:'Anlagen-Datenstand konnte nicht gelesen werden.'},502);}
  const faultsOpen=[],faultsProgress=[];
  for(const asset of (state?.assets||[]))for(const fault of (asset?.faults||[])){
   const row={id:fault.id,assetId:asset.id,assetName:asset.name,description:fault.description,reportedAt:fault.reportedAt,unitName:fault.unitBarcode||fault.unitName||''};
   if(fault.status==='open')faultsOpen.push(row);
   else if(fault.status==='in_progress')faultsProgress.push(row);
  }
  const now=new Date();
  const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'});
  const parts=Object.fromEntries(fmt.formatToParts(now).filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`;
  const daily=Array.isArray(state?.dailyBusiness)?state.dailyBusiness:[];
  // Exact web-app rule: today or older, not marked done. Never reset at midnight.
  const unfinished=daily.filter(r=>r&&r.done!==true&&typeof r.date==='string'&&r.date<=today);
  return json({ok:true,serverTime:Date.now(),revision:Number(loaded.revision||0),openCount:faultsOpen.length,progressCount:faultsProgress.length,todayCount:unfinished.length,openFaultIds:faultsOpen.map(x=>x.id),openFaults:faultsOpen.slice(-20),latestAt:loaded.latestAt||0});
 }
 return sync.fetch(req);
}


export {AnlagenbuchSync};
export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')||path==='/companion-auth'){
   try{return await gateway(request,env);}catch(e){return json({error:'Serverfehler: '+String(e?.message||e)},e?.status||500);}
  }
  return env.ASSETS.fetch(request);
 }
};
