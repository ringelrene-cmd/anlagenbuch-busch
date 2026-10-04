'use strict';
(()=>{
 const trigger=document.getElementById('dataTools');
 const panel=document.getElementById('settingsMenu');
 const close=document.getElementById('closeSettingsMenu');
 const tools=document.querySelector('footer');
 panel.appendChild(tools);
 const info=tools.querySelector('p');
 tools.querySelector('.actions').after(info);
 trigger.onclick=()=>{panel.showModal();trigger.setAttribute('aria-expanded','true');};
 close.onclick=()=>panel.close();
 panel.addEventListener('close',()=>{trigger.setAttribute('aria-expanded','false');});
 panel.addEventListener('click',event=>{
  if(event.target!==panel)return;
  const r=panel.getBoundingClientRect();
  if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)panel.close();
 });
 // Close before the original button handler opens its existing dialog.
 tools.addEventListener('click',event=>{if(event.target.closest('button'))panel.close();},true);
})();
