// 3.10: read-only comparison of the visible browser copy and OneDrive central copy.
(()=>{
 const b=document.getElementById('compareCompanionStatus');if(!b)return;
 const rows=s=>Array.isArray(s?.dailyBusiness)?s.dailyBusiness:[];
 const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Berlin'});
 const calc=s=>{const r=rows(s),date=today();return {gesamt:r.length,offen:r.filter(x=>x&&!x.done).length,faellig:r.filter(x=>x&&!x.done&&typeof x.date==='string'&&x.date<=date).length};};
 b.addEventListener('click',async()=>{
  const old=b.textContent;b.disabled=true;b.textContent='Prüfe Datenstände …';
  try{
   const sync=window.OneDriveSync?.status?.()||{};
   const local=JSON.parse(window.Native?.load?.()||localStorage.getItem('anlagenbuch-v1')||'null');
   const localStats=calc(local);
   const response=await fetch('/api/bootstrap',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error('Server antwortet mit HTTP '+response.status);
   const data=await response.json();const remote=data.state?JSON.parse(data.state):null,serverStats=calc(remote);
   const detail=`Web-App (lokale Kopie): ${localStats.faellig} offene Tagesgeschäfte (insgesamt ${localStats.gesamt} Einträge)\nOneDrive-Zentralstand: ${serverStats.faellig} offene Tagesgeschäfte (insgesamt ${serverStats.gesamt} Einträge)\nSynchronisation: ${sync.pending?'Ausstehende Änderungen':'Keine ausstehenden Änderungen'}\nKonflikte: ${sync.conflicts||0}\nLetzter Sync-Fehler: ${sync.error||'keiner'}\nLokale Revision: ${sync.revision||0}; Server-Revision: ${data.revision||0}`;
   alert('Anlagenbuch – Zählerdiagnose\n\n'+detail+'\n\nKeine Daten wurden bei dieser Prüfung verändert.');
  }catch(e){alert('Zählerprüfung fehlgeschlagen: '+e.message)}
  finally{b.disabled=false;b.textContent=old;}
 });
})();
