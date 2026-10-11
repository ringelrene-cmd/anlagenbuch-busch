'use strict';
(()=>{
 document.title='Anlagenbuch Web · Busch Group';

 if('serviceWorker'in navigator){navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='anlagenbuch-version'&&e.data.version==='3.16.2'){try{sessionStorage.setItem('anlagenbuch-sw-version','3.16.2');}catch(_){}}});}
 const footer=document.querySelector('footer small');if(footer)footer.textContent='Anlagenbuch Web 3.16.2 · Offline-Arbeit mit lokalem Schutzspeicher · automatischer OneDrive-Abgleich';
 // Users can connect their installed Windows helper without re-entering the web password.
 window.connectWindowsCompanion=async()=>{
  try{
   const r=await fetch('/api/companion/pair-code',{cache:'no-store',credentials:'same-origin'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error||('Gerätefreigabe fehlgeschlagen (HTTP '+r.status+').'));
   if(!d.code)throw Error('Kein Verbindungscode erhalten.');
   location.href='anlagenbuch-begleiter://connect?code='+encodeURIComponent(d.code);
  }catch(e){alert('Windows-Begleiter konnte nicht verbunden werden: '+e.message);}
 };
 window.connectAndroidCompanion=async()=>{
  try{
   const r=await fetch('/api/companion/pair-code',{cache:'no-store',credentials:'same-origin'});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(d.error||('Gerätefreigabe fehlgeschlagen (HTTP '+r.status+').'));
   if(!d.code)throw Error('Kein Verbindungscode erhalten.');
   location.href='anlagenbuch-begleiter://connect?code='+encodeURIComponent(d.code);
  }catch(e){alert('Android-Begleiter konnte nicht verbunden werden: '+e.message);}
 };
 // Controls live in index.html and remain visible even before the JS runs.
 const windowsConnect=document.getElementById('connectWindowsCompanion');
 if(windowsConnect)windowsConnect.addEventListener('click',window.connectWindowsCompanion);
 const androidConnect=document.getElementById('connectAndroidCompanion');
 if(androidConnect)androidConnect.addEventListener('click',window.connectAndroidCompanion);
 const actions=document.querySelector('footer .actions');if(actions){const b=document.createElement('button');b.className='light';b.textContent='Abmelden / Sitzung beenden';b.onclick=async()=>{try{await fetch('/api/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});}finally{location.replace('/login.html');}};actions.appendChild(b);}
 const oldSite=window.sitePlanPanel;if(typeof oldSite==='function')window.sitePlanPanel=()=>{oldSite();for(const img of document.querySelectorAll('img')){const src=img.getAttribute('src')||'';if(/^(app-image|web-image):/.test(src))img.src=window.webMediaUrl(src);}};
 window.setupAssistant=function(force=false){if(!force)return;modal('<h2>Web-Version</h2><p class="status ok">OneDrive wird serverseitig verwaltet.</p><p class="status ok">✓ Anlagenbestand wird auf diesem Gerät zusätzlich lokal für den Offline-Betrieb gespeichert.</p><p class="status ok">✓ Updates erfolgen zentral – keine Installation auf diesem Rechner erforderlich.</p><p>Für QR-Codes kann der Browser nach deiner Zustimmung auf die Kamera zugreifen. Benachrichtigungstöne funktionieren zuverlässig, solange die Web-Seite geöffnet ist.</p><div class="actions"><button id="webSiren" class="light">Sirenenton testen</button><button id="webLogout" class="light">Abmelden</button><button id="cancel" class="light">Schließen</button></div>');$('webSiren').onclick=()=>Native.testFaultSiren();$('webLogout').onclick=async()=>{await fetch('/api/logout',{method:'POST',credentials:'same-origin',cache:'no-store'});location.replace('/login.html');};};
 if($('setupAssistant'))$('setupAssistant').onclick=()=>setupAssistant(true);
 let installPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
 // 3.00: Service Worker wird ausschließlich vom stabilen Startschutz verwaltet; keine Update-/Reload-Schleife aus der Haupt-App.
 async function installWebApp(){if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;return;}const ua=navigator.userAgent||'';if(/iPhone|iPad|iPod/.test(ua))toast('Auf iPhone/iPad: Teilen → Zum Home-Bildschirm.');else if(/Macintosh/.test(ua))toast('In Safari: Ablage → Zum Dock hinzufügen. In Chrome/Edge erscheint das Installieren-Symbol in der Adresszeile.');else toast('Im Browsermenü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.');}
 window.showCompanionInstall=()=>{const ua=navigator.userAgent||'',android=/Android/i.test(ua),windows=/Windows/i.test(ua),apple=/iPhone|iPad|iPod|Macintosh/i.test(ua);modal(`<h2>Begleit-App installieren / aktualisieren</h2><p>Das Anlagenbuch selbst bleibt ab Version 2.12 die Web-Version. Die Begleiter sind nur für Systemfunktionen wie Widget und Alarmton da.</p><div class="companionCards"><section class="record ${android?'recommended':''}"><h3>Android-Begleiter 2.39 ${android?'· dieses Gerät':''}</h3><p>Widget auf dem Startbildschirm mit Live-Zählern aus der Web-Version, Hintergrundalarm mit Anlagenbuch-Sirene und direkter Start der Web-Version. Android 2.39 ist die aktuelle signierte Version. Die Gerätefreigabe ist bei bestehenden Verbindungen weiterhin gültig.</p><a class="buttonLink" href="/companion/Anlagenbuch-Begleiter-Android-2.39.apk" download>Android-Update 2.39 herunterladen</a><p class="hint">APK öffnen und die Android-Installation bestätigen. Die bisherige Begleit-App nicht deinstallieren.</p></section><section class="record ${windows?'recommended':''}"><h3>Windows-Begleiter – Version wird geprüft ${windows?'· dieses Gerät':''}</h3><p>Automatische Statusabfrage mit sicher gespeicherter Gerätefreigabe, Sirene und Taskleistenanzeige.</p><a class="buttonLink" href="https://1drv.ms/f/c/52c38b14925c0f91/IgD21JSqMNX-Tqxn4Gk2MTQLAZAPEjqALkjsm15PRJTJqMc?e=QwMPz6" target="_blank" rel="noopener noreferrer">Windows-Begleiter in OneDrive öffnen</a><p class="hint">Datei im OneDrive-Ordner auswählen und herunterladen. Einmalige Anmeldung bei der Ersteinrichtung; danach automatischer Datenabruf.</p></section><section class="record ${apple?'recommended':''}"><h3>Apple ${apple?'· dieses Gerät':''}</h3><p>iPhone, iPad und Mac können die Web-App direkt installieren. Web-Benachrichtigungen nutzen den Systemton; ein fest erzwungener eigener Sirenenton im geschlossenen Zustand benötigt bei Apple eine signierte native App.</p><button id="installPwa" type="button">Web-App installieren</button></section></div><p class="hint">Android- und Windows-Updates werden hier bereitgestellt. Neue Installationen können hier einmalig sicher freigegeben werden; die Installation selbst wird aus Sicherheitsgründen vom Betriebssystem bestätigt. Auf Firmenrechnern können Installationen durch IT-Richtlinien gesperrt sein. Dann die Web-Version ohne Begleiter weiter im Browser verwenden.</p><div class="actions"><button id="cancel" class="light">Schließen</button></div>`);if($('installPwa'))$('installPwa').onclick=installWebApp;if($('pairInstalledHelper'))$('pairInstalledHelper').onclick=()=>{if(android)window.connectAndroidCompanion();else if(windows)window.connectWindowsCompanion();else toast('Gerätefreigabe auf dem jeweiligen Android- oder Windows-Gerät öffnen.');};};
 if($('companionInstall'))$('companionInstall').onclick=showCompanionInstall;

 if($('teamSetup'))$('teamSetup').onclick=()=>{if(window.CompanionNative&&window.companySetupPanel){companySetupPanel();return;}modal('<h2>Firmenzugang</h2><p>Der OneDrive-Firmenzugang liegt bei der reinen Web-Version geschützt auf dem Server und wird nicht an den Browser ausgegeben.</p><p>Die Begleiter werden künftig über die Anmeldung der Web-App verbunden. Die Android-APK 2.33 muss hierfür noch erstellt werden.</p><div class="actions"><button id="cancel" class="light">Schließen</button></div>');};
 let qrLibPromise=null;
 function ensureQrLib(){if(window.jsQR)return Promise.resolve();if(qrLibPromise)return qrLibPromise;qrLibPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='/vendor/jsQR.js';s.onload=resolve;s.onerror=()=>reject(Error('QR-Erkennung konnte nicht geladen werden.'));document.head.appendChild(s);});return qrLibPromise;}
 function decodeImageSource(source,w,h){const max=900,scale=Math.min(1,max/Math.max(w,h)),cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale)),c=document.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(source,0,0,cw,ch);const d=g.getImageData(0,0,cw,ch);return window.jsQR?.(d.data,cw,ch,{inversionAttempts:'attemptBoth'})?.data||'';}
 window.webScanQr=()=>{
  modal('<h2>QR-Code scannen</h2><p>QR-Code vor die Kamera halten. Ein eindeutiger Anlagen- oder Unit-Code öffnet sofort den passenden Datensatz.</p><video id="webQrVideo" class="webQrVideo" autoplay playsinline muted></video><canvas id="webQrCanvas" class="webQrCanvas"></canvas><p id="webQrState" class="hint">Kamera wird gestartet …</p><details><summary>Foto oder USB-Scanner als Ersatz</summary><input id="webQrPhoto" type="file" accept="image/*" capture="environment"><input id="webQrText" autocomplete="off" placeholder="QR-Inhalt"><div class="actions"><button id="webQrOpen">Text öffnen</button></div></details><div class="actions"><button id="cancel" class="light">Schließen</button></div>');
  let stream=null,timer=0,busy=false,detector=null;
  const video=$('webQrVideo'),canvas=$('webQrCanvas'),st=$('webQrState');
  const stop=()=>{if(timer){clearTimeout(timer);timer=0;}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null;}};
  const process=raw=>{raw=String(raw||'').trim();if(!raw||busy)return;busy=true;stop();if(window.handleQrScanResult&&window.handleQrScanResult(raw))return;busy=false;st.textContent='Code erkannt, aber keine passende Anlage oder Unit gefunden: '+raw;};
  const scanFrame=async()=>{if(!stream||busy||!document.getElementById('webQrVideo')||!$('modal').open){stop();return;}try{if(detector){const rows=await detector.detect(video);if(rows.length&&rows[0].rawValue){process(rows[0].rawValue);return;}}else if(window.jsQR&&video.videoWidth){const max=720,scale=Math.min(1,max/video.videoWidth),w=Math.max(1,Math.round(video.videoWidth*scale)),h=Math.max(1,Math.round(video.videoHeight*scale));canvas.width=w;canvas.height=h;const g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(video,0,0,w,h);const d=g.getImageData(0,0,w,h),code=window.jsQR(d.data,w,h,{inversionAttempts:'attemptBoth'});if(code?.data){process(code.data);return;}}}catch(_){}timer=setTimeout(scanFrame,180);};
  $('webQrOpen').onclick=()=>process($('webQrText').value);$('webQrText').onkeydown=e=>{if(e.key==='Enter')process(e.target.value);};
  $('webQrPhoto').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{await ensureQrLib();const u=URL.createObjectURL(f),img=new Image();img.onload=()=>{try{const raw=decodeImageSource(img,img.naturalWidth,img.naturalHeight);URL.revokeObjectURL(u);raw?process(raw):st.textContent='Auf dem Foto wurde kein QR-Code erkannt.';}catch(err){st.textContent=err.message;}};img.onerror=()=>{URL.revokeObjectURL(u);st.textContent='Foto konnte nicht gelesen werden.';};img.src=u;}catch(err){st.textContent=err.message;}};
  (async()=>{try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Dieser Browser stellt keine Kamera für Webseiten bereit.');if('BarcodeDetector'in window){try{detector=new BarcodeDetector({formats:['qr_code']});}catch(_){detector=null;}}if(!detector)await ensureQrLib();stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});video.srcObject=stream;await video.play();st.textContent='QR-Code in das Kamerabild halten';scanFrame();}catch(e){st.textContent=e.message+' Du kannst darunter ein Foto auswählen oder einen USB-Scanner verwenden.';stop();}})();
 };
})();


