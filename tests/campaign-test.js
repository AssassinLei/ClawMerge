// Reachability proof: a fresh save, actual production/merges and earned currency.
// The bot uses the same public operations as a player; it never injects materials.
const assert=require('node:assert/strict');
const Zoo=require('../js/merge/zoo');
const {CONFIG,isValidItem}=require('../js/merge/config');
const {AREAS,RESIDENTS}=require('../js/merge/content');
const {makePuzzle}=require('../js/merge/puzzles');
let seed=20261009;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const now=1791550000000;
let m=new Zoo(null,random,()=>now),operations=0,rests=0,discards=0;
const ok=result=>{assert.equal(result.ok,true,JSON.stringify(result));operations++;rewards();return result;};
function rewards(){
  for(let i=0;i<3;i++)if(m.dailyProgress(i).ready&&!m.world.daily.claimed.includes(i))m.claimDaily(i);
  for(let guard=0;guard<100;guard++){
    const f=m.world.festival,index=f.claimed.length;
    if(f.points<m.festivalTargets()[index])break;
    assert(m.claimFestival(index).ok);
  }
}
const requirements=(chainId,level,quantity=1)=>[{chainId,level,quantity}];
function mergeOne(chainId,target,protectedItems=[]){
  for(let level=target-1;level>=1;level--){
    const keep=protectedItems.find(v=>v.chainId===chainId&&v.level===level)?.quantity||0;
    const indices=m.board.flatMap((v,i)=>v?.chainId===chainId&&v.level===level?[i]:[]);
    if(indices.length>=keep+2){ok(m.move(indices[keep],indices[keep+1]));return true;}
  }
  return false;
}
function produce(chainId,protectedItems=[]){
  if(!m.energy){m.refillEnergy();rests++;}
  if(m.board.every(Boolean)){
    const counts={};let candidate=-1;
    m.board.forEach((v,i)=>{const key=v.chainId+v.level,keep=protectedItems.find(r=>r.chainId===v.chainId&&r.level===v.level)?.quantity||0;counts[key]=(counts[key]||0)+1;if(counts[key]>keep)candidate=i;});
    assert(candidate>=0,'Full board has no recoverable space');assert(m.discard(candidate));discards++;
  }
  const producer=CONFIG.producers.find(p=>p.outputs[0].chainId===chainId);
  ok(m.produce(producer.id));
}
function ensure(items){
  let guard=0;
  for(const item of items)while(m.count(item)<item.quantity){
    assert(++guard<100000,'Material generation did not converge');
    if(!mergeOne(item.chainId,item.level,items))produce(item.chainId,items);
  }
  assert(m.hasItems(items));
}
function order(){
  const easy=m.orders.filter(o=>m.isEasyOrder(o));assert(easy.length,'Easy wish safeguard failed');
  easy.sort((a,b)=>a.requirements.reduce((s,v)=>s+2**(v.level-1)*v.quantity,0)-b.requirements.reduce((s,v)=>s+2**(v.level-1)*v.quantity,0));
  ensure(easy[0].requirements);ok(m.submit(easy[0].id));
}
function currency(coins,stars){let guard=0;while(m.coins<coins||m.world.stars<stars){assert(++guard<10000,'Economic deadlock');order();}}
function build(area,stage){
  if(area>0&&!m.areaUnlocked(area))build(area-1,2);
  while(m.world.areas[area]<stage){const cost=m.buildCost(area);currency(cost.coins,cost.stars);ensure(cost.items);ok(m.build(area));}
}
function adopt(level){if(m.world.residents[level])return;const def=m.residentDef(level);build(def.area,1);ensure(requirements('friends',level));ok(m.adopt(level));}
function gift(level){const def=m.residentDef(level);ensure(requirements('snacks',def.favorite));ok(m.gift(level,m.board.findIndex(v=>v?.chainId==='snacks'&&v.level===def.favorite)));}
function puzzle(level){if(m.energy<30){m.refillEnergy();rests++;}ok(m.startPuzzle(level,true));for(const move of makePuzzle(level).solution)ok(m.puzzleMove(move.from,move.to));assert(m.world.puzzle.active.won);}
const chapterEvidence=[];
while(m.storyTask()){
  const task=m.storyTask(),step=m.world.story.step,start=operations;
  if(task.type==='merges')while(!m.storyProgress().ready){if(!mergeOne('friends',5))produce('friends');}
  if(task.type==='orders')while(!m.storyProgress().ready)order();
  if(task.type==='build')build(task.area,task.target);
  if(task.type==='build-total')for(let i=0;m.buildCount()<task.target;i=(i+1)%AREAS.length)if(m.world.areas[i]<4)build(i,m.world.areas[i]+1);
  if(task.type==='resident')adopt(task.level);
  if(task.type==='resident-count')for(let level=1;Object.keys(m.world.residents).length<task.target;level++)adopt(level);
  if(task.type==='donate')ensure(task.items);
  if(task.type==='gifts')while(!m.storyProgress().ready)gift(1);
  if(task.type==='friendship')while(!m.storyProgress().ready)gift(1);
  if(task.type==='puzzles')while(!m.storyProgress().ready)puzzle(m.world.puzzle.cleared.length+1);
  assert(m.storyProgress().ready,task.title);ok(m.claimStory(step%2,step));
  chapterEvidence.push({step:step+1,title:task.title,actions:operations-start,coins:m.coins,stars:m.world.stars});
  const saved=m.snapshot();m=new Zoo(saved,random,()=>now);assert.deepEqual(m.snapshot(),saved,'Progress changed on reload');
}
assert.equal(m.world.story.step,24);assert.equal(m.world.story.choices.length,6);
for(let area=0;area<6;area++)build(area,4);
for(let level=1;level<=8;level++)adopt(level);
for(let level=m.world.puzzle.cleared.length+1;level<=20;level++)puzzle(level);
for(const def of RESIDENTS)while(m.friendship(def.level)<10)gift(def.level);
for(const producer of CONFIG.producers)while(m.world.producerLevels[producer.id]<3){const cost=m.producerCost(producer.id);currency(cost.coins,cost.stars);ok(m.upgradeProducer(producer.id));}
while(m.world.storageSize<12){currency(m.world.storageSize*20,2);ok(m.expandStorage());}
// Finish the collection through real production and merges, including all eight fruits.
for(const chain of CONFIG.chains){ensure(requirements(chain.id,chain.levels.length));assert.equal(m.discovered[chain.id],chain.levels.length);}
assert.equal(m.buildCount(),24);assert.equal(Object.keys(m.world.residents).length,8);assert.equal(m.world.puzzle.cleared.length,20);
assert.equal(RESIDENTS.filter(def=>m.friendship(def.level)===10).length*3,24);
assert.equal(m.world.unlockedDecorations.length,3);
const end=m.snapshot();m=new Zoo(end,random,()=>now);assert.deepEqual(m.snapshot(),end);
const before=m.completed;order();assert.equal(m.completed,before+1,'The post-story loop stopped');
assert(m.coins>=0&&m.world.stars>=0&&m.energy>=0);assert(m.board.every(v=>!v||isValidItem(v)));
console.log(JSON.stringify({result:'PASS: fresh-save campaign and endgame reached using only legal player actions',operations,produced:m.world.stats.produced,merges:m.merges,orders:m.completed,rests,discards,festivals:m.world.festival.cycle,saveBytes:Buffer.byteLength(JSON.stringify(m.snapshot())),chapters:chapterEvidence},null,2));
