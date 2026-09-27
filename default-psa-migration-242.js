'use strict';
(function(root){
const VERSION=1;
const DEFAULT_SIGNS=['M009','M017'];
root.migrateDefaultPsa242=function(input){
 const C=root.AppCore,next=C.clone(input);
 let changed=false,updated=0,added=0,initialized=0;
 for(const a of next.assets||[]){
  for(const u of a.units||[]){
   if(Number(u.psaDefaultSeedVersion||0)>=VERSION)continue;
   const before=Array.isArray(u.psaSigns)?u.psaSigns.map(String):[];
   const set=new Set(before);
   let touched=false;
   for(const id of DEFAULT_SIGNS){if(!set.has(id)){set.add(id);added++;touched=true;}}
   u.psaSigns=[...set];
   u.psaDefaultSeedVersion=VERSION;
   initialized++;
   if(touched)updated++;
   changed=true;
  }
 }
 if(Number(next.defaultPsaSeedVersion||0)<VERSION){next.defaultPsaSeedVersion=VERSION;changed=true;}
 next.defaultPsaSeedImportedAt='2026-09-26';
 next.defaultPsaSeedSigns=DEFAULT_SIGNS.slice();
 return {state:next,changed,updated,added,initialized};
};
})(window);
