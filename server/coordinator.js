import '../sync-merge.js';
import '../core.js';
import {OneDrive} from './onedrive.js';
const M=globalThis.SyncMerge;
const response=(j,status=200)=>new Response(JSON.stringify(j),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const empty=()=>({schema:1,revision:0,state:null,receipts:{}});
export class Coordinator {
 constructor(store){this.store=store;this.knownMedia=new Set();}
 async read(){return await this.store.read('state.json')||empty();}
 async mediaPresent(s){
  const refs=new Set();const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image|content):/.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(s);
  const names=[...refs].map(mediaName).filter(n=>!this.knownMedia.has(n));
  for(let i=0;i<names.length;i+=6)await Promise.all(names.slice(i,i+6).map(async name=>{if(!(this.store.exists?await this.store.exists(name):await this.store.get(name)))throw Error('Zugeordnete Datei fehlt in OneDrive: '+name+'. Zuerst Medien migrieren.');this.knownMedia.add(name);}));
 }
 async handle(req){
  const u=new URL(req.url),path=u.pathname;
  if(path==='/api/media/upload'&&req.method==='POST'){
   const kind=u.searchParams.get('kind');if(!['pdf','image'].includes(kind))throw Error('Ungültiger Medientyp.');
   const bytes=new Uint8Array(await req.arrayBuffer());if(!bytes.length||bytes.length>50*1024*1024)throw Error('Datei leer oder größer als 50 MB.');
   const name=decodeURIComponent(req.headers.get('X-File-Name')||'Datei');const ext=kind==='pdf'?'pdf':(name.match(/\.(png|jpe?g|webp)$/i)?.[1]||'jpg').toLowerCase();
   if(kind==='pdf'&&!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('Ungültige PDF-Datei.');
   const file=crypto.randomUUID()+'.'+ext;await this.store.put('media-'+file,bytes);return response({ok:true,uri:'web-'+kind+'://temp/'+file,name});
  }
  if(path==='/api/media'&&req.method==='GET'){
   const uri=u.searchParams.get('uri'),name=mediaName(uri);let bytes=await this.store.get(name);
   // OneDrive-Migration: Falls bei der OneDrive-Migration nur der Datenstand/Backup vorhanden ist,
   // eine fehlende Mediendatei automatisch aus dem letzten Backup zurückholen.
   if(!bytes){
    const backup=await this.store.read('backup-latest.json');const encoded=backup?.media?.[uri];
    if(typeof encoded==='string'&&encoded){try{bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));if(bytes.length)await this.store.put(name,bytes);}catch(_){bytes=null;}}
   }
   if(!bytes)return response({error:'Datei fehlt im gemeinsamen OneDrive-Speicher. PDF auf einem Gerät mit vorhandener Offline-Kopie einmal öffnen.'},404);
   const ext=name.split('.').pop();return new Response(bytes,{headers:{'Content-Type':ext==='pdf'?'application/pdf':ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg','Cache-Control':'private, no-cache','X-Content-Type-Options':'nosniff'}});
  }
  if(path==='/api/backup/read'&&req.method==='GET'){const b=await this.store.read('backup-latest.json');if(!b)return response({error:'Noch kein Backup vorhanden.'},404);return response({ok:true,backup:b});}
  if(path==='/api/backup/media'&&req.method==='POST'){
   const {media}=await req.json();let total=0;for(const [uri,data] of Object.entries(media||{})){const name=mediaName(uri);if(typeof data!=='string')throw Error('Ungültige Mediendaten.');total+=data.length;if(total>84*1024*1024)throw Error('Dateien zu groß.');const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)),existing=await this.store.get(name);if(existing){if(existing.length!==bytes.length||existing.some((v,i)=>v!==bytes[i]))throw Error('Datei-ID enthält abweichende Daten. Wiederherstellung abgebrochen.');}else await this.store.put(name,bytes);}return response({ok:true});
  }
  const doc=await this.read();
  if(path==='/api/bootstrap'&&req.method==='GET')return response({ok:true,state:doc.state?JSON.stringify(doc.state):'',revision:doc.revision,latestAt:doc.at||0});
  if(path==='/api/health'&&req.method==='GET')return response({ok:true,onedrive:true,initialized:!!doc.state,revision:doc.revision});
  if(path==='/api/companion/status'&&req.method==='GET'){
   const open=[],progress=[];for(const a of doc.state?.assets||[])for(const f of a.faults||[]){const row={id:f.id,assetId:a.id,assetName:a.name,description:f.description,reportedAt:f.reportedAt,unitName:f.unitBarcode||f.unitName||''};if(f.status==='open')open.push(row);if(f.status==='in_progress')progress.push(row);}
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
   return response({ok:true,serverTime:Date.now(),openCount:open.length,progressCount:progress.length,todayCount:(doc.state?.dailyBusiness||[]).filter(r=>r.date===today&&!r.done).length,openFaultIds:open.map(x=>x.id),openFaults:open.slice(-20),latestAt:doc.at||0});
  }
  if(path==='/api/sync'&&req.method==='POST'){
   const body=await req.json();if(typeof body.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(body.id))throw Error('Ungültige Vorgangs-ID.');
   if(doc.receipts[body.id])return response({ok:true,state:doc.state,revision:doc.revision,at:doc.at});
   const local=AppCore.validate(body.local),base=body.base===null?null:AppCore.validate(body.base);
   if(!doc.state&&!this.store.allowInitialize)return response({error:'Migration noch nicht freigegeben. ONEDRIVE_ALLOW_INITIALIZE einmalig aktivieren.'},409);
   if(doc.state&&!base)return response({error:'Lokaler Ausgangsstand fehlt. Vor der Migration den lokalen Bestand sichern und abgleichen.'},409);
   // Reject the entire transaction on conflict, including dependent changes.
   const merged=doc.state?M.merge(base,local,doc.state):{state:local,conflicts:[]};
   if(merged.conflicts.length)return response({ok:false,error:'Widersprüchliche Änderungen bitte auswählen.',conflicts:merged.conflicts,state:doc.state,revision:doc.revision},409);
   const next=AppCore.validate(merged.state);await this.mediaPresent(next);
   const receipt={state:next,revision:doc.revision+1,at:Date.now()};
   // Receipt and state share one OneDrive write: lost responses can safely retry.
   // An offline client may retry long after 200 other edits. Keep its receipt,
   // otherwise a delayed retry could resurrect a record deleted in the meantime.
   doc.receipts[body.id]={revision:receipt.revision};
   await this.store.write('state.json',{...doc,...receipt});return response({ok:true,...receipt});
  }
  if(path==='/api/backup'&&req.method==='POST'){
   const supplied=await req.clone().json();
   if(supplied.backup){
    const b=supplied.backup;if(b.format!=='anlagenbuch-backup-v1'||!Number.isFinite(b.at))throw Error('Ungültiges Backup.');AppCore.validate(b.state);
    const refs=new Set();const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image):/.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(b.state);
    let total=0;for(const uri of refs){mediaName(uri);if(typeof b.media?.[uri]!=='string')throw Error('Backup unvollständig: '+uri);total+=b.media[uri].length;if(total>84*1024*1024)throw Error('Backup zu groß.');atob(b.media[uri]);}
    const previous=await this.store.read('backup-latest.json');if(previous&&previous.at>b.at)return response({ok:true,superseded:true});
    await this.store.write('backup-latest.json',b);return response({ok:true});
   }
   const body=await req.json();if(!doc.state||body.revision!==doc.revision)return response({error:'Datenstand hat sich geändert. Bitte erneut sichern.'},409);
   const media={};const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image):/.test(x))media[x]=null;else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(doc.state);
   let total=0;for(const uri of Object.keys(media)){const name=mediaName(uri),b=await this.store.get(name);if(!b)throw Error('Backup abgebrochen: Datei fehlt '+name);total+=b.length;if(total>60*1024*1024)throw Error('Backup größer als 60 MB. Administrator muss das Speicherlimit erweitern.');let str='';for(let i=0;i<b.length;i+=8192)str+=String.fromCharCode(...b.slice(i,i+8192));media[uri]=btoa(str);}
   const backup={format:'anlagenbuch-backup-v1',at:Date.now(),revision:doc.revision,state:doc.state,media};await this.store.write('backup-latest.json',backup);return response({ok:true,backup});
  }
  return response({error:'API-Endpunkt nicht verfügbar.',path},404);
 }
}
export function mediaName(uri){
 const u=new URL(uri),bits=u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
 if(['web-pdf:','web-image:'].includes(u.protocol)&&u.hostname==='temp'&&bits.length===1&&/^[A-Za-z0-9._-]+$/.test(bits[0]))return 'media-'+bits[0];
 if(['app-pdf:','app-image:'].includes(u.protocol)&&u.hostname==='backup'&&bits.length===2&&bits.every(x=>/^[A-Za-z0-9._-]+$/.test(x)))return 'legacy-'+bits.join('--');
 throw Error('Dateiverweis muss vor der Umstellung migriert werden: '+uri);
}
export class AnlagenbuchSync {
 constructor(ctx,env){const store=new OneDrive(env,ctx.storage);store.allowInitialize=env.ONEDRIVE_ALLOW_INITIALIZE==='true';this.engine=new Coordinator(store);this.queue=Promise.resolve();}
 fetch(req){const job=this.queue.then(()=>this.engine.handle(req));this.queue=job.catch(()=>{});return job.catch(e=>{const r=response({error:e.message},e.status||400);if(e.retryAfter)r.headers.set('Retry-After',e.retryAfter);return r;});}
}
export default {fetch(){return response({error:'Nur über das Anlagenbuch erreichbar.'},403);}};
