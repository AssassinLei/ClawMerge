const test = require('node:test');
const assert = require('node:assert/strict');
const GameModel = require('../js/merge/model');
const { CONFIG, getItem } = require('../js/merge/config');
const finalLevel = CONFIG.chains[0].levels.length;
const item = (level = 1, chainId = 'friends') => ({ chainId, level });
const empty = () => { const model = new GameModel(null, () => 0.5); model.board.fill(null); return model; };
const value = model => model.board.reduce((sum, item) => sum + (item ? 2 ** (item.level - 1) : 0), 0);

test('initial game has 49 cells, 100 energy and three achievable orders', () => {
  const model = new GameModel();
  assert.equal(model.board.length, 49); assert.equal(model.energy, 100); assert.equal(model.orders.length, 3);
  assert(model.orders.every(order => model.validOrder(order)));
});
test('producer creates base item and charges exactly one energy', () => {
  const model = empty(); const result = model.produce();
  assert(result.ok); assert.deepEqual(model.board[result.index], item()); assert.equal(model.energy, 99);
});
test('full board, missing producer and zero energy leave state unchanged', () => {
  const model = empty(); model.board.fill(item()); let before = model.snapshot();
  assert.equal(model.produce().reason, 'full'); assert.deepEqual(model.snapshot(), before);
  model.board[0] = null; model.energy = 0; before = model.snapshot();
  assert.equal(model.produce().reason, 'energy'); assert.deepEqual(model.snapshot(), before);
  assert.equal(model.produce('bad').reason, 'unknown-producer'); assert.deepEqual(model.snapshot(), before);
});
test('every tier merges two to one, preserves base value and unlocks next tier', () => {
  for (let level = 1; level < finalLevel; level++) {
    const model = empty(); model.board[0] = item(level); model.board[1] = item(level);
    const before = value(model); const result = model.move(0, 1);
    assert.equal(result.kind, 'merge'); assert.equal(model.board[0], null); assert.deepEqual(model.board[1], item(level + 1));
    assert.equal(value(model), before); assert.equal(model.merges, 1); assert.equal(model.discovered.friends, Math.max(2, level + 1));
  }
});
test('128 base items merge on a 49-cell board into exactly one eighth-tier bird', () => {
  const model = empty(), baseCount = 2 ** (finalLevel - 1);
  for (let produced = 0; produced < baseCount; produced++) {
    model.refillEnergy(); assert(model.produce().ok);
    for (let level = 1; level < finalLevel; level++) {
      const indices = model.board.map((v, i) => v && v.level === level ? i : -1).filter(i => i >= 0);
      if (indices.length >= 2) assert(model.move(indices[0], indices[1]).ok);
    }
    assert.equal(value(model), produced + 1);
  }
  assert.deepEqual(model.board.filter(Boolean), [item(finalLevel)]);
  assert.equal(getItem(model.board.find(Boolean)).id, 'bird'); assert.equal(model.merges, baseCount - 1);
});
test('moving and swapping never destroy items; invalid drops and final tiers do nothing', () => {
  const model = empty(); model.board[0] = item(); model.board[1] = item(2);
  assert.equal(model.move(0, 1).kind, 'swap'); assert.deepEqual(model.board[0], item(2));
  assert.equal(model.move(1, 4).kind, 'move'); assert.equal(model.board[1], null); assert.equal(value(model), 3);
  for (const [from, to] of [[-1, 0], [0, 49], [0, 0], [2, 0]]) { const before = model.snapshot(); assert(!model.move(from, to).ok); assert.deepEqual(model.snapshot(), before); }
  model.board[0] = item(finalLevel); model.board[1] = item(finalLevel); const before = model.snapshot();
  assert.equal(model.move(0, 1).reason, 'max'); assert.deepEqual(model.snapshot(), before);
});
test('order needs exact levels and consumes exact quantity, then replaces once', () => {
  const model = empty(); model.orders[0] = model.makeOrder({ requirements: [{ chainId: 'friends', level: 2, quantity: 2 }] });
  const order = model.orders[0]; model.board[0] = item(3); model.board[1] = item(2);
  const before = model.snapshot(); assert.equal(model.submit(order.id).reason, 'not-ready'); assert.deepEqual(model.snapshot(), before);
  model.board[2] = item(2); model.board[3] = item(2);
  const result = model.submit(order.id); assert(result.ok); assert.equal(model.coins, 40); assert.equal(model.completed, 1);
  assert.deepEqual(model.board[0], item(3)); assert.equal(model.board.filter(v => v && v.level === 2).length, 1); assert.equal(model.orders.length, 3);
  assert.equal(model.submit(order.id).reason, 'missing-order'); assert.equal(model.coins, 40);
});
test('snapshot is independent and restores board, counters, orders, and discoveries', () => {
  const model = empty(); model.produce(); model.coins = 99; model.discovered.friends = 5;
  const saved = model.snapshot(), restored = new GameModel(saved);
  assert.deepEqual(restored.snapshot(), saved); saved.board.find(Boolean).level = 4; saved.orders[0].requirements[0].level = 5;
  assert.equal(model.board.find(Boolean).level, 1); assert.notEqual(model.orders[0].requirements[0].level, 5);
});
test('invalid saves recover; forged rewards, duplicate IDs and invalid items are sanitized', () => {
  for (const saved of [{ version: 9, board: [] }, 'bad', { version: 1, board: [] }]) {
    const model = new GameModel(saved); assert(model.lastSaveRecovered); assert.equal(model.energy, 100);
  }
  const saved = new GameModel().snapshot(); saved.board[0] = item(99); saved.energy = -5; saved.coins = NaN;
  saved.orders[0].reward = 999999; saved.orders[1].id = saved.orders[0].id;
  const restored = new GameModel(saved); assert.equal(restored.board[0], null); assert.equal(restored.energy, 100); assert.equal(restored.coins, 0);
  assert.equal(restored.orders[0].reward, new GameModel().orders[0].reward); assert.equal(new Set(restored.orders.map(o => o.id)).size, 3);
});
test('orders remain reachable, unique IDs keep increasing, and randomness edge values work', () => {
  for (const random of [() => 0, () => 1, () => NaN]) {
    const model = empty(); model.random = random; model.discovered.friends = 5;
    for (let i = 0; i < 100; i++) {
      const order = model.orders[0]; assert(model.validOrder(order));
      model.board.fill(null); let cursor = 0;
      order.requirements.forEach(requirement => { for (let j = 0; j < requirement.quantity; j++) model.board[cursor++] = item(requirement.level, requirement.chainId); });
      assert(model.submit(order.id).ok); assert.equal(new Set(model.orders.map(o => o.id)).size, 3);
    }
  }
});
test('new chains are supported through config without changing game rules', () => {
  CONFIG.chains.push({ id: 'flowers', name: '花园', levels: [{ id: 'seed', name: '种子', reward: 3 }, { id: 'bud', name: '花苞', reward: 9 }] });
  CONFIG.producers.push({ id: 'garden', name: '花园小窝', energyCost: 2, outputs: [{ chainId: 'flowers', level: 1, weight: 1 }] });
  try {
    const model = empty(); assert(model.produce('garden').ok); assert.equal(model.energy, 98);
    model.board.fill(null); model.board[0] = item(1, 'flowers'); model.board[1] = item(1, 'flowers'); assert.equal(model.move(0, 1).kind, 'merge'); assert.deepEqual(model.board[1], item(2, 'flowers'));
    model.orders[0] = model.makeOrder({ requirements: [{ chainId: 'flowers', level: 2, quantity: 1 }] }); assert.equal(model.submit(model.orders[0].id).reward, 9);
    model.board[0] = item(1, 'flowers'); model.board[1] = item(1); assert.equal(model.move(0, 1).kind, 'swap');
  } finally { CONFIG.chains.pop(); CONFIG.producers.pop(); }
});
test('discard and free refill allow recovery from a full board without altering coins', () => {
  const model = empty(); model.board.fill(item()); model.energy = 0;
  assert(model.discard(0)); assert(!model.discard(0)); model.refillEnergy(); assert(model.produce().ok); assert.equal(model.energy, 99); assert.equal(model.coins, 0);
});
