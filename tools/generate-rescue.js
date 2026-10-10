// Offline authoring only. The game loads fixed, verified boards without a solver.
const fs=require('node:fs');
const {randomFor,neighbors}=require('../js/merge/puzzles');
const layouts=[[5,10],[6,9],[5,6],[9,10],[1,9,10],[5,6,14],[2,5,10],[6,9,13],[1,6,9],[5,10,14],[5,6,9,10],[5,6,10,13],[2,5,9,10],[1,5,9,10]];
const key=board=>board.map(v=>String.fromCharCode(65+v)).join('');
function moves(board,target){const out=[];board.forEach((a,from)=>{if(a<1)return;for(const to of neighbors(from)){const b=board[to];if(b===0||b===a&&a<target)out.push({from,to});}});return out;}
function apply(board,{from,to}){const next=board.slice();next[to]=next[to]===next[from]?next[from]+1:next[from];next[from]=0;return next;}
function generate(level,attempt=0){
  const random=randomFor(87017+level*7919+attempt*104729),target=level<=4?5:level<=12?6:7,goal=[15,0,12,3][(level-1)%4];
  const board=Array(16).fill(0),blocked=layouts[level<=4?(level-1)%4:level<=12?4+(level-5)%6:10+(level-13)%4];blocked.forEach(i=>board[i]=-1);board[goal]=target;
  const solution=[],occupancy=level<=4?9:level<=12?10:11;
  let previous=null;
  for(let step=0;step<100;step++){
    const options=[];const count=board.filter(v=>v>0).length;
    board.forEach((a,from)=>{if(a<1)return;for(const to of neighbors(from))if(board[to]===0){
      if(!previous||previous.from!==to||previous.to!==from)options.push({from,to,split:false});
      if(a>1&&count<occupancy)options.push({from,to,split:true});
    }});
    const splits=options.filter(v=>v.split),pool=splits.length&&random()<.78?splits:options.filter(v=>!v.split);
    if(!pool.length)continue;const chosen=pool[Math.floor(random()*pool.length)],{from,to,split}=chosen;
    if(split){board[from]--;board[to]=board[from];}else{board[to]=board[from];board[from]=0;}
    solution.unshift({from:to,to:from});previous=chosen;
  }
  // Erase cycles in the reference path, never by weakening the goal or rules.
  let states=[board.slice()],path=[],seen=new Map([[key(board),0]]);
  for(const move of solution){const next=apply(states[states.length-1],move),id=key(next);
    if(seen.has(id)){const at=seen.get(id);states=states.slice(0,at+1);path=path.slice(0,at);seen=new Map(states.map((b,i)=>[key(b),i]));}
    else{path.push(move);states.push(next);seen.set(id,states.length-1);}
  }
  return {level,board,target,goal,solution:path};
}
class Heap{constructor(){this.a=[];}push(v){let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p].f<=v.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const root=this.a[0],v=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let j=i*2+1;if(j+1<this.a.length&&this.a[j+1].f<this.a[j].f)j++;if(this.a[j].f>=v.f)break;this.a[i]=this.a[j];i=j;}this.a[i]=v;}return root;}}
function improve(def){
  const distances=Array(16).fill(99),queue=[def.goal];distances[def.goal]=0;
  for(const from of queue)for(const to of neighbors(from))if(def.board[to]!==-1&&distances[to]===99){distances[to]=distances[from]+1;queue.push(to);}
  const score=board=>{let n=0,d=0;board.forEach((v,i)=>{if(v>0){n++;d+=distances[i]*(v/def.target);}});return (n-1)*3+d*.8;};
  const heap=new Heap(),visited=new Map();heap.push({board:def.board,g:0,f:score(def.board),parent:null});let explored=0;
  while(heap.a.length&&explored++<100000){
    const node=heap.pop(),id=key(node.board);if((visited.get(id)??Infinity)<node.g)continue;
    if(node.board[def.goal]===def.target&&node.board.filter(v=>v>0).length===1){let path=[];for(let n=node;n.parent;n=n.parent)path.unshift(n.move);if(path.length<def.solution.length)def.solution=path;break;}
    for(const move of moves(node.board,def.target)){
      const board=apply(node.board,move),k=key(board),g=node.g+1;
      if(g>=def.solution.length||(visited.get(k)??Infinity)<=g)continue;
      visited.set(k,g);heap.push({board,g,f:g+score(board),parent:node,move});
    }
  }
  def.limit=def.solution.length+(def.level<=4?3:def.level<=12?2:1);
  return {explored,found:explored<100001&&heap.a.length>0};
}
const levels=[];
for(let level=1;level<=20;level++){
  let best=null;const desired=level<=4?20:level<=12?23:26;
  for(let attempt=0;attempt<24;attempt++){
    const candidate=generate(level,attempt),search=improve(candidate);
    if(search.found&&candidate.solution.length<=38&&candidate.board.filter(v=>v>0).length===(level<=4?9:level<=12?10:11)&&(!best||candidate.solution.length>best.solution.length))best=candidate;
    if(best&&best.solution.length>=desired)break;
  }
  if(!best)throw Error('No authored solution for level '+level);levels.push(best);
  console.log(`Rescue ${level}: ${best.board.filter(v=>v>0).length} pieces, target ${best.target}, solution ${best.solution.length}, budget ${best.limit}`);
}
fs.writeFileSync(require('node:path').resolve(__dirname,'../js/merge/rescue-levels.js'),'// Authored offline; reference solutions are used by regression tests.\nmodule.exports = '+JSON.stringify(levels)+';\n');