// Automatische Windows-Update-Erkennung beim Öffnen des Begleiter-Dialogs.
// Die Web-App kann nicht feststellen, welche EXE lokal installiert ist; sie meldet
// daher neue OneDrive-Dateien, statt eine Installation zu behaupten.
(function(){
 const original=window.showCompanionInstall;
 if(typeof original!=='function')return;
 window.showCompanionInstall=function(){
  original.apply(this,arguments);
  const anchor=[...document.querySelectorAll('a[href*="1drv.ms/f/"]')].find(a=>a.textContent.includes('Windows'));
  if(!anchor)return;
  const status=document.createElement('p');status.className='hint';status.textContent='Prüfe Windows-Updates in OneDrive …';
  anchor.insertAdjacentElement('afterend',status);
  fetch('/api/companion/windows-update',{credentials:'same-origin',cache:'no-store'}).then(async r=>{
   const info=await r.json();if(!r.ok||!info.ok)throw new Error(info.error||'OneDrive nicht erreichbar');
   if(!info.available){status.textContent='Zurzeit keine Windows-EXE in diesem Ordner gefunden.';return;}
   const key='ab-windows-update-file';const signature=[info.name,info.modified,info.size].join('|');
   const prev=localStorage.getItem(key);
   const newer=!!prev&&prev!==signature;
   const v=String(info.version||'').trim();
   const title=anchor.closest('section')?.querySelector('h3');
   if(title)title.textContent='Windows-Begleiter '+(v||'(Version unbekannt)')+(/Windows/i.test(navigator.userAgent)?' · dieses Gerät':'');
   status.textContent=(newer?'Neue Windows-Datei erkannt: ':'Neueste verfügbare Windows-Datei: ')+info.name+(info.modified?' · '+new Date(info.modified).toLocaleString('de-DE'):'');
   anchor.textContent='Windows-Begleiter '+(v||'')+' herunterladen';
   anchor.href=info.downloadUrl;
   anchor.removeAttribute('download');
   anchor.onclick=()=>{try{localStorage.setItem(key,signature);}catch(_){}};
  }).catch(e=>{status.textContent='Automatische Prüfung nicht verfügbar. Ordner manuell öffnen. '+e.message;});
 };
})();
