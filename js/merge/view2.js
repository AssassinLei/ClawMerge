const {CONFIG,getItem,getChain}=require('./config');
const {AREAS,CHAPTERS,RESIDENTS,FESTIVALS,DAILY}=require('./content');
const {C,box,text,wrap,circle,icon,sprite,progress,areaArt}=require('./art');
const {RESCUE_RULES}=require('./puzzles');
const inside=(r,x,y)=>r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
const short=n=>n>=10000?(n/10000).toFixed(1)+'万':String(n);
class ZooView {
  constructor(canvas,platform,info,menu) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.images={};this.failedImages=[];this.buttons=[];this.layout(info,menu);
    const assets=CONFIG.chains.flatMap(chain=>chain.levels.filter(level=>level.image));assets.push({id:'park',image:'images/zoo/park.jpg'});
    this.assetCount=assets.length;
    assets.forEach(def=>{const image=platform.createImage();image.onload=()=>{this.images[def.id]=image;this.onInvalidate?.();};image.onerror=()=>{this.failedImages.push(def.image);this.onInvalidate?.();};image.src=def.image;});
  }
  layout(info,menu) {
    const width=info.windowWidth||390,height=info.windowHeight||844;
    this.scale=width/390;this.height=height/this.scale;this.pixelRatio=Math.min(info.pixelRatio||1,3);
    this.canvas.width=Math.round(width*this.pixelRatio);this.canvas.height=Math.round(height*this.pixelRatio);
    const safe=info.safeArea||{top:0,bottom:height};this.safeBottom=Math.max(0,height-(safe.bottom||height))/this.scale;
    this.top=Math.max((safe.top||0)/this.scale+12,menu?.bottom?menu.bottom/this.scale+8:24);
    this.contentY=this.top+82;this.navY=this.height-this.safeBottom-56;this.compact=this.navY-this.contentY<550;
    this.orderY=this.contentY+38;this.orderH=this.compact?104:116;
    this.gridY=this.orderY+this.orderH+30;this.cell=Math.min(50,(this.navY-this.gridY-45)/7);
    this.gridW=this.cell*7;this.gridX=(390-this.gridW)/2;
    this.producerRect={x:20,y:this.orderY,w:83,h:this.orderH};
    this.orderRects=[0,1,2].map(i=>({x:109+i*89,y:this.orderY,w:83,h:this.orderH}));
    this.panelRect={x:18,y:this.top+35,w:354,h:this.navY-this.top-43};
    this.puzzleRect=null;
  }
  point(x,y){return{x:x/this.scale,y:y/this.scale};}
  cellRect(index){return{x:this.gridX+index%7*this.cell,y:this.gridY+Math.floor(index/7)*this.cell,w:this.cell,h:this.cell};}
  cellAt(x,y){return x<this.gridX||x>=this.gridX+this.gridW||y<this.gridY||y>=this.gridY+this.gridW?-1:Math.floor((y-this.gridY)/this.cell)*7+Math.floor((x-this.gridX)/this.cell);}
  puzzleAt(x,y){const r=this.puzzleRect;return !r||!inside(r,x,y)?-1:Math.min(3,Math.floor((y-r.y)/(r.w/4)))*4+Math.min(3,Math.floor((x-r.x)/(r.w/4)));}
  actionAt(x,y,ui){for(let i=this.buttons.length-1;i>=0;i--)if(inside(this.buttons[i],x,y))return this.buttons[i].action;return ui.panel?{type:'panel'}:null;}
  hit(r,action){this.buttons.push({...r,action});}
  button(label,r,action,enabled=true,color=C.green,size=11){box(this.ctx,r,enabled?color:'#EAE5DC',10);text(this.ctx,label,r.x+r.w/2,r.y+r.h/2,size,enabled?'#FFFDF6':C.muted,'center',true,r.w-10);this.hit(r,action);}
  item(item,r,opacity=1){sprite(this.ctx,this.images,item,r,opacity);}
  draw(model,ui,now) {
    const c=this.ctx;c.setTransform(this.scale*this.pixelRatio,0,0,this.scale*this.pixelRatio,0,0);c.clearRect(0,0,390,this.height);this.buttons=[];this.puzzleRect=null;
    const g=c.createLinearGradient(0,0,0,this.height);g.addColorStop(0,'#FFF9EF');g.addColorStop(1,'#F0F2E7');c.fillStyle=g;c.fillRect(0,0,390,this.height);
    this.header(model);
    if(ui.tab==='park')this.park(model,ui);else if(ui.tab==='story')this.story(model,ui);else if(ui.tab==='festival')this.festival(model,ui);else this.merge(model,ui,now);
    this.nav(ui,model);
    if(ui.panel){this.buttons=[];this.panel(model,ui);}
    if(ui.toast&&now<ui.toast.until){const label=ui.toast.message,w=Math.min(354,Math.max(190,label.length*11+24)),y=this.navY-42;box(c,{x:(390-w)/2,y,w,h:32},'#51443CEE',16);text(c,label,195,y+16,11,'#FFFDF5','center',false,w-20);}
  }
  header(m) {
    const c=this.ctx,t=this.top;text(c,CONFIG.title,20,t+3,23,C.ink,'left',true);text(c,'重新开园 · 2.0',20,t+25,9,C.muted);
    box(c,{x:300,y:t-9,w:30,h:30},C.white,10,C.line);icon(c,'book',315,t+6,17);this.hit({x:300,y:t-9,w:30,h:30},{type:'open',panel:'gallery'});
    box(c,{x:338,y:t-9,w:32,h:30},C.white,10,C.line);icon(c,'settings',354,t+6,17);this.hit({x:338,y:t-9,w:32,h:30},{type:'open',panel:'settings'});
    [[20,128],[155,79],[242,128]].forEach(([x,w])=>box(c,{x,y:t+39,w,h:29},C.white,12,C.line));
    icon(c,'coin',35,t+53,15,C.gold);text(c,short(m.coins),49,t+53,12,C.ink,'left',true);icon(c,'star',170,t+53,14,C.gold);text(c,short(m.world.stars),184,t+53,12,C.ink,'left',true);
    icon(c,'bolt',257,t+53,14);text(c,`${m.energy}/100`,271,t+53,12,C.ink,'left',true);
    const level=m.level(),previous=25*(level-1)*level;
    text(c,`园长 Lv.${level}`,20,t+75,9,C.muted);progress(c,96,t+73,274,level===30?1:(m.world.xp-previous)/(m.levelTarget()-previous));
  }
  nav(ui,m) {
    const c=this.ctx,y=this.navY;box(c,{x:12,y,w:366,h:50},'#FFFDF8',17,C.line);
    const tabs=[['merge','合成','leaf'],['park','园区','home'],['story','故事','book'],['festival','庆典','star']];
    tabs.forEach(([id,name,symbol],i)=>{const x=22+i*90,active=ui.tab===id;if(active)box(c,{x,y:y+5,w:78,h:40},'#E7EEE0',12);icon(c,symbol,x+39,y+17,15,active?C.green:C.muted);text(c,name,x+39,y+35,10,active?C.green:C.muted,'center',active);this.hit({x,y,w:78,h:48},{type:'tab',id});});
    if(m.storyProgress().ready&&m.storyTask())circle(c,236,y+8,3,'#D4A174');
  }
  merge(m,ui,now) {
    const c=this.ctx,y=this.contentY,task=m.storyTask(),p=m.storyProgress();
    const hint=m.world.tutorial<2?'拖动相同萌友，合成下一等级':m.world.tutorial<3?'凑齐心愿后提交，赚到修复星星':task?task.title:'动物园的故事，继续由你来写';
    box(c,{x:20,y,w:350,h:29},'#EEEADC',10);icon(c,'book',35,y+14,13);text(c,hint,48,y+14,10,C.ink,'left',false,245);text(c,task?`${p.have}/${p.need} ›`:'回看 ›',356,y+14,10,C.green,'right');this.hit({x:20,y,w:350,h:29},{type:'tab',id:'story'});
    const producer=CONFIG.producers.find(v=>v.id===ui.producer)||CONFIG.producers[0],r=this.producerRect;
    box(c,r,C.green,13);text(c,producer.name,r.x+r.w/2,r.y+13,9,'#FFFDF4','center',true);const s=42,sy=r.y+26;
    box(c,{x:r.x+(r.w-s)/2,y:sy,w:s,h:s},'#F7F2E4',10);this.item(producer.outputs[0],{x:r.x+(r.w-s)/2,y:sy,w:s,h:s});
    this.button('生成 -1',{x:r.x+6,y:r.y+r.h-34,w:r.w-12,h:28},{type:'produce',id:producer.id},true,'#8C9E87',9);
    // The entire card has one frequent action; management lives in the board toolbar.
    this.hit(r,{type:'produce',id:producer.id});
    m.orders.forEach((order,i)=>this.order(m,order,this.orderRects[i],i));
    text(c,'爪爪小院',20,this.gridY-15,12,C.ink,'left',true);text(c,`连合 ${m.combo}`,108,this.gridY-15,9,C.muted);
    this.button('生产器管理',{x:188,y:this.gridY-27,w:88,h:22},{type:'open',panel:'producers'},true,'#A4957C',9);
    text(c,'整理',299,this.gridY-15,9,C.green,'center');this.hit({x:280,y:this.gridY-27,w:38,h:22},{type:'sort'});
    if(ui.selected>=0&&m.board[ui.selected]){text(c,'移出',352,this.gridY-15,9,C.muted,'right');this.hit({x:322,y:this.gridY-27,w:48,h:22},{type:'discard'});}
    box(c,{x:this.gridX-6,y:this.gridY-6,w:this.gridW+12,h:this.gridW+12},'#E8DFCE',17);
    for(let i=0;i<49;i++)this.drawCell(m,ui,i,now);
    if(ui.drag?.kind==='board'&&ui.drag.moved){const s=this.cell*1.2;this.item(m.board[ui.drag.from],{x:ui.drag.x-s/2,y:ui.drag.y-s/2,w:s,h:s},.92);}
    const by=this.gridY+this.gridW+13;
    if(ui.selected>=0&&m.board[ui.selected]){
      this.button('放入仓库',{x:20,y:by,w:106,h:24},{type:'store'},true,C.green,9);
      this.button(`拆分 ×${m.world.tools.split}`,{x:137,y:by,w:106,h:24},{type:'tool',id:'split'},!!m.world.tools.split,'#A4957C',9);
      this.button(`升一级 ×${m.world.tools.wild}`,{x:254,y:by,w:116,h:24},{type:'tool',id:'wild'},!!m.world.tools.wild,'#B69C78',9);
    }else{
      this.button(`仓库 ${m.world.storage.length}/${m.world.storageSize}`,{x:20,y:by,w:106,h:24},{type:'open',panel:'storage'},true,C.green,9);
      this.button('动物居民',{x:137,y:by,w:106,h:24},{type:'open',panel:'residents'},true,'#A4957C',9);
      this.button('解救萌友',{x:254,y:by,w:116,h:24},{type:'open',panel:'puzzle-list'},true,'#B69C78',9);
    }
  }
  drawCell(m,ui,index,now) {
    const r=this.cellRect(index),c=this.ctx,item=m.board[index],target=ui.drag?.kind==='board'&&ui.drag.moved&&this.cellAt(ui.drag.x,ui.drag.y)===index;
    box(c,{x:r.x+2,y:r.y+2,w:r.w-4,h:r.h-4},index===ui.selected?'#F8E8C8':target?'#DAE6D1':'#FAF7EF',9,index===ui.selected||target?'#B7A281':undefined);
    if(!item){circle(c,r.x+r.w/2,r.y+r.h/2,1.2,'#D7CBB8');return;}
    if(ui.drag?.kind==='board'&&ui.drag.from===index&&ui.drag.moved)return;
    const effect=ui.effects?.find(e=>e.index===index&&now-e.start<320),pop=effect?1+Math.sin((now-effect.start)/320*Math.PI)*.1:1,s=(this.cell-6)*pop;
    this.item(item,{x:r.x+(r.w-s)/2,y:r.y+(r.h-s)/2,w:s,h:s});
  }
  order(m,order,r,slot) {
    const c=this.ctx,ready=m.orderReady(order),challenge=order.kind==='challenge';box(c,r,ready?'#F1F7EB':challenge?'#FFF7E7':C.white,13,ready?'#ABC09E':C.line);
    text(c,challenge?'挑战单':`心愿 ${slot+1}`,r.x+7,r.y+11,8,challenge?'#AC8753':C.muted);icon(c,'refresh',r.x+r.w-12,r.y+11,11,C.muted);this.hit({x:r.x+r.w-23,y:r.y,w:23,h:24},{type:'refresh-order',id:order.id});
    icon(c,'coin',r.x+14,r.y+28,11,C.gold);text(c,short(order.reward),r.x+23,r.y+28,10,C.gold,'left',true,51);
    const n=order.requirements.length,s=n===1?30:this.compact?18:22;
    m.orderProgress(order).forEach((p,i)=>{const yy=r.y+(n===1?48:35+i*(this.compact?25:29));this.item(p.requirement,{x:r.x+6,y:yy,w:s,h:s});text(c,`${Math.min(p.have,p.requirement.quantity)}/${p.requirement.quantity}`,r.x+r.w-8,yy+s/2,10,p.have>=p.requirement.quantity?C.green:C.muted,'right',true);text(c,getItem(p.requirement).name,r.x+6+s/2,yy+s+2,6,C.ink,'center');});
    this.button(ready?'提交心愿':'继续合成',{x:r.x+5,y:r.y+r.h-20,w:r.w-10,h:16},{type:'submit',id:order.id},ready, C.green,8);
  }
  park(m,ui) {
    const c=this.ctx,y=this.contentY,available=this.navY-y,hero=this.compact?70:86,tileH=Math.min(119,(available-hero-62)/3);
    if(this.images.park){c.save();c.globalAlpha=.45;c.drawImage(this.images.park,0,y,390,available);c.restore();}
    if(m.world.decoration!=='spring'){c.fillStyle=m.world.decoration==='sunset'?'#E6B99535':'#BAB6D74A';c.fillRect(0,y,390,available);}
    box(c,{x:20,y:y+3,w:350,h:hero},'#FFFDF2DB',15);text(c,'把小院，慢慢变成一个家',34,y+25,16,C.ink,'left',true);text(c,`已修复 ${m.buildCount()}/24 · ${Object.keys(m.world.residents).length}/8 位居民`,34,y+48,10,C.muted);
    AREAS.forEach((area,i)=>{const x=20+i%2*180,yy=y+hero+13+Math.floor(i/2)*(tileH+8),r={x,y:yy,w:170,h:tileH},stage=m.world.areas[i],locked=!m.areaUnlocked(i);
      box(c,r,locked?'#EEE9DFE8':'#FFFDF4EE',14,C.line);c.save();c.globalAlpha=locked?.4:1;areaArt(c,area.shape,x+85,yy+tileH*.37,55,stage,m.world.decoration==='starlight');c.restore();
      text(c,area.name,x+85,yy+tileH-32,12,C.ink,'center',true);text(c,locked?`先修复${AREAS[i-1].name} 2 次`:`${stage}/4 · ${stage===4?'已经很温暖':area.lines[stage]}`,x+85,yy+tileH-14,8,C.muted,'center',false,157);
      RESIDENTS.filter(def=>def.area===i&&m.world.residents[def.level]).forEach((def,j)=>this.item({chainId:'friends',level:def.level},{x:x+125-j*30,y:yy+8,w:31,h:31}));
      this.hit(r,{type:'area',id:i});});
    const by=y+hero+13+3*(tileH+8)+1;
    this.button('看望居民',{x:20,y:by,w:170,h:30},{type:'open',panel:'residents'},true,C.green);
    this.button('园区换装',{x:200,y:by,w:170,h:30},{type:'open',panel:'decorations'},true,'#A4947C');
  }
  story(m,ui) {
    const c=this.ctx,y=this.contentY,step=m.world.story.step,chapter=CHAPTERS[Math.min(5,Math.floor(step/4))],task=m.storyTask(),p=m.storyProgress();
    const speakerLevel=getChain('friends').levels.findIndex(def=>def.name===chapter.speaker)+1;
    box(c,{x:20,y:y+3,w:350,h:138},'#F3E6D6',18);this.item({chainId:'friends',level:speakerLevel},{x:279,y:y+11,w:75,h:75});
    text(c,step===24?'故事已完结':`第 ${Math.floor(step/4)+1} 章 / 6`,36,y+27,9,C.muted);text(c,chapter.title,36,y+51,17,C.ink,'left',true,235);wrap(c,chapter.intro,36,y+98,310,10,C.ink,17);
    const yy=y+158,h=Math.min(232,this.navY-yy-65);box(c,{x:20,y:yy,w:350,h},C.white,17,C.line);
    if(task){text(c,`这一次，我们一起…  ${step%4+1}/4`,36,yy+23,10,C.muted);text(c,task.title,36,yy+48,16,C.ink,'left',true);const used=wrap(c,task.text,36,yy+74,312,11,C.muted,19);
      if(task.items){task.items.forEach((item,i)=>{this.item(item,{x:36+i*155,y:yy+82+used,w:34,h:34});text(c,`${getItem(item).name} ${Math.min(m.count(item),item.quantity)}/${item.quantity}`,74+i*155,yy+100+used,9,C.ink,'left',false,115);});}
      progress(c,36,yy+h-56,318,p.have/p.need);text(c,`${p.have}/${p.need}`,350,yy+h-68,9,C.muted,'right');
      this.button(p.ready?'写下这段回忆':'去完成这个心愿',{x:36,y:yy+h-40,w:318,h:27},p.ready?{type:'claim-story',id:step}:{type:'story-route'},true,p.ready?C.green:'#A6977F');
    }else{icon(c,'heart',195,yy+43,30,'#D6AB97');text(c,'欢迎回家，亲爱的园长',195,yy+84,17,C.ink,'center',true);wrap(c,'大门已经重新打开。还有来信等你读，还有朋友等你陪，还有庆典等着大家一起举办。',36,yy+118,312,12,C.muted,22);}
    this.button(`回看日记 · ${Math.min(6,Math.floor(step/4))} 段回忆`,{x:20,y:yy+h+13,w:350,h:32},{type:'open',panel:'journal'},true,'#B59E80');
  }
  festival(m,ui) {
    const c=this.ctx,y=this.contentY,def=m.festivalDef(),event=m.world.festival,targets=m.festivalTargets();
    box(c,{x:20,y:y+3,w:350,h:169},def.color,18);icon(c,'gift',336,y+31,32,'#B19F7C');text(c,`第 ${event.cycle+1} 场动物园庆典`,36,y+22,9,C.muted);text(c,def.name,36,y+47,21,C.ink,'left',true);text(c,def.tag,36,y+73,10,C.ink);text(c,def.intro,36,y+92,9,C.muted,'left',false,319);progress(c,36,y+108,318,event.points/targets[2]);
    targets.forEach((target,i)=>{const done=event.claimed.includes(i);this.button(done?'已领取':`${target} 点 · 领取`,{x:32+i*109,y:y+125,w:101,h:29},{type:'festival-claim',id:i},!done&&event.points>=target,C.green,9);});
    text(c,`今天的小约定 · ${m.world.daily.date}`,22,y+198,12,C.ink,'left',true);
    DAILY.forEach((quest,i)=>{const yy=y+216+i*44,p=m.dailyProgress(i),done=m.world.daily.claimed.includes(i);box(c,{x:20,y:yy,w:350,h:38},C.white,10,C.line);text(c,quest.name,33,yy+13,11,C.ink,'left',true);text(c,`${p.have}/${p.need} · ${60+m.world.areas[2]*10} 金币 + 2 星星`,33,yy+27,8,C.muted);this.button(done?'已领取':'领取',{x:294,y:yy+6,w:64,h:26},{type:'daily-claim',id:i},!done&&p.ready,C.green,10);});
    const yy=y+362;box(c,{x:20,y:yy,w:350,h:70},'#E6E1ED',14);icon(c,'star',47,yy+27,24,'#B1A0BF');text(c,'解救萌友',71,yy+23,14,C.ink,'left',true);text(c,`20 个空间谜题 · 已通关 ${m.world.puzzle.cleared.length}/20`,71,yy+46,10,C.muted);this.hit({x:20,y:yy,w:350,h:70},{type:'open',panel:'puzzle-list'});
    text(c,'庆典可以慢慢完成，领取全部奖励后开启下一场',195,yy+90,9,C.muted,'center');
  }
  panel(m,ui) {
    const c=this.ctx,p=this.panelRect;c.fillStyle='#453B3375';c.fillRect(0,0,390,this.height);box(c,p,'#FBF7EF',22);
    const titles={settings:'小院设置',gallery:'萌友与心意图鉴',storage:'我的储物架',producers:'小窝与生产器',residents:'动物园的朋友',resident:'一份陪伴',area:'修复园区',journal:'园长的日记',reading:'一封小小的信',decorations:'今天的动物园', 'puzzle-list':'解救萌友',puzzle:'解救萌友'};
    text(c,titles[ui.panel]||'小院',p.x+20,p.y+29,19,C.ink,'left',true);box(c,{x:p.x+p.w-45,y:p.y+14,w:29,h:29},'#EEE7DA',10);icon(c,'close',p.x+p.w-30,p.y+29,15);this.hit({x:p.x+p.w-48,y:p.y+10,w:36,h:38},{type:'close'});
    if(ui.panel==='settings')this.settings(m,p);if(ui.panel==='gallery')this.gallery(m,ui,p);if(ui.panel==='storage')this.storage(m,p);if(ui.panel==='producers')this.producers(m,ui,p);
    if(ui.panel==='area')this.area(m,ui,p);if(ui.panel==='residents')this.residents(m,ui,p);if(ui.panel==='resident')this.resident(m,ui,p);
    if(ui.panel==='reading')this.reading(m,ui,p);if(ui.panel==='journal')this.journal(m,ui,p);if(ui.panel==='decorations')this.decorations(m,p);
    if(ui.panel==='puzzle-list')this.puzzleList(m,p);if(ui.panel==='puzzle')this.puzzle(m,ui,p);
  }
  settings(m,p) {
    const c=this.ctx;wrap(c,'这里没有广告，也没有充值。累了可以休息，回来的时候，大家仍在等你。',p.x+20,p.y+64,p.w-40,11,C.muted,19);
    const labels=[['sound-toggle',`音效：${m.soundEnabled?'开启':'关闭'} · 点击切换`],['refill','休息一下 · 免费补满体力'],['open','玩法小指南'],['redeem-code','兑换码 · 输入领取'],['reset','重新开始这座动物园']];
    labels.forEach(([type,label],i)=>this.button(label,{x:p.x+20,y:p.y+112+i*43,w:p.w-40,h:34},type==='open'?{type,panel:'reading',reading:'help'}:{type},true,i===4?'#B79A86':C.green));
    text(c,'体力每 90 秒恢复 1 点，最多 100 点',195,p.y+350,10,C.muted,'center');text(c,'居民会照看小院，离线金币最多累积 8 小时',195,p.y+371,9,C.muted,'center');
    text(c,'进度保存在当前设备 · 重新开园 2.0',195,p.y+p.h-22,9,C.muted,'center');
  }
  gallery(m,ui,p) {
    const c=this.ctx,all=CONFIG.chains.flatMap(chain=>chain.levels.map((_,i)=>({chainId:chain.id,level:i+1}))),pages=Math.ceil(all.length/5),page=Math.min(ui.page||0,pages-1),rowH=Math.min(75,(p.h-115)/5);
    text(c,'相同物品合为下一级 · 三条合成链',p.x+20,p.y+63,10,C.muted);
    all.slice(page*5,page*5+5).forEach((item,i)=>{const def=getItem(item),yy=p.y+84+i*rowH,unlocked=(m.discovered[item.chainId]||0)>=item.level;box(c,{x:p.x+15,y:yy,w:p.w-30,h:rowH-6},C.white,11,C.line);this.item(item,{x:p.x+22,y:yy+4,w:rowH-15,h:rowH-15},unlocked?1:.35);text(c,`${def.name}  Lv.${item.level}`,p.x+rowH+15,yy+18,12,C.ink,'left',true);text(c,unlocked?def.note:'合成后点亮这个小小收藏',p.x+rowH+15,yy+39,9,C.muted,'left',false,p.w-rowH-35);});
    this.pages(p,page,pages,'page');
  }
  pages(p,page,pages,type) {
    this.button('‹',{x:p.x+20,y:p.y+p.h-36,w:42,h:24},{type,delta:-1},true,'#A6977F');text(this.ctx,`${page+1} / ${pages}`,195,p.y+p.h-24,10,C.muted,'center');this.button('›',{x:p.x+p.w-62,y:p.y+p.h-36,w:42,h:24},{type,delta:1},true,'#A6977F');
  }
  storage(m,p) {
    const c=this.ctx,cols=3,s=91,gap=12; text(c,`${m.world.storage.length}/${m.world.storageSize} · 点击物品取回棋盘`,p.x+20,p.y+64,10,C.muted);
    for(let i=0;i<m.world.storageSize;i++){const x=p.x+28+i%cols*(s+gap),y=p.y+86+Math.floor(i/cols)*76;box(c,{x,y,w:s,h:68},C.white,12,C.line);const item=m.world.storage[i];if(item){this.item(item,{x:x+21,y:y+4,w:49,h:49});text(c,getItem(item).name,x+s/2,y+58,8,C.muted,'center');this.hit({x,y,w:s,h:68},{type:'withdraw',id:i});}else circle(c,x+s/2,y+34,2,'#D6C8B6');}
    this.button(`扩容 +3 格 · ${m.world.storageSize*20} 金币 / 2 星`,{x:p.x+20,y:p.y+p.h-48,w:p.w-40,h:30},{type:'expand-storage'},m.world.storageSize<(m.world.areas[2]?12:9),C.green,10);
  }
  producers(m,ui,p) {
    const c=this.ctx;CONFIG.producers.forEach((producer,i)=>{const y=p.y+66+i*115,unlocked=m.isProducerUnlocked(producer),lv=m.world.producerLevels[producer.id]||0,cost=m.producerCost(producer.id);box(c,{x:p.x+15,y,w:p.w-30,h:105},C.white,13,C.line);this.item(producer.outputs[0],{x:p.x+24,y:y+17,w:56,h:56},unlocked?1:.35);text(c,`${producer.name} · Lv.${lv+1}`,p.x+92,y+20,12,C.ink,'left',true);text(c,unlocked?'每次 1 体力 · 升级提高高级产出':`修复迎风小院 ${producer.unlock} 次解锁`,p.x+92,y+40,9,C.muted);
      this.button(ui.producer===producer.id?'使用中':'使用',{x:p.x+92,y:y+60,w:78,h:27},{type:'select-producer',id:producer.id},unlocked,C.green,10);
      this.button(cost.coins?`升级 ${cost.coins}币/${cost.stars}星`:'已满级',{x:p.x+182,y:y+60,w:137,h:27},{type:'upgrade-producer',id:producer.id},unlocked&&!!cost.coins,'#AD987C',9);
    });wrap(c,'萌友小窝初始概率：一级 65%、二级 20%、三级 10%、四级 5%。饮品与果实在修复小院后开启。',p.x+20,p.y+427,p.w-40,10,C.muted,17);
  }
  area(m,ui,p) {
    const c=this.ctx,index=ui.area||0,def=AREAS[index],stage=m.world.areas[index],cost=m.buildCost(index),unlocked=m.areaUnlocked(index);
    areaArt(c,def.shape,195,p.y+100,108,stage,m.world.decoration==='starlight');text(c,def.name,195,p.y+163,18,C.ink,'center',true);text(c,def.subtitle,195,p.y+189,10,C.muted,'center');
    wrap(c,def.perk,p.x+22,p.y+217,p.w-44,11,C.green,19);text(c,`${stage}/4 · ${stage===4?'这里已经重新开放':def.lines[stage]}`,p.x+22,p.y+260,12,C.ink,'left',true);
    if(!unlocked){wrap(c,`先把${AREAS[index-1].name}修复到 2/4，这条路就会打开。`,p.x+22,p.y+300,p.w-44,12,C.muted,22);return;}
    if(cost){text(c,`需要 ${cost.coins} 金币 + ${cost.stars} 星星`,p.x+22,p.y+294,12,C.gold,'left',true);cost.items.forEach((item,i)=>{this.item(item,{x:p.x+22+i*156,y:p.y+315,w:44,h:44});text(c,getItem(item).name,p.x+73+i*156,p.y+328,10,C.ink);text(c,`${Math.min(m.count(item),item.quantity)}/${item.quantity}`,p.x+73+i*156,p.y+347,10,m.count(item)>=item.quantity?C.green:C.muted);});
      this.button('一起修复这里',{x:p.x+22,y:p.y+386,w:p.w-44,h:34},{type:'build',id:index,stage},m.coins>=cost.coins&&m.world.stars>=cost.stars&&m.hasItems(cost.items),C.green);
      text(c,'星星来自心愿、故事、庆典与解救',195,p.y+443,10,C.muted,'center');
    }else{icon(c,'heart',195,p.y+323,32,'#DAB7A0');text(c,'谢谢你，把这里变成了一个家。',195,p.y+373,13,C.ink,'center');}
  }
  residents(m,ui,p) {
    const c=this.ctx,page=Math.min(1,ui.page||0),h=Math.min(99,(p.h-115)/4);text(c,'邀请会消耗棋盘上的一个对应动物',p.x+20,p.y+63,10,C.muted);
    RESIDENTS.slice(page*4,page*4+4).forEach((def,i)=>{const yy=p.y+83+i*h,owned=!!m.world.residents[def.level],unlocked=!!m.world.areas[def.area],r={x:p.x+15,y:yy,w:p.w-30,h:h-7};box(c,r,C.white,12,C.line);this.item({chainId:'friends',level:def.level},{x:p.x+21,y:yy+7,w:64,h:64},owned||unlocked?1:.4);text(c,getItem({chainId:'friends',level:def.level}).name,p.x+96,yy+21,13,C.ink,'left',true);text(c,owned?`亲密 Lv.${m.friendship(def.level)} · ${def.role}`:`小屋位于${AREAS[def.area].name}`,p.x+96,yy+43,9,C.muted,'left',false,220);text(c,owned?'看望与来信 ›':unlocked?'邀请入住 ›':'先修复小屋 ›',p.x+96,yy+65,10,C.green);this.hit(r,{type:'resident',id:def.level});});this.pages(p,page,2,'page');
  }
  resident(m,ui,p) {
    const c=this.ctx,level=ui.resident||1,def=m.residentDef(level),owned=!!m.world.residents[level],friend=m.friendship(level),favorite=getItem({chainId:'snacks',level:def.favorite});
    this.item({chainId:'friends',level},{x:155,y:p.y+55,w:80,h:80});text(c,getItem({chainId:'friends',level}).name,195,p.y+153,19,C.ink,'center',true);text(c,def.role,195,p.y+175,10,C.muted,'center');
    if(!owned){wrap(c,`在${AREAS[def.area].name}准备一间小屋，再从棋盘邀请一位${getItem({chainId:'friends',level}).name}。它会一直住在这里。`,p.x+22,p.y+245,p.w-44,12,C.muted,22);this.button('邀请它留下来',{x:p.x+22,y:p.y+340,w:p.w-44,h:35},{type:'adopt',id:level},!!m.world.areas[def.area]&&m.count({chainId:'friends',level})>0,C.green);return;}
    const count=getChain('snacks').levels.length,selectedLevel=ui.giftLevel||def.favorite,cols=4,w=(p.w-44-24)/cols,rowH=Math.min(66,132/Math.ceil(count/cols)),size=Math.min(45,rowH-20);
    text(c,`亲密 Lv.${friend} / 10 · 最爱${favorite.name}`,195,p.y+200,11,C.green,'center');text(c,`选一杯：${getItem({chainId:'snacks',level:selectedLevel}).name}`,195,p.y+226,10,C.muted,'center');
    for(let lv=1;lv<=count;lv++){const x=p.x+22+(lv-1)%cols*(w+8),yy=p.y+239+Math.floor((lv-1)/cols)*rowH,item={chainId:'snacks',level:lv},selected=selectedLevel===lv;box(c,{x,y:yy,w,h:rowH-7},selected?'#E3EDD8':C.white,10,selected?'#A4B89A':C.line);this.item(item,{x:x+(w-size)/2,y:yy+2,w:size,h:size},m.count(item)>0?1:.35);text(c,`×${m.count(item)}`,x+w/2,yy+rowH-15,9,C.muted,'center');this.hit({x,y:yy,w,h:rowH-7},{type:'gift-level',id:lv});}
    this.button('送给它',{x:p.x+22,y:p.y+382,w:p.w-44,h:30},{type:'gift',id:level},friend<10&&m.count({chainId:'snacks',level:selectedLevel})>0,C.green);
    [3,6,10].forEach((need,i)=>this.button(`${need} 级来信`,{x:p.x+22+i*106,y:p.y+428,w:99,h:28},{type:'letter',id:level,letter:i},friend>=need,'#AE987C',10));
    text(c,'最爱的饮料带来双倍心意 · 来信在 3/6/10 级解锁',195,p.y+471,9,C.muted,'center');
  }
  reading(m,ui,p) {
    const c=this.ctx;const body=ui.readingBody||'',speaker=ui.readingTitle||'来自小院的一封信';icon(c,'heart',195,p.y+79,30,'#D6AD99');text(c,speaker,195,p.y+112,15,C.ink,'center',true,p.w-42);
    const height=wrap(c,body,p.x+25,p.y+149,p.w-50,12,C.ink,20);
    if(ui.storyChoice!==undefined){const chapter=CHAPTERS[Math.floor(ui.storyChoice/4)];chapter.choices.forEach((choice,i)=>this.button(choice,{x:p.x+25,y:p.y+171+height+i*43,w:p.w-50,h:33},{type:'choose-story',id:ui.storyChoice,choice:i},true,i===0?C.green:'#AF987E'));}
    else this.button('把这份心意收好',{x:p.x+25,y:Math.min(p.y+184+height,p.y+p.h-58),w:p.w-50,h:32},{type:'close'},true,C.green);
  }
  journal(m,ui,p) {
    const c=this.ctx,count=Math.min(6,Math.floor(m.world.story.step/4)+1);text(c,'已经走过的路，都值得记下来',p.x+20,p.y+65,10,C.muted);
    CHAPTERS.slice(0,count).forEach((chapter,i)=>{const y=p.y+89+i*57,done=m.world.story.step>=(i+1)*4;box(c,{x:p.x+17,y,w:p.w-34,h:48},C.white,11,C.line);text(c,`${i+1}. ${chapter.title}`,p.x+30,y+17,12,C.ink,'left',true);text(c,done?chapter.choices[m.world.story.choices[i]||0]:'故事正在发生…',p.x+30,y+35,9,C.muted);this.hit({x:p.x+17,y,w:p.w-34,h:48},{type:'read-chapter',id:i});});
  }
  decorations(m,p) {
    const c=this.ctx;['spring','sunset','starlight'].forEach((style,i)=>{const y=p.y+75+i*126,unlocked=m.world.unlockedDecorations.includes(style),labels=['春日草坪','落日野餐','星光小院'];box(c,{x:p.x+17,y,w:p.w-34,h:112},['#E2ECD4','#F0DDCC','#E1DDEB'][i],15);areaArt(c,'gate',p.x+77,y+49,68,4,i===2);text(c,labels[i],p.x+136,y+29,14,C.ink,'left',true);text(c,unlocked?'你们一起收集的纪念':'完成对应庆典解锁',p.x+136,y+54,9,C.muted);this.button(m.world.decoration===style?'正在使用':'换上它',{x:p.x+136,y:y+72,w:163,h:26},{type:'decoration',id:style},unlocked,C.green,10);});
  }
  puzzleList(m,p) {
    const c=this.ctx;wrap(c,'在图案上向上下左右滑动，每次移动一格，同级相遇会合成。每关初始均有解。挑战／重试消耗30体力，继续当前局不重复扣费。',p.x+21,p.y+64,p.w-42,11,C.muted,20);
    const unlocked=Math.min(20,m.world.puzzle.cleared.length+1),active=m.world.puzzle.active;
    for(let level=1;level<=20;level++){const x=p.x+22+(level-1)%5*64,y=p.y+143+Math.floor((level-1)/5)*72,cleared=m.world.puzzle.cleared.includes(level),resume=active?.level===level&&!active.won&&active.moves<active.limit;this.button(`${level}${cleared?' ✓':''}`,{x,y,w:55,h:55},{type:'start-puzzle',id:level},level<=unlocked,cleared?'#A6B497':C.green,13);text(c,resume?'继续':level<=unlocked?'-30 体力':'未解锁',x+27,y+46,7,level<=unlocked?'#FFFDF4':C.muted,'center');}
    this.button('休息一下 · 免费补满体力',{x:p.x+22,y:p.y+p.h-48,w:p.w-44,h:28},{type:'refill'},true,C.green,10);
    text(c,'首次解救获金币和星星 · 重玩也计入每日救援',195,p.y+p.h-9,8,C.muted,'center');
  }
  puzzle(m,ui,p) {
    const c=this.ctx,s=m.world.puzzle.active;if(!s)return;const size=Math.min(294,p.h-228),r={x:(390-size)/2,y:p.y+113,w:size,h:size};this.puzzleRect=r;
    const remaining=s.limit-s.moves,failed=!s.won&&remaining<=0;
    text(c,`第 ${s.level} 关 · 救援格合出${getItem({chainId:'friends',level:s.target}).name}`,195,p.y+64,11,C.ink,'center');text(c,`剩余 ${remaining} 步 · 在图案上滑动一格`,195,p.y+87,remaining<=3?12:10,remaining<=3?'#B96B50':C.muted,'center',remaining<=3);box(c,{x:r.x-5,y:r.y-5,w:size+10,h:size+10},'#E7DFD2',15);
    const cell=size/4;s.board.forEach((value,index)=>{const x=r.x+index%4*cell,y=r.y+Math.floor(index/4)*cell,selected=ui.drag?.kind==='puzzle'&&ui.drag.from===index;box(c,{x:x+3,y:y+3,w:cell-6,h:cell-6},value===-1?'#C5BCAF':index===s.goal?'#F6E5BA':selected?'#DCE9D3':C.white,9,index===s.goal?'#D0AB69':undefined);
      if(value===-1){circle(c,x+cell/2,y+cell/2,cell*.2,'#A99F90');return;}if(value>0)this.item({chainId:'friends',level:value},{x:x+7,y:y+7,w:cell-14,h:cell-14});else if(index===s.goal)icon(c,'star',x+cell/2,y+cell/2,23,C.gold);});
    const yy=r.y+size+22;text(c,s.won?'萌友获救，欢迎回家！':s.moves>=s.limit?'步数用完了，重新规划路线吧':'走错可重试，初始棋盘始终可解',195,yy,11,s.won?C.green:C.muted,'center',true);
    this.button(`重试 -${RESCUE_RULES.energyCost}体力`,{x:p.x+22,y:yy+22,w:147,h:30},{type:'retry-puzzle',id:s.level},true,'#AC987C');
    this.button(s.won&&s.level<20?'下一关 -30体力':'选择关卡',{x:p.x+184,y:yy+22,w:147,h:30},s.won&&s.level<20?{type:'start-puzzle',id:s.level+1}:{type:'open',panel:'puzzle-list'},true,C.green,10);
    if(failed){
      // Persistent end-state overlay; no board or obscured button can receive input.
      c.fillStyle='#51443C99';c.fillRect(p.x+1,p.y+52,p.w-2,p.h-54);
      this.buttons=this.buttons.filter(button=>button.action.type==='close');this.puzzleRect=null;
      const card={x:45,y:r.y+(size-210)/2,w:300,h:210};box(c,card,'#FFF9F0',20);
      circle(c,195,card.y+27,16,'#F5DACE');text(c,'!',195,card.y+27,22,'#B96B50','center',true);
      text(c,'步数用完了',195,card.y+62,22,'#AD604C','center',true);
      text(c,'换条路线再试试，萌友还在等你',195,card.y+89,11,C.ink,'center');
      text(c,'重试消耗30体力 · 可在关卡页免费补满',195,card.y+108,9,C.muted,'center');
      this.button('重新挑战 · -30体力',{x:card.x+20,y:card.y+128,w:260,h:34},{type:'retry-puzzle',id:s.level},true,C.green,12);
      this.button('返回关卡',{x:card.x+20,y:card.y+174,w:260,h:26},{type:'open',panel:'puzzle-list'},true,'#AC987C',10);
    }
  }
}
module.exports=ZooView;
