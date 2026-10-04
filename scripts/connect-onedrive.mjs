import fs from 'node:fs/promises';
const client=process.argv[2],folder=process.argv[3]||'Anlagenbuch-Busch-Test';
if(!client)throw Error('Aufruf: node scripts/connect-onedrive.mjs CLIENT-ID [ORDNERNAME]');
const base='https://login.microsoftonline.com/consumers/oauth2/v2.0/',scope='https://graph.microsoft.com/Files.ReadWrite offline_access';
const start=await fetch(base+'devicecode',{method:'POST',body:new URLSearchParams({client_id:client,scope})}),device=await start.json();
if(!start.ok)throw Error(device.error_description||'App-Registrierung prüfen.');
console.log(device.message||('Öffnen: '+device.verification_uri+' · Code: '+device.user_code));
let token,interval=device.interval||5;const deadline=Date.now()+device.expires_in*1000;
while(Date.now()<deadline){await new Promise(r=>setTimeout(r,interval*1000));const r=await fetch(base+'token',{method:'POST',body:new URLSearchParams({client_id:client,grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:device.device_code})}),j=await r.json();if(r.ok){token=j;break;}if(j.error==='slow_down'){interval+=5;continue;}if(j.error==='authorization_pending')continue;throw Error(j.error_description||j.error);}
if(!token?.refresh_token)throw Error('Freigabe abgelaufen oder fehlendes offline_access.');
const graph=async(path,opt={})=>{const r=await fetch('https://graph.microsoft.com/v1.0'+path,{...opt,headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json',...opt.headers}});if(!r.ok)throw Error('OneDrive-Anfrage: '+r.status);return r.json();};
const drive=await graph('/me/drive');let dir;
const check=await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/'+encodeURIComponent(folder),{headers:{Authorization:'Bearer '+token.access_token}});
if(check.ok){dir=await check.json();if(!dir.folder)throw Error('Ordnername ist bereits eine Datei.');}else if(check.status===404)dir=await graph('/me/drive/root/children',{method:'POST',body:JSON.stringify({name:folder,folder:{},'@microsoft.graph.conflictBehavior':'fail'})});else throw Error('OneDrive-Ordner konnte nicht geprüft werden.');
await fs.writeFile('.onedrive-secrets.json',JSON.stringify({ONEDRIVE_CLIENT_ID:client,ONEDRIVE_REFRESH_TOKEN:token.refresh_token,ONEDRIVE_TOKEN_VERSION:String(Date.now()),ONEDRIVE_DRIVE_ID:drive.id,ONEDRIVE_FOLDER_ID:dir.id},null,2),{mode:0o600});
console.log('Freigabe lokal in .onedrive-secrets.json gespeichert. Diese Datei niemals hochladen, teilen oder in Git aufnehmen. Mit Wrangler als Worker-Secrets importieren.');
