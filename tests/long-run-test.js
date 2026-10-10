const test=require('node:test');
const assert=require('node:assert/strict');
const Zoo=require('../js/merge/zoo');
const {CONFIG,isValidItem}=require('../js/merge/config');
const mass=items=>items.reduce((sum,item)=>sum+(item?2**(item.level-1):0),0);
const total=m=>mass(m.board)+mass(m.world.storage);
test('15,000 mixed legal/invalid operations preserve resources, failure atomicity and reloads',()=>{
  for(const initialSeed of [9,127,2026]){
    let seed=initialSeed,time=1791550000000;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    let m=new Zoo(null,random,()=>time);
    for(let step=0;step<5000;step++){
      const roll=random(),index=Math.floor(random()*49),before=m.snapshot(),value=total(m);
      let result,expected;
      if(roll<.24){
        const unlocked=CONFIG.producers.filter(p=>m.isProducerUnlocked(p));
        result=m.produce(unlocked[Math.floor(random()*unlocked.length)].id);
        if(result.ok)expected=value+2**(result.item.level-1);
      }else if(roll<.49){
        const pair=m.board.flatMap((v,i)=>v?m.board.flatMap((w,j)=>j>i&&w?.chainId===v.chainId&&w.level===v.level?[{i,j}]:[]):[]);
        const target=pair[Math.floor(random()*pair.length)];result=target?m.move(target.i,target.j):m.move(index,Math.floor(random()*49));expected=value;
      }else if(roll<.56){result=m.store(index);expected=value;}
      else if(roll<.62){result=m.withdraw(Math.floor(random()*14));expected=value;}
      else if(roll<.69){const order=m.orders[Math.floor(random()*3)];result=m.submit(order.id);if(result.ok)expected=value-order.requirements.reduce((sum,v)=>sum+2**(v.level-1)*v.quantity,0);}
      else if(roll<.73){const type=random()<.5?'split':'wild',item=m.board[index];result=m.useTool(type,index);if(result.ok)expected=value+(type==='wild'?2**(item.level-1):0);}
      else if(roll<.77){const area=Math.floor(random()*6),cost=m.buildCost(area);result=m.build(area);if(result.ok)expected=value-mass(cost.items.flatMap(v=>Array(v.quantity).fill(v)));}
      else if(roll<.81){const level=1+Math.floor(random()*8);result=m.adopt(level);if(result.ok)expected=value-2**(level-1);}
      else if(roll<.84){const item=m.board[index];result=m.gift(1+Math.floor(random()*8),index);if(result.ok)expected=value-2**(item.level-1);}
      else if(roll<.87){result=m.sortBoard();expected=value;}
      else if(roll<.90){result=m.refreshOrder(m.orders[Math.floor(random()*3)].id);expected=value;}
      else if(roll<.93){const item=m.board[index];const discarded=m.discard(index);result={ok:discarded};expected=value-(discarded?2**(item.level-1):0);}
      else if(roll<.96){result=m.upgradeProducer(CONFIG.producers[Math.floor(random()*3)].id);expected=value;}
      else if(roll<.98){result=m.expandStorage();expected=value;}
      else{m.refillEnergy();result={ok:true};expected=value;}
      if(!result.ok)assert.deepEqual(m.snapshot(),before,`Failed operation mutated state at ${initialSeed}/${step}`);
      else if(expected!==undefined)assert.equal(total(m),expected,`Resource mismatch at ${initialSeed}/${step}`);
      assert(m.board.length===49&&m.board.every(v=>v===null||isValidItem(v)));
      assert(m.world.storage.length<=m.world.storageSize&&m.world.storage.every(isValidItem));
      assert(Number.isSafeInteger(m.coins)&&m.coins>=0&&Number.isSafeInteger(m.world.stars)&&m.world.stars>=0&&m.energy>=0&&m.energy<=100);
      assert(m.orders.length===3&&m.orders.some(o=>m.isEasyOrder(o)));
      assert(m.orders.every(o=>o.requirements.every(v=>m.availableChains().some(c=>c.id===v.chainId))));
      if(step%37===0){const saved=m.snapshot();m=new Zoo(saved,random,()=>time);assert.deepEqual(m.snapshot(),saved);}
      if(step%173===0){time+=90000;m.syncTime();const saved=m.snapshot();m.syncTime();assert.deepEqual(m.snapshot(),saved,'Repeated time sync paid twice');}
    }
  }
});
