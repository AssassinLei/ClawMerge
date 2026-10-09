const test = require('node:test');
const assert = require('node:assert/strict');
const GameModel = require('../js/merge/model');
const { CONFIG } = require('../js/merge/config');
const item = level => ({ chainId: 'friends', level });
const empty = () => { const m = new GameModel(null, () => 0.5); m.board.fill(null); return m; };
function seeded(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

test('producer has exact 65/20/10/5 percent buckets, including boundaries, for one energy', () => {
  const m = empty();
  for (const [roll, level] of [[0, 1], [0.649999, 1], [0.65, 2], [0.849999, 2], [0.85, 3], [0.949999, 3], [0.95, 4], [0.999999, 4]]) {
    m.board.fill(null); m.energy = 1; m.combo = 3;
    const draws = [0.5, roll]; m.random = () => draws.shift();
    const result = m.produce(); assert(result.ok); assert.equal(result.item.level, level);
    assert.equal(m.board.filter(Boolean).length, 1); assert.equal(m.board[result.index].level, level);
    assert.equal(m.energy, 0); assert.equal(m.combo, 0); assert(m.discovered.friends >= level);
    assert.equal(m.produce().reason, 'energy');
  }
});

test('uniform draws yield precisely 6500/2000/1000/500 outputs without dependence on position', () => {
  const m = empty(), counts = [0, 0, 0, 0];
  for (let i = 0; i < 10000; i++) {
    m.board.fill(null); m.energy = 1;
    const draws = [i % 2 ? 0 : 0.999999, (i + 0.5) / 10000]; m.random = () => draws.shift();
    const result = m.produce(); assert(result.ok); counts[result.item.level - 1]++;
    assert.equal(result.index, i % 2 ? 0 : 48); assert.equal(m.energy, 0);
  }
  assert.deepEqual(counts, [6500, 2000, 1000, 500]);
});

test('new game fills exactly 22 base and 10 second-tier items at randomized positions', () => {
  const a = new GameModel(null, seeded(1)), b = new GameModel(null, seeded(2));
  assert.equal(a.board.filter(Boolean).length, 32); assert.equal(a.board.filter(v => v && v.level === 1).length, 22);
  assert.equal(a.board.filter(v => v && v.level === 2).length, 10); assert.notDeepEqual(a.board, b.board);
  assert(a.orders.every(order => !a.orderReady(order))); assert(a.orders.every(order => order.requirements.length === 2));
});
test('producer samples any empty position without overwriting an existing item', () => {
  const m = empty(); m.board.fill(item(3)); m.board[3] = null; m.board[40] = null;
  m.random = () => 0.999; assert.equal(m.produce().index, 40); assert.deepEqual(m.board[3], null);
  m.random = () => 0; assert.equal(m.produce().index, 3); assert.equal(m.board.filter(v => v.level === 3).length, 47);
});
test('partially fulfilled bundle is atomic; submission consumes exact quantities of every component', () => {
  const m = empty(); m.orders[0] = m.makeOrder({ requirements: [{ ...item(3), quantity: 2 }, { ...item(2), quantity: 1 }] });
  const order = m.orders[0]; m.board[0] = item(3); m.board[1] = item(3); m.board[2] = item(4);
  const before = m.snapshot(); assert(!m.submit(order.id).ok); assert.deepEqual(m.snapshot(), before);
  m.board[3] = item(2); m.board[4] = item(3);
  const result = m.submit(order.id); assert(result.ok); assert.equal(m.coins, order.reward);
  assert.deepEqual(m.board.filter(Boolean), [item(4), item(3)]); assert.equal(m.orders.length, 3);
});
test('combo rewards start at three merges, allow rearrangement, and end on successful production', () => {
  const m = empty(); for (let i = 0; i < 8; i++) m.board[i] = item(1);
  assert.equal(m.move(0, 1).bonus, 0); assert.equal(m.move(2, 3).bonus, 0);
  m.move(1, 20); assert.equal(m.combo, 2);
  assert.equal(m.move(4, 5).bonus, 2); assert.equal(m.move(6, 7).bonus, 3);
  assert.equal(m.coins, 5); assert.equal(m.bestCombo, 4); assert.equal(m.combo, 4);
  m.produce(); assert.equal(m.combo, 0); assert.equal(m.bestCombo, 4);
});
test('failed production cannot break a combo or consume energy', () => {
  const m = empty(); m.combo = 5; m.board.fill(item(1)); const before = m.snapshot();
  assert.equal(m.produce().reason, 'full'); assert.deepEqual(m.snapshot(), before);
});
test('every five deliveries advance a chapter once and award its bonus', () => {
  const m = empty(); m.completed = 4; m.orders[0] = m.makeOrder({ requirements: [{ ...item(2), quantity: 1 }] });
  const old = m.orders[0]; m.board[0] = item(2); const result = m.submit(old.id);
  assert(result.chapterUp); assert.equal(m.chapter(), 2); assert.equal(result.chapterBonus, 75); assert.equal(m.coins, old.reward + 75);
  assert.equal(m.submit(old.id).reason, 'missing-order');
  m.orders[0] = m.makeOrder({ requirements: [{ ...item(2), quantity: 1 }] }); m.board[0] = item(2);
  assert.equal(m.submit(m.orders[0].id).chapterBonus, 0);
});
test('chapters increase quantities and gradually raise challenges from rabbit to the final bird', () => {
  const m = empty(); m.random = () => 0; m.orders = [];
  const easy = m.generateOrder(0), firstChallenge = m.generateOrder(2); assert.equal(firstChallenge.requirements[0].level, 5);
  m.completed = 15; const normal = m.generateOrder(0), challenge = m.generateOrder(2);
  assert(m.isEasyOrder(normal)); assert.equal(normal.requirements[0].quantity, easy.requirements[0].quantity);
  assert(challenge.requirements[0].quantity > firstChallenge.requirements[0].quantity);
  assert.equal(challenge.requirements[0].level, 8); assert.equal(challenge.kind, 'challenge'); assert(m.validOrder(challenge));
});

test('all eight roles have the specified order; normal orders follow newly unlocked higher tiers', () => {
  assert.deepEqual(CONFIG.chains[0].levels.map(role => role.name), ['哈巴狗', '水豚噜噜', '月薪猫', '肥嘟嘟', '懵兔', '耳朵龙', '黄油小熊', '爪爪鸟']);
  const m = empty(); m.random = () => 0.999;
  m.orders = [m.makeOrder({requirements: [{...item(1), quantity: 1}]})];
  for (let discovered = 3; discovered <= 8; discovered++) {
    m.discovered.friends = discovered;
    const normal = m.generateOrder(0), challenge = m.generateOrder(2);
    assert.equal(normal.requirements[0].level, Math.min(7, discovered + 1));
    assert.equal(challenge.requirements[0].level, Math.min(8, Math.max(5, discovered + 1)));
    assert(m.validOrder(normal)); assert(m.validOrder(challenge));
  }
  m.board[0] = item(8); m.board[1] = item(7);
  m.orders = [m.makeOrder({kind: 'challenge', requirements: [{...item(8), quantity: 1}, {...item(7), quantity: 1}]})];
  assert(m.submit(m.orders[0].id).ok); assert(m.coins > 4000); assert.equal(m.board.filter(Boolean).length, 0);
});
test('refresh spends coins exactly once and changes requirements, leaving other orders intact', () => {
  const m = empty(); const id = m.orders[2].id, before = m.snapshot();
  assert.equal(m.refreshOrder(id).reason, 'coins'); assert.deepEqual(m.snapshot(), before);
  m.coins = 100; const oldSignature = m.signature(m.orders[2]); const others = m.orders.slice(0, 2);
  assert(m.refreshOrder(id).ok); assert.equal(m.coins, 70); assert.notEqual(m.signature(m.orders[2]), oldSignature);
  assert.deepEqual(m.orders.slice(0, 2), others); assert.equal(m.refreshOrder(id).reason, 'missing-order'); assert.equal(m.coins, 70);
});

test('late-game normal orders mix 60 percent easy, 30 percent medium and 10 percent advanced', () => {
  const m = empty(); m.completed = 25; m.discovered.friends = 8;
  m.orders = [m.makeOrder({requirements: [{...item(1), quantity: 1}]})];
  const counts = [0, 0, 0];
  for (let i = 0; i < 1000; i++) {
    const draws = [(i + 0.5) / 1000, 0.5]; m.random = () => draws.shift();
    const order = m.generateOrder(1), level = order.requirements[0].level;
    counts[level <= 3 ? 0 : level <= 5 ? 1 : 2]++;
    assert(m.validOrder(order));
    if (level <= 3) { assert(m.isEasyOrder(order)); assert.equal(order.requirements.length, 1); assert(order.requirements[0].quantity <= 2); }
    assert.notEqual(m.signature(order), m.signature(m.orders[0]));
  }
  assert.deepEqual(counts, [600, 300, 100]);
  for (const [roll, group] of [[0.599999, 0], [0.6, 1], [0.899999, 1], [0.9, 2]]) {
    const draws = [roll, 0.5]; m.random = () => draws.shift();
    const level = m.generateOrder(1).requirements[0].level;
    assert.equal(level <= 3 ? 0 : level <= 5 ? 1 : 2, group);
  }
});

test('refreshing an all-hard board adds an easy order and preserves cost, other slots and save', () => {
  const m = empty(); m.completed = 25; m.discovered.friends = 8; m.coins = 1000; m.random = () => 0.999;
  m.orders = [6, 7, 8].map((level, slot) => m.makeOrder({kind: slot === 2 ? 'challenge' : 'normal', requirements: [{...item(level), quantity: 3}]}));
  const original = m.snapshot(), result = m.refreshOrder(m.orders[0].id);
  assert(result.ok); assert.equal(result.cost, 60); assert.equal(m.coins, 940); assert(m.isEasyOrder(m.orders[0]));
  assert.deepEqual(m.orders.slice(1), original.orders.slice(1));
  assert.deepEqual(new GameModel(m.snapshot()).snapshot(), m.snapshot());
});

test('refreshing the only easy order keeps it easy, changes its requirements and remains atomic', () => {
  const m = empty(); m.completed = 25; m.discovered.friends = 8; m.coins = 10000; m.random = () => 0.999;
  m.orders = [m.makeOrder({requirements: [{...item(2), quantity: 1}]}), m.makeOrder({requirements: [{...item(7), quantity: 3}]}), m.generateOrder(2)];
  const otherOrders = m.orders.slice(1);
  for (let i = 0; i < 30; i++) {
    const previous = m.orders[0], coins = m.coins;
    assert(m.refreshOrder(previous.id).ok); assert(m.isEasyOrder(m.orders[0]));
    assert.notEqual(m.signature(m.orders[0]), m.signature(previous));
    assert.equal(m.coins, coins - 60); assert.deepEqual(m.orders.slice(1), otherOrders);
  }
  m.coins = 0; const before = m.snapshot();
  assert.equal(m.refreshOrder(m.orders[0].id).reason, 'coins'); assert.deepEqual(m.snapshot(), before);
});

test('delivering the last easy order replaces it with an easy one even at the highest chapter', () => {
  for (const random of [() => 0, () => 0.999, () => NaN]) {
    const m = empty(); m.completed = 25; m.discovered.friends = 8; m.random = random;
    m.orders = [m.makeOrder({requirements: [{...item(3), quantity: 1}]}), m.makeOrder({requirements: [{...item(7), quantity: 3}]}), m.generateOrder(2)];
    const others = m.orders.slice(1), previous = m.orders[0]; m.board[0] = item(3);
    const result = m.submit(previous.id); assert(result.ok); assert.equal(result.reward, previous.reward);
    assert(m.isEasyOrder(m.orders[0])); assert.deepEqual(m.orders.slice(1), others); assert.equal(m.board[0], null);
  }
});
test('current save preserves combos and muted preference; restarting does not re-enable sound', () => {
  const m = empty(); m.merges = 9; m.combo = 4; m.bestCombo = 7; m.soundEnabled = false;
  const restored = new GameModel(m.snapshot()); assert.equal(restored.combo, 4); assert.equal(restored.bestCombo, 7); assert(!restored.soundEnabled);
  restored.reset(); assert(!restored.soundEnabled); assert.equal(restored.combo, 0);
});
test('duplicate bundle components and unreachable requirements are rejected on restore', () => {
  const m = empty(), saved = m.snapshot(); saved.orders[0].requirements[1] = Object.assign({}, saved.orders[0].requirements[0]);
  saved.orders[1].requirements[0].chainId = 'unknown';
  const restored = new GameModel(saved); assert(restored.lastSaveRecovered); assert(restored.orders.every(order => restored.validOrder(order)));
  assert.equal(new Set(restored.orders.map(order => order.id)).size, CONFIG.orderSlots);
});
