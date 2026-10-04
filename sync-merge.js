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
