'use strict';
(()=>{
 const P='anlagenbuch-web-v230-';
 const K={state:P+'state',base:P+'base',dirty:P+'dirty',localAt:P+'localAt',bootstrap:P+'bootstrap',reconcile:P+'reconcile',faultQ:P+'faultQueue',workQ:P+'workQueue',faultCursor:P+'faultCursor',workCursor:P+'workCursor',backupCursor:P+'backupCursor',uploadedAt:P+'uploadedAt'};
 const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
 const eq=(a,b)=>{try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return false;}};
 const get=k=>{try{return localStorage.getItem(k);}catch(_){return null;}};
 const set=(k,v)=>{try{localStorage.setItem(k,String(v));return true;}catch(_){return false;}};
 const del=k=>{try{localStorage.removeItem(k);}catch(_){}};
 function parse(raw,fallback=null){try{return raw?JSON.parse(raw):fallback;}catch(_){return fallback;}}
 function stableKey(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  for(const k of ['id','eventId','code','key'])if(typeof v[k]==='string'&&v[k])return k+':'+v[k];
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
     if(l===undefined&&b!==undefined)continue; // lokale Löschung gewinnt bei Konflikt
     if(l!==undefined&&b===undefined){out.push(clone(l));continue;}
     if(l===undefined&&b===undefined){if(r!==undefined)out.push(clone(r));continue;}
     const m=merge3(b,l,r);if(m!==undefined)out.push(m);
    }
    return out;
   }
   return clone(local); // nicht eindeutig adressierbare Liste: lokale Änderung gewinnt
  }
  const ob=base&&typeof base==='object',ol=local&&typeof local==='object',or=remote&&typeof remote==='object';
  if(ob||ol||or){
   if(!(ob&&ol&&or))return clone(local);
   const out={},keys=new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)]);
   for(const k of keys){
    const hasB=Object.prototype.hasOwnProperty.call(base,k),hasL=Object.prototype.hasOwnProperty.call(local,k),hasR=Object.prototype.hasOwnProperty.call(remote,k);
    if(!hasL&&hasB)continue; // lokale Löschung
    if(hasL&&!hasB){out[k]=clone(local[k]);continue;}
    if(!hasL&&!hasB){if(hasR)out[k]=clone(remote[k]);continue;}
    const m=merge3(base[k],local[k],hasR?remote[k]:undefined);if(m!==undefined)out[k]=m;
   }
   return out;
  }
  return clone(local); // echter Feldkonflikt: lokale Eingabe gewinnt
 }
 const api={
  keys:K,
  getStateRaw:()=>get(K.state)||'',
  setStateRaw:(raw,opts={})=>{raw=String(raw||'');if(raw&&!set(K.state,raw))return false;if(opts.dirty===true)set(K.dirty,'1');if(opts.dirty===false)set(K.dirty,'0');if(opts.localAt)set(K.localAt,opts.localAt);return true;},
  getBaseRaw:()=>get(K.base)||'',setBaseRaw:raw=>raw?set(K.base,raw):false,
  isDirty:()=>get(K.dirty)==='1',markDirty:()=>{set(K.dirty,'1');set(K.localAt,Date.now());},markClean:raw=>{if(raw)set(K.base,raw);set(K.dirty,'0');set(K.reconcile,'0');},
  localAt:()=>Number(get(K.localAt)||0),needsReconcile:()=>get(K.reconcile)==='1',setNeedsReconcile:v=>set(K.reconcile,v?'1':'0'),
  cacheBootstrap:j=>{try{const c={...j};delete c.state;set(K.bootstrap,JSON.stringify(c));}catch(_){}},getBootstrap:()=>parse(get(K.bootstrap),{}),
  getCursor:type=>get(type==='fault'?K.faultCursor:type==='work'?K.workCursor:K.backupCursor)||'',
  setCursor:(type,v)=>set(type==='fault'?K.faultCursor:type==='work'?K.workCursor:K.backupCursor,String(v||'')),
  getUploadedAt:()=>Number(get(K.uploadedAt)||0),setUploadedAt:v=>set(K.uploadedAt,Number(v)||0),
  getQueue:type=>parse(get(type==='fault'?K.faultQ:K.workQ),[]),
  setQueue:(type,rows)=>set(type==='fault'?K.faultQ:K.workQ,JSON.stringify(Array.isArray(rows)?rows:[])),
  mergeThreeWay:(baseRaw,localRaw,remoteRaw)=>{const b=parse(baseRaw),l=parse(localRaw),r=parse(remoteRaw);if(!l)return remoteRaw||'';if(!b||!r)return localRaw||remoteRaw||'';return JSON.stringify(merge3(b,l,r));}
 };
 window.OfflineStore=api;
})();
