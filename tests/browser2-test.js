const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const createServer=require('../preview/server');
const {makePuzzle}=require('../js/merge/puzzles');
const {CHAPTERS}=require('../js/merge/content');
(async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'}),output=path.resolve(__dirname,'../preview/screenshots/v2');fs.mkdirSync(output,{recursive:true});
  const errors=[];const url=`http://127.0.0.1:${server.address().port}/`;
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'?safeTop=44&safeBottom=34&capsule=1');await page.waitForFunction(()=>Object.keys(mergeGame.view.images).length===mergeGame.view.assetCount);
    assert.deepEqual(await page.evaluate(()=>mergeGame.view.failedImages),[]);
    const click=async(type,id,extra={})=>{
      await page.waitForTimeout(50);const r=await page.evaluate(({type,id,extra})=>mergeGame.view.buttons.find(b=>b.action.type===type&&(id===undefined||b.action.id===id)&&Object.entries(extra).every(([key,value])=>b.action[key]===value)),{type,id,extra});
      assert(r,`Missing button ${type}/${id}/${JSON.stringify(extra)}`);await page.mouse.click((r.x+r.w/2)*await page.evaluate(()=>mergeGame.view.scale),(r.y+r.h/2)*await page.evaluate(()=>mergeGame.view.scale));await page.waitForTimeout(50);
    };
    const shot=async name=>{await page.waitForTimeout(50);await page.screenshot({path:path.join(output,name+'.png')});};
    const cell=async(index,puzzle=false)=>page.evaluate(({index,puzzle})=>{const v=mergeGame.view,r=puzzle?v.puzzleRect:v.cellRect(index),s=puzzle?r.w/4:r.w;return{x:(r.x+(puzzle?index%4*s:0)+s/2)*v.scale,y:(r.y+(puzzle?Math.floor(index/4)*s:0)+s/2)*v.scale};},{index,puzzle});
    const drag=async(from,to,puzzle=false)=>{const a=await cell(from,puzzle),b=typeof to==='number'?await cell(to,puzzle):to;await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up();await page.waitForTimeout(40);};
    const swipe=async(from,to)=>{const a=await cell(from,true),b=await cell(to,true);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+(b.x-a.x)*.32,a.y+(b.y-a.y)*.32,{steps:4});await page.mouse.up();await page.waitForTimeout(40);};
    await shot('welcome-390');await click('close');await shot('merge-new-390');
    assert.equal(await page.evaluate(()=>mergeGame.view.buttons.filter(b=>b.action.panel==='gallery').length),1);
    await page.evaluate(()=>{const now=Date.now(),m=mergeGame.model;m.clock=()=>now;m.world.energyAt=now;m.world.incomeAt=now;m.random=()=>.5;m.board.fill(null);m.board[14]={chainId:'friends',level:1};m.board[15]={chainId:'friends',level:1};m.board[20]={chainId:'friends',level:2};m.orders[0]=m.makeOrder({requirements:[{chainId:'friends',level:3,quantity:1}]});mergeGame.invalidate();});
    await drag(14,15);await drag(15,20);assert.equal(await page.evaluate(()=>mergeGame.model.board[20].level),3);
    await click('submit',await page.evaluate(()=>mergeGame.model.orders[0].id));assert.equal(await page.evaluate(()=>mergeGame.model.coins),48);assert.equal(await page.evaluate(()=>mergeGame.model.world.stars),1);
    await click('produce','friends-home');assert.equal(await page.evaluate(()=>mergeGame.model.energy),99);
    const active=await page.evaluate(()=>mergeGame.model.board.findIndex(Boolean)),before=await page.evaluate(()=>mergeGame.model.snapshot());
    await drag(active,{x:3,y:3});assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),before);
    await page.evaluate(index=>{const r=mergeGame.view.cellRect(index),v=mergeGame.view,t={clientX:(r.x+10)*v.scale,clientY:(r.y+10)*v.scale};mergeGame.touchStart({touches:[t]});mergeGame.touchMove({touches:[{clientX:t.clientX+20,clientY:t.clientY+20}]});document.querySelector('canvas').dispatchEvent(new PointerEvent('pointercancel'));},active);
    assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),before);assert.equal(await page.evaluate(()=>mergeGame.ui.drag),null);
    await page.evaluate(()=>{mergeGame.ui.selected=-1;mergeGame.invalidate();});
    let a=await cell(active);await page.mouse.click(a.x,a.y);await click('store');assert.equal(await page.evaluate(()=>mergeGame.model.world.storage.length),1);
    await click('open',undefined,{panel:'storage'});await shot('storage-390');await click('withdraw',0);assert.equal(await page.evaluate(()=>mergeGame.model.world.storage.length),0);
    await page.evaluate(()=>{mergeGame.model.board.fill(null);mergeGame.model.board[0]={chainId:'friends',level:2};mergeGame.invalidate();});
    a=await cell(0);await page.mouse.click(a.x,a.y);await click('tool','split');assert.equal(await page.evaluate(()=>mergeGame.model.board.filter(Boolean).length),2);
    await page.mouse.click(a.x,a.y);await click('tool','wild');assert.equal(await page.evaluate(()=>mergeGame.model.board[0].level),2);
    assert(await page.evaluate(()=>previewAudioPlays.includes('merge.wav')&&previewAudioPlays.includes('spawn.wav')&&previewAudioPlays.includes('order.wav')));
    await click('open',undefined,{panel:'settings'});await click('sound-toggle');assert.equal(await page.evaluate(()=>mergeGame.model.soundEnabled),false);
    await page.evaluate(()=>{mergeGame.model.energy=0;});await click('refill');assert.equal(await page.evaluate(()=>mergeGame.model.energy),100);await click('close');
    const plays=await page.evaluate(()=>previewAudioPlays.length);await click('produce','friends-home');assert.equal(await page.evaluate(()=>previewAudioPlays.length),plays);
    await page.reload();await page.waitForFunction(()=>Object.keys(mergeGame.view.images).length===mergeGame.view.assetCount);assert.equal(await page.evaluate(()=>mergeGame.model.soundEnabled),false);
    await click('tab','merge');
    const separation=await page.evaluate(()=>{const v=mergeGame.view,r=v.producerRect,management=v.buttons.find(b=>b.action.panel==='producers');return {actions:v.buttons.filter(b=>b.x>=r.x&&b.x+b.w<=r.x+r.w&&b.y>=r.y&&b.y+b.h<=r.y+r.h).map(b=>b.action.type),gap:management.x-(r.x+r.w)};});assert(separation.actions.every(v=>v==='produce'));assert(separation.gap>=80);
    await click('open',undefined,{panel:'producers'});await shot('producer-management-390');await click('close');
    await click('open',undefined,{panel:'settings'});await shot('redeem-settings-390');await page.evaluate(()=>{const m=mergeGame.model,now=Date.now();m.clock=()=>now;m.world.energyAt=now;m.world.incomeAt=now;});const beforeRedeem=await page.evaluate(()=>mergeGame.model.snapshot());
    page.once('dialog',dialog=>dialog.dismiss());await click('redeem-code');assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),beforeRedeem);assert.equal(await page.evaluate(()=>mergeGame.busy),false);
    page.once('dialog',dialog=>{assert.equal(dialog.type(),'prompt');return dialog.accept('错误兑换码');});await click('redeem-code');assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),beforeRedeem);
    page.once('dialog',dialog=>dialog.accept('爪爪鸟'));await click('redeem-code');assert(await page.evaluate(()=>mergeGame.model.world.allProducersUnlocked));assert.equal(await page.evaluate(()=>mergeGame.model.world.areas[0]),0);
    const redeemed=await page.evaluate(()=>mergeGame.model.snapshot());page.once('dialog',dialog=>dialog.accept('爪爪鸟'));await click('redeem-code');assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),redeemed);await click('close');
    await page.reload();await page.waitForFunction(()=>Object.keys(mergeGame.view.images).length===mergeGame.view.assetCount);assert(await page.evaluate(()=>mergeGame.model.world.allProducersUnlocked));
    await click('open',undefined,{panel:'producers'});await click('select-producer','seed-house');await click('produce','seed-house');assert(await page.evaluate(()=>mergeGame.model.board.some(v=>v?.chainId==='garden')));
    // Mid-game fixtures expose every screen; all subsequent transactions use real UI input.
    await page.evaluate(()=>{const m=mergeGame.model,now=Date.now();m.clock=()=>now;m.world.energyAt=now;m.world.incomeAt=now;m.world.areas=[2,2,2,2,2,1];m.world.stars=80;m.coins=2500;m.world.xp=1000000;m.world.residents={1:{xp:150}};m.world.story.step=8;m.world.story.baseline={merges:m.merges,orders:m.completed,gifts:0,puzzles:0};m.discovered={friends:8,snacks:8,garden:8};m.board.fill(null);let i=0;for(const chain of ['friends','snacks','garden'])for(let level=1;level<=8;level++)m.board[i++]={chainId:chain,level};mergeGame.ui.selected=-1;mergeGame.ui.toast=null;mergeGame.invalidate();});
    await click('tab','park');await shot('park-progress-390');await click('area',1);await shot('area-390');await click('build',1);assert.equal(await page.evaluate(()=>mergeGame.model.world.areas[1]),3);await click('close');
    await click('open',undefined,{panel:'residents'});await shot('residents-390');await click('resident',4);await click('adopt',4);assert(await page.evaluate(()=>!!mergeGame.model.world.residents[4]));await click('close');
    await click('open',undefined,{panel:'residents'});await click('resident',1);await shot('resident-390');await click('gift-level',1);await click('gift',1);assert.equal(await page.evaluate(()=>mergeGame.model.world.stats.gifts),1);await click('letter',1,{letter:0});await shot('letter-390');await click('close');
    await click('open',undefined,{panel:'residents'});await click('page',undefined,{delta:1});await click('resident',8);await click('adopt',8);await click('gift-level',8);await shot('drink-gifts-390');await click('gift',8);assert.equal(await page.evaluate(()=>mergeGame.model.friendship(8)),9);await click('close');
    await click('tab','merge');await click('open',undefined,{panel:'producers'});await shot('producers-390');await click('upgrade-producer','snack-cart');assert.equal(await page.evaluate(()=>mergeGame.model.world.producerLevels['snack-cart']),1);await click('select-producer','seed-house');await click('produce','seed-house');assert(await page.evaluate(()=>mergeGame.model.board.some(v=>v?.chainId==='garden')));await shot('merge-resources-390');
    await click('tab','story');await shot('story-390');await page.evaluate(()=>{const m=mergeGame.model;m.world.story.step=3;mergeGame.invalidate();});await click('claim-story',3);await shot('story-choice-390');await click('choose-story',3,{choice:1});assert.equal(await page.evaluate(()=>mergeGame.model.world.story.choices[0]),1);
    await click('open',undefined,{panel:'journal'});await click('read-chapter',0);await shot('journal-390');await click('close');
    await page.evaluate(()=>{mergeGame.model.world.festival.points=200;mergeGame.invalidate();});await click('tab','festival');await shot('festival-390');for(let i=0;i<3;i++)await click('festival-claim',i);assert.equal(await page.evaluate(()=>mergeGame.model.world.festival.cycle),1);
    await click('open',undefined,{panel:'puzzle-list'});await shot('puzzles-390');
    await page.evaluate(()=>{mergeGame.model.energy=29;});const denied=await page.evaluate(()=>mergeGame.model.snapshot());await click('start-puzzle',1);assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),denied);assert.equal(await page.evaluate(()=>mergeGame.ui.panel),'puzzle-list');
    await click('refill');await click('start-puzzle',1);assert.equal(await page.evaluate(()=>mergeGame.model.energy),70);await click('retry-puzzle',1);assert.equal(await page.evaluate(()=>mergeGame.model.energy),40);
    const board=await page.evaluate(()=>mergeGame.model.board);await shot('puzzle-390');const tapped=await page.evaluate(()=>mergeGame.model.world.puzzle.active.board.flatMap((value,i)=>value>0?[i]:[]).slice(0,2)),beforeTaps=await page.evaluate(()=>mergeGame.model.world.puzzle.active);for(const index of tapped){const point=await cell(index,true);await page.mouse.click(point.x,point.y);}assert.deepEqual(await page.evaluate(()=>mergeGame.model.world.puzzle.active),beforeTaps);
    for(const move of makePuzzle(1).solution)await swipe(move.from,move.to);assert(await page.evaluate(()=>mergeGame.model.world.puzzle.active.won));assert.deepEqual(await page.evaluate(()=>mergeGame.model.board),board);await shot('puzzle-win-390');
    await click('start-puzzle',2);assert.equal(await page.evaluate(()=>mergeGame.model.energy),10);const first=makePuzzle(2).solution[0];await drag(first.from,first.to,true);const puzzle=await page.evaluate(()=>mergeGame.model.world.puzzle.active);await page.reload();await page.waitForFunction(()=>Object.keys(mergeGame.view.images).length===mergeGame.view.assetCount);await click('open',undefined,{panel:'puzzle-list'});await click('start-puzzle',2);assert.deepEqual(await page.evaluate(()=>mergeGame.model.world.puzzle.active),puzzle);assert.equal(await page.evaluate(()=>mergeGame.model.energy),10);await click('close');
    await click('open',undefined,{panel:'puzzle-list'});await click('start-puzzle',2);await page.evaluate(()=>{const m=mergeGame.model,now=Date.now();m.clock=()=>now;m.world.energyAt=now;m.world.incomeAt=now;m.world.puzzle.active.moves=m.world.puzzle.active.limit-1;mergeGame.ui.toast=null;mergeGame.invalidate();});const nextMove=makePuzzle(2).solution[1];await swipe(nextMove.from,nextMove.to);await shot('puzzle-failed-390');
    assert.equal(await page.evaluate(()=>mergeGame.view.puzzleRect),null);const failed=await page.evaluate(()=>mergeGame.model.snapshot());await click('retry-puzzle',2);assert.deepEqual(await page.evaluate(()=>mergeGame.model.snapshot()),failed);
    await click('open',undefined,{panel:'puzzle-list'});await click('refill');await click('start-puzzle',2);assert.equal(await page.evaluate(()=>mergeGame.model.energy),70);assert.equal(await page.evaluate(()=>mergeGame.model.world.puzzle.active.moves),0);await click('close');
    await click('tab','festival');await click('daily-claim',2);assert(await page.evaluate(()=>mergeGame.model.world.daily.claimed.includes(2)));
    await click('open',undefined,{panel:'settings'});await shot('settings-390');const state=await page.evaluate(()=>mergeGame.model.snapshot());page.once('dialog',dialog=>dialog.dismiss());await click('reset');assert.deepEqual(await page.evaluate(()=>mergeGame.model.board),state.board);assert.equal(await page.evaluate(()=>mergeGame.model.world.story.step),state.world.story.step);await click('close');
    await click('open',undefined,{panel:'gallery'});await shot('gallery-390');await click('page',undefined,{delta:1});assert.equal(await page.evaluate(()=>mergeGame.ui.page),1);await shot('gallery-resources-390');await click('close');
    await click('open',undefined,{panel:'gallery'});await click('page',undefined,{delta:1});await click('page',undefined,{delta:1});await shot('gallery-drinks-390');await click('page',undefined,{delta:1});await shot('gallery-final-drink-390');await click('close');
    await click('tab','merge');await page.evaluate(()=>{const m=mergeGame.model;m.board.fill(null);for(let lv=1;lv<=8;lv++){m.board[lv-1]={chainId:'snacks',level:lv};m.board[lv+7]={chainId:'snacks',level:lv};}mergeGame.ui.selected=-1;mergeGame.ui.producer='snack-cart';mergeGame.ui.toast=null;mergeGame.invalidate();});await shot('drink-board-390');
    await drag(6,14);assert.equal(await page.evaluate(()=>mergeGame.model.board[14].level),8);
    await page.evaluate(()=>{const m=mergeGame.model;m.board.fill(null);for(let lv=1;lv<=8;lv++){m.board[lv-1]={chainId:'garden',level:lv};m.board[lv+7]={chainId:'garden',level:lv};}mergeGame.ui.selected=-1;mergeGame.ui.producer='seed-house';mergeGame.ui.toast=null;mergeGame.invalidate();});await shot('fruit-board-390');
    await drag(6,14);assert.equal(await page.evaluate(()=>mergeGame.model.board[14].level),8);
    await page.evaluate(()=>{const m=mergeGame.model;m.orders[2]=m.makeOrder({kind:'challenge',requirements:[{chainId:'garden',level:8,quantity:1},{chainId:'garden',level:6,quantity:1}]});mergeGame.ui.toast=null;mergeGame.invalidate();});await shot('fruit-order-390');
    const fruitCoins=await page.evaluate(()=>mergeGame.model.coins);await click('submit',await page.evaluate(()=>mergeGame.model.orders[2].id));assert(await page.evaluate(coins=>mergeGame.model.coins>coins,fruitCoins));
    await click('open',undefined,{panel:'gallery'});for(let i=0;i<4;i++)await click('page',undefined,{delta:1});await shot('gallery-fruits-390');await click('close');
    const decoded=await page.evaluate(async()=>{const c=new AudioContext();const results=await Promise.all(['merge','combo','spawn','move','order','chapter','error'].map(async name=>{const r=await fetch('/sounds/'+name+'.wav');const b=await c.decodeAudioData(await r.arrayBuffer());return r.ok&&b.numberOfChannels===1&&b.duration<1;}));await c.close();return results;});assert(decoded.every(Boolean));
    const lifecycle=await page.evaluate(()=>{
      const game=mergeGame,m=game.model;window.previewClock=Date.now();m.clock=()=>previewClock;m.world.energyAt=previewClock;m.world.incomeAt=previewClock;m.energy=50;
      const coins=m.coins,expected=2*Object.keys(m.world.residents).length*(1+Math.floor(m.buildCount()/8));
      Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));
      const hidden=!game.active&&game.timer===null&&game.ui.drag===null;
      previewClock+=120000;Object.defineProperty(document,'hidden',{value:false,configurable:true});document.dispatchEvent(new Event('visibilitychange'));
      const income=m.coins-coins,energy=m.energy;document.dispatchEvent(new Event('visibilitychange'));
      return {hidden,shown:game.active&&game.timer!==null,income,expected,energy,noRepeat:m.coins-coins===expected};
    });assert(lifecycle.hidden&&lifecycle.shown&&lifecycle.noRepeat);assert.equal(lifecycle.income,lifecycle.expected);assert.equal(lifecycle.energy,51);
    await context.close();
    for(const [width,height,safeTop,safeBottom,capsule]of[[320,568,20,0,true],[375,667,20,0,false],[390,844,44,34,true],[430,932,59,34,true],[360,640,24,0,true]]){
      const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:2}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(url+`?safeTop=${safeTop}&safeBottom=${safeBottom}${capsule?'&capsule=1':''}`);await p.waitForFunction(()=>Object.keys(mergeGame.view.images).length===mergeGame.view.assetCount);
      const press=async action=>{await p.waitForTimeout(50);const r=await p.evaluate(action=>mergeGame.view.buttons.find(b=>Object.entries(action).every(([key,value])=>b.action[key]===value)),action);assert(r,JSON.stringify(action));const s=await p.evaluate(()=>mergeGame.view.scale);await p.mouse.click((r.x+r.w/2)*s,(r.y+r.h/2)*s);await p.waitForTimeout(50);};
      await press({type:'close'});
      for(const tab of ['merge','park','story','festival']){await press({type:'tab',id:tab});await p.screenshot({path:path.join(output,`${tab}-${width}.png`)});assert(await p.evaluate(()=>mergeGame.view.buttons.every(r=>r.x>=0&&r.w>0&&r.h>0&&r.x+r.w<=390.01&&r.y>=0&&r.y+r.h<=mergeGame.view.height-mergeGame.view.safeBottom+.01)),`Clipped buttons on ${tab}/${width}`);}
      await p.evaluate(()=>{const m=mergeGame.model;m.world.areas.fill(4);m.world.storageSize=12;m.world.story.step=24;m.world.story.choices=[0,1,0,1,0,1];m.world.unlockedDecorations=['spring','sunset','starlight'];for(let level=1;level<=8;level++)m.world.residents[level]={xp:1296};mergeGame.ui.area=5;mergeGame.ui.resident=8;m.startPuzzle(1);});
      if(width===390){
        await press({type:'tab',id:'park'});await p.screenshot({path:path.join(output,'park-complete-390.png')});
        for(let area=0;area<6;area++){
          const images=[];
          for(let stage=0;stage<=4;stage++){
            await p.evaluate(({area,stage})=>{mergeGame.model.world.areas[area]=stage;mergeGame.ui.area=area;mergeGame.open('area');mergeGame.invalidate();},{area,stage});await p.waitForTimeout(60);
            const clip=await p.evaluate(()=>{const v=mergeGame.view;return {x:75*v.scale,y:(v.panelRect.y+52)*v.scale,width:240*v.scale,height:101*v.scale};});
            images.push((await p.screenshot({clip})).toString('base64'));
          }
          assert.equal(new Set(images).size,5,`Repair stages need visible artwork changes in area ${area}`);
        }
        await p.evaluate(()=>{mergeGame.model.world.areas.fill(4);mergeGame.ui.panel=null;mergeGame.invalidate();});
      }
      for(const panel of ['gallery','settings','storage','producers','residents','resident','area','journal','decorations','puzzle-list','puzzle','reading','choice']){
        await p.evaluate(({panel,chapter})=>{if(panel==='reading')mergeGame.perform({type:'open',reading:'help'});else if(panel==='choice'){mergeGame.reading(chapter.title,chapter.tasks[3].text+'\n'+chapter.ending,23);}else mergeGame.open(panel);mergeGame.invalidate();},{panel,chapter:CHAPTERS[5]});
        await p.waitForTimeout(60);await p.screenshot({path:path.join(output,`${panel}-${width}.png`)});
        assert(await p.evaluate(()=>{const v=mergeGame.view,p=v.panelRect;return v.buttons.every(r=>r.y>=p.y&&r.y+r.h<=p.y+p.h+.01&&r.x>=p.x&&r.x+r.w<=p.x+p.w+.01);}),`Clipped panel ${panel}/${width}`);await press({type:'close'});
      }
      await p.evaluate(()=>{const s=mergeGame.model.world.puzzle.active;s.moves=s.limit;s.won=false;mergeGame.ui.toast=null;mergeGame.open('puzzle');mergeGame.invalidate();});await p.waitForTimeout(60);await p.screenshot({path:path.join(output,`puzzle-failed-${width}.png`)});
      assert(await p.evaluate(()=>{const v=mergeGame.view,p=v.panelRect;return v.puzzleRect===null&&v.buttons.length===3&&v.buttons.every(r=>r.y>=p.y&&r.y+r.h<=p.y+p.h&&r.x>=p.x&&r.x+r.w<=p.x+p.w);}),`Clipped rescue failure overlay/${width}`);await press({type:'open',panel:'puzzle-list'});
      await ctx.close();
    }
    assert.deepEqual(errors,[]);console.log('PASS: 2.0 actual touch gameplay, storage/tools, repairs, residents/gifts/letters, producers, story choices/journal, celebration, puzzle/reload, daily, mute/audio, hide/show recovery, reset cancellation, four tabs and thirteen panel states at five sizes; zero JavaScript errors.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
