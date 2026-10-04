'use strict';
window.migrateLocalOneDrive=async()=>{
 const key='anlagenbuch-onedrive-v2',old='anlagenbuch-onedrive-v1';
 const openDb=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('anlagenbuch-sync',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('state'))r.result.createObjectStore('state');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const use=(db,mode,fn)=>new Promise((resolve,reject)=>{const t=db.transaction('state',mode),s=t.objectStore('state'),r=fn(s);t.oncomplete=()=>resolve(r?.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
 let db;
 try{
  db=await openDb();
  let packed=await use(db,'readonly',s=>s.get('onedrive-v2'));
  if(!packed){
   packed=localStorage.getItem(key)||localStorage.getItem(old)||'';
   if(!packed){
    const prefix='anlagenbuch-web-v230-',raw=localStorage.getItem(prefix+'state')||localStorage.getItem('anlagenbuch-v1');
    if(raw){const baseRaw=localStorage.getItem(prefix+'base');packed=SyncMerge.pack({local:JSON.parse(raw),base:baseRaw?JSON.parse(baseRaw):null,revision:0,pending:null,conflicts:[]});}
   }
   if(packed)await use(db,'readwrite',s=>s.put(packed,'onedrive-v2'));
  }
  window.__OD_LOCAL_PACKED=packed||'';
  // Erst NACH erfolgreicher IndexedDB-Kopie die großen alten Snapshots entfernen.
  if(packed){
   localStorage.removeItem(key);localStorage.removeItem(old);localStorage.removeItem('anlagenbuch-v1');
   for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k&&k.startsWith('anlagenbuch-web-v230-'))localStorage.removeItem(k);}
  }
 }finally{if(db)db.close();}
};
