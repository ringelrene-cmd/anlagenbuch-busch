'use strict';
(function(){
const MULTI_VERSION=2;

const PDF_RECOVERY_235={
 'Cobra_Hardware_Basic.pdf':'app-pdf://backup/backup-1789922137516-95be86bb-fcc0-4742-b596-62b9181b5f5e.json/library__70053fd8-2566-479b-b835-89216b26911b.pdf',
 'A_C_Version_Control_Basic.pdf':'app-pdf://backup/backup-1789922137516-95be86bb-fcc0-4742-b596-62b9181b5f5e.json/library__910200a8-caed-4396-bdc6-4c1ffed24d07.pdf'
};
function recoverMissingPoolPdfs235(s){
 let n=0;
 for(const x of s.instructionLibrary||[]){
  if(!x||!x.attachmentOnly||x.pdfUri)continue;
  const key=String(x.pdfName||x.title||'').trim(),uri=PDF_RECOVERY_235[key];
  if(!uri)continue;
  x.pdfUri=uri;x.updatedAt=Math.max(Number(x.updatedAt)||0,now());n++;
  const owner=(s.instructionLibrary||[]).find(i=>i&&!i.attachmentOnly&&i.id===x.ownerId);
  if(owner)owner.updatedAt=Math.max(Number(owner.updatedAt)||0,x.updatedAt);
 }
 return n;
}
const now=()=>Date.now();
const normalInstructions=s=>(s.instructionLibrary||[]).filter(i=>!i.attachmentOnly);
const attachmentById=(s,id)=>(s.instructionLibrary||[]).find(i=>i&&i.attachmentOnly&&i.id===id)||null;
const ensureMeta=s=>{if(!s.handlingSyncMeta||typeof s.handlingSyncMeta!=='object'||Array.isArray(s.handlingSyncMeta))s.handlingSyncMeta={seenAt:0,deleted:{},lastLocalAt:0,lastAckAt:0};if(!s.handlingSyncMeta.deleted||typeof s.handlingSyncMeta.deleted!=='object'||Array.isArray(s.handlingSyncMeta.deleted))s.handlingSyncMeta.deleted={};if(!Number.isFinite(s.handlingSyncMeta.seenAt))s.handlingSyncMeta.seenAt=0;if(!Number.isFinite(s.handlingSyncMeta.lastLocalAt))s.handlingSyncMeta.lastLocalAt=0;if(!Number.isFinite(s.handlingSyncMeta.lastAckAt))s.handlingSyncMeta.lastAckAt=0;return s.handlingSyncMeta;};
const stampOwner=(o,t=now())=>{o.updatedAt=t;return o;};
const markDeleted=(s,id,t=now())=>{ensureMeta(s).deleted[id]=Math.max(Number(ensureMeta(s).deleted[id])||0,t);};
const deletedAt=(s,id)=>Number((s.handlingSyncMeta&&s.handlingSyncMeta.deleted||{})[id])||0;
function makeAttachment(id,name,uri,ownerType,ownerId,t=now()){
 return {id,title:(name||'Hantierungsanweisung.pdf').slice(0,200),pumpModel:'',text:'',pdfName:(name||'Hantierungsanweisung.pdf').slice(0,500),pdfUri:uri||'',attachmentOnly:true,ownerType,ownerId,updatedAt:t};
}
function migrateMulti(){
 try{
  const s=C.clone(state);let changed=false;ensureMeta(s);const recovered235=recoverMissingPoolPdfs235(s);if(recovered235)changed=true;
  for(const i of normalInstructions(s)){
   if(!Array.isArray(i.pdfRefs)){i.pdfRefs=[];changed=true;}if(!Number.isFinite(i.updatedAt)){i.updatedAt=0;changed=true;}
   if(i.pdfUri){const id='att-legacy-lib-'+i.id;if(!attachmentById(s,id))s.instructionLibrary.push(makeAttachment(id,i.pdfName||'Hantierungsanweisung.pdf',i.pdfUri,'library',i.id,0));if(!i.pdfRefs.includes(id))i.pdfRefs.push(id);i.pdfUri='';i.pdfName='';changed=true;}
  }
  for(const a of s.assets){const h=a.handlingInstruction||(a.handlingInstruction=C.emptyHandling());if(!Array.isArray(h.pdfRefs)){h.pdfRefs=[];changed=true;}if(!Number.isFinite(h.updatedAt)){h.updatedAt=0;changed=true;}if(h.pdfUri){const id='att-legacy-asset-'+a.id;if(!attachmentById(s,id))s.instructionLibrary.push(makeAttachment(id,h.pdfName||'Hantierungsanweisung.pdf',h.pdfUri,'asset',a.id,0));if(!h.pdfRefs.includes(id))h.pdfRefs.push(id);h.pdfUri='';h.pdfName='';changed=true;}}
  for(const x of s.instructionLibrary||[]){if(x&&x.attachmentOnly&&!Number.isFinite(x.updatedAt)){x.updatedAt=0;changed=true;}}
  for(const a of s.assets||[]){for(const u of (a.units||[])){const h=u&&u.handlingInstruction;if(!h||!h.libraryId)continue;const q=(s.instructionLibrary||[]).find(x=>x&&x.id===h.libraryId);if(q&&q.attachmentOnly&&q.ownerType==='library'&&q.ownerId){h.libraryId=q.ownerId;h.updatedAt=Math.max(Number(h.updatedAt)||0,Number(q.updatedAt)||0,now());changed=true;}}}
  if(changed&&persist(s)){render();if(recovered235)toast(recovered235+' Hantierungsanweisungs-PDF'+(recovered235===1?'':'s')+' aus der Sicherung wiederhergestellt.');setTimeout(()=>handlingSyncCommit(false),300);}
 }catch(e){toast('PDF-Migration konnte nicht abgeschlossen werden: '+e.message);}
}
function linkedAssetIds(p){const i=p&&ownerFor('library',p.ownerId);return i?state.assets.filter(a=>PoolLinks.linked(i,a.id)).map(a=>a.id):[];}
function pdfRows(refs,assetId=''){const rows=(refs||[]).map(id=>attachmentById(state,id)).filter(Boolean).filter(p=>!assetId||p.ownerType==='asset'||linkedAssetIds(p).includes(assetId));if(!rows.length)return '<p class="empty">Noch keine passende PDF hinterlegt.</p>';return rows.map(p=>{const n=linkedAssetIds(p).length;return `<article class="record"><strong>${esc(p.title||p.pdfName||'PDF')}</strong><p class="hint">${esc(p.pdfName||'PDF-Datei')} · offline verfügbar${p.ownerType==='library'?` · ${n} Anlage${n===1?'':'n'} verknüpft`:''}</p><div class="actions"><button data-mpdf-open="${esc(p.id)}">Öffnen</button><button class="light" data-mpdf-rename="${esc(p.id)}">Umbenennen</button><button class="danger" data-mpdf-delete="${esc(p.id)}">Entfernen</button></div></article>`;}).join('');}
function searchableChoices({title,description,searchLabel,rows,initial,onSave,browseFirst=false}){
 const chosen=new Set(initial);
 modal(`<h2>${esc(title)}</h2><p>${esc(description)}</p>${browseFirst?'<details><summary>Suche bei Bedarf öffnen</summary>':''}<label for="poolSearch">${esc(searchLabel)}</label><input id="poolSearch" type="search" placeholder="Suchbegriff eingeben …" autocomplete="off">${browseFirst?'</details>':''}<label class="check"><input id="poolOnlySelected" type="checkbox"> Nur ausgewählte anzeigen</label><p id="poolSelectionCount" class="hint"></p><div id="poolChoiceRows" style="max-height:45vh;overflow:auto"></div><div class="actions"><button id="savePoolChoices">Auswahl speichern</button><button id="cancel" class="light">Abbrechen</button></div>`);
 const normalize=s=>String(s).toLocaleLowerCase('de').replace(/\s+/g,'');
 const paint=()=>{
  const query=normalize($('poolSearch').value),only=$('poolOnlySelected').checked;
  const visible=rows.filter(r=>(!only||chosen.has(r.id))&&(!query||normalize(r.search||r.title).includes(query)));
  $('poolSelectionCount').textContent=`${chosen.size} ausgewählt · ${visible.length} Treffer`;
  $('poolChoiceRows').innerHTML=visible.map(r=>`<label class="record" style="display:flex;gap:12px;align-items:flex-start;cursor:pointer"><input style="width:22px;min-width:22px;margin-top:4px" type="checkbox" data-pool-choice="${esc(r.id)}" ${chosen.has(r.id)?'checked':''}><span style="min-width:0;overflow-wrap:anywhere"><strong>${esc(r.title)}</strong>${r.detail?`<br><small>${esc(r.detail)}</small>`:''}</span></label>`).join('')||'<p class="empty">Keine passenden Einträge gefunden.</p>';
  document.querySelectorAll('[data-pool-choice]').forEach(b=>b.onchange=()=>{if(b.checked)chosen.add(b.dataset.poolChoice);else chosen.delete(b.dataset.poolChoice);$('poolSelectionCount').textContent=`${chosen.size} ausgewählt · ${visible.length} Treffer`;if(only)paint();});
 };
 $('poolSearch').oninput=paint;$('poolOnlySelected').onchange=paint;
 $('savePoolChoices').onclick=()=>onSave(chosen);
 paint();
}
function linkPdfToAssets(id){
 PoolLinks.migrate(state);const p=attachmentById(state,id),i=p?ownerFor('library',p.ownerId):ownerFor('library',id);if(!i)return;
 const initial=new Set(state.assets.filter(a=>PoolLinks.linked(i,a.id)).map(a=>a.id));
 const assets=[...state.assets].sort((a,b)=>Number(initial.has(b.id))-Number(initial.has(a.id))||a.name.localeCompare(b.name,'de',{numeric:true}));
 searchableChoices({title:'Anlagen verknüpfen',description:i.title+' · einschließlich aller zugehörigen PDFs',searchLabel:'Anlagen-ID, Name, Modul oder Koordinaten suchen',initial,
  rows:assets.map(a=>({id:a.id,title:a.name,detail:`${a.module} · Y ${a.y} / X ${a.x}`,search:`${a.name} ${a.id} ${a.module} ${a.y} ${a.x}`})),
  onSave:ids=>{if(change(s=>{for(const a of assets)if(initial.has(a.id)!==ids.has(a.id))PoolLinks.setLink(s,i.id,a.id,ids.has(a.id));})){$('modal').close();instructionLibraryPanel();handlingSyncCommit(false);}}
 });
}

function ownerFor(kind,id,s=state){if(kind==='asset'){const a=s.assets.find(x=>x.id===id);return a&&a.handlingInstruction;}return (s.instructionLibrary||[]).find(x=>!x.attachmentOnly&&x.id===id)||null;}
function choosePdf(kind,id){if(!window.Native||!Native.chooseInstructionPdf)return toast('PDF-Auswahl ist in der Android-App verfügbar.');const target=kind==='library'?`library:${id}`:`asset:${id}`;Native.chooseInstructionPdf(target);}
function uploadNewPoolPdf(){
 if(!window.Native||!Native.chooseInstructionPdf)return toast('PDF-Auswahl ist in der Android-App verfügbar.');
 const target='library:pool-new-'+uid();
 try{Native.chooseInstructionPdf(target);}catch(e){toast('PDF-Auswahl konnte nicht geöffnet werden: '+(e.message||String(e)));}
}
window.instructionPdfSelected=(target,uri,name)=>{try{
 if(/^library:pool-new-[a-z0-9]+-[a-z0-9]+$/.test(String(target||''))){
  if(!uri)return;
  const title=String(name||'Hantierungsanweisung.pdf').trim()||'Hantierungsanweisung.pdf';
  const id='pool-'+String(target).slice('library:pool-new-'.length),attId=uid(),t=now(),s=C.clone(state);
  if(s.instructionLibrary.some(i=>i.id===id))return;
  s.instructionLibrary.push({id,title:title.slice(0,200),pumpModel:'',text:'',pdfName:'',pdfUri:'',pdfRefs:[attId],updatedAt:t,poolLinks:{},poolLinksVersion:1});
  s.instructionLibrary.push(makeAttachment(attId,title,uri,'library',id,t));ensureMeta(s);
  if(persist(s)){render();instructionLibraryPanel();handlingSyncCommit(true);toast('PDF und Anweisung unter dem Dateinamen gespeichert.');}
  return;
 }

 if(String(target||'').startsWith('library:pool-new-'))return;
 const raw=String(target||'');let kind='',ownerId='';if(raw.startsWith('library:')){kind='library';ownerId=raw.slice(8);}else if(raw.startsWith('asset:')){kind='asset';ownerId=raw.slice(6);}else return;const attId=uid();
 if(!ownerId)return;
 const s=C.clone(state),owner=ownerFor(kind,ownerId,s);if(!owner)return toast('Die Hantierungsanweisung wurde nicht gefunden.');if(!Array.isArray(owner.pdfRefs))owner.pdfRefs=[];
 const t=now();s.instructionLibrary.push(makeAttachment(attId,name,uri,kind,ownerId,t));owner.pdfRefs.push(attId);stampOwner(owner,t);ensureMeta(s);
 if(persist(s)){render();toast('PDF hinterlegt. Lokale Kopie und Synchronisierung werden vorbereitet.');handlingSyncCommit(true);}
 }catch(e){toast('PDF konnte nicht hinterlegt werden: '+e.message);}};
function removePdf(id){const p=attachmentById(state,id);if(!p)return;if(!confirm(`„${p.title||p.pdfName||'PDF'}“ aus der Hantierungsanweisung entfernen?`))return;const s=C.clone(state),q=attachmentById(s,id);if(!q)return;const owner=ownerFor(q.ownerType,q.ownerId,s),t=now();if(owner){owner.pdfRefs=(owner.pdfRefs||[]).filter(x=>x!==id);stampOwner(owner,t);}s.instructionLibrary=s.instructionLibrary.filter(x=>x.id!==id);markDeleted(s,id,t);if(p.pdfUri&&window.Native&&Native.releaseInstructionPdf)try{Native.releaseInstructionPdf(p.pdfUri);}catch(_){}if(persist(s)){render();toast('PDF entfernt. Änderung wird synchronisiert.');handlingSyncCommit(false);}}
function renamePdf(id){const p=attachmentById(state,id);if(!p)return;const v=prompt('Bezeichnung der PDF',p.title||p.pdfName||'PDF');if(v===null)return;const name=v.trim();if(!name)return toast('Bitte eine Bezeichnung eingeben.');const s=C.clone(state),q=attachmentById(s,id),t=now();q.title=name.slice(0,200);q.updatedAt=t;const owner=ownerFor(q.ownerType,q.ownerId,s);if(owner)stampOwner(owner,t);if(persist(s)){render();handlingSyncCommit(false);}}
let pdfOpenRequest=0;
function openPoolPdf(id){
 const request=++pdfOpenRequest,started=Date.now();let requestedBackup=false,lastError='';
 const first=attachmentById(state,id);if(!first)return toast('Diese PDF wurde inzwischen entfernt.');
 // Web-Version: PDF direkt aus dem Offline-Mediencache öffnen. Beim ersten Online-Start werden alle Pool-PDFs automatisch vorgeladen.
 if(window.__WEB_BOOTSTRAP__&&window.WebPdfOffline){WebPdfOffline.open(first.pdfUri,first.title||first.pdfName||'Hantierungsanweisung',first.id);return;}
 if(!window.Native||!Native.openInstructionPdf)return toast('Der PDF-Viewer ist nicht verfügbar.');
 const attempt=()=>{
  if(request!==pdfOpenRequest)return;
  const p=attachmentById(state,id);if(!p)return toast('Diese PDF wurde inzwischen entfernt.');
  try{
   // Native.readBackup resolves PDF references against files on THIS phone.
   // Do not send a fresh content:// selection or another phone's backup path to the viewer.
   if(Native.readBackup&&Native.backupStatus){
    const status=backupStatus(),backups=[...(status.backups||[])].sort((a,b)=>(b.at||0)-(a.at||0));
    const current=String(p.pdfUri||'').match(/^app-pdf:\/\/backup\/([^/]+)\//);
    const ids=[...new Set([...backups.slice(0,3).map(b=>b.id),...(current?[current[1]+'.json']:[])])];
    for(const backupId of ids){
     try{
      const snapshot=JSON.parse(Native.readBackup(backupId));
      const local=(snapshot.instructionLibrary||[]).find(x=>x.id===id&&x.attachmentOnly);
      if(!local||!/^app-pdf:\/\/backup\//.test(local.pdfUri||''))continue;
      if(p.pdfUri!==local.pdfUri){const s=C.clone(state),q=attachmentById(s,id);q.pdfUri=local.pdfUri;if(!persist(s))return;}
      Native.openInstructionPdf(local.pdfUri);return;
     }catch(e){lastError=e.message||String(e);}
    }
    if(!requestedBackup){requestedBackup=true;if(Native.makeBackup)Native.makeBackup(JSON.stringify(state));toast('PDF wird zum Öffnen vorbereitet …');}
    if(Date.now()-started<20000){setTimeout(attempt,1000);return;}
    return toast('Keine lokale PDF-Kopie gefunden. Bitte den Dropbox-Abgleich abwarten und erneut öffnen.'+(status.error?' '+status.error:''));
   }
   // Compatibility with older bridges that do not expose backup lookup.
   if(!p.pdfUri)return toast('Die PDF-Datei ist noch nicht auf diesem Handy verfügbar.');
   Native.openInstructionPdf(p.pdfUri);
  }catch(e){toast('PDF konnte nicht geöffnet werden: '+(e.message||String(e)));}
 };
 attempt();
}

window.openHandlingPdf=openPoolPdf;
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.renamePool){renamePool(b.dataset.renamePool);return;}if(b.dataset.openPoolAsset){$('modal').close();showDetail(b.dataset.openPoolAsset,false);return;}if(b.dataset.mpdfOpen){openPoolPdf(b.dataset.mpdfOpen);return;}if(b.dataset.mpdfDelete)removePdf(b.dataset.mpdfDelete);if(b.dataset.mpdfRename)renamePdf(b.dataset.mpdfRename);if(b.dataset.mpdfLink)linkPdfToAssets(b.dataset.mpdfLink);});
window.renderHandlingInstruction=function(a){
 PoolLinks.migrate(state);
 const h=a.handlingInstruction||C.emptyHandling(),rows=normalInstructions(state).filter(i=>PoolLinks.linked(i,a.id));
 $('handlingSection').innerHTML=`<div class="row"><h2>Hantierungsanweisungen</h2><button id="assignHandlingLibrary">Aus Pool auswählen</button></div><p class="hint">Verknüpfte Anweisungen und PDFs stammen aus dem zentralen Pool. Änderungen werden mit dem Team synchronisiert.</p>${rows.length?rows.map(i=>`<article class="record"><strong>${esc(i.title)}</strong>${handlingTextHtml(i.text)}${(i.pdfRefs||[]).map(id=>attachmentById(state,id)).filter(Boolean).map(p=>`<p>${esc(p.title||p.pdfName)} <button data-mpdf-open="${esc(p.id)}">Öffnen</button></p>`).join('')}<button class="danger" data-unlink-pool="${esc(i.id)}">Verknüpfung entfernen</button></article>`).join(''):'<p class="empty">Noch keine Pool-Anweisung verknüpft.</p>'}<hr><div class="row"><strong>Anlagenspezifische Ergänzung</strong><button id="editHandlingText" class="light">Text bearbeiten</button></div>${handlingTextHtml(h.text)}<div class="handlingPdf"><strong>PDFs nur für diese Anlage</strong>${pdfRows(h.pdfRefs||[])}<button id="addHandlingPdf" class="light">+ PDF hinzufügen</button></div>`;
 $('assignHandlingLibrary').onclick=()=>assignInstructionLibrary(a.id);
 document.querySelectorAll('[data-unlink-pool]').forEach(b=>b.onclick=()=>{if(change(s=>PoolLinks.setLink(s,b.dataset.unlinkPool,a.id,false))){handlingSyncCommit(false);toast('Verknüpfung entfernt. Die Anweisung bleibt im Pool.');}});
 $('editHandlingText').onclick=handlingTextForm;$('addHandlingPdf').onclick=()=>choosePdf('asset',a.id);
};
window.handlingTextForm=function(){const a=state.assets.find(x=>x.id===selected),h=a.handlingInstruction||C.emptyHandling();modal(`<h2>Anlagenspezifische Ergänzung</h2><p>${esc(a.name)} · ${esc(a.module)}</p><form id="handlingTextForm"><label for="handlingText">Text nur für diese Anlage</label><textarea id="handlingText" name="text" maxlength="50000" placeholder="Besonderheiten dieser einzelnen Anlage …">${esc(h.text)}</textarea><p class="hint">Änderungen werden lokal gespeichert und bei Internetverbindung automatisch synchronisiert.</p><div class="actions"><button type="submit">Speichern</button><button type="button" id="cancel" class="light">Abbrechen</button></div></form>`);$('handlingTextForm').onsubmit=e=>{e.preventDefault();const text=e.target.elements.text.value.trim(),t=now();if(change(s=>{const x=s.assets.find(x=>x.id===selected).handlingInstruction;x.text=text;stampOwner(x,t);})){ $('modal').close();toast('Ergänzung gespeichert und zur Synchronisierung vorgemerkt.');handlingSyncCommit(false);}};};
window.assignInstructionLibrary=function(assetId){
 PoolLinks.migrate(state);const a=state.assets.find(a=>a.id===assetId);if(!a)return;
 const initial=new Set(normalInstructions(state).filter(i=>PoolLinks.linked(i,assetId)).map(i=>i.id));
 const instructions=normalInstructions(state).sort((a,b)=>Number(initial.has(b.id))-Number(initial.has(a.id))||a.title.localeCompare(b.title,'de',{numeric:true}));
 searchableChoices({title:'Aus Pool auswählen',description:`${a.name} · Hier stehen alle Pool-Anweisungen. Gewünschte Einträge samt PDFs anhaken und speichern.`,searchLabel:'PDF-Dateiname oder Anweisung suchen',initial,
  rows:instructions.map(i=>{const names=(i.pdfRefs||[]).map(id=>attachmentById(state,id)).filter(Boolean).map(p=>p.title===p.pdfName?p.title:`${p.title} (${p.pdfName})`).join(' · ');return {id:i.id,title:i.title,detail:names||'Anweisung ohne PDF',search:`${i.title} ${i.pumpModel||''} ${names}`};}),
  browseFirst:true,onSave:ids=>{if(change(s=>{for(const i of instructions)if(initial.has(i.id)!==ids.has(i.id))PoolLinks.setLink(s,i.id,assetId,ids.has(i.id));})){$('modal').close();showDetail(assetId,false);handlingSyncCommit(false);toast('Auswahl gespeichert.');}}
 });
};

function compactPoolCard(i){
 const assigned=state.assets.filter(a=>PoolLinks.linked(i,a.id)).sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true}));
 const pdfs=(i.pdfRefs||[]).map(id=>attachmentById(state,id)).filter(Boolean);
 const pdfButtons=pdfs.map(p=>`<button data-mpdf-open="${esc(p.id)}">${pdfs.length===1||p.title===i.title?'Öffnen':esc(p.title||p.pdfName||'PDF öffnen')}</button>`).join('');
 return `<article class="record poolCard" data-pool-card="${esc(i.id)}"><strong style="overflow-wrap:anywhere">${esc(i.title)}</strong><div class="assignedAssets" style="margin:10px 0">${assigned.length?assigned.map(a=>`<button class="light" style="margin:0 6px 6px 0;overflow-wrap:anywhere" data-open-pool-asset="${esc(a.id)}">${esc(a.name)} · ${esc(a.module)}</button>`).join(''):'<p class="hint">Noch keine Anlagen verknüpft.</p>'}</div><div class="actions">${pdfButtons}<button class="light" data-rename-pool="${esc(i.id)}">Umbenennen</button><button class="light" data-mpdf-link="${esc(i.id)}">Anlagen verknüpfen</button><button class="danger" data-delete-instruction="${esc(i.id)}">Löschen</button></div><details style="margin-top:10px"><summary>Weitere Optionen</summary>${i.text?handlingTextHtml(i.text):''}${i.pumpModel?`<p class="hint">Pumpentyp: ${esc(i.pumpModel)}</p>`:''}<div class="actions"><button class="light" data-add-library-pdf="${esc(i.id)}">+ PDF</button><button class="light" data-edit-instruction="${esc(i.id)}">Text / Angaben bearbeiten</button></div>${pdfs.length>1?pdfs.map(p=>`<p>${esc(p.title||p.pdfName)} <button class="light" data-mpdf-rename="${esc(p.id)}">PDF umbenennen</button><button class="danger" data-mpdf-delete="${esc(p.id)}">PDF entfernen</button></p>`).join(''):''}</details></article>`;
}
function renamePool(id){
 const i=ownerFor('library',id);if(!i)return;
 const value=prompt('Name der Hantierungsanweisung',i.title);if(value===null)return;
 const title=value.trim();if(!title)return toast('Bitte einen Namen eingeben.');
 const s=C.clone(state),q=ownerFor('library',id,s),t=now();q.title=title.slice(0,200);stampOwner(q,t);
 const pdfs=(q.pdfRefs||[]).map(id=>attachmentById(s,id)).filter(Boolean);
 if(pdfs.length===1){pdfs[0].title=q.title;pdfs[0].updatedAt=t;}
 if(persist(s)){render();instructionLibraryPanel();handlingSyncCommit(false);}
}

