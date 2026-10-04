const enc=new TextEncoder();
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
async function hmac(password,text){const key=await crypto.subtle.importKey('raw',enc.encode(password),{name:'HMAC',hash:'SHA-256'},false,['sign']),sig=new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(text)));return [...sig].map(b=>b.toString(16).padStart(2,'0')).join('');}
function cookie(req,name){const raw=req.headers.get('cookie')||'';for(const p of raw.split(';')){const [k,...v]=p.trim().split('=');if(k===name)return v.join('=');}return'';}
async function authorized(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return false;const t=cookie(req,'ab_session'),m=t.match(/^(\d+)\.([0-9a-f]{64})$/);if(!m||Number(m[1])<Date.now())return false;return (await hmac(pw,m[1]))===m[2];}

async function companionAuthorized(req,env){const pw=String(env.WEB_PASSWORD||''),got=String(req.headers.get('X-Anlagenbuch-Password')||'');return !!pw&&got===pw;}
async function persistentSessionCookie(env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return'';const maxAge=365*24*3600,exp=Date.now()+maxAge*1000,t=exp+'.'+await hmac(pw,String(exp));return `ab_session=${t}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;}
async function companionHandoffUrl(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)throw Error('WEB_PASSWORD ist noch nicht eingerichtet.');const exp=Date.now()+90000,sig=await hmac(pw,'handoff:'+exp),u=new URL('/companion-auth',req.url);u.searchParams.set('token',exp+'.'+sig);return u.toString();}
async function verifyCompanionHandoff(token,env){const pw=String(env.WEB_PASSWORD||''),m=String(token||'').match(/^(\d+)\.([0-9a-f]{64})$/);if(!pw||!m)return false;const exp=Number(m[1]),now=Date.now();if(!Number.isFinite(exp)||exp<now||exp>now+120000)return false;return (await hmac(pw,'handoff:'+m[1]))===m[2];}
async function login(req,env){const pw=String(env.WEB_PASSWORD||'');if(!pw)return json({ok:false,error:'WEB_PASSWORD ist noch nicht eingerichtet.'},503);let body;try{body=await req.json();}catch(_){return json({ok:false,error:'Ungültige Anmeldung.'},400);}if(String(body.password||'')!==pw)return json({ok:false,error:'Passwort ist nicht richtig.'},401);return json({ok:true},200,{'Set-Cookie':await persistentSessionCookie(env)});}

export async function gateway(req,env){
 const u=new URL(req.url),p=u.pathname;
 if(!['GET','HEAD'].includes(req.method)){const origin=req.headers.get('Origin');if(origin&&origin!==u.origin)return json({error:'Fremder Ursprung.'},403);}
 if(p==='/api/version')return json({ok:true,version:'2.84-test',provider:'onedrive'});
 if(p==='/api/login'&&req.method==='POST')return login(req,env);
 if(p==='/companion-auth'){
  if(!await verifyCompanionHandoff(u.searchParams.get('token'),env))return json({error:'Ungültiger Begleiter-Zugang.'},401);
  return new Response(null,{status:302,headers:{Location:'/', 'Set-Cookie':await persistentSessionCookie(env),'Cache-Control':'no-store'}});
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
