import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../sync-merge.js';
import '../core.js';
import {Coordinator} from '../server/coordinator.js';
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function cacheAPI(){
 const stores=new Map();
 return {keys:async()=>[...stores.keys()],open:async name=>{if(!stores.has(name))stores.set(name,new Map());const s=stores.get(name);return {match:async k=>s.get(typeof k==='string'?k:k.url)?.clone(),put:async(k,v)=>s.set(typeof k==='string'?k:k.url,v.clone())};}};
}
test('PDF refreshes online, preserves offline copy and falls back on server outage',async()=>{
 const caches=cacheAPI(),url='/api/media?uri='+encodeURIComponent('web-pdf://temp/test.pdf');
 await(await caches.open('anlagenbuch-media-2.72')).put(url,new Response('old'));
 let calls=0;
 const ctx={caches,navigator:{onLine:true},AbortSignal,fetch:async()=>{calls++;return new Response('new');}};ctx.window=ctx;
 vm.runInNewContext(source('web-pdf-offline-249.js'),ctx);
 await ctx.WebPdfOffline.ensure('web-pdf://temp/test.pdf');assert.equal(calls,1);
 assert.equal(await(await(await caches.open('anlagenbuch-media-2.82')).match(url)).text(),'new');
 ctx.navigator.onLine=false;await ctx.WebPdfOffline.ensure('web-pdf://temp/test.pdf','link-id');assert.equal(calls,1);
 ctx.navigator.onLine=true;ctx.fetch=async()=>new Response('',{status:503});await ctx.WebPdfOffline.ensure('web-pdf://temp/test.pdf');
 ctx.fetch=async()=>new Response('',{status:401});await assert.rejects(ctx.WebPdfOffline.ensure('web-pdf://temp/test.pdf'),/401/);
});
test('Service worker keeps PDFs and photos from earlier versions available offline',async()=>{
 const caches=cacheAPI(),url='https://example.test/api/media?uri=image';
 await(await caches.open('anlagenbuch-media-2.80')).put(url,new Response('photo'));
 const handlers={},ctx={caches,Response,URL,AbortSignal,location:{origin:'https://example.test'},fetch:async()=>{throw Error('offline');},self:{addEventListener:(event,fn)=>handlers[event]=fn}};
 vm.runInNewContext(source('sw.js'),ctx);let response;
 handlers.fetch({request:new Request(url),respondWith:p=>response=p});assert.equal(await(await response).text(),'photo');
 ctx.fetch=async()=>new Response('',{status:503});handlers.fetch({request:new Request(url),respondWith:p=>response=p});assert.equal(await(await response).text(),'photo');
 ctx.fetch=async()=>new Response('',{status:404});handlers.fetch({request:new Request(url),respondWith:p=>response=p});assert.equal((await response).status,404);
});
test('Conflict choices cannot silently accept missing choices or apply to changed values',()=>{
 const base={rows:[{id:'a',value:0}]},local={rows:[{id:'a',value:1}]},remote={rows:[{id:'a',value:2}]};
 const journal={base,local,revision:1,pending:null,conflicts:SyncMerge.merge(base,local,remote).conflicts,conflictRemote:remote,conflictRevision:2};
 let raw=SyncMerge.pack(journal);
 const ctx={SyncMerge,OfflineStore:{},localStorage:{getItem:()=>raw,setItem:(k,v)=>raw=v},navigator:{onLine:false},setTimeout:()=>{},setInterval:()=>{},addEventListener:()=>{}};ctx.window=ctx;
 vm.runInNewContext(source('onedrive-client.js'),ctx);const rows=ctx.OneDriveSync.getConflicts();
 assert.throws(()=>ctx.OneDriveSync.resolveConflicts([]),/Variante/);
 ctx.Native.save(JSON.stringify({rows:[{id:'a',value:3}]}));
 assert.throws(()=>ctx.OneDriveSync.resolveConflicts(['remote'],rows),/inzwischen/);
 assert.equal(JSON.parse(ctx.Native.load()).rows[0].value,3);
 ctx.OneDriveSync.resolveConflicts(['local'],ctx.OneDriveSync.getConflicts());
 assert.equal(JSON.parse(ctx.Native.load()).rows[0].value,3);
});
test('Server-created backup can be restored with the same media references',async()=>{
 const files=new Map(),store={read:async n=>files.get(n)||null,write:async(n,d)=>files.set(n,d),get:async n=>files.get(n)||null,put:async(n,d)=>files.set(n,d)};
 const state=AppCore.seed('A1 1 2'),uri='web-pdf://temp/test.pdf';
 state.assets[0].handlingInstruction={pdfUri:uri,pdfName:'test.pdf'};
 files.set('state.json',{schema:1,revision:1,state,receipts:{}});files.set('media-test.pdf',new TextEncoder().encode('%PDF-test'));
 const c=new Coordinator(store),call=(path,data)=>c.handle(new Request('https://example.test'+path,{method:'POST',body:JSON.stringify(data)}));
 const b=(await(await call('/api/backup',{revision:1})).json()).backup;
 assert.equal(b.media[uri],btoa('%PDF-test'));
 const restored=new Map(),other=new Coordinator({get:async n=>restored.get(n),put:async(n,d)=>restored.set(n,d)});
 assert.equal((await other.handle(new Request('https://example.test/api/backup/media',{method:'POST',body:JSON.stringify({media:b.media})}))).status,200);
 assert.equal(new TextDecoder().decode(restored.get('media-test.pdf')),'%PDF-test');
});
test('Health distinguishes an uninitialized folder from existing synchronized data',async()=>{
 const c=new Coordinator({read:async()=>null});
 assert.equal((await(await c.handle(new Request('https://example.test/api/health'))).json()).initialized,false);
});
