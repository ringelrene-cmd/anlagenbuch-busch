'use strict';
(function(){
const CURRENT='2.72';
let checked=false;
const escu=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function show(info){
 if(!info||!info.available)return;
 const notes=Array.isArray(info.notes)&&info.notes.length?`<ul>${info.notes.map(x=>`<li>${escu(x)}</li>`).join('')}</ul>`:'<p>Für dieses Update ist kein Änderungstext hinterlegt.</p>';
 modal(`<h2>Update ${escu(info.version)} verfügbar</h2><p>Eine neuere Anlagenbuch-Version liegt im Dropbox-Ordner <strong>Updates</strong>.</p><h3>Was ist neu?</h3>${notes}<p class="hint">Das Update wird direkt in Anlagenbuch heruntergeladen. Danach öffnet Android nur noch den Installationsdialog.</p><p id="updateProgress" class="status">Bereit zum Herunterladen.</p><div class="actions"><button id="downloadUpdate">Update herunterladen</button><button id="cancel" class="light">Später</button></div>`);
 const btn=document.getElementById('downloadUpdate');
 btn.onclick=()=>{if(window.Native&&Native.downloadUpdate){btn.disabled=true;btn.textContent='Wird heruntergeladen …';Native.downloadUpdate(info.path,info.version);}else nativeMessage('Direkter Update-Download ist auf diesem Gerät nicht verfügbar.');};
}
window.updateDownloadState=raw=>{let s=raw;try{if(typeof raw==='string')s=JSON.parse(raw);}catch(e){return;}const p=document.getElementById('updateProgress'),b=document.getElementById('downloadUpdate');if(!p)return;if(s.error){p.textContent=s.error;p.className='status';if(b){b.disabled=false;b.textContent='Erneut versuchen';}return;}if(s.stage==='download'){const pct=Number.isFinite(s.percent)?Math.max(0,Math.min(100,Math.round(s.percent))):0;p.textContent=s.total>0?`Update wird heruntergeladen … ${pct} %`:'Update wird heruntergeladen …';}else if(s.stage==='verify'){p.textContent='Download fertig · Update wird geprüft …';}else if(s.stage==='permission'){p.textContent='Download fertig. Bitte „Apps aus dieser Quelle zulassen“ aktivieren. Danach geht es automatisch weiter.';}else if(s.stage==='install'){p.textContent='Update geprüft · Android-Installation wird geöffnet …';}else if(s.stage==='ready'){p.textContent='Update heruntergeladen.';}}
let manualCheckToken=0,manualFound=false;
window.updateInfo=raw=>{let info=raw;try{if(typeof raw==='string')info=JSON.parse(raw);}catch(e){return;}if(info&&info.available){manualFound=true;show(info);return;}if(info&&info.error&&window.nativeMessage)nativeMessage(info.error);};
window.checkAppUpdates=(manual=false)=>{
 if(!window.Native||!Native.checkUpdates){if(manual)nativeMessage('Update-Prüfung ist auf diesem Gerät nicht verfügbar.');return;}
 if(!manual){if(checked)return;checked=true;Native.checkUpdates(CURRENT,false);return;}
 checked=false;manualFound=false;const token=++manualCheckToken;
 const fresh=()=>{if(token!==manualCheckToken||manualFound)return;Native.checkUpdates(CURRENT,true);};
 fresh();
 setTimeout(fresh,1200);
 setTimeout(fresh,3200);
};
window.APP_VERSION=CURRENT;
setTimeout(()=>window.checkAppUpdates(false),1800);
})();