window.instructionLibraryPanel=function(){PoolLinks.migrate(state);const rows=normalInstructions(state);modal(`<div class="row"><h2>Hantierungsanweisungen</h2><div class="actions"><button id="uploadPoolPdf">+ PDF hochladen</button><button id="addInstruction" class="light">Anweisung ohne PDF</button></div></div><p class="hint">Jede Anweisung wird einschließlich ihrer PDFs mit den passenden Anlagen verknüpft. Die Verknüpfungen werden mit den anderen Handys synchronisiert.</p>${rows.length?rows.map(compactPoolCard).join(''):'<p class="empty">Noch keine gemeinsamen Anleitungen angelegt.</p>'}<button id="cancel" class="light">Schließen</button>`);$('uploadPoolPdf').onclick=uploadNewPoolPdf;$('addInstruction').onclick=()=>instructionLibraryForm();document.querySelectorAll('[data-add-library-pdf]').forEach(b=>b.onclick=()=>choosePdf('library',b.dataset.addLibraryPdf));document.querySelectorAll('[data-edit-instruction]').forEach(b=>b.onclick=()=>instructionLibraryForm(b.dataset.editInstruction));document.querySelectorAll('[data-delete-instruction]').forEach(b=>b.onclick=()=>{const id=b.dataset.deleteInstruction,i=instructionById(id),used=state.assets.filter(a=>PoolLinks.linked(i,a.id)).length;if(!confirm(`„${i.title}“ löschen? Die Zuordnung wird bei ${used} Anlage${used===1?'':'n'} entfernt.`))return;const refs=[...(i.pdfRefs||[])],t=now(),s=C.clone(state);for(const rid of refs){const p=attachmentById(s,rid);if(p&&p.pdfUri&&window.Native&&Native.releaseInstructionPdf)try{Native.releaseInstructionPdf(p.pdfUri);}catch(_){}markDeleted(s,rid,t);}s.instructionLibrary=s.instructionLibrary.filter(x=>x.id!==id&&!refs.includes(x.id));s.assets.forEach(a=>{if(a.handlingInstruction&&a.handlingInstruction.libraryId===id){a.handlingInstruction.libraryId='';stampOwner(a.handlingInstruction,t);}});markDeleted(s,id,t);if(persist(s)){ $('modal').close();instructionLibraryPanel();handlingSyncCommit(false);}});};
window.instructionLibraryForm=function(id){const i=instructionById(id)||{id:id||uid(),title:'',pumpModel:'',text:'',pdfName:'',pdfUri:'',pdfRefs:[],updatedAt:0};modal(`<h2>${id?'Anleitung bearbeiten':'Gemeinsame Anleitung anlegen'}</h2><form id="instructionLibraryForm"><label for="instructionTitle">Bezeichnung der Anleitung</label><input id="instructionTitle" name="title" value="${esc(i.title)}" maxlength="200" required><label for="instructionModel">Pumpentyp / Modell</label><input id="instructionModel" name="pumpModel" value="${esc(i.pumpModel)}" maxlength="200"><label for="instructionText">Arbeitsreihenfolge / Text</label><textarea id="instructionText" name="text" maxlength="50000">${esc(i.text)}</textarea><p class="hint">${(i.pdfRefs||[]).length} PDF${(i.pdfRefs||[]).length===1?'':'s'} hinterlegt. Jede ausgewählte PDF wird lokal gespeichert und bei Internetverbindung synchronisiert.</p><div class="actions"><button type="submit">Speichern</button><button type="button" id="addPdfInInstruction" class="light">+ PDF hinzufügen</button><button type="button" id="cancel" class="light">Abbrechen</button></div></form>`);const saveForm=(openPdf)=>{const f=$('instructionLibraryForm').elements,title=f.title.value.trim();if(!title){toast('Bitte zuerst eine Bezeichnung der Anleitung eingeben.');f.title.focus();return;}const t=now(),val={...C.clone(i),id:i.id,title,pumpModel:f.pumpModel.value.trim(),text:f.text.value.trim(),pdfName:'',pdfUri:'',pdfRefs:Array.isArray(i.pdfRefs)?i.pdfRefs:[],updatedAt:t};if(change(s=>{const x=s.instructionLibrary.findIndex(x=>x.id===val.id);if(x<0)s.instructionLibrary.push(val);else s.instructionLibrary[x]=val;})){if(openPdf){toast('Anleitung gespeichert. Jetzt PDF auswählen.');choosePdf('library',val.id);}else{$('modal').close();instructionLibraryPanel();toast('Gemeinsame Anleitung gespeichert.');handlingSyncCommit(false);}}};$('instructionLibraryForm').onsubmit=e=>{e.preventDefault();saveForm(false);};$('addPdfInInstruction').onclick=()=>saveForm(true);};

