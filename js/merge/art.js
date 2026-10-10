const {getItem} = require('./config');
const C = {ink: '#51443C', muted: '#9D8C7C', green: '#718873', mint: '#E4EEDF', gold: '#CCA063', line: '#E9DFD0', white: '#FFFDF8', pink: '#E9C9BE'};
function round(ctx, x, y, w, h, r = 12) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function box(ctx, r, fill, radius = 12, stroke) { round(ctx, r.x, r.y, r.w, r.h, radius); ctx.fillStyle = fill; ctx.fill(); if (stroke) {ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();} }
function text(ctx, value, x, y, size = 12, color = C.ink, align = 'left', bold = false, maxWidth) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC","Microsoft YaHei",sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  let label = String(value);
  if (maxWidth && ctx.measureText(label).width > maxWidth) { while (label.length && ctx.measureText(label + '…').width > maxWidth) label = label.slice(0, -1); label += '…'; }
  ctx.fillText(label, x, y);
}
function wrap(ctx, value, x, y, width, size = 12, color = C.muted, lineHeight = 20) {
  let row = '', offset = 0;
  ctx.font = `${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  for (const letter of String(value)) {
    if (letter === '\n' || ctx.measureText(row + letter).width > width) {
      let next = letter === '\n' ? '' : letter;
      // Keep Chinese closing punctuation with its preceding character.
      if (letter !== '\n' && row && (/[，。！？；：、”’）】》]/.test(letter) || /[“‘（【《]$/.test(row))) {
        next = row.slice(-1) + letter; row = row.slice(0, -1);
      }
      text(ctx, row, x, y + offset, size, color); row = next; offset += lineHeight;
    }
    else row += letter;
  }
  if (row) text(ctx, row, x, y + offset, size, color); return offset + lineHeight;
}
function circle(ctx, x, y, radius, color) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function ellipse(ctx, x, y, rx, ry, color, rotation = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
function line(ctx, points, color, width = 2) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.beginPath(); points.forEach(([x,y], i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.stroke(); }
function icon(ctx, kind, x, y, size = 20, color = C.green) {
  ctx.save(); ctx.translate(x, y); ctx.scale(size / 20, size / 20);
  if (kind === 'coin') { circle(ctx, 0, 0, 8, '#F5E7C9'); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); text(ctx, 'C', 0, 0, 9, color, 'center', true); }
  else if (kind === 'star') { ctx.beginPath(); for (let i=0;i<10;i++) {const a=-Math.PI/2+i*Math.PI/5,r=i%2?4:9; i?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(0,-9);}ctx.closePath();ctx.fillStyle=color;ctx.fill(); }
  else if (kind === 'heart') {ctx.beginPath();ctx.moveTo(0,7);ctx.bezierCurveTo(-14,-2,-6,-13,0,-5);ctx.bezierCurveTo(6,-13,14,-2,0,7);ctx.fillStyle=color;ctx.fill();}
  else if (kind === 'bolt') {ctx.beginPath();ctx.moveTo(2,-9);ctx.lineTo(-6,2);ctx.lineTo(0,2);ctx.lineTo(-2,9);ctx.lineTo(7,-2);ctx.lineTo(1,-2);ctx.closePath();ctx.fillStyle=color;ctx.fill();}
  else if (kind === 'book') {box(ctx,{x:-7,y:-8,w:14,h:16},'#EFE7D8',3,color);line(ctx,[[-2,-8],[-2,8]],color,1.5);}
  else if (kind === 'settings') {circle(ctx,0,0,7,color);circle(ctx,0,0,3,C.white);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(ctx,[[Math.cos(a)*6,Math.sin(a)*6],[Math.cos(a)*10,Math.sin(a)*10]],color,2);}}
  else if (kind === 'refresh') {ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,6,0.5,Math.PI*1.9);ctx.stroke();line(ctx,[[4,-6],[7,-1],[2,-2]],color,1.5);}
  else if (kind === 'close') {line(ctx,[[-5,-5],[5,5]],color);line(ctx,[[5,-5],[-5,5]],color);}
  else if (kind === 'leaf') {ellipse(ctx,0,0,5,9,color,0.5);line(ctx,[[-3,6],[3,-6]],'#EAF2E2',1);}
  else if (kind === 'home') {ctx.beginPath();ctx.moveTo(-9,-1);ctx.lineTo(0,-9);ctx.lineTo(9,-1);ctx.fillStyle=color;ctx.fill();box(ctx,{x:-6,y:-1,w:12,h:10},color,2);box(ctx,{x:-2,y:3,w:4,h:6},C.white,1);}
  else if (kind === 'gift') {box(ctx,{x:-7,y:-4,w:14,h:13},color,2);line(ctx,[[0,-4],[0,9]],C.white,2);ellipse(ctx,-3,-6,4,2,color,-0.5);ellipse(ctx,3,-6,4,2,color,0.5);}
  else if (kind === 'split') {circle(ctx,-4,5,3,color);circle(ctx,4,5,3,color);line(ctx,[[-5,-8],[5,5]],color,2);line(ctx,[[5,-8],[-5,5]],color,2);}
  else {text(ctx,kind,0,0,12,color,'center',true);} ctx.restore();
}
function sprite(ctx, images, item, rect, opacity = 1) {
  const def=getItem(item);if(!def)return;ctx.save();ctx.globalAlpha*=opacity;
  if(images[def.id])ctx.drawImage(images[def.id],rect.x,rect.y,rect.w,rect.h);
  ctx.restore();
}
function progress(ctx, x, y, width, ratio, color=C.green) {box(ctx,{x,y,w:width,h:5},'#EAE3D8',3);if(ratio>0)box(ctx,{x,y,w:Math.max(5,width*Math.min(1,ratio)),h:5},color,3);}
function areaArt(ctx, shape, x, y, size, stage=1, night=false) {
  ctx.save();ctx.translate(x,y);ctx.scale(size/100,size/100);
  ellipse(ctx,0,22,46,16,stage===0?'#D4CBBB':night?'#BDC3D6':'#BFD2A7');
  if(stage===0)ctx.globalAlpha*=.55;
  if(shape==='pond'){ellipse(ctx,0,14,36,19,stage?'#98C7CB':'#B2B3A2');ellipse(ctx,0,12,28,13,stage?'#BDDFD9':'#C4C3B3');if(stage>=2){line(ctx,[[-30,9],[28,9]],'#C3AC87',7);for(let i=-24;i<25;i+=8)line(ctx,[[i,5],[i,13]],'#F0DEC3',2);}if(stage>=3){ellipse(ctx,-16,21,8,3,'#82B58E');circle(ctx,-16,18,3,'#EABDB5');}if(stage===4)[-22,3,25].forEach(a=>circle(ctx,a,27,3,'#FFE6A1'));}
  else if(shape==='forest'){for(const [a,b]of[[-22,0],[16,-8],[0,10]]){box(ctx,{x:a-4,y:b,w:8,h:30},'#A38C6E',2);circle(ctx,a,b-5,20,'#91B185');circle(ctx,a-9,b+1,14,'#AAC395');}}
  else if(shape==='meadow'){if(stage>=2){line(ctx,[[-29,10],[-29,27]],'#AB9472',3);line(ctx,[[-12,10],[-12,27]],'#AB9472',3);line(ctx,[[-32,12],[-9,12]],'#EBCAA3',6);}if(stage>=3){line(ctx,[[2,-8],[2,26]],'#AB9472',4);line(ctx,[[36,-8],[36,26]],'#AB9472',4);line(ctx,[[0,-8],[38,-8]],'#AB9472',4);line(ctx,[[10,-8],[10,16],[27,16],[27,-8]],'#C3AF91',2);line(ctx,[[7,17],[30,17]],'#EBCAA3',5);}if(stage===4){box(ctx,{x:-18,y:26,w:34,h:12},'#E7BEAA',3);icon(ctx,'heart',0,32,9,'#FFF1D9');}if(stage<2){for(let a=-30;a<36;a+=13)line(ctx,[[a,28],[a-3,16],[a,23],[a+4,13]],'#A4B28C',2);}}
  else if(shape==='sky'){box(ctx,{x:-29,y:17,w:58,h:13},'#B9A9C5',3);box(ctx,{x:-23,y:9,w:46,h:10},'#C8BBD0',3);if(stage>=2){line(ctx,[[-10,9],[6,-15]],'#A798B9',5);line(ctx,[[6,-15],[28,-5]],'#A798B9',8);}if(stage>=3){icon(ctx,'star',-25,-13,16,'#F3DB95');icon(ctx,'star',27,-22,11,'#F3DB95');}if(stage===4)icon(ctx,'heart',0,25,11,'#FCEDD6');}
  else if(shape==='bakery'){box(ctx,{x:-30,y:-4,w:60,h:38},'#E9CEAE',7);ctx.beginPath();ctx.moveTo(-36,-3);ctx.lineTo(0,-31);ctx.lineTo(36,-3);ctx.fillStyle='#C7917D';ctx.fill();box(ctx,{x:-23,y:3,w:46,h:16},stage?'#ECC58E':'#B9B09F',3);if(stage>=3)icon(ctx,'heart',0,9,14,'#FCEDD6');if(stage>=2){line(ctx,[[-34,28],[34,28]],'#A58A68',5);line(ctx,[[-27,28],[-27,37]],'#A58A68',3);line(ctx,[[27,28],[27,37]],'#A58A68',3);}if(stage===4)[-16,0,16].forEach(a=>ellipse(ctx,a,25,6,2,'#FFF0D9'));}
  else {line(ctx,[[-30,-24],[-30,30]],'#B69974',8);line(ctx,[[30,-24],[30,30]],'#B69974',8);box(ctx,{x:-40,y:-30,w:80,h:17},stage?'#CEB08A':'#B9AC96',6);icon(ctx,'heart',0,-22,15,'#FAE2BB');line(ctx,[[-29,-9],[-29,26],[-(stage===4?38:2),26],[-(stage===4?38:2),-9]],'#BC9C76',3);line(ctx,[[29,-9],[29,26],[stage===4?38:2,26],[stage===4?38:2,-9]],'#BC9C76',3);}
  if(shape==='forest'&&stage>=2){line(ctx,[[26,-24],[26,-7]],'#B49B7B',1);icon(ctx,'star',26,-6,11,'#F1D89E');}
  if(shape==='forest'&&stage>=3){box(ctx,{x:-15,y:-4,w:28,h:21},'#CFAB84',4);box(ctx,{x:-8,y:1,w:8,h:8},'#F7E2AA',2);}
  for(let i=0;i<stage;i++){const a=-39+i*25;line(ctx,[[a,31],[a,22]],'#849F74',2);circle(ctx,a,20,4,stage>=3?'#E9B9AC':'#EDD18B');}
  if(stage>=3){line(ctx,[[-35,-34],[0,-40],[36,-34]],'#B6A687',1);[-24,0,24].forEach(a=>circle(ctx,a,-36,3,'#F4DDA0'));}
  ctx.restore();
}
module.exports={C,box,text,wrap,circle,ellipse,line,icon,sprite,progress,areaArt};
