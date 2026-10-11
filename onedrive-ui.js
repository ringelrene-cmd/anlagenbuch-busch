'use strict';
function backupStatus(){return OneDriveSync.status();}
function updateCloudStatus(){
 const s=backupStatus(),badge=document.querySelector('.offline');if(badge)badge.textContent=s.online?'● Online':'● Offline';
 const status=$('backupStatusText');if(!status)return;
 status.textContent=!s.online?'Offline · Änderungen bleiben lokal gespeichert':s.retrySeconds?'OneDrive-Fehler: '+(s.error||'Verbindung prüfen')+' · neuer Versuch in '+s.retrySeconds+' s':s.error?'OneDrive-Fehler: '+s.error:s.conflicts?'Konflikte warten auf Auswahl ('+s.conflicts+')':s.busy?'OneDrive-Abgleich läuft …':s.pending?'Änderungen lokal gespeichert · Übertragung noch nicht bestätigt':s.revision?'Mit OneDrive abgeglichen · Stand '+s.revision:'OneDrive noch nicht initialisiert';

 const b=$('syncConflicts');if(b){b.hidden=!s.conflicts;b.textContent='Konflikte prüfen ('+s.conflicts+')';}
 const retry=$('retryOneDriveNow');if(retry)retry.disabled=!s.online||s.busy;
}
window.cloudChanged=updateCloudStatus;
function makeBackup(){OneDriveSync.makeBackup();}
function cloudPanel(){modal('<h2>OneDrive</h2><p>Die Verbindung wird zentral verwaltet. Deine Änderungen werden automatisch abgeglichen.</p><p id="cloudDetail"></p><div class="actions"><button id="backupNow">Backup erstellen</button><button id="restoreNow">Backup wiederherstellen</button><button id="cancel" class="light">Schließen</button></div>');$('cloudDetail').textContent=$('backupStatusText').textContent;$('backupNow').onclick=makeBackup;$('restoreNow').onclick=()=>OneDriveSync.restoreBackup();}
$('cloudSettings').onclick=cloudPanel;$('backupButton').onclick=makeBackup;$('import').onclick=()=>OneDriveSync.restoreBackup();
$('cloudSettings').textContent='OneDrive-Status';$('checkUpdates').onclick=()=>Native.checkUpdates();
$('backupButton').textContent='Backup erstellen';$('import').textContent='Backup wiederherstellen';$('export').hidden=true;
const conflicts=document.createElement('button');conflicts.id='syncConflicts';conflicts.className='danger';conflicts.hidden=true;document.querySelector('footer .actions').append(conflicts);
conflicts.onclick=()=>{const rows=OneDriveSync.getConflicts();modal('<h2>Gleichzeitige Änderungen</h2><p>Wähle für jeden Wert die gewünschte Variante. Bis dahin bleibt dein kompletter Änderungsvorgang lokal erhalten.</p><div id="conflictRows"></div><button id="resolveSync">Auswahl übernehmen</button><button id="cancel" class="light">Später</button>');rows.forEach((c,i)=>{const box=document.createElement('section');box.className='record';const title=document.createElement('strong');title.textContent=c.path.map(x=>typeof x==='object'?x.id:x).join(' / ');box.append(title);for(const [v,label,data,missing] of [['remote','OneDrive',c.remote,c.remoteMissing],['local','Dieses Gerät',c.local,c.localMissing]]){const l=document.createElement('label'),input=document.createElement('input');input.type='radio';input.name='conflict-'+i;input.value=v;const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=label+': '+(missing?'Gelöscht':JSON.stringify(data,null,2));l.append(input,pre);box.append(l);}$('conflictRows').append(box);});$('resolveSync').onclick=()=>{const choices=rows.map((_,i)=>document.querySelector('input[name="conflict-'+i+'"]:checked')?.value);if(choices.some(x=>!x))return toast('Bitte für jeden Wert eine Variante auswählen.');try{OneDriveSync.resolveConflicts(choices,rows);$('modal').close();}catch(e){toast(e.message);}};};
updateCloudStatus();setInterval(updateCloudStatus,2000);

(function(){const btn=document.getElementById('retryOneDriveNow');if(btn){btn.addEventListener('click',()=>{OneDriveSync.forceRetry();setTimeout(updateCloudStatus,250);});}setInterval(updateCloudStatus,1500);})();
