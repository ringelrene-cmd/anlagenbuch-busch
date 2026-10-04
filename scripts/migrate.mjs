import fs from 'node:fs/promises';import {OneDrive} from '../server/onedrive.js';import {mediaName} from '../server/coordinator.js';
const mode=process.argv[2],file=process.argv[3]||'migration-private.json';
if(mode==='export'){
 const origin=process.env.SOURCE_URL||'https://anlagenbuch-busch.pages.dev';if(!process.env.WEB_PASSWORD)throw Error('WEB_PASSWORD nur lokal als Umgebungsvariable setzen.');
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.WEB_PASSWORD})});if(!login.ok)throw Error('Anmeldung fehlgeschlagen.');const cookie=login.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw Error('Sitzung fehlt.');
 const get=async p=>{const r=await fetch(origin+p,{headers:{Cookie:cookie}});if(!r.ok)throw Error('Export fehlgeschlagen ('+r.status+'). Original unverändert.');return r;};
 const boot=await(await get('/api/bootstrap')).json();if(!boot.state)throw Error('Kein Cloud-Datenstand.');const state=AppCore.validate(JSON.parse(boot.state)),refs=new Set();
 const scan=x=>{if(typeof x==='string'&&/^(app-pdf|app-image|web-pdf|web-image|content):/.test(x))refs.add(x);else if(x&&typeof x==='object')Object.values(x).forEach(scan);};scan(state);
 const media={};for(const uri of refs){mediaName(uri);media[uri]=Buffer.from(await(await get('/api/media?uri='+encodeURIComponent(uri))).arrayBuffer()).toString('base64');}
 await fs.writeFile(file,JSON.stringify({format:'anlagenbuch-backup-v1',at:Date.now(),state,media}),{mode:0o600});console.log('Export vollständig: '+state.assets.length+' Anlagen, '+refs.size+' Mediendateien. Datei enthält Nutzdaten; nicht veröffentlichen.');
}else if(mode==='import'){
 const secrets=JSON.parse(await fs.readFile('.onedrive-secrets.json','utf8')),store=new OneDrive(secrets,{get:async()=>secrets.ONEDRIVE_REFRESH_TOKEN,put:async(k,v)=>{secrets.ONEDRIVE_REFRESH_TOKEN=v;await fs.writeFile('.onedrive-secrets.json',JSON.stringify(secrets,null,2),{mode:0o600});}});
 if(await store.read('state.json'))throw Error('Ziel enthält bereits Daten. Kein Überschreiben erlaubt.');
 const b=JSON.parse(await fs.readFile(file,'utf8'));if(b.format!=='anlagenbuch-backup-v1')throw Error('Ungültiger Export.');const state=AppCore.validate(b.state);
 for(const [uri,data]of Object.entries(b.media||{}))await store.put(mediaName(uri),Buffer.from(data,'base64'));
 await store.write('backup-latest.json',b);await store.write('state.json',{schema:1,revision:1,at:Date.now(),state,receipts:{}});
 const verify=await store.read('state.json');if(!SyncMerge.same(state,verify.state))throw Error('Kontrolllesen fehlgeschlagen.');console.log('Daten nach OneDrive übertragen und kontrollgelesen. Jetzt Secrets importieren und neue Web-Version bereitstellen.');
}else throw Error('Aufruf: node scripts/migrate.mjs export|import [DATEI]');
