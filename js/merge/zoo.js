const BaseModel = require('./model');
const {CONFIG, getChain, getItem, isValidItem} = require('./config');
const {AREAS, CHAPTERS, RESIDENTS, FESTIVALS, DAILY} = require('./content');
const {makePuzzle, puzzleMove, RESCUE_RULES} = require('./puzzles');
const copy = value => JSON.parse(JSON.stringify(value));
const num = (value, max = 1000000000) => Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : 0;
const dayFor = time => new Date(time + 8 * 3600000).toISOString().slice(0, 10);
const counters = model => ({merges: model.merges, orders: model.completed, gifts: model.world.stats.gifts, puzzles: model.world.stats.puzzles});

class ZooModel extends BaseModel {
  constructor(saved, random = Math.random, clock = Date.now) {
    super(saved, random); this.clock = clock; this.initWorld();
    if (saved && saved.version === CONFIG.version && saved.world) this.restoreWorld(saved.world);
    this.offlineIncome = this.syncTime().income;
  }
  initWorld() {
    const now = this.clock();
    this.world = {
      stars: 0, xp: 0, areas: AREAS.map(() => 0), residents: {}, storage: [], storageSize: 6,
      producerLevels: Object.fromEntries(CONFIG.producers.map(p => [p.id, 0])), allProducersUnlocked: false, tools: {split: 2, wild: 1}, stats: {produced: 0, gifts: 0, puzzles: 0, gardenMerges: 0, snackMerges: 0},
      story: {step: 0, baseline: {}, choices: []}, festival: {cycle: 0, points: 0, claimed: []},
      daily: {date: dayFor(now), baseline: {}, claimed: []}, puzzle: {cleared: [], active: null},
      decoration: 'spring', unlockedDecorations: ['spring'], tutorial: 0, energyAt: now, incomeAt: now,
    };
    this.world.story.baseline = counters(this); this.world.daily.baseline = counters(this);
  }
  restart() { super.reset(); this.initWorld(); }
  snapshot() { return {...super.snapshot(), world: copy(this.world)}; }
  isProducerUnlocked(producer) { return !producer.unlock || !!this.world && (this.world.allProducersUnlocked || this.world.areas[0] >= producer.unlock); }
  redeemCode(value) {
    if (typeof value !== 'string' || value.trim() !== '爪爪鸟') return {ok: false, reason: 'invalid-code'};
    if (this.world.allProducersUnlocked) return {ok: false, reason: 'code-used'};
    this.world.allProducersUnlocked = true;
    return {ok: true};
  }
  availableChains() {
    return CONFIG.chains.filter(chain => CONFIG.producers.some(producer => this.isProducerUnlocked(producer) &&
      producer.outputs.some(output => output.chainId === chain.id && output.weight > 0 && isValidItem(output))));
  }
  productionOutputs(producer) {
    const outputs = super.productionOutputs(producer).map(item => ({...item}));
    const upgrade = this.world ? this.world.producerLevels[producer.id] || 0 : 0;
    if (upgrade) {
      outputs[0].weight = Math.max(20, outputs[0].weight - upgrade * 12);
      const last = outputs[outputs.length - 1], next = Math.min(getChain(last.chainId).levels.length, last.level + 1);
      if (next !== last.level) outputs.push({chainId: last.chainId, level: next, weight: upgrade * 6});
      else last.weight += upgrade * 6;
    }
    return outputs;
  }
  level() { return Math.min(30, 1 + Math.floor((Math.sqrt(1 + this.world.xp / 6.25) - 1) / 2)); }
  levelTarget() { return 25 * this.level() * (this.level() + 1); }
  earnXp(amount) {
    const before = this.level(); this.world.xp = Math.min(1000000, this.world.xp + amount);
    const levels = this.level() - before;
    if (levels > 0) { this.coins += levels * 40; this.world.stars += levels; this.world.tools.split += levels; }
    return levels;
  }
  festivalDef() { return FESTIVALS[this.world.festival.cycle % FESTIVALS.length]; }
  eventPoints(chainId, base) { this.world.festival.points += base + (chainId === this.festivalDef().chain ? 2 : 0); }
  produce(id = CONFIG.producers[0].id) {
    const producer = CONFIG.producers.find(p => p.id === id);
    if (producer && !this.isProducerUnlocked(producer)) return {ok: false, reason: 'locked'};
    const wasFull = this.energy === CONFIG.initialEnergy, result = super.produce(id);
    if (result.ok) {
      if (wasFull) this.world.energyAt = this.clock();
      this.world.stats.produced++; this.earnXp(1); this.world.tutorial = Math.max(this.world.tutorial, 1);
    }
    return result;
  }
  move(from, to) {
    const result = super.move(from, to);
    if (result.ok && result.kind === 'merge') {
      this.earnXp(result.item.level * 2); this.eventPoints(result.item.chainId, Math.min(3, result.item.level - 1));
      if (result.item.chainId === 'garden') this.world.stats.gardenMerges++;
      if (result.item.chainId === 'snacks') this.world.stats.snackMerges++;
      this.world.tutorial = Math.max(this.world.tutorial, 2);
    }
    return result;
  }
  submit(id) {
    const order = this.orders.find(order => order.id === id), result = super.submit(id);
    if (result.ok) {
      const stars = order.kind === 'challenge' ? 3 : 1;
      const bonus = Math.floor(result.reward * this.world.areas[3] * 0.03);
      this.world.stars += stars; this.coins += bonus; this.earnXp(order.kind === 'challenge' ? 24 : 12);
      this.world.festival.points += order.kind === 'challenge' ? 8 : 4;
      this.world.tutorial = Math.max(this.world.tutorial, 3);
      return {...result, stars, bonus};
    }
    return result;
  }
  refillEnergy() { super.refillEnergy(); this.world.energyAt = this.clock(); }
  syncTime() {
    const now = this.clock(), energySteps = Math.floor(Math.max(0, now - this.world.energyAt) / 90000);
    if (this.energy === CONFIG.initialEnergy) this.world.energyAt = now;
    else if (energySteps > 0) { this.energy = Math.min(CONFIG.initialEnergy, this.energy + energySteps); this.world.energyAt += energySteps * 90000; }
    const residentCount = Object.keys(this.world.residents).length;
    const minutes = Math.floor(Math.min(8 * 3600000, Math.max(0, now - this.world.incomeAt)) / 60000);
    const income = minutes * residentCount * (1 + Math.floor(this.buildCount() / 8));
    if (minutes || !residentCount) this.world.incomeAt = now;
    this.coins += income;
    const date = dayFor(now);
    if (date > this.world.daily.date) this.world.daily = {date, baseline: counters(this), claimed: []};
    return {income, energySteps};
  }
  buildCount() { return this.world.areas.reduce((sum, value) => sum + value, 0); }
  areaUnlocked(index) { return index === 0 || index > 0 && index < AREAS.length && this.world.areas[index - 1] >= 2; }
  buildCost(index) { return AREAS[index] && AREAS[index].costs[this.world.areas[index]]; }
  hasItems(items) { return items.every(requirement => this.count(requirement) >= requirement.quantity); }
  consume(items) {
    items.forEach(requirement => { let remaining = requirement.quantity;
      this.board.forEach((item, index) => { if (remaining && item && item.chainId === requirement.chainId && item.level === requirement.level) { this.board[index] = null; remaining--; } });
    });
  }
  build(index) {
    const cost = this.buildCost(index);
    if (!cost || !this.areaUnlocked(index)) return {ok: false, reason: cost ? 'locked-area' : 'max'};
    if (this.coins < cost.coins || this.world.stars < cost.stars) return {ok: false, reason: 'currency'};
    if (!this.hasItems(cost.items)) return {ok: false, reason: 'items'};
    this.consume(cost.items); this.coins -= cost.coins; this.world.stars -= cost.stars; this.world.areas[index]++;
    this.combo = 0; this.earnXp(20 + index * 5); this.world.festival.points += 10;
    return {ok: true, stage: this.world.areas[index], unlocked: index === 0 && this.world.areas[0] <= 2};
  }
  residentDef(level) { return RESIDENTS.find(resident => resident.level === level); }
  adopt(level) {
    const def = this.residentDef(level);
    if (!def || !this.world.areas[def.area]) return {ok: false, reason: 'locked-home'};
    if (this.world.residents[level]) return {ok: false, reason: 'owned'};
    const requirement = {chainId: 'friends', level, quantity: 1};
    if (!this.hasItems([requirement])) return {ok: false, reason: 'items'};
    this.consume([requirement]); this.world.residents[level] = {xp: 0}; this.combo = 0;
    this.world.stars++; this.earnXp(20); this.world.incomeAt = this.clock();
    return {ok: true};
  }
  friendship(level) {
    const resident = this.world.residents[level];
    return resident ? Math.min(10, 1 + Math.floor(Math.sqrt(resident.xp / 16))) : 0;
  }
  gift(level, index) {
    const resident = this.world.residents[level], item = this.board[index], def = this.residentDef(level);
    if (!resident || !def) return {ok: false, reason: 'not-resident'};
    if (!item || item.chainId !== 'snacks') return {ok: false, reason: 'not-snack'};
    if (this.friendship(level) === 10) return {ok: false, reason: 'max-friendship'};
    const before = this.friendship(level), amount = 4 * 2 ** (item.level - 1) * (item.level === def.favorite ? 2 : 1) + this.world.areas[1] + this.world.areas[3];
    resident.xp = Math.min(1296, resident.xp + amount); this.board[index] = null;
    this.world.stats.gifts++; this.earnXp(5); this.world.festival.points += 5; this.combo = 0;
    return {ok: true, amount, friendship: this.friendship(level), letter: [3, 6, 10].some(value => before < value && this.friendship(level) >= value)};
  }
  store(index) {
    if (!this.validIndex(index) || !this.board[index]) return {ok: false, reason: 'invalid'};
    if (this.world.storage.length >= this.world.storageSize) return {ok: false, reason: 'storage-full'};
    this.world.storage.push({...this.board[index]}); this.board[index] = null; this.combo = 0;
    return {ok: true};
  }
  withdraw(index) {
    if (!Number.isInteger(index) || !this.world.storage[index]) return {ok: false, reason: 'invalid'};
    const empty = this.board.findIndex(item => !item); if (empty < 0) return {ok: false, reason: 'full'};
    this.board[empty] = this.world.storage.splice(index, 1)[0]; this.combo = 0; return {ok: true, index: empty};
  }
  expandStorage() {
    const max = this.world.areas[2] ? 12 : 9, cost = this.world.storageSize * 20;
    if (this.world.storageSize >= max) return {ok: false, reason: 'max-storage'};
    if (this.coins < cost || this.world.stars < 2) return {ok: false, reason: 'currency'};
    this.coins -= cost; this.world.stars -= 2; this.world.storageSize += 3; return {ok: true};
  }
  producerCost(id) { const level = this.world.producerLevels[id] || 0; return {coins: [150, 400, 900][level], stars: [2, 4, 8][level]}; }
  upgradeProducer(id) {
    const producer = CONFIG.producers.find(p => p.id === id), cost = this.producerCost(id);
    if (!producer || !this.isProducerUnlocked(producer)) return {ok: false, reason: 'locked'};
    if (!cost.coins) return {ok: false, reason: 'max'};
    if (this.coins < cost.coins || this.world.stars < cost.stars) return {ok: false, reason: 'currency'};
    this.coins -= cost.coins; this.world.stars -= cost.stars; this.world.producerLevels[id] = (this.world.producerLevels[id] || 0) + 1;
    return {ok: true};
  }
  useTool(type, index) {
    const item = this.board[index];
    if (!this.validIndex(index) || !item || !['split', 'wild'].includes(type)) return {ok: false, reason: 'invalid'};
    if (!this.world.tools[type]) return {ok: false, reason: 'no-tool'};
    if (type === 'split') {
      if (item.level <= 1) return {ok: false, reason: 'base'};
      const empty = this.board.findIndex(v => !v); if (empty < 0) return {ok: false, reason: 'full'};
      this.board[index] = {...item, level: item.level - 1}; this.board[empty] = {...this.board[index]};
    } else {
      if (item.level >= getChain(item.chainId).levels.length) return {ok: false, reason: 'max'};
      this.board[index] = {...item, level: item.level + 1}; this.discover(this.board[index]);
    }
    this.world.tools[type]--; this.combo = 0; return {ok: true};
  }
  sortBoard() {
    const items = this.board.filter(Boolean).sort((a, b) => CONFIG.chains.findIndex(c => c.id === a.chainId) - CONFIG.chains.findIndex(c => c.id === b.chainId) || a.level - b.level);
    this.board = items.concat(Array(this.board.length - items.length).fill(null)); return {ok: true};
  }
  storyTask() { return CHAPTERS[Math.floor(this.world.story.step / 4)]?.tasks[this.world.story.step % 4] || null; }
  storyProgress() {
    const task = this.storyTask(); if (!task) return {have: 1, need: 1, ready: true};
    let have = 0;
    if (['merges', 'orders', 'gifts', 'puzzles'].includes(task.type)) have = Math.max(0, counters(this)[task.type] - (this.world.story.baseline[task.type] || 0));
    if (task.type === 'build') have = this.world.areas[task.area];
    if (task.type === 'build-total') have = this.buildCount();
    if (task.type === 'resident') have = this.world.residents[task.level] ? 1 : 0;
    if (task.type === 'resident-count') have = Object.keys(this.world.residents).length;
    if (task.type === 'friendship') have = Math.max(0, ...RESIDENTS.map(def => this.friendship(def.level)));
    if (task.type === 'donate') have = this.hasItems(task.items) ? 1 : 0;
    return {have: Math.min(have, task.target), need: task.target, ready: have >= task.target};
  }
  claimStory(choice = 0, expectedStep = this.world.story.step) {
    const task = this.storyTask(), step = this.world.story.step;
    if (!task || expectedStep !== step || !this.storyProgress().ready) return {ok: false, reason: 'not-ready'};
    if (task.type === 'donate') this.consume(task.items);
    const chapter = Math.floor(step / 4), chapterEnd = step % 4 === 3;
    this.coins += 40 + chapter * 20; this.world.stars += 2 + (chapterEnd ? 2 : 0); this.earnXp(15);
    if (chapterEnd) { this.world.story.choices[chapter] = choice === 1 ? 1 : 0; this.world.tools.wild++; }
    else if (step % 4 === 2) this.world.tools.split++;
    this.world.story.step++; this.world.story.baseline = counters(this); this.combo = 0;
    return {ok: true, chapterEnd, chapter, ending: this.world.story.step === 24};
  }
  dailyProgress(index) {
    const quest = DAILY[index]; if (!quest) return {have: 0, need: 1, ready: false};
    const have = Math.max(0, counters(this)[quest.type] - (this.world.daily.baseline[quest.type] || 0));
    return {have: Math.min(have, quest.target), need: quest.target, ready: have >= quest.target};
  }
  claimDaily(index) {
    this.syncTime();
    if (!DAILY[index] || this.world.daily.claimed.includes(index) || !this.dailyProgress(index).ready) return {ok: false, reason: 'not-ready'};
    this.world.daily.claimed.push(index); this.coins += 60 + this.world.areas[2] * 10; this.world.stars += 2;
    if (index === 2) this.world.tools.split++; return {ok: true};
  }
  festivalTargets() { const scale = 1 + Math.min(5, this.world.festival.cycle) * 0.15; return [30, 80, 150].map(n => Math.round(n * scale)); }
  claimFestival(index) {
    const festival = this.world.festival, targets = this.festivalTargets();
    if (!Number.isInteger(index) || index < 0 || index > 2 || festival.claimed.includes(index) || festival.points < targets[index]) return {ok: false, reason: 'not-ready'};
    // Claim in order, so the next celebration cannot erase an unclaimed reward.
    if (index && !festival.claimed.includes(index - 1)) return {ok: false, reason: 'previous-reward'};
    festival.claimed.push(index); this.coins += [80, 160, 300][index]; this.world.stars += [2, 3, 5][index];
    if (index === 1) this.world.tools.split += 1 + (this.world.areas[4] >= 2 ? 1 : 0);
    if (index === 2) {
      this.world.tools.wild++; const style = ['spring', 'sunset', 'starlight'][festival.cycle % 3];
      if (!this.world.unlockedDecorations.includes(style)) this.world.unlockedDecorations.push(style);
      festival.points -= targets[2]; festival.cycle++; festival.claimed = [];
    }
    return {ok: true};
  }
  setDecoration(style) { if (!this.world.unlockedDecorations.includes(style)) return {ok: false, reason: 'locked'}; this.world.decoration = style; return {ok: true}; }
  startPuzzle(level, restart = false) {
    const unlocked = Math.min(20, this.world.puzzle.cleared.length + 1);
    if (!Number.isInteger(level) || level < 1 || level > unlocked) return {ok: false, reason: 'locked'};
    const active = this.world.puzzle.active;
    if (!restart && active && active.level === level && !active.won && active.moves < active.limit) return {ok: true, resumed: true, energyCost: 0};
    if (this.energy < RESCUE_RULES.energyCost) return {ok: false, reason: 'rescue-energy'};
    const {solution, ...session} = makePuzzle(level);
    if (this.energy === CONFIG.initialEnergy) this.world.energyAt = this.clock();
    this.energy -= RESCUE_RULES.energyCost;
    this.world.puzzle.active = {...session, moves: 0, won: false}; return {ok: true, resumed: false, energyCost: RESCUE_RULES.energyCost};
  }
  puzzleMove(from, to) {
    const session = this.world.puzzle.active; if (!session) return {ok: false, reason: 'invalid'};
    const result = puzzleMove(session, from, to);
    if (result.won) {
      this.world.stats.puzzles++;
      if (!this.world.puzzle.cleared.includes(session.level)) {
        this.world.puzzle.cleared.push(session.level);
        this.coins += 50 + session.level * 5; this.world.stars += 2; this.earnXp(20); this.world.festival.points += 12;
        if (session.level % 4 === 0) this.world.tools.wild++; result.rewarded = true;
      } else this.world.festival.points += 3;
    }
    return result;
  }
  restoreWorld(saved) {
    if (!saved || typeof saved !== 'object') { this.lastSaveRecovered = true; return; }
    const w = this.world, now = this.clock();
    w.stars = num(saved.stars); w.xp = num(saved.xp, 1000000);
    if (Array.isArray(saved.areas)) w.areas = AREAS.map((_, i) => num(saved.areas[i], 4));
    if (saved.residents && typeof saved.residents === 'object') RESIDENTS.forEach(def => {
      const resident = saved.residents[def.level]; if (resident && w.areas[def.area]) w.residents[def.level] = {xp: num(resident.xp, 1296)};
    });
    w.storageSize = [6, 9, 12].includes(saved.storageSize) ? saved.storageSize : 6;
    w.storage = Array.isArray(saved.storage) ? saved.storage.filter(isValidItem).slice(0, w.storageSize).map(item => ({chainId: item.chainId, level: item.level})) : [];
    CONFIG.producers.forEach(p => { w.producerLevels[p.id] = num(saved.producerLevels?.[p.id], 3); });
    w.allProducersUnlocked = saved.allProducersUnlocked === true;
    ['split', 'wild'].forEach(key => { w.tools[key] = num(saved.tools?.[key], 9999); });
    Object.keys(w.stats).forEach(key => { w.stats[key] = num(saved.stats?.[key]); });
    const current = counters(this), baseline = value => Object.fromEntries(Object.keys(current).map(key => [key, Math.min(current[key], num(value?.[key]))]));
    w.story.step = num(saved.story?.step, 24); w.story.baseline = baseline(saved.story?.baseline);
    w.story.choices = Array.from({length: Math.floor(w.story.step / 4)}, (_, i) => saved.story?.choices?.[i] === 1 ? 1 : 0);
    w.festival = {cycle: num(saved.festival?.cycle, 10000), points: num(saved.festival?.points), claimed: []};
    if (Array.isArray(saved.festival?.claimed)) for (let i = 0; i < 2 && saved.festival.claimed.includes(i); i++) w.festival.claimed.push(i);
    if (typeof saved.daily?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(saved.daily.date)) {
      w.daily = {date: saved.daily.date, baseline: baseline(saved.daily.baseline), claimed: Array.isArray(saved.daily.claimed) ? [...new Set(saved.daily.claimed.filter(i => Number.isInteger(i) && i >= 0 && i < 3))] : []};
    }
    const cleared = Array.isArray(saved.puzzle?.cleared) ? saved.puzzle.cleared : [];
    for (let i = 1; i <= 20 && cleared.includes(i); i++) w.puzzle.cleared.push(i);
    const active = saved.puzzle?.active;
    if (active && active.revision === RESCUE_RULES.version && Number.isInteger(active.level) && active.level >= 1 && active.level <= Math.min(20, w.puzzle.cleared.length + 1)) {
      const def = makePuzzle(active.level);
      if (Array.isArray(active.board) && active.board.length === 16 && active.board.every((value, i) =>
          Number.isInteger(value) && (def.board[i] === -1 ? value === -1 : value >= 0 && value <= def.target)) &&
          active.board.reduce((sum, v) => sum + (v > 0 ? 2 ** (v - 1) : 0), 0) === 2 ** (def.target - 1)) {
        w.puzzle.active = {level: active.level, revision: RESCUE_RULES.version, board: active.board.slice(), target: def.target, goal: def.goal, limit: def.limit, moves: num(active.moves, def.limit),
          won: active.board[def.goal] === def.target && active.board.filter(v => v > 0).length === 1};
      } else this.lastSaveRecovered = true;
    }
    w.unlockedDecorations = ['spring', ...(Array.isArray(saved.unlockedDecorations) ? saved.unlockedDecorations.filter(style => ['sunset', 'starlight'].includes(style)) : [])];
    w.unlockedDecorations = [...new Set(w.unlockedDecorations)]; w.decoration = w.unlockedDecorations.includes(saved.decoration) ? saved.decoration : 'spring';
    w.tutorial = num(saved.tutorial, 3); w.energyAt = Math.min(now, num(saved.energyAt, Number.MAX_SAFE_INTEGER) || now); w.incomeAt = Math.min(now, num(saved.incomeAt, Number.MAX_SAFE_INTEGER) || now);
    // A damaged unlock state must not leave unreachable wishes on the board.
    const chains = this.availableChains().map(chain => chain.id);
    if (this.orders.some(order => order.requirements.some(item => !chains.includes(item.chainId)))) { this.orders = []; this.fillOrders(); }
  }
}
module.exports = ZooModel;
