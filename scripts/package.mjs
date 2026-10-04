import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.resolve(process.argv[2]||path.join(root,'../release/Anlagenbuch-OneDrive-2.81-Test'));
if(target===path.resolve(root)||target.startsWith(path.resolve(root)+path.sep))throw Error('Ziel muss außerhalb des Projektordners liegen.');
if(fs.existsSync(target))throw Error('Ziel existiert bereits. Bitte einen neuen Ausgabeordner wählen.');
// Local credentials and migrations may live beside scripts; copy only named sources.
const files=['server/coordinator.js','server/gateway.js','server/onedrive.js','server/wrangler.toml','server/wrangler.preview.toml',
 'scripts/build.mjs','scripts/connect-onedrive.mjs','scripts/dev.mjs','scripts/migrate.mjs','scripts/package.mjs',
 'README-RENE.md','ADMIN-ONEDRIVE.md','ABGLEICH-2.81.md','Start-Test.cmd','package.json','wrangler.toml','sync-merge.js','core.js','.gitignore'];
for(const dir of ['functions','tests']){
 const scan=rel=>{for(const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){const p=rel+'/'+e.name;if(e.isDirectory()&&!e.name.startsWith('.'))scan(p);else if(e.isFile()&&/\.(?:js|mjs)$/.test(e.name)&&!e.name.startsWith('.'))files.push(p);}};scan(dir);
}
for(const name of files)if(!fs.existsSync(path.join(root,name)))throw Error('Datei fehlt: '+name);
const inspect=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Verknüpfung im Build.');const p=path.join(dir,e.name);if(/secret|migration-private|\.dev\.vars|\.env|\.local-test/i.test(e.name))throw Error('Private Datei im Build: '+e.name);if(e.isDirectory())inspect(p);}};
inspect(path.join(root,'dist'));
fs.mkdirSync(target,{recursive:true});fs.cpSync(path.join(root,'dist'),target,{recursive:true});fs.cpSync(path.join(root,'dist'),path.join(target,'dist'),{recursive:true});
for(const name of files){const dest=path.join(target,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(root,name),dest);}
console.log(target);
