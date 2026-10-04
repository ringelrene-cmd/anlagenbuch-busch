(async()=>{
 'use strict';
 if(!('serviceWorker' in navigator)||!('caches' in window))return;
 const VERSION='2.97', FLAG='anlagenbuch-repair-'+VERSION;
 try{
  // Alte App-Shells entfernen. Medien-/Offline-Daten und IndexedDB bleiben erhalten.
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith('anlagenbuch-shell-')&&n!=='anlagenbuch-shell-'+VERSION).map(n=>caches.delete(n)));
  const reg=await navigator.serviceWorker.register('/sw.js?v='+VERSION,{scope:'/',updateViaCache:'none'});
  await reg.update().catch(()=>{});
  if(reg.waiting)reg.waiting.postMessage({type:'activate-now'});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
   try{if(sessionStorage.getItem(FLAG))return;sessionStorage.setItem(FLAG,'1');location.reload();}catch(_){location.reload();}
  },{once:true});
 }catch(e){console.warn('Anlagenbuch-Selbstreparatur:',e);}
})();
