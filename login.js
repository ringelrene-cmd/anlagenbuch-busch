'use strict';
(()=>{
 const f=document.getElementById('login'),e=document.getElementById('error');
 async function repairWorker(){
  if(!('serviceWorker' in navigator))return;
  try{
   const reg=await navigator.serviceWorker.register('/sw.js?v=3.03',{scope:'/',updateViaCache:'none'});
   if(reg.waiting)reg.waiting.postMessage({type:'activate-now'});
   const deadline=Date.now()+5000;
   while(Date.now()<deadline){
    const r=await navigator.serviceWorker.getRegistration('/');
    if(r?.active?.scriptURL?.includes('/sw.js'))break;
    await new Promise(x=>setTimeout(x,150));
   }
  }catch(err){console.warn('Service-Worker-Reparatur:',err);}
 }
 f.onsubmit=async ev=>{
  ev.preventDefault();e.textContent='Anmeldung wird geprüft …';
  try{
   const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:f.elements.password.value}),cache:'no-store',credentials:'same-origin'});
   const ct=r.headers.get('content-type')||'';const j=ct.includes('application/json')?await r.json():null;
   if(r.status===405)throw Error('Serverfehler 405: Der Anlagenbuch-Worker wurde bei dieser Cloudflare-Bereitstellung nicht aktiviert.');
   if(!r.ok||!j?.ok)throw Error(j?.error||('Anmeldung fehlgeschlagen ('+r.status+').'));
   e.textContent='Anlagenbuch wird vorbereitet …';
   await repairWorker();
   location.replace('/index.html?v=3.03&start='+Date.now());
  }catch(err){e.textContent=err.message;}
 };
})();
