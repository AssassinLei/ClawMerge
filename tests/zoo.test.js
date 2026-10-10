const test=require('node:test');
const assert=require('node:assert/strict');
const Zoo=require('../js/merge/zoo');
const {CONFIG,getItem,getChain}=require('../js/merge/config');
const {AREAS,CHAPTERS}=require('../js/merge/content');
const {makePuzzle,puzzleMove,swipeTarget,randomFor}=require('../js/merge/puzzles');
const NOW=Date.UTC(2026,9,9,2),item=(level=1,chainId='friends')=>({chainId,level});
function make(){let now=NOW;const m=new Zoo(null,randomFor(13),()=>now);return{m,advance:ms=>{now+=ms;},now:()=>now};}
function provision(m,requirements){m.board.fill(null);let index=0;requirements.forEach(r=>{for(let i=0;i<r.quantity;i++)m.board[index++]=item(r.level,r.chainId);});}
function mass(m){return m.board.filter(Boolean).concat(m.world.storage).reduce((sum,v)=>sum+2**(v.level-1),0);}
function solve(m,level){if(m.energy<30)m.refillEnergy();assert(m.startPuzzle(level,true).ok);for(const a of makePuzzle(level).solution)assert(m.puzzleMove(a.from,a.to).ok);assert(m.world.puzzle.active.won);}

