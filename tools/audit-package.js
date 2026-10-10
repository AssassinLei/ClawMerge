// Local delivery check: runtime module closure, asset inclusion, syntax and bytes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),config=require('../project.config.json');
const ignored=file=>config.packOptions.ignore.some(rule=>rule.type==='folder'?file===rule.value||file.startsWith(rule.value+'/'):file===rule.value);
const files=new Set();
function include(file){assert(!ignored(file),`Runtime file excluded: ${file}`);assert(fs.existsSync(path.join(root,file)),`Missing ${file}`);files.add(file);}
function moduleFile(file){
  if(files.has(file))return;include(file);
  const checked=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);
  const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const match of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)){
    assert(match[1].startsWith('.'),`External runtime dependency: ${match[1]}`);
    moduleFile(path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]+(match[1].endsWith('.js')?'':'.js'))));
  }
}
moduleFile('game.js');include('game.json');JSON.parse(fs.readFileSync(path.join(root,'game.json'),'utf8'));
const {CONFIG}=require('../js/merge/config');
for(const chain of CONFIG.chains)for(const item of chain.levels){assert(item.image,`Missing artwork for ${item.id}`);include(item.image);}
include('images/zoo/park.jpg');
for(const file of fs.readdirSync(path.join(root,'sounds')))include('sounds/'+file);
for(const folder of ['preview','tests','tools','branding'])assert(ignored(folder+'/dummy'),'Development folder would upload: '+folder);
for(const file of ['README.md','DEVELOPMENT_PLAN.md','DESIGN_2_0.md','TEST_REPORT.md','images/characters/ASSETS.md','images/zoo/ASSETS.md','images/drinks/ASSETS.md','images/fruits/ASSETS.md'])assert(ignored(file),'Documentation would upload: '+file);
const bytes=[...files].reduce((sum,file)=>sum+fs.statSync(path.join(root,file)).size,0);
console.log(JSON.stringify({result:'PASS: all runtime imports and assets exist, pass syntax checks and remain in the upload package',runtimeFiles:files.size,bytes,MiB:(bytes/1048576).toFixed(2),appid:config.appid,files:[...files].sort()},null,2));
