'use strict';
(function(root){
const clone=x=>JSON.parse(JSON.stringify(x));
const normal=s=>(s.instructionLibrary||[]).filter(i=>!i.attachmentOnly);
const deleted=(s,id)=>Number((s.handlingSyncMeta||{}).deleted?.[id])>0;
function migrate(s){
 for(const i of normal(s)){
  if(i.poolLinksVersion===1)continue;
  i.poolLinks=i.poolLinks||{};
  const ids=new Set((s.assets||[]).filter(a=>a.handlingInstruction?.libraryId===i.id).map(a=>a.id));
  for(const p of s.instructionLibrary||[])if(p.attachmentOnly&&p.ownerType==='library'&&p.ownerId===i.id)for(const id of p.assetIds||[])ids.add(id);
  for(const id of ids)if(!i.poolLinks[id])i.poolLinks[id]={at:0,eventId:'legacy',linked:true};
  i.poolLinksVersion=1;
 }
 return s;
}
function linked(i,id){return !!(i.poolLinks&&i.poolLinks[id]&&i.poolLinks[id].linked);}
function setLink(s,id,assetId,value){
 migrate(s);const i=normal(s).find(i=>i.id===id);if(!i||deleted(s,id))return;
 const old=i.poolLinks[assetId],at=Math.max(Date.now(),(Number(old?.at)||0)+1);
 i.poolLinks[assetId]={at,eventId:at.toString(36)+'-'+Math.random().toString(36).slice(2),linked:value};
 // Compatibility with the old single-link field; authoritative links stay on the pool item.
 const a=s.assets.find(a=>a.id===assetId);if(a&&a.handlingInstruction)a.handlingInstruction.libraryId='';
}
function merge(local,remote){
 local=migrate(clone(local));remote=migrate(clone(remote));
 const del={...remote.handlingSyncMeta?.deleted};
 for(const [id,t] of Object.entries(local.handlingSyncMeta?.deleted||{}))del[id]=Math.max(Number(t)||0,Number(del[id])||0);
 remote.handlingSyncMeta={...remote.handlingSyncMeta,deleted:del};
 const items=new Map((remote.instructionLibrary||[]).map(i=>[i.id,i]));
 for(const li of local.instructionLibrary||[]){
  const ri=items.get(li.id);if(!ri){items.set(li.id,clone(li));continue;}
  const winner=Number(li.updatedAt||0)>Number(ri.updatedAt||0)?clone(li):ri;
  // A restored remote URI belongs to this device and must survive metadata merging.
  if(ri.attachmentOnly&&ri.pdfUri)winner.pdfUri=ri.pdfUri;
  if(!li.attachmentOnly){
   winner.poolLinks={...ri.poolLinks};winner.poolLinksVersion=1;
   for(const [id,e] of Object.entries(li.poolLinks||{})){
    const prev=winner.poolLinks[id];
    if(!prev||e.at>prev.at||(e.at===prev.at&&String(e.eventId)>String(prev.eventId)))winner.poolLinks[id]=clone(e);
   }
  }
  items.set(li.id,winner);
 }
 remote.instructionLibrary=[...items.values()].filter(i=>!del[i.id]&&!(i.attachmentOnly&&i.ownerType==='library'&&del[i.ownerId]));
 const live=new Set(remote.instructionLibrary.map(i=>i.id)),assets=new Set(remote.assets.map(a=>a.id));
 for(const i of remote.instructionLibrary){if(i.pdfRefs)i.pdfRefs=i.pdfRefs.filter(id=>live.has(id));if(i.poolLinks)for(const id of Object.keys(i.poolLinks))if(!assets.has(id))delete i.poolLinks[id];}
 for(const a of remote.assets){const h=a.handlingInstruction;if(!h)continue;if(h.libraryId&&!live.has(h.libraryId))h.libraryId='';if(h.pdfRefs)h.pdfRefs=h.pdfRefs.filter(id=>live.has(id));}
 return remote;
}
root.PoolLinks={migrate,linked,setLink,merge};
if(typeof module!=='undefined')module.exports=root.PoolLinks;
})(typeof window==='undefined'?globalThis:window);
