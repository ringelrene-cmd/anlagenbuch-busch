'use strict';
window.openHelpImage=(src,title)=>{
 const viewer=document.createElement('dialog');viewer.className='helpImageViewer';viewer.setAttribute('aria-label',title);
 viewer.innerHTML='<div class="helpImageToolbar"><button type="button" data-zoom="out" aria-label="Verkleinern">−</button><button type="button" data-zoom="reset" aria-label="Ansicht zurücksetzen">100 %</button><button type="button" data-zoom="in" aria-label="Vergrößern">+</button><button type="button" data-zoom="close" aria-label="Bild schließen">Schließen</button></div><p class="helpImageHint">Mit zwei Fingern zoomen · Zum Verschieben ziehen</p><div class="helpImageStage"><img draggable="false"></div>';
 document.body.appendChild(viewer);const stage=viewer.querySelector('.helpImageStage'),img=stage.querySelector('img'),percent=viewer.querySelector('[data-zoom="reset"]');
 img.alt=title;let scale=1,x=0,y=0,w=1,h=1,points=new Map();
 function draw(){const r=stage.getBoundingClientRect();x=Math.max(-Math.max(0,(w*scale-r.width)/2),Math.min(Math.max(0,(w*scale-r.width)/2),x));y=Math.max(-Math.max(0,(h*scale-r.height)/2),Math.min(Math.max(0,(h*scale-r.height)/2),y));img.style.transform=`translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale})`;percent.textContent=Math.round(scale*100)+' %';}
 function fit(){const r=stage.getBoundingClientRect(),factor=Math.min((r.width-16)/img.naturalWidth,(r.height-16)/img.naturalHeight);w=img.naturalWidth*factor;h=img.naturalHeight*factor;img.style.width=w+'px';img.style.height=h+'px';scale=1;x=y=0;draw();}
 function zoom(value,cx=stage.clientWidth/2,cy=stage.clientHeight/2){const next=Math.max(1,Math.min(5,value)),k=next/scale;x=(x-(cx-stage.clientWidth/2))*k+(cx-stage.clientWidth/2);y=(y-(cy-stage.clientHeight/2))*k+(cy-stage.clientHeight/2);scale=next;draw();}
 viewer.addEventListener('click',e=>{const op=e.target.dataset.zoom;if(op==='close')viewer.close();if(op==='in')zoom(scale*1.4);if(op==='out')zoom(scale/1.4);if(op==='reset'){scale=1;x=y=0;draw();}});
 stage.addEventListener('pointerdown',e=>{stage.setPointerCapture(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});});
 stage.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const old=[...points.values()],p=points.get(e.pointerId);points.set(e.pointerId,{x:e.clientX,y:e.clientY});const now=[...points.values()];if(now.length===1){x+=e.clientX-p.x;y+=e.clientY-p.y;draw();}else if(now.length===2){const a=Math.hypot(old[0].x-old[1].x,old[0].y-old[1].y),b=Math.hypot(now[0].x-now[1].x,now[0].y-now[1].y);const r=stage.getBoundingClientRect();if(a>0)zoom(scale*b/a,(now[0].x+now[1].x)/2-r.left,(now[0].y+now[1].y)/2-r.top);x+=(now[0].x+now[1].x-old[0].x-old[1].x)/2;y+=(now[0].y+now[1].y-old[0].y-old[1].y)/2;draw();}});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(event,e=>points.delete(e.pointerId));
 stage.addEventListener('dblclick',()=>zoom(scale>1?1:2));
 viewer.addEventListener('keydown',e=>{if(e.key==='+')zoom(scale*1.4);if(e.key==='-')zoom(scale/1.4);});
 viewer.addEventListener('close',()=>{window.removeEventListener('resize',fit);viewer.remove();});
 const hint=viewer.querySelector('.helpImageHint');hint.textContent='Bild wird geladen …';
 window.addEventListener('resize',fit);img.onload=()=>{hint.textContent='Mit zwei Fingern zoomen · Zum Verschieben ziehen';fit();};img.onerror=()=>{hint.textContent='Das Bild konnte nicht geladen werden. Bitte die Hilfe schließen und erneut öffnen.';};viewer.showModal();img.src=src;
};