let localizeStart=0,localizeKnown=new Set(),localizeTimer=0;
function mergeHandlingSnapshot(remote,seenAt,localizeOnly){
 const s=C.clone(state);ensureMeta(s);ensureMeta(remote);let changed=false;
 const remoteById=new Map((remote.instructionLibrary||[]).map(x=>[x.id,x]));
 if(localizeOnly){for(const ri of remote.instructionLibrary||[]){if(!ri.attachmentOnly)continue;const li=(s.instructionLibrary||[]).find(x=>x.id===ri.id);if(li&&ri.pdfUri&&ri.pdfUri.startsWith('app-pdf://backup/')&&li.pdfUri!==ri.pdfUri){li.pdfUri=ri.pdfUri;changed=true;}}if(changed)persist(s);return changed;}
 const del={...ensureMeta(s).deleted};for(const [id,t] of Object.entries(ensureMeta(remote).deleted||{}))del[id]=Math.max(Number(del[id])||0,Number(t)||0);s.handlingSyncMeta.deleted=del;
 for(const ri of remote.instructionLibrary||[]){const dt=Number(del[ri.id])||0;if(dt>=(Number(ri.updatedAt)||0))continue;const li=(s.instructionLibrary||[]).find(x=>x.id===ri.id);if(!li||(Number(ri.updatedAt)||0)>(Number(li.updatedAt)||0)){if(li)Object.assign(li,C.clone(ri));else s.instructionLibrary.push(C.clone(ri));changed=true;}else if(ri.attachmentOnly&&ri.pdfUri&&ri.pdfUri.startsWith('app-pdf://backup/')&&li.pdfUri!==ri.pdfUri){li.pdfUri=ri.pdfUri;changed=true;}}
 for(const a of remote.assets||[]){const la=s.assets.find(x=>x.id===a.id);if(!la||!a.handlingInstruction)continue;const rh=a.handlingInstruction,lh=la.handlingInstruction||C.emptyHandling();if((Number(rh.updatedAt)||0)>(Number(lh.updatedAt)||0)){la.handlingInstruction={...C.clone(rh),pdfName:'',pdfUri:'',pdfRefs:Array.isArray(rh.pdfRefs)?rh.pdfRefs:[]};changed=true;}}
 for(const [id,t] of Object.entries(del)){const i=(s.instructionLibrary||[]).findIndex(x=>x.id===id);if(i>=0&&(Number(t)||0)>=(Number(s.instructionLibrary[i].updatedAt)||0)){const obj=s.instructionLibrary[i];s.instructionLibrary.splice(i,1);for(const a of s.assets){if(a.handlingInstruction){a.handlingInstruction.pdfRefs=(a.handlingInstruction.pdfRefs||[]).filter(x=>x!==id);if(a.handlingInstruction.libraryId===id)a.handlingInstruction.libraryId='';}}for(const n of normalInstructions(s))n.pdfRefs=(n.pdfRefs||[]).filter(x=>x!==id);changed=true;}}
 if(seenAt&&seenAt>(Number(s.handlingSyncMeta.seenAt)||0)){s.handlingSyncMeta.seenAt=seenAt;changed=true;}
 if(changed&&persist(s)){render();return true;}return false;
}
function pollLocalize(){clearTimeout(localizeTimer);if(!window.Native||!Native.backupStatus||!Native.readBackup)return;try{const st=backupStatus(),rows=[...(st.backups||[])].sort((a,b)=>(b.at||0)-(a.at||0)),b=rows.find(x=>!localizeKnown.has(x.id)&&(x.at||0)>=localizeStart-1500);if(b){const raw=Native.readBackup(b.id),snap=C.validate(JSON.parse(raw));mergeHandlingSnapshot(snap,0,true);toast('PDF lokal gespeichert. Sie bleibt jetzt auch ohne Empfang verfügbar.');return;}}catch(_){}if(Date.now()-localizeStart<12000)localizeTimer=setTimeout(pollLocalize,700);}
function handlingSyncCommit(localize){try{if(!window.Native||!Native.makeBackup)return;const t=Date.now(),s=C.clone(state);ensureMeta(s).lastLocalAt=t;if(!persist(s))return;if(localize){const st=backupStatus();localizeKnown=new Set((st.backups||[]).map(x=>x.id));localizeStart=t;}Native.makeBackup(JSON.stringify(state));if(localize)localizeTimer=setTimeout(pollLocalize,700);}catch(e){toast('Lokale PDF-Sicherung konnte nicht gestartet werden.');} }
window.handlingSyncCommit=handlingSyncCommit;
if($("instructionLibrary"))$("instructionLibrary").onclick=()=>instructionLibraryPanel();
setTimeout(()=>{migrateMulti();render();if(window.WebPdfOffline)WebPdfOffline.prefetchState(state);},250);window.addEventListener('online',()=>setTimeout(()=>{if(window.WebPdfOffline)WebPdfOffline.prefetchState(state);},900));setInterval(()=>{if(navigator.onLine!==false&&window.WebPdfOffline)WebPdfOffline.prefetchState(state);},60000);
})();

