const enc=new TextEncoder();
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
async function hmac(password,text){const key=await crypto.subtle.importKey('raw',enc.encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text)));return [...sig].map(b=>b.toString(16).padStart(2,'0')).join('');}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const p of raw.split(';')){const [k,...v]=p.trim().split('=');if(k===name)return v.join('=');}return'';}
async function authorized(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return false;const t=cookie(req,'ab_session'),m=t.match(/^(\d+)\.([0-9a-f]{64})$/);if(!m||Number(m[1])<Date.now())return false;return (await hmac(pw,m[1]))===m[2];}

async function companionAuthorized(req,env){
 const pw=String(env.WEB_PASSWORD||'');
 const got=String(req.headers.get('X-Anlagenbuch-Password')||'');
 if(pw&&got===pw)return true; // Upgrade compatibility with existing 2.32 and 2.21 companions.
 const token=String(req.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
 return verifySignedDeviceToken(token,env,'device');
}
function randomId(){const a=new Uint8Array(16);crypto.getRandomValues(a);return [...a].map(v=>v.toString(16).padStart(2,'0')).join('');}
async function issueSignedDeviceToken(env,type,duration){
 const pw=String(env.WEB_PASSWORD||'');if(!pw)throw Error('WEB_PASSWORD fehlt');
 const exp=Date.now()+duration,nonce=randomId(),payload=[type,exp,nonce].join('.');
 return payload+'.'+await hmac(pw,'companion-v304:'+payload);
}
async function verifySignedDeviceToken(token,env,type){
 const pw=String(env.WEB_PASSWORD||''),m=String(token||'').match(/^(device|pair)\.(\d+)\.([a-f0-9]{32})\.([a-f0-9]{64})$/);
 if(!pw||!m||m[1]!==type)return false;
 const exp=Number(m[2]);if(!Number.isFinite(exp)||exp<Date.now()||exp>Date.now()+366*86400000)return false;
 const raw=m[1]+'.'+m[2]+'.'+m[3];
 return (await hmac(pw,'companion-v304:'+raw))===m[4];
}
async function persistentSessionCookie(env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return'';const maxAge=365*24*3600,exp=Date.now()+maxAge*1000,t=exp+'.'+await hmac(pw,String(exp));return `ab_session=${t}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;}
async function companionHandoffUrl(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)throw Error('WEB_PASSWORD ist noch nicht eingerichtet.');const exp=Date.now()+90000,sig=await hmac(pw,'handoff:'+exp),u=new URL('/companion-auth','https://anlagenbuch-busch.pages.dev/');u.searchParams.set('token',exp+'.'+sig);return u.toString();}
async function verifyCompanionHandoff(token,env){const pw=String(env.WEB_PASSWORD||''),m=String(token||'').match(/^(\d+)\.([0-9a-f]{64})$/);if(!pw||!m)return false;const exp=Number(m[1]),now=Date.now();if(!Number.isFinite(exp)||exp<now||exp>now+120000)return false;return (await hmac(pw,'handoff:'+m[1]))===m[2];}
async function login(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return json({ok:false,error:'WEB_PASSWORD ist noch nicht eingerichtet.'},503);let body;try{body=await req.json();}catch(_){return json({ok:false,error:'Ungültige Anmeldung.'},400);}if(String(body.password||'')!==pw)return json({ok:false,error:'Passwort ist nicht richtig.'},401);return json({ok:true},200,{'Set-Cookie':await persistentSessionCookie(env)});}

export async function gateway(req,env){
 const u=new URL(req.url),p=u.pathname;
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('Origin');if(origin&&origin!==u.origin)return json({error:'Fremder Ursprung.'},403);}
 if(p==='/api/version')return json({ok:true,version:'3.08',provider:'onedrive'});
 // Pairing is only authorized through the existing authenticated web session.
 if(p==='/api/companion/device-token'&&req.method==='GET'){
  if(!await authorized(req,env))return json({error:'Bitte einmal in der Web-App anmelden.'},401);
  return json({ok:true,token:await issueSignedDeviceToken(env,'device',365*86400000)});
 }
 if(p==='/api/companion/pair-code'&&req.method==='GET'){
  if(!await authorized(req,env))return json({error:'Bitte einmal in der Web-App anmelden.'},401);
  return json({ok:true,code:await issueSignedDeviceToken(env,'pair',60000)});
 }
 if(p==='/api/companion/device-exchange'&&req.method==='POST'){
  let data={};try{data=await req.json();}catch(_){return json({error:'Ungültiger Verbindungscode.'},400)}
  if(!await verifySignedDeviceToken(data.code,env,'pair'))return json({error:'Verbindungscode abgelaufen.'},401);
  return json({ok:true,token:await issueSignedDeviceToken(env,'device',365*86400000)});
 }

 if(p==='/api/login'&&req.method==='POST')return login(req,env);
 if(p==='/companion-auth'){
  if(!await verifyCompanionHandoff(u.searchParams.get('token'),env))return json({error:'Ungültiger Begleiter-Zugang.'},401);
  return new Response(null,{status:302,headers:{Location:'/app.html?v=3.08', 'Set-Cookie':await persistentSessionCookie(env),'Cache-Control':'no-store'}});
 }
 if(p==='/api/companion/handoff'&&req.method==='GET'){
  if(!await companionAuthorized(req,env))return json({error:'Anmeldung erforderlich.'},401);
  return json({ok:true,url:await companionHandoffUrl(req,env)});
 }
 const companion=p==='/api/companion/status'&&req.method==='GET';
 if(!(companion?await companionAuthorized(req,env):await authorized(req,env)))return json({error:'Anmeldung erforderlich. Lokale Änderungen bleiben gespeichert.'},401);
 if(p==='/api/logout'&&req.method==='POST')return json({ok:true},200,{'Set-Cookie':'ab_session=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'});
 if(!env.SYNC)return json({error:'OneDrive-Koordinator noch nicht eingerichtet.'},503);
 return env.SYNC.get(env.SYNC.idFromName('anlagenbuch-main')).fetch(req);
}
