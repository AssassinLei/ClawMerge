const {CONFIG,getItem}=require('./config');
const ZooModel=require('./zoo');
const ZooView=require('./view2');
const SoundManager=require('./sound');
const {CHAPTERS,AREAS}=require('./content');
const {swipeTarget}=require('./puzzles');
const HELP='合成：拖动相同物品，或先点选再点目标格。\n心愿：交单赚金币和星星，普通心愿会保留容易需求。\n园区：星星、金币与资源修复小屋，开启饮品吧和果香小屋。\n居民：邀请动物入住，送饮料解锁来信。\n仓库与道具：点选物品后可收纳、拆分或升一级。\n故事：完成目标后领取奖励，并写下自己的章节选择。\n解救萌友：在图案上向上下左右滑动一格，同级自动合成，每次挑战或重试消耗30体力，续局不重复扣费。';
const ERRORS={'rescue-energy':'需要30体力，可在关卡选择中免费休息补满',full:'棋盘满了，可以合成、交单或先放入仓库',energy:'体力不足，设置里可以免费休息补满',locked:'先修复迎风小院，开启新的生产器','locked-area':'先把前一个园区修复到 2/4','locked-home':'先修复这个朋友所在的小屋',currency:'金币或星星还不够，心愿和庆典都能获得',items:'棋盘上的材料还不够，先合成需要的物品',max:'已经是最高等级啦','no-tool':'道具用完了，故事与庆典会送给你',base:'基础物品不能再拆分','storage-full':'仓库满了，可以取出一些物品或扩容','max-storage':'先修复月光水岸，再继续扩容','not-snack':'先选择棋盘里已有的饮料','not-resident':'先邀请这位朋友入住','max-friendship':'已经亲密满级，来信都解锁了',owned:'它已经住在这里啦','not-ready':'目标还没有完成，继续慢慢来',adjacent:'只能移动到相邻空格，或与相邻同级合成',blocked:'这里暂时不能移动过去','previous-reward':'先领取左边的庆典奖励',coins:'金币不够，先完成一个容易心愿','no-alternative':'暂时没有不同的心愿，金币未扣除',invalid:'先点选一个有效物品'};
class MergeGame {
  constructor(platform,options={}) {
    this.platform=platform;let saved;try{saved=platform.getStorageSync(CONFIG.storageKey);}catch(_){saved=null;}
    this.model=new ZooModel(saved,options.random||Math.random,options.clock||Date.now);
    this.sound=new SoundManager(platform,this.model.soundEnabled);
    this.ui={tab:'merge',producer:'friends-home',selected:-1,drag:null,panel:null,page:0,toast:null,effects:[]};
    this.active=true;this.busy=false;this.pendingFrame=null;this.timer=null;this.canvas=platform.createCanvas();
    this.view=new ZooView(this.canvas,platform,this.windowInfo(),this.menuRect());this.view.onInvalidate=()=>this.invalidate();
    this.frame=()=>{this.pendingFrame=null;if(!this.active)return;const now=Date.now();this.ui.effects=this.ui.effects.filter(e=>now-e.start<350);this.view.draw(this.model,this.ui,now);if(this.ui.effects.length||this.ui.toast&&now<this.ui.toast.until)this.invalidate();};
    platform.onTouchStart(e=>this.touchStart(e));platform.onTouchMove(e=>this.touchMove(e));platform.onTouchEnd(e=>this.touchEnd(e));platform.onTouchCancel(()=>this.cancelTouch());
    platform.onHide?.(()=>{this.cancelTouch();this.model.syncTime();this.save();this.sound.stopAll();this.active=false;clearTimeout(this.timer);this.timer=null;if(this.pendingFrame!==null)this.cancelFrame(this.pendingFrame);this.pendingFrame=null;});
    platform.onShow?.(()=>{this.active=true;const {income}=this.model.syncTime();if(income)this.notify(`朋友们照看小院 · 金币 +${income}`);this.save();this.invalidate();this.startTimer();});
    platform.onWindowResize?.(()=>{this.cancelTouch();this.view.layout(this.windowInfo(),this.menuRect());this.invalidate();});
    if(!saved)this.reading('欢迎成为园长',CHAPTERS[0].intro+'\n先把相同萌友拖到一起，再完成心愿。去“故事”页领取奖励，一点一点把动物园重新打开。');
    else if(this.model.offlineIncome)this.notify(`欢迎回来 · 居民积攒了 ${this.model.offlineIncome} 金币`);
    if(this.model.lastSaveRecovered)this.notify('已恢复可用进度，可以继续建设小院');
    this.save();this.invalidate();this.startTimer();
  }
  startTimer(){if(this.timer!==null||!this.active)return;this.timer=setTimeout(()=>{this.timer=null;if(!this.active)return;const result=this.model.syncTime();if(result.income||result.energySteps)this.save();this.invalidate();this.startTimer();},1000);this.timer?.unref?.();}
  windowInfo(){return this.platform.getWindowInfo?this.platform.getWindowInfo():this.platform.getSystemInfoSync();}
  menuRect(){try{return this.platform.getMenuButtonBoundingClientRect?.()||null;}catch(_){return null;}}
  requestFrame(fn){return this.canvas.requestAnimationFrame?this.canvas.requestAnimationFrame(fn):requestAnimationFrame(fn);}
  cancelFrame(id){if(this.canvas.cancelAnimationFrame)this.canvas.cancelAnimationFrame(id);else cancelAnimationFrame(id);}
  invalidate(){if(this.active&&this.frame&&this.pendingFrame===null)this.pendingFrame=this.requestFrame(this.frame);}
  save(){try{this.platform.setStorageSync(CONFIG.storageKey,this.model.snapshot());}catch(_){this.notify('暂时无法保存，请检查设备存储空间');}}
  notify(message){this.ui.toast={message,until:Date.now()+2200};this.invalidate();}
  reading(title,body,choice){this.ui.panel='reading';this.ui.readingTitle=title;this.ui.readingBody=body;this.ui.storyChoice=choice;this.cancelTouch();}
  open(panel){this.ui.panel=panel;this.ui.page=0;this.ui.storyChoice=undefined;this.cancelTouch();this.ui.selected=-1;}
  position(event,end=false){const touch=(end?event.changedTouches:event.touches)?.[0];return touch?this.view.point(touch.clientX??touch.x,touch.clientY??touch.y):null;}
  cancelTouch(){this.ui.drag=null;this.pressed=null;this.startPoint=null;this.invalidate();}
  touchStart(event){
    if(!this.active||this.busy||this.ui.drag)return;const point=this.position(event);if(!point)return;this.startPoint=point;
    const puzzle=this.ui.panel==='puzzle',session=this.model.world.puzzle.active,ended=puzzle&&(!session||session.won||session.moves>=session.limit),index=ended?-1:puzzle?this.view.puzzleAt(point.x,point.y):this.ui.panel||this.ui.tab!=='merge'?-1:this.view.cellAt(point.x,point.y);
    if(puzzle&&index>=0&&session.board[index]<=0)return;
    if(index>=0){this.ui.drag={kind:puzzle?'puzzle':'board',from:index,startX:point.x,startY:point.y,x:point.x,y:point.y,moved:false};this.invalidate();return;}
    this.pressed=this.view.actionAt(point.x,point.y,this.ui);
  }
  touchMove(event){const point=this.position(event),drag=this.ui.drag;if(!point||!drag||this.busy)return;drag.x=point.x;drag.y=point.y;if(Math.hypot(point.x-drag.startX,point.y-drag.startY)>6)drag.moved=true;this.invalidate();}
  touchEnd(event){
    if(!this.active||this.busy){this.cancelTouch();return;}const point=this.position(event,true);if(!point){this.cancelTouch();return;}
    if(['gallery','residents'].includes(this.ui.panel)&&this.startPoint&&Math.abs(point.x-this.startPoint.x)>45&&Math.abs(point.y-this.startPoint.y)<60){this.perform({type:'page',delta:point.x<this.startPoint.x?1:-1});this.cancelTouch();return;}
    const pressed=this.pressed,drag=this.ui.drag;this.pressed=null;this.ui.drag=null;this.startPoint=null;
    if(pressed){const target=this.view.actionAt(point.x,point.y,this.ui);if(target&&JSON.stringify(target)===JSON.stringify(pressed))this.perform(pressed);this.invalidate();return;}
    if(!drag)return;
    if(drag.kind==='puzzle'){
      const target=swipeTarget(drag.from,point.x-drag.startX,point.y-drag.startY,this.view.puzzleRect?.w/4);
      if(target>=0)this.move(drag.from,target,true);
      this.invalidate();return;
    }
    const target=this.view.cellAt(point.x,point.y);
    if(target<0){this.ui.selected=drag.from;this.invalidate();return;}
    if(drag.moved&&target!==drag.from)this.move(drag.from,target);
    else if(!drag.moved){if(this.ui.selected>=0&&this.ui.selected!==target)this.move(this.ui.selected,target);else{this.ui.selected=this.ui.selected===target?-1:target;this.sound.play('move');}}
    this.invalidate();
  }
  move(from,to,puzzle=false){
    const result=puzzle?this.model.puzzleMove(from,to):this.model.move(from,to);
    if(!result.ok){this.notify(ERRORS[result.reason]||'这一步暂时不能完成');this.sound.play('error');return;}
    if(!puzzle)this.ui.selected=to;
    if(result.kind==='merge'){this.sound.play(result.bonus?'combo':'merge');if(!puzzle)this.ui.effects.push({index:to,start:Date.now()});}
    else this.sound.play('move');
    if(result.won){this.notify(result.rewarded?'萌友获救！首次奖励已收好':'再次救出萌友 · 今日救援完成了');this.sound.play('order');}
    else if(!puzzle&&result.isNew)this.notify(`发现新收藏：${getItem(result.item).name}`);
    else if(result.failed)this.notify('步数用完了，重新挑战需要30体力');
    this.save();this.invalidate();
  }
  finish(result,message,sound='move'){if(!result?.ok){this.notify(ERRORS[result?.reason]||'这一步暂时不能完成');this.sound.play('error');return false;}this.ui.selected=-1;this.sound.play(sound);this.save();if(message)this.notify(message);this.invalidate();return true;}
  routeStory(){
    const m=this.model,task=m.storyTask();if(!task)return;
    if(['build','build-total'].includes(task.type)){let area=task.area??m.world.areas.findIndex(stage=>stage<4);if(area<0)area=0;while(area>0&&!m.areaUnlocked(area))area--;this.ui.area=area;this.open('area');}
    else if(['resident','resident-count','gifts','friendship'].includes(task.type)){this.open('residents');}
    else if(task.type==='puzzles')this.open('puzzle-list');
    else{this.ui.tab='merge';this.ui.panel=null;const chain=task.items?.[0]?.chainId,producer=CONFIG.producers.find(p=>p.outputs[0].chainId===chain);if(producer){if(m.isProducerUnlocked(producer))this.ui.producer=producer.id;else{this.ui.area=0;this.open('area');}}}
  }
  perform(action){
    if(this.busy||!this.active)return;const m=this.model;let result;
    if(action.type==='tab'){this.ui.tab=action.id;this.ui.panel=null;this.cancelTouch();this.ui.selected=-1;this.sound.play('move');}
    else if(action.type==='close'){this.ui.panel=null;this.ui.storyChoice=undefined;this.cancelTouch();}
    else if(action.type==='open'){if(action.reading==='help')this.reading('小院怎么玩',HELP);else this.open(action.panel);}
    else if(action.type==='page'){const pages=this.ui.panel==='residents'?2:Math.ceil(CONFIG.chains.reduce((n,c)=>n+c.levels.length,0)/5);this.ui.page=((this.ui.page||0)+action.delta+pages)%pages;}
    else if(action.type==='sound-toggle'){m.soundEnabled=!m.soundEnabled;this.sound.setEnabled(m.soundEnabled);this.save();this.sound.play('move');}
    else if(action.type==='redeem-code')this.redeemCode();
    else if(action.type==='refill'){m.refillEnergy();this.save();this.notify('体力补满了，慢慢来就好');}
    else if(action.type==='produce'){result=m.produce(action.id);if(this.finish(result,null,'spawn'))this.ui.effects.push({index:result.index,start:Date.now()});}
    else if(action.type==='submit'){result=m.submit(action.id);this.finish(result,result.ok?`心愿完成 · +${result.reward+result.bonus} 金币 +${result.stars} 星`:null,'order');}
    else if(action.type==='refresh-order'){const cost=m.refreshCost();if(m.coins<cost)this.notify(`需要 ${cost} 金币，先完成一个容易心愿`);else this.confirm('换一个心愿？',`消耗 ${cost} 金币，其他心愿保留。`,()=>this.finish(m.refreshOrder(action.id),'新心愿来了'));}
    else if(action.type==='sort')this.finish(m.sortBoard(),'小院整理好了');
    else if(action.type==='store')this.finish(m.store(this.ui.selected),'已放入仓库');
    else if(action.type==='withdraw'){result=m.withdraw(action.id);if(this.finish(result,'物品已取回棋盘'))this.ui.panel=null;}
    else if(action.type==='expand-storage')this.finish(m.expandStorage(),'储物架多了 3 个空位');
    else if(action.type==='tool')this.finish(m.useTool(action.id,this.ui.selected),action.id==='wild'?'星光让它升了一级':'已经拆成两个相同的物品','merge');
    else if(action.type==='select-producer'){const producer=CONFIG.producers.find(p=>p.id===action.id);if(producer&&m.isProducerUnlocked(producer)){this.ui.producer=action.id;this.ui.panel=null;this.ui.tab='merge';}else this.notify(ERRORS.locked);}
    else if(action.type==='upgrade-producer')this.finish(m.upgradeProducer(action.id),'小窝升级了，高级物品更容易出现','chapter');
    else if(action.type==='area'){this.ui.area=action.id;this.open('area');}
    else if(action.type==='build'){if(m.world.areas[action.id]!==action.stage)return;result=m.build(action.id);this.finish(result,result.ok&&result.unlocked?'修复完成！新的生产器已经打开':'这个地方变得更温暖了','chapter');}
    else if(action.type==='resident'){this.ui.resident=action.id;this.ui.giftLevel=m.residentDef(action.id).favorite;this.open('resident');}
    else if(action.type==='adopt')this.finish(m.adopt(action.id),'又一位朋友决定留下来','order');
    else if(action.type==='gift-level')this.ui.giftLevel=action.id;
    else if(action.type==='gift'){const index=m.board.findIndex(item=>item?.chainId==='snacks'&&item.level===this.ui.giftLevel);result=m.gift(action.id,index);this.finish(result,result.ok?result.letter?'这份陪伴，解锁了一封新来信':`心意 +${result.amount} · 亲密 Lv.${result.friendship}`:null,'order');}
    else if(action.type==='letter'){if(m.friendship(action.id)<[3,6,10][action.letter])this.notify(`亲密 ${[3,6,10][action.letter]} 级时，它会把这封信交给你`);else this.reading(`${getItem({chainId:'friends',level:action.id}).name}的来信`,m.residentDef(action.id).letters[action.letter]);}
    else if(action.type==='story-route')this.routeStory();
    else if(action.type==='claim-story'){
      const task=m.storyTask();if(!task||action.id!==m.world.story.step)return;if(!m.storyProgress().ready){this.notify(ERRORS['not-ready']);return;}
      const chapter=Math.floor(action.id/4);if(action.id%4===3)this.reading(CHAPTERS[chapter].title,task.text+'\n'+CHAPTERS[chapter].ending,action.id);
      else{result=m.claimStory(0,action.id);if(this.finish(result,'故事奖励已收好','order'))this.reading(CHAPTERS[chapter].speaker,task.text);}
    }
    else if(action.type==='choose-story'){result=m.claimStory(action.choice,action.id);if(this.finish(result,result.ending?'欢迎回家 · 动物园重新开门了':'下一段回忆，在等你们一起写','chapter'))this.ui.panel=null;}
    else if(action.type==='read-chapter'){const chapter=CHAPTERS[action.id],done=m.world.story.step>=(action.id+1)*4;if(chapter&&action.id<=Math.floor(m.world.story.step/4))this.reading(chapter.title,done?chapter.intro+'\n'+chapter.ending+'\n你们的选择：'+chapter.choices[m.world.story.choices[action.id]||0]+'。':chapter.intro);}
    else if(action.type==='daily-claim')this.finish(m.claimDaily(action.id),'今天的小约定完成了 · 奖励已收好','order');
    else if(action.type==='festival-claim')this.finish(m.claimFestival(action.id),action.id===2?'庆典圆满结束 · 下一场已经开始':'这份庆典礼物，送给你们','chapter');
    else if(action.type==='decoration')this.finish(m.setDecoration(action.id),'动物园换上了新的心情');
    else if(action.type==='start-puzzle'||action.type==='retry-puzzle'){result=m.startPuzzle(action.id,action.type==='retry-puzzle');if(this.finish(result,result.resumed?'继续救援 · 不重复扣费':'开始救援 · 体力 -30'))this.ui.panel='puzzle';}
    else if(action.type==='discard'){const index=this.ui.selected,item=m.board[index];if(item)this.confirm(`移出${getItem(item).name}？`,'这个物品会离开棋盘。也可以先放入仓库保存。',()=>{if(m.board[index]===item){m.discard(index);this.ui.selected=-1;this.save();this.invalidate();}});}
    else if(action.type==='reset')this.confirm('重新开始动物园？','将清除棋盘、故事、居民和建设进度，开启新的旅程。',()=>{m.restart();this.ui={...this.ui,tab:'merge',producer:'friends-home',selected:-1,panel:null,drag:null,effects:[]};this.save();this.reading('一封没有署名的信',CHAPTERS[0].intro);this.invalidate();});
    this.invalidate();
  }
  confirm(title,content,callback){
    this.busy=true;this.cancelTouch();
    try{this.platform.showModal({title,content,confirmText:'确认',cancelText:'取消',confirmColor:'#718873',success:result=>{this.busy=false;if(result.confirm)callback();this.invalidate();},fail:()=>{this.busy=false;this.notify('暂时无法打开确认窗口');}});}catch(_){this.busy=false;this.notify('暂时无法打开确认窗口');}
  }
  redeemCode(){
    this.busy=true;this.cancelTouch();
    try{this.platform.showModal({title:'兑换码',editable:true,placeholderText:'请输入兑换码',confirmText:'兑换',cancelText:'取消',confirmColor:'#718873',success:result=>{
      this.busy=false;
      if(result.confirm){const redeemed=this.model.redeemCode(result.content);if(redeemed.ok)this.finish(redeemed,'兑换成功 · 所有生产器已解锁','chapter');else this.notify(redeemed.reason==='code-used'?'这份礼物已经领取，生产器都已解锁':'兑换码不正确，请检查后再试');}
      this.invalidate();
    },fail:()=>{this.busy=false;this.notify('暂时无法输入兑换码，请再试一次');}});}catch(_){this.busy=false;this.notify('暂时无法输入兑换码，请再试一次');}
  }
}
module.exports=MergeGame;
