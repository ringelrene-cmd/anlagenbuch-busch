'use strict';
window.migrateLocalOneDrive=async()=>{
 const key='anlagenbuch-onedrive-v1';if(localStorage.getItem(key))return;
 const prefix='anlagenbuch-web-v230-',entries={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith(prefix)||k==='anlagenbuch-v1')entries[k]=localStorage.getItem(k);}
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('anlagenbuch-migration',1);r.onupgradeneeded=()=>r.result.createObjectStore('original');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const transaction=(value)=>new Promise((resolve,reject)=>{const t=db.transaction('original',value?'readwrite':'readonly'),s=t.objectStore('original'),r=value?s.put(value,'pre-onedrive'):s.get('pre-onedrive');t.oncomplete=()=>resolve(value||r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});
 try{
  let original=entries;if(!original[prefix+'state']&&!original['anlagenbuch-v1'])original=await transaction();
  if(!original)return;const raw=original[prefix+'state']||original['anlagenbuch-v1'];if(!raw)return;
  const local=JSON.parse(raw),base=original[prefix+'base']?JSON.parse(original[prefix+'base']):null;
  await transaction(original); // Complete archival transaction before reclaiming localStorage space.
  for(const k of Object.keys(entries))localStorage.removeItem(k);
  localStorage.setItem(key,SyncMerge.pack({local,base,revision:0,pending:null,conflicts:[]}));
 }finally{db.close();}
};
