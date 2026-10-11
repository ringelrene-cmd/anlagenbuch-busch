const GRAPH='https://graph.microsoft.com/v1.0';
export class OneDrive {
 constructor(env,storage){this.env=env;this.storage=storage;this.cached=null;}
 async token(){
  if(this.cached?.until>Date.now()+60000)return this.cached.value;
  const e=this.env;
  for(const k of ['ONEDRIVE_CLIENT_ID','ONEDRIVE_REFRESH_TOKEN','ONEDRIVE_DRIVE_ID','ONEDRIVE_FOLDER_ID'])if(!e[k])throw Object.assign(Error('OneDrive-Einrichtung fehlt: '+k),{status:503});
  const tokenKey='refresh-token-'+(e.ONEDRIVE_TOKEN_VERSION||'1');
  const refresh=await this.storage?.get(tokenKey)||e.ONEDRIVE_REFRESH_TOKEN;
  const body=new URLSearchParams({client_id:e.ONEDRIVE_CLIENT_ID,refresh_token:refresh,grant_type:'refresh_token',scope:'https://graph.microsoft.com/Files.ReadWrite offline_access'});
  const r=await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',body,signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Object.assign(Error('OneDrive-Serveranmeldung fehlgeschlagen ('+r.status+').'),{status:503});
  const j=await r.json();if(j.refresh_token)await this.storage?.put(tokenKey,j.refresh_token);this.cached={value:j.access_token,until:Date.now()+j.expires_in*1000};return j.access_token;
 }
 path(name){if(!/^[A-Za-z0-9._-]+$/.test(name)||name==='.'||name==='..')throw Error('Ungültiger Dateiname.');return '/drives/'+encodeURIComponent(this.env.ONEDRIVE_DRIVE_ID)+'/items/'+encodeURIComponent(this.env.ONEDRIVE_FOLDER_ID)+':/'+name;}
 async request(path,opt={}){
  const r=await fetch(GRAPH+path,{...opt,headers:{Authorization:'Bearer '+await this.token(),...opt.headers},signal:AbortSignal.timeout(20000)});
  if(!r.ok){const e=Object.assign(Error('OneDrive-Anfrage fehlgeschlagen ('+r.status+').'),{status:r.status===404?404:503,retryAfter:r.headers.get('Retry-After')||'30'});if(r.status===429)e.status=429;throw e;}return r;
 }
 async get(name){try{return new Uint8Array(await(await this.request(this.path(name)+':/content')).arrayBuffer());}catch(e){if(e.status===404)return null;throw e;}}
 async exists(name){try{await this.request(this.path(name));return true;}catch(e){if(e.status===404)return false;throw e;}}
 async put(name,bytes){return (await this.request(this.path(name)+':/content',{method:'PUT',headers:{'Content-Type':'application/octet-stream'},body:bytes})).json();}
 // Existing instruction PDFs live in the single OneDrive folder "PDFs".
 pdfPath(name,folder='PDFs'){
  if(typeof name!=='string'||!name||name==='.'||name==='..'||/[\\/\u0000-\u001f]/.test(name)||name.length>240)throw Error('Ungültiger PDF-Dateiname.');
  return '/drives/'+encodeURIComponent(this.env.ONEDRIVE_DRIVE_ID)+'/items/'+encodeURIComponent(this.env.ONEDRIVE_FOLDER_ID)+':/'+encodeURIComponent(folder)+'/'+encodeURIComponent(name);
 }
 async getPdf(name){
  for(const folder of ['PDFs','PDF']){
   try{return new Uint8Array(await(await this.request(this.pdfPath(name,folder)+':/content')).arrayBuffer());}
   catch(e){if(e.status!==404)throw e;}
  }
  return null;
 }
 async pdfExists(name){
  for(const folder of ['PDFs','PDF']){
   try{await this.request(this.pdfPath(name,folder));return true;}
   catch(e){if(e.status!==404)throw e;}
  }
  return false;
 }
 async read(name){const b=await this.get(name);return b?JSON.parse(new TextDecoder().decode(b)):null;}
 async write(name,data){return this.put(name,new TextEncoder().encode(JSON.stringify(data)));}
}
