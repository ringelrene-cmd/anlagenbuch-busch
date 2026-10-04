(async()=>{
 'use strict';
 if(!('serviceWorker' in navigator)||!('caches' in window))return;
 try{
  const names=await caches.keys();
  await Promise.all(names.filter(n=>n.startsWith('anlagenbuch-shell-')).map(n=>caches.delete(n)));
  const reg=await navigator.serviceWorker.register('/sw.js?v=2.98',{scope:'/',updateViaCache:'none'});
  if(reg.waiting)reg.waiting.postMessage({type:'activate-now'});
 }catch(e){console.warn('Anlagenbuch-Startschutz:',e);}
})();
