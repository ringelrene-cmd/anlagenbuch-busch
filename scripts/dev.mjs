import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {Coordinator} from '../server/coordinator.js';
import {gateway} from '../server/gateway.js';
const root=path.resolve('dist'),data=path.resolve('.local-test');await fs.mkdir(data,{recursive:true});
class Store {allowInitialize=true;async get(n){try{return new Uint8Array(await fs.readFile(path.join(data,n)));}catch(e){if(e.code==='ENOENT')return null;throw e;}}async read(n){const b=await this.get(n);return b?JSON.parse(new TextDecoder().decode(b)):null;}async put(n,b){await fs.writeFile(path.join(data,n+'.tmp'),b);await fs.rename(path.join(data,n+'.tmp'),path.join(data,n));}async write(n,j){return this.put(n,JSON.stringify(j));}}
const engine=new Coordinator(new Store());let queue=Promise.resolve();
const env={WEB_PASSWORD:process.env.WEB_PASSWORD||'test-busch',SYNC:{idFromName:()=>'',get:()=>({fetch:r=>{const task=queue.then(()=>engine.handle(r));queue=task.catch(()=>{});return task;}})}};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.mp3':'audio/mpeg','.wav':'audio/wav','.pdf':'application/pdf'};
http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost:8788');let response;
 if(url.pathname.startsWith('/api/')||url.pathname==='/companion-auth'){const chunks=[];let total=0;for await(const b of req){total+=b.length;if(total>90*1024*1024)throw Error('Anfrage zu groß.');chunks.push(b);}const request=new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks),duplex:'half'});response=await gateway(request,env);}
 else {const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep))throw Error('Ungültiger Pfad.');const b=await fs.readFile(file);response=new Response(b,{headers:{'Content-Type':mime[path.extname(file)]||'application/octet-stream'}});}
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(e.code==='ENOENT'?404:400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}}).listen(8788,'127.0.0.1',()=>console.log('Lokaler Test: http://localhost:8788 · Passwort test-busch (oder WEB_PASSWORD). Cloud wird ausschließlich lokal simuliert.'));
