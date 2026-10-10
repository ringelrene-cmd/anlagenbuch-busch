(async()=>{
 'use strict';
 if(!('serviceWorker'in navigator))return;
 try{await navigator.serviceWorker.register('/sw.js?v=3.12',{scope:'/',updateViaCache:'none'});}
 catch(e){console.warn('Offline-App konnte nicht vorbereitet werden:',e);}
})();
