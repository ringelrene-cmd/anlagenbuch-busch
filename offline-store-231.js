'use strict';
(()=>{
 // Keep the 2.30 namespace intentionally: existing offline data must survive the 2.31 update.
 const P='anlagenbuch-web-v230-';
 const K={state:P+'state',base:P+'base',dirty:P+'dirty',localAt:P+'localAt',bootstrap:P+'bootstrap',reconcile:P+'reconcile',faultQ:P+'faultQueue',workQ:P+'workQueue',faultCursor:P+'faultCursor',workCursor:P+'workCursor',backupCursor:P+'backupCursor',uploadedAt:P+'uploadedAt',baseAt:P+'baseAt',syncNote:P+'syncNote'};
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const eq=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return false;}};
 const get=k=>{try{return localStorage.getItem(k);}catch(_){return null;}};
 const set=(k,v)=>{try{localStorage.setItem(k,String(v));return true;}catch(_){return false;}};
 const del=k=>{try{localStorage.removeItem(k);}catch(_){} };
 function parse(raw,fallback=null){try{return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
 function stableKey(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  for(const k of ['id','eventId','code','key'])if((typeof v[k]==='string'||typeof v[k]==='number')&&String(v[k]))return k+':'+String(v[k]);
  return null;
 }
 function keyedArray(a){return Array.isArray(a)&&a.every(x=>stableKey(x));}
 function merge3(base,local,remote){
  if(eq(local,base))return clone(remote);
  if(eq(remote,base))return clone(local);
  if(local===undefined)return undefined;
  if(base===undefined)return clone(local);
  if(remote===undefined)return clone(local);
  const ta=Array.isArray(base),tl=Array.isArray(local),tr=Array.isArray(remote);
  if(ta||tl||tr){
   if(!(ta&&tl&&tr))return clone(local);
   if(keyedArray(base)&&keyedArray(local)&&keyedArray(remote)){
    const bm=new Map(base.map(x=>[stableKey(x),x])),lm=new Map(local.map(x=>[stableKey(x),x])),rm=new Map(remote.map(x=>[stableKey(x),x]));
    const order=[];for(const x of remote){const k=stableKey(x);if(!order.includes(k))order.push(k);}for(const x of local){const k=stableKey(x);if(!order.includes(k))order.push(k);}for(const x of base){const k=stableKey(x);if(!order.includes(k))order.push(k);}
    const out=[];
    for(const k of order){
     const b=bm.get(k),l=lm.get(k),r=rm.get(k);
     if(l===undefined&&b!==undefined)continue;
     if(l!==undefined&&b===undefined){out.push(clone(l));continue;}
     if(l===undefined&&b===undefined){if(r!==undefined)out.push(clone(r));continue;}
     const m=merge3(b,l,r);if(m!==undefined)out.push(m);
    }
    return out;
   }
   // For unkeyed arrays a local offline edit wins. This avoids a stale remote list replacing user input.
   return clone(local);
  }
  const ob=base&&typeof base==='object',ol=local&&typeof local==='object',or=remote&&typeof remote==='object';
  if(ob||ol||or){
   if(!(ob&&ol&&or))return clone(local);
   const out={},keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]);
   for(const k of keys){
    const hasB=Object.prototype.hasOwnProperty.call(base,k),hasL=Object.prototype.hasOwnProperty.call(local,k),hasR=Object.prototype.hasOwnProperty.call(remote,k);
    if(!hasL&&hasB)continue;
    if(hasL&&!hasB){out[k]=clone(local[k]);continue;}
    if(!hasL&&!hasB){if(hasR)out[k]=clone(remote[k]);continue;}
    const m=merge3(base[k],local[k],hasR?remote[k]:undefined);if(m!==undefined)out[k]=m;
   }
   return out;
  }
  return clone(local);
 }
 const api={
  keys:K,
  getStateRaw:()=>get(K.state)||'',
  setStateRaw:(raw,opts={})=>{raw=String(raw||'');if(raw&&!set(K.state,raw))return false;if(opts.dirty===true)set(K.dirty,'1');if(opts.dirty===false)set(K.dirty,'0');if(opts.localAt)set(K.localAt,opts.localAt);return true;},
  getBaseRaw:()=>get(K.base)||'',setBaseRaw:raw=>raw?set(K.base,raw):false,
  getBaseAt:()=>Number(get(K.baseAt)||0),setBaseAt:v=>set(K.baseAt,Number(v)||0),
  isDirty:()=>get(K.dirty)==='1',
  markDirty:()=>{set(K.dirty,'1');set(K.localAt,Date.now());},
  markClean:(raw,at)=>{if(raw)set(K.base,raw);if(at)set(K.baseAt,Number(at)||0);set(K.dirty,'0');set(K.reconcile,'0');set(K.syncNote,'');},
  localAt:()=>Number(get(K.localAt)||0),needsReconcile:()=>get(K.reconcile)==='1',setNeedsReconcile:v=>set(K.reconcile,v?'1':'0'),
  setSyncNote:v=>set(K.syncNote,String(v||'')),getSyncNote:()=>get(K.syncNote)||'',
  cacheBootstrap:j=>{try{const c={...j};delete c.state;set(K.bootstrap,JSON.stringify(c));}catch(_){}},getBootstrap:()=>parse(get(K.bootstrap),{}),
  getCursor:type=>get(type==='fault'?K.faultCursor:type==='work'?K.workCursor:K.backupCursor)||'',
  setCursor:(type,v)=>set(type==='fault'?K.faultCursor:type==='work'?K.workCursor:K.backupCursor,String(v||'')),
  getUploadedAt:()=>Number(get(K.uploadedAt)||0),setUploadedAt:v=>set(K.uploadedAt,Number(v)||0),
  getQueue:type=>parse(get(type==='fault'?K.faultQ:K.workQ),[]),
  setQueue:(type,rows)=>set(type==='fault'?K.faultQ:K.workQ,JSON.stringify(Array.isArray(rows)?rows:[])),
  mergeThreeWay:(baseRaw,localRaw,remoteRaw)=>{const b=parse(baseRaw),l=parse(localRaw),r=parse(remoteRaw);if(!l)return remoteRaw||'';if(!r)return localRaw||'';if(!b)return JSON.stringify(merge3(r,l,r));return JSON.stringify(merge3(b,l,r));},
  sameRaw:(a,b)=>eq(parse(a),parse(b))
 };
 window.OfflineStore=api;
})();
