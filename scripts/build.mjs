import fs from 'node:fs';
import path from 'node:path';
const out='dist';fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync('index.html','utf8'),boot=fs.readFileSync('web-bootstrap-onedrive.js','utf8');
const scripts=JSON.parse([...boot.matchAll(/for\(const src of (\[[^\n]+\])\)/g)].at(-1)[1]);scripts.push('migrate-local.js');
const sw=fs.readFileSync('sw.js','utf8');const core=Function('return '+sw.match(/const CORE=(\[[^;]+\]);/)[1])();
const files=new Set(['index.html','login.html','login.js','sw.js','_headers','_routes.json','windows-hilfe.html','pc-widget.html','THIRD_PARTY_NOTICES.txt','vendor/jsQR.js','offline-store-235.js','web-bootstrap-onedrive.js',...scripts,...core.map(x=>x.slice(1)).filter(Boolean)]);
for(const file of files){if(!fs.existsSync(file))throw Error('Fehlende Build-Datei: '+file);const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(file,target);}
for(const dir of ['companion'])fs.cpSync(dir,path.join(out,dir),{recursive:true});
for(const file of fs.readdirSync('.').filter(x=>/^help-image-.*\.png$/.test(x)))fs.copyFileSync(file,path.join(out,file));
console.log('Teststand erstellt: '+path.resolve(out));
