const { CONFIG, getItem, getChain } = require('./config');

const C = { ink: '#534339', muted: '#A28E7D', cream: '#FBF7EF', white: '#FFFDFA', line: '#EEE3D4', green: '#718775', mint: '#E7EFE5', gold: '#D4A15A', peach: '#EBC5B3' };
function rounded(ctx, x, y, w, h, r = 14) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function box(ctx, rect, color, radius = 14, stroke) {
  rounded(ctx, rect.x, rect.y, rect.w, rect.h, radius); ctx.fillStyle = color; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function text(ctx, value, x, y, size = 14, color = C.ink, align = 'left', bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(String(value), x, y);
}
const contains = (rect, x, y) => rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

class GameView {
  constructor(canvas, platform, windowInfo, menu) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.images = {};
    this.failedImages = [];
    this.layout(windowInfo, menu);
    CONFIG.chains.forEach(chain => chain.levels.forEach(level => {
      const image = platform.createImage();
      image.onload = () => { this.images[level.id] = image; if (this.onInvalidate) this.onInvalidate(); };
      image.onerror = () => { this.failedImages.push(level.image); if (this.onInvalidate) this.onInvalidate(); };
      image.src = level.image;
    }));
  }

  layout(info, menu) {
    const width = info.windowWidth || info.screenWidth || 390;
    const height = info.windowHeight || info.screenHeight || 844;
    this.scale = width / 390;
    this.width = 390;
    this.height = height / this.scale;
    this.pixelRatio = Math.min(info.pixelRatio || 1, 3);
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    const safe = info.safeArea || { top: 0, bottom: height };
    const bottom = Math.max(0, height - (safe.bottom || height)) / this.scale;
    this.safeBottom = bottom;
    const top = Math.max((safe.top || 0) / this.scale + 12, menu && menu.bottom ? menu.bottom / this.scale + 10 : 24);
    this.top = top;
    this.compact = this.height < 780;
    this.orderY = top + (this.compact ? 106 : 115);
    this.orderH = this.compact ? 126 : 138;
    this.gridY = this.orderY + this.orderH + 37;
    this.cell = Math.min(58, 350 / CONFIG.columns, (this.height - bottom - this.gridY - 90) / CONFIG.rows);
    this.cell = Math.max(20, this.cell);
    this.gridW = CONFIG.columns * this.cell;
    this.gridH = CONFIG.rows * this.cell;
    this.gridX = (390 - this.gridW) / 2;
    this.footerY = this.gridY + this.gridH + 18;
    const cardCount = CONFIG.producers.length + CONFIG.orderSlots;
    const cardGap = 6, cardWidth = (350 - cardGap * (cardCount - 1)) / cardCount;
    this.producerRects = CONFIG.producers.map((producer, index) => {
      return { x: 20 + index * (cardWidth + cardGap), y: this.orderY, w: cardWidth, h: this.orderH, producerId: producer.id };
    });
    this.galleryButton = { x: 282, y: top + 42, w: 42, h: 34 };
    this.settingsButton = { x: 330, y: top + 42, w: 40, h: 34 };
    this.discardButton = { x: 296, y: this.gridY - 34, w: 74, h: 26 };
    this.orderRects = Array.from({ length: CONFIG.orderSlots }, (_, index) => ({ x: 20 + (index + CONFIG.producers.length) * (cardWidth + cardGap), y: this.orderY, w: cardWidth, h: this.orderH }));
    this.refreshRects = this.orderRects.map(r => ({ x: r.x + r.w - 21, y: r.y + 3, w: 18, h: 19 }));
    this.panelRect = { x: 22, y: Math.max(top, (this.height - 492) / 2), w: 346, h: Math.min(492, this.height - top - bottom - 20) };
    this.panelClose = { x: this.panelRect.x + this.panelRect.w - 47, y: this.panelRect.y + 14, w: 32, h: 32 };
  }
  point(clientX, clientY) { return { x: clientX / this.scale, y: clientY / this.scale }; }
  cellRect(index) { return { x: this.gridX + index % CONFIG.columns * this.cell, y: this.gridY + Math.floor(index / CONFIG.columns) * this.cell, w: this.cell, h: this.cell }; }
  cellAt(x, y) {
    if (x < this.gridX || x >= this.gridX + this.gridW || y < this.gridY || y >= this.gridY + this.gridH) return -1;
    return Math.floor((y - this.gridY) / this.cell) * CONFIG.columns + Math.floor((x - this.gridX) / this.cell);
  }
  actionAt(x, y, ui) {
    if (ui.panel) {
      if (contains(this.panelClose, x, y) || !contains(this.panelRect, x, y)) return { type: 'close-panel' };
      if (ui.panel === 'settings') {
        const p = this.panelRect;
        if (contains({ x: p.x + 20, y: p.y + 145, w: p.w - 40, h: 30 }, x, y)) return { type: 'sound-toggle' };
        if (contains({ x: p.x + 20, y: p.y + 184, w: p.w - 40, h: 46 }, x, y)) return { type: 'refill' };
        if (contains({ x: p.x + 20, y: p.y + 244, w: p.w - 40, h: 46 }, x, y)) return { type: 'reset' };
      }
      return { type: 'panel' };
    }
    if (contains(this.galleryButton, x, y)) return { type: 'gallery' };
    if (contains(this.settingsButton, x, y)) return { type: 'settings' };
    if (ui.selected >= 0 && contains(this.discardButton, x, y)) return { type: 'discard' };
    const producer = this.producerRects.find(rect => contains(rect, x, y));
    if (producer) return { type: 'produce', id: producer.producerId };
    const refreshSlot = this.refreshRects.findIndex(rect => contains(rect, x, y));
    if (refreshSlot >= 0) return { type: 'refresh-order', slot: refreshSlot };
    const slot = this.orderRects.findIndex(rect => contains(rect, x, y));
    if (slot >= 0) return { type: 'submit', slot };
    return null;
  }

  icon(kind, x, y, size, color = C.green) {
    const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(size / 20, size / 20);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kind === 'coin') { ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke(); text(ctx, 'C', 0, 0, 10, color, 'center', true); }
    if (kind === 'bolt') { ctx.beginPath(); ctx.moveTo(2, -9); ctx.lineTo(-6, 2); ctx.lineTo(0, 2); ctx.lineTo(-2, 9); ctx.lineTo(7, -2); ctx.lineTo(1, -2); ctx.closePath(); ctx.fill(); }
    if (kind === 'book') { rounded(ctx, -7, -8, 14, 16, 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-2, -8); ctx.lineTo(-2, 8); ctx.stroke(); }
    if (kind === 'settings') { ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.stroke(); } }
    if (kind === 'close' || kind === 'plus') { ctx.beginPath(); if (kind === 'close') { ctx.moveTo(-5, -5); ctx.lineTo(5, 5); ctx.moveTo(5, -5); ctx.lineTo(-5, 5); } else { ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); } ctx.stroke(); }
    if (kind === 'heart') { ctx.beginPath(); ctx.moveTo(0, 7); ctx.bezierCurveTo(-16, -3, -6, -14, 0, -5); ctx.bezierCurveTo(6, -14, 16, -3, 0, 7); ctx.fill(); }
    if (kind === 'refresh') { ctx.beginPath(); ctx.arc(0, 0, 6, 0.4, Math.PI * 1.85); ctx.stroke(); ctx.beginPath(); ctx.moveTo(5, -6); ctx.lineTo(7, -1); ctx.lineTo(2, -2); ctx.stroke(); }
    ctx.restore();
  }
  sprite(item, rect, opacity = 1) {
    const ctx = this.ctx, def = getItem(item);
    if (!def) return;
    const image = this.images[def.id];
    ctx.save(); ctx.globalAlpha *= opacity;
    if (image) ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
    else text(ctx, def.name.slice(0, 2), rect.x + rect.w / 2, rect.y + rect.h / 2, Math.min(14, rect.w / 4), C.muted, 'center');
    ctx.restore();
  }
  draw(model, ui, now) {
    const ctx = this.ctx, top = this.top;
    ctx.setTransform(this.scale * this.pixelRatio, 0, 0, this.scale * this.pixelRatio, 0, 0);
    ctx.clearRect(0, 0, this.width, this.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#FFF9EF'); gradient.addColorStop(1, '#F1F3E9');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, this.width, this.height);
    ctx.save(); ctx.globalAlpha = 0.24;
    for (let x = 10; x < 390; x += 24) for (let y = 14; y < this.height; y += 24) { ctx.fillStyle = '#DCCDB9'; ctx.beginPath(); ctx.arc(x, y, 0.7, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    text(ctx, CONFIG.title, 20, top + 6, 25, C.ink, 'left', true);
    this.icon('heart', 164, top + 6, 14, '#C59782');
    text(ctx, '把小可爱，合成大快乐', 20, top + 29, 11, C.muted);
    text(ctx, '', 370, top + 18, 9, C.muted, 'right');
    box(ctx, { x: 20, y: top + 42, w: 110, h: 34 }, C.white, 17, C.line);
    this.icon('coin', 38, top + 59, 18, C.gold); text(ctx, model.coins, 55, top + 59, 15, C.ink, 'left', true);
    box(ctx, { x: 140, y: top + 42, w: 132, h: 34 }, C.white, 17, C.line);
    this.icon('bolt', 156, top + 59, 17); text(ctx, `${model.energy} / ${CONFIG.initialEnergy}`, 171, top + 59, 12, C.ink, 'left', true);
    box(ctx, this.galleryButton, C.white, 12, C.line); this.icon('book', 303, top + 59, 18);
    box(ctx, this.settingsButton, C.white, 12, C.line); this.icon('settings', 350, top + 59, 16);
    text(ctx, '小窝 & 今日心愿', 20, top + (this.compact ? 91 : 97), 14, C.ink, 'left', true);
    text(ctx, `已完成 ${model.completed} 单`, 370, top + (this.compact ? 91 : 97), 11, C.muted, 'right');
    model.orders.forEach((order, slot) => this.drawOrder(model, order, this.orderRects[slot], slot));
    const selected = model.board[ui.selected];
    text(ctx, '爪爪小院', 20, this.gridY - 21, 14, C.ink, 'left', true);
    if (selected) {
      box(ctx, this.discardButton, '#F8E9E0', 13); text(ctx, '移出棋盘', 333, this.gridY - 21, 10, '#A1715D', 'center');
    } else text(ctx, '相同萌友拖到一起', 370, this.gridY - 21, 11, C.muted, 'right');
    box(ctx, { x: this.gridX - 8, y: this.gridY - 8, w: this.gridW + 16, h: this.gridH + 16 }, '#E9DFCF', 19);
    for (let i = 0; i < model.board.length; i++) this.drawCell(model, ui, i, now);
    this.producerRects.forEach((rect, i) => this.drawProducer(model, rect, CONFIG.producers[i], now, ui));
    this.drawProgress(model);
    this.drawEffects(ui, now);
    if (ui.drag && ui.drag.moved && model.board[ui.drag.from]) {
      const size = this.cell * 1.25, d = ui.drag;
      ctx.save(); ctx.shadowColor = '#6D5B4633'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
      box(ctx, { x: d.x - size / 2, y: d.y - size / 2 - 10, w: size, h: size }, C.white, 14); ctx.restore();
      this.sprite(model.board[d.from], { x: d.x - size / 2 + 1, y: d.y - size / 2 - 9, w: size - 2, h: size - 2 });
    }
    if (ui.panel) this.drawPanel(model, ui);
    if (ui.toast && now < ui.toast.until) {
      const w = Math.min(352, Math.max(170, ui.toast.message.length * 13 + 34));
      const y = Math.min(ui.panel ? this.panelRect.y + this.panelRect.h - 60 : this.footerY + 40, this.height - this.safeBottom - 42);
      box(ctx, { x: (390 - w) / 2, y, w, h: 34 }, '#534339EF', 17);
      text(ctx, ui.toast.message, 195, y + 17, 12, '#FFF9EF', 'center');
    }
  }
  drawOrder(model, order, r, slot) {
    const ctx = this.ctx, ready = model.orderReady(order), ratio = r.h / 138, challenge = order.kind === 'challenge';
    ctx.save(); ctx.shadowColor = '#8975590C'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    box(ctx, r, ready ? '#F5FAF1' : challenge ? '#FFF8EA' : C.white, 14, ready ? '#A6BB9E' : challenge ? '#DEC397' : C.line); ctx.restore();
    text(ctx, challenge ? '挑战单' : `心愿 ${slot + 1}`, r.x + 8, r.y + 12, 8, challenge ? '#B28A50' : C.muted, 'left', challenge);
    const refresh = this.refreshRects[slot];
    this.icon('refresh', refresh.x + refresh.w / 2, refresh.y + refresh.h / 2, 11, C.muted);
    this.icon('coin', r.x + 18, r.y + 29 * ratio, 11, C.gold);
    text(ctx, order.reward, r.x + r.w / 2 + 5, r.y + 29 * ratio, 11, C.gold, 'center', true);
    const progresses = model.orderProgress(order), imageSize = 30 * ratio;
    progresses.forEach((progress, index) => {
      const requirement = progress.requirement, y = (progresses.length === 1 ? 63 : 39 + index * 37) * ratio;
      this.sprite(requirement, { x: r.x + 7, y: r.y + y, w: imageSize, h: imageSize });
      text(ctx, `${Math.min(progress.have, requirement.quantity)}/${requirement.quantity}`, r.x + r.w - 12, r.y + y + imageSize / 2, 11, progress.have >= requirement.quantity ? C.green : C.muted, 'right', true);
      text(ctx, getItem(requirement).name, r.x + 7 + imageSize / 2, r.y + y + imageSize + 4, 6.5, C.ink, 'center');
    });
    box(ctx, { x: r.x + 6, y: r.y + r.h - 24, w: r.w - 12, h: 19 }, ready ? C.green : '#F0EBE2', 9);
    text(ctx, ready ? '提交心愿' : '继续合成', r.x + r.w / 2, r.y + r.h - 14.5, 9, ready ? '#FFFFFF' : C.muted, 'center', ready);
  }
  drawCell(model, ui, index, now) {
    const ctx = this.ctx, r = this.cellRect(index), item = model.board[index], selected = index === ui.selected;
    const target = ui.drag && ui.drag.moved && this.cellAt(ui.drag.x, ui.drag.y) === index;
    const source = ui.drag && model.board[ui.drag.from];
    const canMerge = target && source && item && source.chainId === item.chainId && source.level === item.level && item.level < getChain(item.chainId).levels.length;
    box(ctx, { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 4 }, canMerge ? '#D8EACF' : selected ? '#FAEACA' : '#FAF7F0', Math.min(11, this.cell / 5), selected || target ? '#B6A181' : undefined);
    if (!item) { ctx.fillStyle = '#DACDBA'; ctx.beginPath(); ctx.arc(r.x + r.w / 2, r.y + r.h / 2, 1.5, 0, Math.PI * 2); ctx.fill(); return; }
    if (ui.drag && ui.drag.moved && ui.drag.from === index) return;
    const effect = ui.effects.find(value => value.index === index && now - value.start < 350);
    const pop = effect ? 1 + Math.sin(Math.min(1, (now - effect.start) / 350) * Math.PI) * 0.13 : 1;
    const imgSize = (this.cell - 7) * pop;
    this.sprite(item, { x: r.x + (r.w - imgSize) / 2, y: r.y + (r.h - imgSize) / 2, w: imgSize, h: imgSize });
  }
  drawProducer(model, r, producer, now, ui) {
    const ctx = this.ctx, output = producer.outputs[0];
    ctx.save(); ctx.shadowColor = '#61775520'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    box(ctx, r, '#718775', 14); ctx.restore();
    text(ctx, producer.name, r.x + r.w / 2, r.y + 14, 10, '#FFFBF1', 'center', true);
    const size = Math.min(53, r.w - 18), y = r.y + 31;
    box(ctx, { x: r.x + (r.w - size) / 2, y, w: size, h: size }, '#F7F3E6', 13);
    this.sprite(output, { x: r.x + (r.w - size) / 2, y, w: size, h: size });
    const levels = producer.outputs.filter(value => value.weight > 0).map(value => value.level);
    const minLevel = Math.min(...levels), maxLevel = Math.max(...levels);
    const label = minLevel === maxLevel ? '随机落到空格' : `随机 ${minLevel}～${maxLevel} 级`;
    text(ctx, label, r.x + r.w / 2, r.y + r.h - 39, 8, '#E6EEDD', 'center');
    box(ctx, { x: r.x + 6, y: r.y + r.h - 24, w: r.w - 12, h: 19 }, '#FFFFFF25', 9);
    text(ctx, `生成 -${producer.energyCost}`, r.x + r.w / 2, r.y + r.h - 14.5, 9, '#FFF9ED', 'center', true);
  }
  drawProgress(model) {
    const ctx = this.ctx, y = this.footerY;
    const chapter = model.chapter(), done = model.completed % CONFIG.progression.ordersPerChapter;
    const name = CONFIG.chapterNames[Math.min(CONFIG.chapterNames.length - 1, chapter - 1)];
    box(ctx, { x: 20, y, w: 350, h: 44 }, '#FFFDFA', 14, C.line);
    text(ctx, `第 ${chapter} 章 · ${name}`, 31, y + 12, 11, C.ink, 'left', true);
    text(ctx, `连合 ${model.combo} · 最高 ${model.bestCombo}`, 358, y + 12, 10, model.combo >= 3 ? '#B08B4D' : C.muted, 'right');
    box(ctx, { x: 31, y: y + 27, w: 211, h: 4 }, '#EEE6D9', 2);
    if (done) box(ctx, { x: 31, y: y + 27, w: 211 * done / CONFIG.progression.ordersPerChapter, h: 4 }, '#A9B79B', 2);
    text(ctx, `${done}/${CONFIG.progression.ordersPerChapter} 心愿`, 358, y + 29, 9, C.muted, 'right');
    text(ctx, '3 连合起赚金币 · 生成/交单结束连合 · 心愿右上角换单', 195, y + 59, 8.5, C.muted, 'center');
  }
  drawEffects(ui, now) {
    const ctx = this.ctx;
    ui.effects.forEach(effect => {
      const t = (now - effect.start) / 650;
      if (t < 0 || t > 1) return;
      const r = this.cellRect(effect.index), x = r.x + r.w / 2, y = r.y + r.h / 2;
      ctx.save(); ctx.globalAlpha = 1 - t;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, distance = 8 + t * this.cell * 0.7;
        ctx.fillStyle = i % 2 ? '#D8AB66' : '#8FA882';
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * distance, y + Math.sin(a) * distance, 2.5 * (1 - t) + 0.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }
  drawPanel(model, ui) {
    const ctx = this.ctx, p = this.panelRect;
    ctx.fillStyle = '#453A3270'; ctx.fillRect(0, 0, 390, this.height);
    box(ctx, p, C.cream, 24);
    box(ctx, this.panelClose, '#EEE8DD', 16); this.icon('close', this.panelClose.x + 16, this.panelClose.y + 16, 16);
    text(ctx, ui.panel === 'gallery' ? '萌友图鉴' : '小屋设置', p.x + 22, p.y + 33, 21, C.ink, 'left', true);
    if (ui.panel === 'gallery') {
      const all = CONFIG.chains.reduce((items, chain) => items.concat(chain.levels.map((level, i) => ({ chainId: chain.id, level: i + 1 }))), []);
      const pages = Math.ceil(all.length / 5), page = Math.min(ui.galleryPage || 0, pages - 1);
      text(ctx, '两个相同萌友，会变成下一级', p.x + 22, p.y + 65, 11, C.muted);
      const rowH = Math.min(72, (p.h - 116) / 5);
      all.slice(page * 5, page * 5 + 5).forEach((item, i) => {
        const def = getItem(item), y = p.y + 84 + i * rowH, unlocked = (model.discovered[item.chainId] || 0) >= item.level;
        box(ctx, { x: p.x + 16, y, w: p.w - 32, h: rowH - 6 }, C.white, 13, C.line);
        this.sprite(item, { x: p.x + 20, y: y + 2, w: rowH - 9, h: rowH - 9 }, unlocked ? 1 : 0.4);
        text(ctx, `${def.name}  Lv.${item.level}`, p.x + rowH + 24, y + (rowH - 6) * 0.34, 13, C.ink, 'left', true);
        text(ctx, def.note, p.x + rowH + 24, y + (rowH - 6) * 0.73, 9, C.muted);
        if (!unlocked) text(ctx, '待发现', p.x + p.w - 27, y + 16, 8, C.muted, 'right');
      });
      text(ctx, pages > 1 ? `左右滑动翻页 · ${page + 1}/${pages}` : '合成后，点亮你的小小收藏', 195, p.y + p.h - 17, 10, C.muted, 'center');
    } else {
      text(ctx, '进度会自动保存在这台手机上', p.x + 22, p.y + 79, 12, C.muted);
      text(ctx, `累计合成 ${model.merges} 次  ·  完成 ${model.completed} 单`, p.x + 22, p.y + 110, 12);
      text(ctx, `最高连合 ${model.bestCombo} 次 · 每 ${CONFIG.progression.ordersPerChapter} 单晋级`, p.x + 22, p.y + 132, 10, C.muted);
      box(ctx, { x: p.x + 20, y: p.y + 145, w: p.w - 40, h: 30 }, '#EEEADF', 12);
      text(ctx, `音效：${model.soundEnabled ? '开启' : '关闭'}  ·  点击切换`, 195, p.y + 160, 12, C.green, 'center', true);
      box(ctx, { x: p.x + 20, y: p.y + 184, w: p.w - 40, h: 46 }, C.mint, 14);
      text(ctx, `50元补满体力至 ${CONFIG.initialEnergy}`, 195, p.y + 207, 14, C.green, 'center', true);
      box(ctx, { x: p.x + 20, y: p.y + 244, w: p.w - 40, h: 46 }, '#F5E6DA', 14);
      text(ctx, '重新开始', 195, p.y + 267, 14, '#A1715D', 'center');
      text(ctx, '可以点选物品，再点目标格进行移动或合成', 195, p.y + 324, 10, C.muted, 'center');
      text(ctx, '棋盘满了？提交订单、合成，或选中后移出', 195, p.y + 345, 10, C.muted, 'center');
      text(ctx, '趣味升级版 · 给你的小小快乐', 195, p.y + p.h - 29, 11, C.muted, 'center');
    }
  }
}

module.exports = GameView;
