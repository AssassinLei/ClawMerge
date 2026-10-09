const { CONFIG, getItem } = require('./config');
const GameModel = require('./model');
const GameView = require('./view');
const SoundManager = require('./sound');

class MergeGame {
  constructor(platform) {
    this.platform = platform;
    let saved;
    try { saved = platform.getStorageSync(CONFIG.storageKey); } catch (error) { console.warn('读取存档失败', error); }
    this.model = new GameModel(saved);
    this.sound = new SoundManager(platform, this.model.soundEnabled);
    this.ui = { selected: -1, drag: null, toast: null, effects: [], panel: null, galleryPage: 0 };
    this.active = true;
    this.pendingFrame = null;
    this.lastSaveWarning = 0;
    this.canvas = platform.createCanvas();
    const info = this.windowInfo();
    this.view = new GameView(this.canvas, platform, info, this.menuRect());
    this.view.onInvalidate = () => this.invalidate();
    this.frame = () => {
      this.pendingFrame = null;
      if (!this.active) return;
      const now = Date.now();
      this.ui.effects = this.ui.effects.filter(effect => now - effect.start < 650);
      this.view.draw(this.model, this.ui, now);
      if (this.ui.effects.length || (this.ui.toast && now < this.ui.toast.until)) this.invalidate();
    };
    platform.onTouchStart(event => this.touchStart(event));
    platform.onTouchMove(event => this.touchMove(event));
    platform.onTouchEnd(event => this.touchEnd(event));
    platform.onTouchCancel(() => { this.ui.drag = null; this.pressed = null; this.startPoint = null; this.invalidate(); });
    if (platform.onHide) platform.onHide(() => {
      this.save(); this.sound.stopAll(); this.active = false; this.ui.drag = null; this.pressed = null; this.startPoint = null;
      if (this.pendingFrame !== null) this.cancelFrame(this.pendingFrame);
      this.pendingFrame = null;
    });
    if (platform.onShow) platform.onShow(() => { this.active = true; this.invalidate(); });
    if (platform.onWindowResize) platform.onWindowResize(() => {
      this.ui.drag = null; this.view.layout(this.windowInfo(), this.menuRect()); this.invalidate();
    });
    if (this.model.lastSaveRecovered) this.notify('已恢复可用存档，可以继续玩啦');
    else if (!saved) this.notify('先整理小院，再挑战组合心愿吧');
    this.invalidate();
  }
  windowInfo() { return this.platform.getWindowInfo ? this.platform.getWindowInfo() : this.platform.getSystemInfoSync(); }
  menuRect() { try { return this.platform.getMenuButtonBoundingClientRect ? this.platform.getMenuButtonBoundingClientRect() : null; } catch (_) { return null; } }
  requestFrame(fn) { return this.canvas.requestAnimationFrame ? this.canvas.requestAnimationFrame(fn) : requestAnimationFrame(fn); }
  cancelFrame(id) { if (this.canvas.cancelAnimationFrame) this.canvas.cancelAnimationFrame(id); else cancelAnimationFrame(id); }
  invalidate() { if (this.active && this.pendingFrame === null && this.frame) this.pendingFrame = this.requestFrame(this.frame); }
  notify(message) { this.ui.toast = { message, until: Date.now() + 2200 }; this.invalidate(); }
  save() {
    try { this.platform.setStorageSync(CONFIG.storageKey, this.model.snapshot()); return true; }
    catch (error) {
      console.warn('保存失败', error);
      if (Date.now() - this.lastSaveWarning > 5000) { this.lastSaveWarning = Date.now(); this.notify('存档失败，请检查手机存储空间'); }
      return false;
    }
  }
  position(event, end = false) {
    const touches = end ? event.changedTouches : event.touches;
    const touch = touches && touches[0];
    return touch ? this.view.point(touch.clientX !== undefined ? touch.clientX : touch.x, touch.clientY !== undefined ? touch.clientY : touch.y) : null;
  }
  touchStart(event) {
    if (this.ui.drag) return;
    const point = this.position(event); if (!point) return;
    const action = this.view.actionAt(point.x, point.y, this.ui);
    this.pressed = action;
    this.startPoint = point;
    if (action) return;
    const index = this.view.cellAt(point.x, point.y);
    if (index < 0) return;
    this.ui.drag = { from: index, startX: point.x, startY: point.y, x: point.x, y: point.y, moved: false };
    this.invalidate();
  }
  touchMove(event) {
    const point = this.position(event), drag = this.ui.drag;
    if (!point || !drag || !this.model.board[drag.from]) return;
    drag.x = point.x; drag.y = point.y;
    if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 6) drag.moved = true;
    if (drag.moved) this.ui.selected = drag.from;
    this.invalidate();
  }
  touchEnd(event) {
    const point = this.position(event, true);
    if (!point) { this.ui.drag = null; this.pressed = null; this.invalidate(); return; }
    if (this.ui.panel === 'gallery' && this.startPoint && Math.abs(point.x - this.startPoint.x) > 45) {
      const pages = Math.ceil(CONFIG.chains.reduce((sum, chain) => sum + chain.levels.length, 0) / 5);
      this.ui.galleryPage = (this.ui.galleryPage + (point.x < this.startPoint.x ? 1 : pages - 1)) % pages;
      this.pressed = null; this.invalidate(); return;
    }
    if (this.pressed) {
      const action = this.view.actionAt(point.x, point.y, this.ui);
      if (action && action.type === this.pressed.type && action.id === this.pressed.id && action.slot === this.pressed.slot) this.perform(action);
      this.pressed = null; this.invalidate(); return;
    }
    const drag = this.ui.drag;
    this.ui.drag = null;
    if (!drag) return;
    const target = this.view.cellAt(point.x, point.y);
    if (drag.moved) {
      if (target >= 0 && target !== drag.from) this.move(drag.from, target);
      else this.ui.selected = drag.from;
    } else if (target === drag.from) {
      if (this.ui.selected >= 0 && this.ui.selected !== target && this.model.board[this.ui.selected]) this.move(this.ui.selected, target);
      else { this.ui.selected = this.model.board[target] && this.ui.selected !== target ? target : -1; this.sound.play('move'); }
    }
    this.invalidate();
  }
  move(from, to) {
    const result = this.model.move(from, to);
    if (!result.ok) {
      if (result.reason === 'max') { this.notify('已经是最高级啦，可以用来完成心愿'); this.sound.play('error'); }
      return;
    }
    this.ui.selected = to;
    if (result.kind === 'merge') {
      this.sound.play(result.bonus ? 'combo' : 'merge');
      this.ui.effects.push({ index: to, start: Date.now() });
      this.notify(result.bonus ? `${result.combo} 连合！${getItem(result.item).name} · 金币 +${result.bonus}` : result.isNew ? `发现新萌友：${getItem(result.item).name}！` : `合成了${getItem(result.item).name}`);
    } else this.sound.play('move');
    this.save(); this.invalidate();
  }
  perform(action) {
    if (action.type === 'close-panel') { this.ui.panel = null; this.sound.play('move'); return; }
    if (action.type === 'gallery' || action.type === 'settings') { this.ui.panel = action.type; this.ui.drag = null; this.sound.play('move'); return; }
    if (action.type === 'sound-toggle') {
      this.model.soundEnabled = !this.model.soundEnabled; this.sound.setEnabled(this.model.soundEnabled); this.save(); this.sound.play('move'); return;
    }
    if (action.type === 'produce') {
      const result = this.model.produce(action.id);
      if (!result.ok) {
        this.sound.play('error');
        this.notify(result.reason === 'full' ? '棋盘满啦，合成、交单或移出一个萌友吧' : result.reason === 'energy' ? '体力不足，需要充值' : '生产器尚未准备好');
        return;
      }
      this.ui.effects.push({ index: result.index, start: Date.now() });
      this.ui.selected = -1;
      this.sound.play('spawn');
      this.save(); return;
    }
    if (action.type === 'submit') {
      const order = this.model.orders[action.slot]; if (!order) return;
      const result = this.model.submit(order.id);
      if (result.ok) {
        this.ui.selected = -1; this.save(); this.sound.play(result.chapterUp ? 'chapter' : 'order');
        this.notify(result.chapterUp ? `进入第 ${result.chapter} 章！金币 +${result.reward + result.chapterBonus}` : `心愿完成！金币 +${result.reward}`);
      } else {
        const missing = this.model.orderProgress(order).filter(p => p.have < p.requirement.quantity).map(p => `${getItem(p.requirement).name}×${p.requirement.quantity - p.have}`).join('、');
        this.notify(`还需：${missing}`); this.sound.play('error');
      }
      return;
    }
    if (action.type === 'refresh-order') {
      const order = this.model.orders[action.slot], cost = this.model.refreshCost(); if (!order) return;
      if (this.model.coins < cost) { this.notify(`刷新心愿需要 ${cost} 金币`); this.sound.play('error'); return; }
      this.confirm('换一个心愿？', `消耗 ${cost} 金币刷新这一单，其他心愿保留。`, () => {
        const result = this.model.refreshOrder(order.id);
        if (result.ok) { this.save(); this.sound.play('move'); this.notify(`心愿已刷新 · 金币 -${result.cost}`); this.invalidate(); }
        else if (result.reason === 'no-alternative') this.notify('暂时没有不同的心愿，金币未扣除');
      });
      return;
    }
    if (action.type === 'refill') { this.model.refillEnergy(); this.save(); this.sound.play('move'); this.notify('体力已补满，慢慢玩吧'); return; }
    if (action.type === 'discard') {
      const index = this.ui.selected, item = this.model.board[index]; if (!item) return;
      this.confirm(`移出${getItem(item).name}？`, '这个萌友会从棋盘移除，不会获得金币。', () => {
        if (this.model.board[index] === item) { this.model.discard(index); this.ui.selected = -1; this.save(); this.sound.play('move'); this.invalidate(); }
      });
    }
    if (action.type === 'reset') this.confirm('重新开始？', `将清除当前棋盘、订单和金币，体力恢复至 ${CONFIG.initialEnergy}。`, () => {
      this.model.reset(); this.ui.selected = -1; this.ui.effects = []; this.ui.panel = null; this.save(); this.sound.play('move'); this.notify('新的小小快乐，从这里开始');
    });
  }
  confirm(title, content, callback) {
    this.platform.showModal({ title, content, confirmText: '确认', cancelText: '取消', confirmColor: '#718775', success: result => { if (result.confirm) callback(); } });
  }
}

module.exports = MergeGame;
