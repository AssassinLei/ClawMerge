const { CONFIG, getChain, getItem, isValidItem } = require('./config');
const cloneItem = item => item ? { chainId: item.chainId, level: item.level } : null;
const cloneRequirement = item => Object.assign(cloneItem(item), { quantity: item.quantity });
const natural = (value, fallback = 0) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, 1000000000) : fallback;

class GameModel {
  constructor(saved, random = Math.random) {
    this.random = random;
    this.lastSaveRecovered = false;
    this.reset();
    if (saved) this.restore(saved);
  }
  reset() {
    const soundEnabled = this.soundEnabled !== false;
    this.board = Array(CONFIG.columns * CONFIG.rows).fill(null);
    this.coins = 0; this.energy = CONFIG.initialEnergy; this.completed = 0; this.merges = 0;
    this.combo = 0; this.bestCombo = 0; this.soundEnabled = soundEnabled;
    this.nextOrderId = 1; this.discovered = Object.fromEntries(CONFIG.chains.map(chain => [chain.id, 0])); this.orders = [];
    const positions = this.board.map((_, index) => index);
    // Fisher-Yates sampling without replacement, so every starting position is fair.
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(this.roll() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    let cursor = 0;
    CONFIG.starterFill.forEach(group => {
      if (!isValidItem(group)) return;
      for (let i = 0; i < group.count && cursor < positions.length; i++) {
        this.board[positions[cursor++]] = cloneItem(group); this.discover(group);
      }
    });
    CONFIG.starterOrders.slice(0, CONFIG.orderSlots).forEach(order => {
      if (this.validOrder(order)) this.orders.push(this.makeOrder(order));
    });
    this.fillOrders();
  }
  chapter() { return Math.floor(this.completed / CONFIG.progression.ordersPerChapter) + 1; }
  difficulty() { return Math.min(CONFIG.progression.maxDifficulty, this.chapter()); }
  refreshCost() { return CONFIG.progression.refreshCost + (this.difficulty() - 1) * 10; }
  validIndex(index) { return Number.isInteger(index) && index >= 0 && index < this.board.length; }
  discover(item) { this.discovered[item.chainId] = Math.max(this.discovered[item.chainId] || 0, item.level); }
  availableChains() {
    return CONFIG.chains.filter(chain => CONFIG.producers.some(producer => !producer.unlock &&
      producer.outputs.some(output => output.chainId === chain.id && output.weight > 0 && isValidItem(output))));
  }
  validRequirement(order) {
    if (!isValidItem(order) || !Number.isInteger(order.quantity) || order.quantity < 1 || order.quantity > 3) return false;
    return CONFIG.producers.some(producer => producer.outputs.some(output =>
      output.chainId === order.chainId && output.level <= order.level && output.weight > 0 && isValidItem(output)));
  }
  requirements(order) {
    return order && Array.isArray(order.requirements) ? order.requirements : [];
  }
  validOrder(order) {
    const requirements = this.requirements(order);
    if (!requirements.length || requirements.length > 2 || !requirements.every(item => this.validRequirement(item))) return false;
    return new Set(requirements.map(item => item.chainId + ':' + item.level)).size === requirements.length;
  }
  orderReward(requirements, kind, tier) {
    const base = requirements.reduce((sum, item) => sum + getItem(item).reward * item.quantity, 0);
    const bonus = (requirements.length > 1 ? 0.15 : 0) + (kind === 'challenge' ? 0.35 : 0) + (tier - 1) * 0.05;
    return Math.round(base * (1 + bonus));
  }
  makeOrder(input) {
    const requirements = this.requirements(input).map(cloneRequirement);
    const kind = input.kind === 'challenge' ? 'challenge' : 'normal';
    const tier = Math.max(1, Math.min(CONFIG.progression.maxDifficulty, natural(input.tier, this.difficulty())));
    return { id: this.nextOrderId++, requirements, kind, tier, reward: this.orderReward(requirements, kind, tier) };
  }
  roll() {
    const value = this.random();
    return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
  }
  signature(order) { return this.requirements(order).map(item => item.chainId + ':' + item.level + ':' + item.quantity).sort().join('|'); }
  isEasyOrder(order) {
    const requirements = this.requirements(order);
    return order.kind !== 'challenge' && this.validOrder(order) &&
      requirements.every(item => item.level <= CONFIG.orderMix.easyMaxLevel) &&
      requirements.reduce((sum, item) => sum + 2 ** (item.level - 1) * item.quantity, 0) <= CONFIG.orderMix.easyMaxValue;
  }
  generateOrder(slot = this.orders.length, replacedId = null) {
    const tier = this.difficulty(), kind = slot === CONFIG.orderSlots - 1 ? 'challenge' : 'normal';
    const groups = { easy: [], medium: [], advanced: [] };
    this.availableChains().forEach(chain => {
      const unlockedTarget = (this.discovered[chain.id] || 1) + 1;
      const normalMax = Math.min(Math.max(1, chain.levels.length - 1), Math.max(3, unlockedTarget));
      const challengeMax = Math.min(chain.levels.length, Math.max(5, unlockedTarget, tier + 4));
      const ranges = kind === 'challenge' ? [{ name: 'advanced', min: challengeMax, max: challengeMax }] : [
        { name: 'easy', min: 1, max: Math.min(normalMax, CONFIG.orderMix.easyMaxLevel) },
        { name: 'medium', min: Math.min(4, normalMax), max: Math.min(normalMax, CONFIG.orderMix.mediumMaxLevel) },
        { name: 'advanced', min: Math.max(1, normalMax - 1), max: normalMax },
      ];
      ranges.forEach(range => {
        const quantity = range.name === 'advanced' ? Math.min(3, 1 + Math.floor(tier / 2)) : 1;
        const secondaryQuantity = range.name === 'advanced' && tier >= 3 ? 2 : 1;
        for (let level = range.min; level <= range.max; level++) {
          for (let primaryCount = quantity; primaryCount <= Math.min(range.name === 'advanced' ? 3 : 2, quantity + 1); primaryCount++) {
            const primary = { chainId: chain.id, level, quantity: primaryCount };
            if (!this.validRequirement(primary)) continue;
            if (range.name === 'easy') {
              const candidate = { requirements: [primary], kind, tier };
              if (this.isEasyOrder(candidate)) groups.easy.push(candidate);
              continue;
            }
            for (let secondaryCount = secondaryQuantity; secondaryCount <= Math.min(3, secondaryQuantity + 1); secondaryCount++) {
              const secondary = { chainId: chain.id, level: Math.max(1, level - 1), quantity: secondaryCount };
              const requirements = [primary];
              if (secondary.level !== level && this.validRequirement(secondary)) requirements.push(secondary);
              groups[range.name].push({ requirements, kind, tier });
            }
          }
        }
      });
    });
    // Keep the three wishes playable; exclude the order being refreshed from this check.
    const needsEasy = !this.orders.some(order => order.id !== replacedId && this.isEasyOrder(order));
    let name = 'advanced';
    if (kind === 'normal') {
      if (needsEasy && groups.easy.length) name = 'easy';
      else {
        const weights = [['easy', CONFIG.orderMix.easyWeight], ['medium', CONFIG.orderMix.mediumWeight], ['advanced', CONFIG.orderMix.advancedWeight]]
          .filter(([group, weight]) => groups[group].length && weight > 0);
        let roll = this.roll() * weights.reduce((sum, [, weight]) => sum + weight, 0);
        name = (weights.find(([, weight]) => { roll -= weight; return roll < 0; }) || weights[weights.length - 1] || ['advanced'])[0];
      }
    }
    const candidates = groups[name];
    if (!candidates.length) throw new Error('至少配置一个有效生产器');
    // Deduplicate within the chosen difficulty so easy orders never turn into hard orders.
    const unique = candidates.filter(candidate => !this.orders.some(order => this.signature(order) === this.signature(candidate)));
    const pool = unique.length ? unique : candidates;
    return this.makeOrder(pool[Math.floor(this.roll() * pool.length)]);
  }
  fillOrders() { while (this.orders.length < CONFIG.orderSlots) this.orders.push(this.generateOrder(this.orders.length)); }
  productionOutputs(producer) { return producer.outputs.filter(output => isValidItem(output) && output.weight > 0); }
  produce(producerId = CONFIG.producers[0].id) {
    const producer = CONFIG.producers.find(value => value.id === producerId);
    if (!producer) return { ok: false, reason: 'unknown-producer' };
    const empty = this.board.map((item, index) => item ? -1 : index).filter(index => index >= 0);
    if (!empty.length) return { ok: false, reason: 'full' };
    if (this.energy < producer.energyCost) return { ok: false, reason: 'energy' };
    const outputs = this.productionOutputs(producer);
    const total = outputs.reduce((sum, output) => sum + output.weight, 0);
    if (!total) return { ok: false, reason: 'unknown-producer' };
    const index = empty[Math.floor(this.roll() * empty.length)];
    let roll = this.roll() * total;
    const output = outputs.find(value => { roll -= value.weight; return roll < 0; }) || outputs[outputs.length - 1];
    this.board[index] = cloneItem(output); this.energy -= producer.energyCost; this.combo = 0; this.discover(output);
    return { ok: true, index, item: cloneItem(output) };
  }
  move(from, to) {
    if (!this.validIndex(from) || !this.validIndex(to) || !this.board[from] || from === to) return { ok: false, reason: 'invalid' };
    const source = this.board[from], target = this.board[to];
    if (!target) {
      this.board[to] = source; this.board[from] = null;
      return { ok: true, kind: 'move', index: to };
    }
    if (source.chainId === target.chainId && source.level === target.level) {
      if (source.level === getChain(source.chainId).levels.length) return { ok: false, reason: 'max' };
      this.board[to] = { chainId: source.chainId, level: source.level + 1 }; this.board[from] = null;
      const isNew = this.board[to].level > (this.discovered[source.chainId] || 0);
      this.discover(this.board[to]); this.merges++; this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
      const bonus = this.combo >= CONFIG.progression.comboStart ? Math.min(CONFIG.progression.comboRewardCap, this.combo - 1) : 0;
      this.coins += bonus;
      return { ok: true, kind: 'merge', index: to, item: cloneItem(this.board[to]), isNew, combo: this.combo, bonus };
    }
    this.board[from] = target; this.board[to] = source;
    return { ok: true, kind: 'swap', index: to };
  }
  count(requirement) {
    return this.board.reduce((count, item) => count + (item && item.chainId === requirement.chainId && item.level === requirement.level ? 1 : 0), 0);
  }
  orderProgress(order) { return this.requirements(order).map(item => ({ requirement: item, have: this.count(item) })); }
  orderReady(order) { return this.validOrder(order) && this.orderProgress(order).every(progress => progress.have >= progress.requirement.quantity); }
  submit(orderId) {
    const slot = this.orders.findIndex(order => order.id === orderId);
    if (slot < 0) return { ok: false, reason: 'missing-order' };
    const order = this.orders[slot];
    if (!this.orderReady(order)) return { ok: false, reason: 'not-ready' };
    this.requirements(order).forEach(requirement => {
      let remaining = requirement.quantity;
      this.board.forEach((item, index) => {
        if (remaining && item && item.chainId === requirement.chainId && item.level === requirement.level) { this.board[index] = null; remaining--; }
      });
    });
    const previousChapter = this.chapter();
    this.coins += order.reward; this.completed++; this.combo = 0;
    const chapterUp = this.chapter() > previousChapter;
    const chapterBonus = chapterUp ? CONFIG.progression.chapterBonus + (this.difficulty() - 1) * 25 : 0;
    this.coins += chapterBonus;
    this.orders.splice(slot, 1);
    this.orders.splice(slot, 0, this.generateOrder(slot));
    return { ok: true, reward: order.reward, chapterUp, chapterBonus, chapter: this.chapter() };
  }
  refreshOrder(orderId) {
    const slot = this.orders.findIndex(order => order.id === orderId);
    if (slot < 0) return { ok: false, reason: 'missing-order' };
    const cost = this.refreshCost();
    if (this.coins < cost) return { ok: false, reason: 'coins', cost };
    // Include the old signature while choosing its replacement, avoiding it where possible.
    const replacement = this.generateOrder(slot, orderId);
    if (this.signature(replacement) === this.signature(this.orders[slot])) {
      this.nextOrderId--;
      return { ok: false, reason: 'no-alternative' };
    }
    this.orders[slot] = replacement; this.coins -= cost; this.combo = 0;
    return { ok: true, cost };
  }
  discard(index) {
    if (!this.validIndex(index) || !this.board[index]) return false;
    this.board[index] = null; this.combo = 0; return true;
  }
  refillEnergy() { this.energy = CONFIG.initialEnergy; }
  snapshot() {
    return {
      version: CONFIG.version, columns: CONFIG.columns, rows: CONFIG.rows, board: this.board.map(cloneItem),
      coins: this.coins, energy: this.energy, completed: this.completed, merges: this.merges,
      combo: this.combo, bestCombo: this.bestCombo, soundEnabled: this.soundEnabled,
      nextOrderId: this.nextOrderId, discovered: Object.assign({}, this.discovered),
      orders: this.orders.map(order => ({ id: order.id, kind: order.kind, tier: order.tier, reward: order.reward, requirements: order.requirements.map(cloneRequirement) })),
    };
  }
  restore(saved) {
    const current = saved && saved.version === CONFIG.version && Array.isArray(saved.board) &&
      saved.board.length === this.board.length && (saved.columns === undefined || saved.columns === CONFIG.columns) &&
      (saved.rows === undefined || saved.rows === CONFIG.rows);
    if (!current) { this.lastSaveRecovered = true; return; }
    this.board.fill(null);
    saved.board.forEach((item, index) => {
      if (item === null) return;
      if (isValidItem(item)) this.board[index] = cloneItem(item); else this.lastSaveRecovered = true;
    });
    this.coins = natural(saved.coins); this.energy = Math.min(CONFIG.initialEnergy, natural(saved.energy, CONFIG.initialEnergy));
    this.completed = natural(saved.completed); this.merges = natural(saved.merges);
    this.combo = Math.min(this.merges, natural(saved.combo)); this.bestCombo = Math.max(this.combo, Math.min(this.merges, natural(saved.bestCombo)));
    this.soundEnabled = saved.soundEnabled !== false; this.discovered = {};
    CONFIG.chains.forEach(chain => { this.discovered[chain.id] = Math.min(chain.levels.length, natural(saved.discovered && saved.discovered[chain.id])); });
    this.board.filter(Boolean).forEach(item => this.discover(item));
    this.orders = []; this.nextOrderId = Math.max(1, natural(saved.nextOrderId, 1));
    const seen = new Set();
    if (Array.isArray(saved.orders)) saved.orders.slice(0, CONFIG.orderSlots).forEach(order => {
      if (this.validOrder(order) && Number.isSafeInteger(order.id) && order.id > 0 && order.id <= 1000000000 && !seen.has(order.id)) {
        seen.add(order.id); this.nextOrderId = Math.max(this.nextOrderId, order.id + 1);
        const requirements = this.requirements(order).map(cloneRequirement);
        const kind = order.kind === 'challenge' ? 'challenge' : 'normal';
        const tier = Math.max(1, Math.min(CONFIG.progression.maxDifficulty, natural(order.tier, 1)));
        this.orders.push({ id: order.id, requirements, kind, tier, reward: this.orderReward(requirements, kind, tier) });
      } else this.lastSaveRecovered = true;
    });
    this.fillOrders();
  }
}

module.exports = GameModel;
