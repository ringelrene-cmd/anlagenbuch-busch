'use strict';
(()=>{
 const button=document.createElement('button');button.id='openHelp';button.className='light';button.textContent='Hilfe';
 document.querySelector('footer .actions').appendChild(button);
 button.onclick=()=>{
  const sections=window.AnlagenbuchHelp||[];
  modal('<h2>Hilfe · Anlagenbuch</h2><p class="hint">Version 2.14 · Vollständige Bedienungsanleitung direkt in der App · Auch ohne Internet verfügbar.</p><label for="helpSearch">In der Anleitung suchen</label><input id="helpSearch" type="search" placeholder="z. B. PDF, Störung oder Sicherung"><div id="helpChapters"></div><p id="helpEmpty" hidden>Kein passendes Kapitel. Versuche einen anderen Suchbegriff.</p><button id="cancel" class="light">Schließen</button>');
  const chapters=document.getElementById('helpChapters');
  sections.forEach((s,i)=>{
   const detail=document.createElement('details');detail.className='helpChapter';
   const summary=document.createElement('summary');summary.textContent=(i+1)+'. '+s.title;detail.appendChild(summary);
   const list=document.createElement('ol');s.steps.forEach(t=>{const li=document.createElement('li');li.textContent=t;list.appendChild(li);});detail.appendChild(list);
   const note=document.createElement('p');note.className='status';note.textContent=s.note;detail.appendChild(note);
   const img=document.createElement('img');img.src='help-image-'+s.image+'.png';img.alt='Beispielansicht: '+s.title;img.loading='lazy';img.style.cssText='display:block;width:100%;max-width:360px;margin:16px auto;border:1px solid #bccac6;border-radius:12px';const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='helpImageButton';imageButton.setAttribute('aria-label','Beispielansicht öffnen: '+s.title);imageButton.appendChild(img);const hint=document.createElement('span');hint.textContent='Bild antippen zum Vergrößern';imageButton.appendChild(hint);imageButton.onclick=()=>openHelpImage(img.src,img.alt);detail.appendChild(imageButton);
   detail.dataset.search=(s.title+' '+s.steps.join(' ')+' '+s.note).toLocaleLowerCase('de');chapters.appendChild(detail);
  });
  document.getElementById('helpSearch').oninput=e=>{const q=e.target.value.trim().toLocaleLowerCase('de');let found=0;chapters.querySelectorAll('details').forEach(d=>{d.hidden=!d.dataset.search.includes(q);if(!d.hidden)found++;});document.getElementById('helpEmpty').hidden=found>0;};
  document.getElementById('modal').scrollTop=0;
 };
})();