test('2.0 initializes all progression; only reachable animal production and orders are enabled',()=>{
  const{m,now}=make();assert.equal(m.energy,100);assert.equal(m.board.length,49);assert.equal(m.world.story.step,0);
  assert.deepEqual(m.availableChains().map(c=>c.id),['friends']);assert(m.orders.every(o=>o.requirements.every(r=>r.chainId==='friends')));
  const before=m.snapshot();assert.equal(m.produce('snack-cart').reason,'locked');assert.deepEqual(m.snapshot(),before);
  assert.deepEqual(new Zoo(m.snapshot(),randomFor(99),now).snapshot(),m.snapshot());
});
test('Chinese redemption unlocks only producers, rejects invalid/duplicate input, persists and resets',()=>{
  const {m,now}=make(),before=m.snapshot();
  for(const code of ['',null,123,'爪爪猫','爪 爪 鸟']){assert.equal(m.redeemCode(code).reason,'invalid-code');assert.deepEqual(m.snapshot(),before);}
  assert(m.redeemCode('  爪爪鸟  ').ok);const expected=JSON.parse(JSON.stringify(before));expected.world.allProducersUnlocked=true;assert.deepEqual(m.snapshot(),expected);
  assert(CONFIG.producers.every(p=>m.isProducerUnlocked(p)));assert.deepEqual(m.availableChains().map(c=>c.id),['friends','snacks','garden']);
  const saved=m.snapshot();assert.equal(m.redeemCode('爪爪鸟').reason,'code-used');assert.deepEqual(m.snapshot(),saved);
  const restored=new Zoo(saved,randomFor(2),now);assert.deepEqual(restored.snapshot(),saved);
  restored.board.fill(null);for(const p of CONFIG.producers)assert(restored.produce(p.id).ok);
  restored.coins=1000;restored.world.stars=20;assert(restored.upgradeProducer('seed-house').ok);assert.equal(restored.world.areas[0],0);
  restored.restart();assert.equal(restored.world.allProducersUnlocked,false);assert.equal(restored.produce('seed-house').reason,'locked');
});
test('construction checks all costs before changing state, and unlocks the two resource chains',()=>{
  const{m}=make();const before=m.snapshot();assert(!m.build(0).ok);assert.deepEqual(m.snapshot(),before);
  m.coins=500;m.world.stars=20;provision(m,AREAS[0].costs[0].items);assert(m.build(0).ok);
  assert.deepEqual(m.availableChains().map(c=>c.id),['friends','snacks']);assert.equal(m.world.areas[0],1);
  const absent=m.snapshot();assert.equal(m.build(0).reason,'items');assert.deepEqual(m.snapshot(),absent);
  provision(m,AREAS[0].costs[1].items);assert(m.build(0).ok);assert.deepEqual(m.availableChains().map(c=>c.id),['friends','snacks','garden']);
  assert(m.areaUnlocked(1));assert.equal(m.build(2).reason,'locked-area');assert(m.produce('seed-house').ok);
});
test('both new chains merge through every configured tier and retain independent identities',()=>{
  const{m}=make();m.world.areas[0]=2;
  for(const chain of ['snacks','garden'])for(let level=1;level<getChain(chain).levels.length;level++){
    provision(m,[{chainId:chain,level,quantity:2}]);const before=mass(m);const r=m.move(0,1);assert.equal(r.kind,'merge');assert.deepEqual(m.board[1],item(level+1,chain));assert.equal(mass(m),before);
  }
  m.board[0]=item(2,'snacks');m.board[1]=item(2,'garden');assert.equal(m.move(0,1).kind,'swap');assert.equal(m.board[0].chainId,'garden');
});
test('the eight requested drinks merge to QQ strawberry tea, submit and gift at the top level',()=>{
  const {m,now}=make(),chain=getChain('snacks');
  assert.deepEqual(chain.levels.map(v=>v.name),['VC柠檬茶','茉莉奶绿','拿铁','泰奶红茶','黑巧美式','黑糖珍珠','芭乐茉莉','QQ美莓奶茶']);
  m.world.areas[0]=2;m.world.areas[5]=1;m.world.residents[8]={xp:0};
  provision(m,[{chainId:'snacks',level:7,quantity:2}]);assert.equal(m.move(0,1).item.level,8);
  assert(m.gift(8,1).ok);assert.equal(m.board[1],null);assert.equal(m.friendship(8),9);
  m.board[0]=item(8,'snacks');assert(m.gift(8,0).ok);assert.equal(m.friendship(8),10);
  const order=m.makeOrder({kind:'challenge',requirements:[{chainId:'snacks',level:8,quantity:1},{chainId:'snacks',level:7,quantity:1}]});m.orders[2]=order;provision(m,order.requirements);assert(m.submit(order.id).ok);
  m.board[0]=item(8,'snacks');m.board[1]=item(8,'snacks');const max=m.snapshot();assert.equal(m.move(0,1).reason,'max');assert.deepEqual(m.snapshot(),max);
  assert.deepEqual(new Zoo(m.snapshot(),randomFor(3),now).snapshot(),m.snapshot());
});
test('all eight fruits work in production, top-tier orders, storage, donations and saved collections',()=>{
  const {m,now}=make(),chain=getChain('garden');
  assert.deepEqual(chain.levels.map(v=>v.name),['咖啡豆','巴旦木坚果','蓝莓','苹果','芭乐','柠檬','沙糖桔','柚子']);
  m.world.areas[0]=2;m.board.fill(null);assert(m.produce('seed-house').ok);
  const produced=m.board.find(Boolean);assert.equal(produced.chainId,'garden');assert([1,2].includes(produced.level));
  provision(m,[{chainId:'garden',level:7,quantity:2}]);assert.equal(m.move(0,1).item.level,8);assert.equal(m.discovered.garden,8);
  assert(m.store(1).ok);assert.equal(getItem(m.world.storage[0]).name,'柚子');assert(m.withdraw(0).ok);
  const order=m.makeOrder({kind:'challenge',requirements:[{chainId:'garden',level:8,quantity:1},{chainId:'garden',level:7,quantity:1}]});
  m.orders[2]=order;provision(m,order.requirements);const coins=m.coins;assert(m.submit(order.id).ok);assert(m.coins>coins);
  m.world.story.step=8;provision(m,CHAPTERS[2].tasks[0].items);assert.equal(getItem(m.board[0]).name,'蓝莓');assert(m.claimStory(0,8).ok);assert(m.board.every(v=>!v));
  m.world.story.step=17;m.world.story.choices=[0,0,0,0];provision(m,CHAPTERS[4].tasks[1].items);assert.equal(getItem(m.board[0]).name,'苹果');assert(m.claimStory(0,17).ok);
  provision(m,[{chainId:'garden',level:8,quantity:2}]);const saved=m.snapshot();assert.equal(m.move(0,1).reason,'max');assert.deepEqual(m.snapshot(),saved);
  assert.deepEqual(new Zoo(saved,randomFor(3),now).snapshot(),saved);
});
test('new orders only request unlocked types and easy protection works after all resources unlock',()=>{
  for(const stage of [0,1,2]){const{m}=make();m.world.areas[0]=stage;m.completed=100;m.discovered={friends:8,snacks:8,garden:8};m.orders=[];m.fillOrders();
    const chains=m.availableChains().map(c=>c.id);
    for(let i=0;i<80;i++){const order=m.orders[i%3];assert(order.requirements.every(r=>chains.includes(r.chainId)));provision(m,order.requirements);assert(m.submit(order.id).ok);assert(m.orders.some(o=>m.isEasyOrder(o)));}
  }
});
test('deliveries award stars and experience once; repeats do not consume materials or duplicate rewards',()=>{
  const{m}=make();const order=m.orders[0];provision(m,order.requirements);const stars=m.world.stars;
  assert(m.submit(order.id).ok);assert(m.world.stars>stars);const before=m.snapshot();assert(!m.submit(order.id).ok);assert.deepEqual(m.snapshot(),before);
});
test('storage preserves item value, full-board withdrawals fail atomically, expansion uses real currency',()=>{
  const{m}=make();m.board.fill(null);m.board[0]=item(7);const before=mass(m);assert(m.store(0).ok);assert.equal(mass(m),before);
  m.board.fill(item(1));const saved=m.snapshot();assert.equal(m.withdraw(0).reason,'full');assert.deepEqual(m.snapshot(),saved);
  m.discard(4);assert(m.withdraw(0).ok);assert.equal(m.board[4].level,7);
  m.coins=500;m.world.stars=10;assert(m.expandStorage().ok);assert.equal(m.world.storageSize,9);assert.equal(m.expandStorage().reason,'max-storage');
  m.world.areas[2]=1;assert(m.expandStorage().ok);assert.equal(m.world.storageSize,12);
});
test('split conserves merge value and wild upgrades once; impossible uses never consume a tool',()=>{
  const{m}=make();m.board.fill(null);m.board[0]=item(8,'garden');const before=mass(m);assert(m.useTool('split',0).ok);assert.equal(mass(m),before);assert.equal(m.board[1].level,7);
  assert(m.useTool('wild',0).ok);assert.equal(m.board[0].level,8);m.world.tools.wild=1;const saved=m.snapshot();assert(!m.useTool('wild',0).ok);assert.deepEqual(m.snapshot(),saved);
  m.world.tools.split=2;m.board.fill(item(1));const full=m.snapshot();assert(!m.useTool('split',0).ok);assert.deepEqual(m.snapshot(),full);
});
test('producer upgrades change weighted supply without mutating shared config or unlocking locked producers',()=>{
  const{m}=make();m.coins=1000;m.world.stars=20;const original=JSON.stringify(CONFIG.producers[0]);
  assert(m.upgradeProducer('friends-home').ok);assert(m.productionOutputs(CONFIG.producers[0]).some(v=>v.level===5));assert.equal(JSON.stringify(CONFIG.producers[0]),original);
  const before=m.snapshot();assert(!m.upgradeProducer('snack-cart').ok);assert.deepEqual(m.snapshot(),before);
});
test('residents require repaired homes, gifting consumes one snack, unlocks letters and caps friendship',()=>{
  const{m}=make();m.board.fill(null);m.board[0]=item(1);const saved=m.snapshot();assert(!m.adopt(1).ok);assert.deepEqual(m.snapshot(),saved);
  m.world.areas[0]=1;assert(m.adopt(1).ok);const after=m.snapshot();assert(!m.adopt(1).ok);assert.deepEqual(m.snapshot(),after);
  m.board[0]=item(5,'snacks');assert(m.gift(1,0).ok);assert.equal(m.board[0],null);assert(m.friendship(1)>=3);
  for(let i=0;i<25&&m.friendship(1)<10;i++){m.board[0]=item(5,'snacks');assert(m.gift(1,0).ok);}assert.equal(m.friendship(1),10);
  m.board[0]=item(5,'snacks');const max=m.snapshot();assert(!m.gift(1,0).ok);assert.deepEqual(m.snapshot(),max);
});
test('real-world timestamps retain energy cooldown and do not repeatedly award offline income',()=>{
  const{m,advance,now}=make();m.world.areas[0]=1;m.world.residents[1]={xp:0};m.energy=99;
  let restored=new Zoo(m.snapshot(),randomFor(1),now);assert.equal(restored.energy,99);assert.equal(restored.offlineIncome,0);
  advance(8*3600000+3600000);restored=new Zoo(restored.snapshot(),randomFor(1),now);assert.equal(restored.energy,100);assert.equal(restored.offlineIncome,480);
  const coins=restored.coins,again=new Zoo(restored.snapshot(),randomFor(1),now);assert.equal(again.coins,coins);assert.equal(again.offlineIncome,0);
});
test('energy recovers at 90-second boundaries and free rest clears prior recovery credit',()=>{
  const{m,advance}=make();m.energy=0;advance(89999);m.syncTime();assert.equal(m.energy,0);advance(1);m.syncTime();assert.equal(m.energy,1);
  m.refillEnergy();m.energy=99;advance(45000);m.syncTime();assert.equal(m.energy,99);advance(45000);m.syncTime();assert.equal(m.energy,100);
});
test('daily rewards persist, cannot double claim, and reset to fresh goals on the next UTC+8 day',()=>{
  const{m,advance,now}=make();m.merges=8;assert(m.claimDaily(0).ok);const saved=m.snapshot();assert(!m.claimDaily(0).ok);assert.deepEqual(m.snapshot(),saved);
  const restored=new Zoo(saved,randomFor(1),now);assert(!restored.claimDaily(0).ok);advance(24*3600000);m.syncTime();assert.equal(m.dailyProgress(0).have,0);assert(!m.claimDaily(0).ok);
});
test('celebration rewards enforce order and cycle with retained progress and persistent cosmetics',()=>{
  const{m}=make();m.world.festival.points=200;const before=m.snapshot();assert.equal(m.claimFestival(2).reason,'previous-reward');assert.deepEqual(m.snapshot(),before);
  for(let cycle=0;cycle<3;cycle++){m.world.festival.points=2000;for(let i=0;i<3;i++)assert(m.claimFestival(i).ok);}
  assert.equal(m.world.festival.cycle,3);assert.deepEqual(m.world.unlockedDecorations,['spring','sunset','starlight']);assert(m.setDecoration('starlight').ok);
  const saved=m.snapshot();assert(!m.setDecoration('wrong').ok);assert.deepEqual(m.snapshot(),saved);
});
test('short and long rescue swipes move one cell in four directions without wrapping, diagonal guessing or jitter',()=>{
  for(const distance of [16,30,1000]){
    assert.equal(swipeTarget(5,distance,2,64),6);assert.equal(swipeTarget(5,-distance,2,64),4);
    assert.equal(swipeTarget(5,2,distance,64),9);assert.equal(swipeTarget(5,2,-distance,64),1);
  }
  for(const [from,dx,dy]of[[0,-30,0],[3,30,0],[2,0,-30],[13,0,30],[5,5,5],[5,30,30],[5,30,-30]])assert.equal(swipeTarget(from,dx,dy,64),-1);
  assert.equal(swipeTarget(5,12,0,64),-1);assert.equal(swipeTarget(5,14,0,64),6);
  assert.equal(swipeTarget(-1,30,0,64),-1);assert.equal(swipeTarget(5,NaN,0,64),-1);assert.equal(swipeTarget(5,30,0,undefined),-1);
});
test('all twenty spatial puzzles have legal solutions within their budgets and conserve tile value',()=>{
  for(let level=1;level<=20;level++){const{solution,...p}=makePuzzle(level);p.moves=0;p.won=false;const value=2**(p.target-1);
    for(const a of solution){assert(puzzleMove(p,a.from,a.to).ok);assert.equal(p.board.reduce((sum,v)=>sum+(v>0?2**(v-1):0),0),value);}
    assert(p.won);assert(p.moves<=p.limit);assert(p.board.filter(v=>v>0).length===1);
  }
});
test('every rescue is solvable through real game actions with save/reload after every step',()=>{
  const {m:initial,now}=make();let m=initial;const board=m.board.map(v=>v&&({...v}));
  for(let level=1;level<=20;level++){
    if(m.energy<30)m.refillEnergy();assert(m.startPuzzle(level).ok);
    const def=makePuzzle(level);
    for(const move of def.solution){assert(m.puzzleMove(move.from,move.to).ok,`Level ${level} rejects its solution`);const saved=m.snapshot();m=new Zoo(saved,randomFor(2),now);assert.deepEqual(m.snapshot(),saved);}
    const active=m.world.puzzle.active;assert(active.won);assert(active.moves<=active.limit);assert.equal(active.board[active.goal],active.target);assert.equal(active.board.filter(v=>v>0).length,1);
    assert.deepEqual(m.board,board);assert(m.world.puzzle.cleared.includes(level));
  }
});
test('retry restores each authored solvable board even after a legal wrong first move',()=>{
  for(let level=1;level<=20;level++){
    const {m}=make();m.world.puzzle.cleared=Array.from({length:level-1},(_,i)=>i+1);const def=makePuzzle(level);
    for(let from=0;from<16;from++)for(let to=0;to<16;to++){
      const session={...def,board:def.board.slice(),moves:0,won:false};if(!puzzleMove(session,from,to).ok)continue;
      m.refillEnergy();assert(m.startPuzzle(level,true).ok);assert(m.puzzleMove(from,to).ok);assert(m.startPuzzle(level,true).ok);assert.equal(m.energy,40);assert.deepEqual(m.world.puzzle.active.board,def.board);
      for(const move of def.solution)assert(m.puzzleMove(move.from,move.to).ok);assert(m.world.puzzle.active.won);
    }
  }
});
test('rescue boards demand multiple merges, interior obstacle planning and tight move budgets',()=>{
  const signatures=new Set();
  for(let level=1;level<=20;level++){
    const p=makePuzzle(level),count=p.board.filter(v=>v>0).length,blocks=p.board.filter(v=>v===-1).length;
    assert(count>=9&&count<=11);assert(blocks>=2&&blocks<=4);assert(p.target>=5&&p.target<=7);
    assert(p.board.some((v,i)=>v===-1&&[5,6,9,10].includes(i)));
    assert(p.limit-p.solution.length>=1&&p.limit-p.solution.length<=3);
    let merges=0;const session={...p,board:p.board.slice(),moves:0,won:false};
    for(const move of p.solution){const result=puzzleMove(session,move.from,move.to);assert(result.ok);if(result.kind==='merge')merges++;}
    assert.equal(merges,count-1);assert(merges>=8);assert(session.won);signatures.add(p.board.join(','));
  }
  assert.equal(signatures.size,20);
});
test('rescue charges 30 for new/retry/failed sessions, but never for resume or rejected starts',()=>{
  const {m,advance,now}=make();m.energy=29;const before=m.snapshot();assert.equal(m.startPuzzle(1).reason,'rescue-energy');assert.deepEqual(m.snapshot(),before);
  m.energy=30;assert.equal(m.startPuzzle(1).energyCost,30);assert.equal(m.energy,0);
  const move=makePuzzle(1).solution[0];assert(m.puzzleMove(move.from,move.to).ok);const saved=m.snapshot();
  assert.equal(m.startPuzzle(1).resumed,true);assert.deepEqual(m.snapshot(),saved);
  const restored=new Zoo(saved,randomFor(99),now);assert(restored.startPuzzle(1).resumed);assert.equal(restored.energy,0);assert.deepEqual(restored.world.puzzle.active,m.world.puzzle.active);
  assert.equal(m.startPuzzle(1,true).reason,'rescue-energy');assert.deepEqual(m.snapshot(),saved);
  assert.equal(m.startPuzzle(2).reason,'locked');assert.deepEqual(m.snapshot(),saved);
  m.refillEnergy();assert(m.startPuzzle(1,true).ok);assert.equal(m.energy,70);assert.equal(m.world.puzzle.active.moves,0);
  m.world.puzzle.active.moves=m.world.puzzle.active.limit;assert(m.startPuzzle(1).ok);assert.equal(m.energy,40);
  solve(m,1);assert.equal(m.energy,10);assert(m.startPuzzle(1).reason==='rescue-energy');m.refillEnergy();assert(m.startPuzzle(2).ok);assert.equal(m.energy,70);
  m.refillEnergy();advance(89999);assert(m.startPuzzle(2,true).ok);advance(1);m.syncTime();assert.equal(m.energy,70);advance(89999);m.syncTime();assert.equal(m.energy,71);
});
test('puzzle invalid actions, reward replay, restart and persisted mid-level progress are isolated from the merge board',()=>{
  const{m,now}=make();const original=m.board.map(v=>v&&({...v}));assert(!m.startPuzzle(2).ok);assert(m.startPuzzle(1).ok);
  const before=m.snapshot();assert(!m.puzzleMove(-1,2).ok);assert.deepEqual(m.snapshot(),before);
  const solution=makePuzzle(1).solution;assert(m.puzzleMove(solution[0].from,solution[0].to).ok);
  let restored=new Zoo(m.snapshot(),randomFor(1),now);assert.deepEqual(restored.world.puzzle.active,m.world.puzzle.active);
  for(const a of solution.slice(1))assert(restored.puzzleMove(a.from,a.to).ok);assert(restored.world.puzzle.active.won);
  const coins=restored.coins;solve(restored,1);assert.equal(restored.coins,coins);assert.equal(restored.world.stats.puzzles,2);assert(restored.dailyProgress(2).ready);
  assert.deepEqual(restored.board,original);
});
test('story claims require the current task, consume donations once and preserve chapter choices',()=>{
  const{m}=make();assert(!m.claimStory(0,0).ok);m.merges=4;assert(m.claimStory(0,0).ok);const saved=m.snapshot();assert(!m.claimStory(0,0).ok);assert.deepEqual(m.snapshot(),saved);
  m.world.story.step=4;provision(m,CHAPTERS[1].tasks[0].items);assert(m.claimStory(0,4).ok);assert.equal(m.board.filter(Boolean).length,0);
  m.world.story.step=3;m.world.areas[0]=1;m.world.residents[1]={xp:0};assert(m.claimStory(1,3).ok);assert.equal(m.world.story.choices[0],1);
});
test('broken metadata and puzzle boards are safely normalized without phantom costs or rewards',()=>{
  const{m,now}=make();const saved=m.snapshot();saved.world.stars=-99;saved.world.areas=[99,-3];saved.world.tools={split:-1,wild:'oops'};saved.world.storage=[{chainId:'bad',level:1}];
  saved.world.puzzle={cleared:[1,3,3],active:{level:2,board:Array(16).fill(99),moves:0}};
  const restored=new Zoo(saved,randomFor(1),now);assert.equal(restored.world.stars,0);assert.equal(restored.world.areas[0],4);assert.equal(restored.world.areas[1],0);assert.deepEqual(restored.world.storage,[]);assert.deepEqual(restored.world.puzzle.cleared,[1]);assert.equal(restored.world.puzzle.active,null);
  saved.coins=Number.MAX_SAFE_INTEGER;saved.merges=Number.MAX_SAFE_INTEGER;saved.nextOrderId=Number.MAX_SAFE_INTEGER;saved.orders[0].id=Number.MAX_SAFE_INTEGER;
  const extreme=new Zoo(saved,randomFor(1),now);assert(extreme.coins<=1000000000);assert(extreme.merges<=1000000000);assert(extreme.orders.every(order=>Number.isSafeInteger(order.id)));assert(extreme.orders.every(order=>order.id<Number.MAX_SAFE_INTEGER));
});
test('sorting and restart conserve content appropriately and preserve a saved mute preference',()=>{
  const{m}=make();const before=mass(m);m.sortBoard();assert.equal(mass(m),before);m.soundEnabled=false;m.world.stars=12;m.world.story.step=14;m.restart();
  assert(!m.soundEnabled);assert.equal(m.world.story.step,0);assert.equal(m.world.stars,0);assert.equal(m.energy,100);assert.equal(m.world.storage.length,0);
});
