const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');
const createServer = require('../preview/server');

(async () => {
  const server = createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try { browser = await chromium.launch({ headless: true, channel: process.argv[3] || 'msedge' }); }
  catch (error) { server.close(); throw error; }
  const output = path.resolve(__dirname, '../preview/screenshots'); fs.mkdirSync(output, { recursive: true });
  try {
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}/?safeTop=44&safeBottom=34&capsule=1`;
    await page.goto(url); await page.waitForFunction(() => Object.keys(window.mergeGame.view.images).length === 8);
    assert.deepEqual(await page.evaluate(() => mergeGame.view.failedImages), []);
    assert.deepEqual(await page.evaluate(() => Object.keys(mergeGame.view.images).sort()), ['bear', 'bird', 'capybara', 'cat', 'dragon', 'kangaroo', 'pug', 'rabbit']);
    await page.screenshot({ path: path.join(output, 'initial-390.png') });
    assert.equal(await page.evaluate(() => mergeGame.model.board.length), 49);
    assert.equal(await page.evaluate(() => mergeGame.model.board.filter(Boolean).length), 32);
    assert.equal(await page.evaluate(() => mergeGame.model.energy), 100);
    assert.equal(await page.title(), '爪爪动物园 · 本地预览');
    assert.deepEqual(await page.evaluate(() => {
      const view = mergeGame.view, calls = [], original = view.ctx.fillText;
      view.ctx.fillText = (...args) => calls.push(args[0]);
      try { for (let i = 0; i < 49; i++) view.drawCell(mergeGame.model, mergeGame.ui, i, Date.now()); }
      finally { view.ctx.fillText = original; }
      return calls;
    }), []);
    assert(await page.evaluate(() => { const v = mergeGame.view, p = v.producerRects[0], o = v.orderRects[0]; return p.x < o.x && p.y === o.y && p.w === o.w && p.h === o.h; }));
    // Deterministic board only for interaction assertions; the actual new game is randomized.
    await page.evaluate(() => { const m = mergeGame.model; m.board.fill(null); m.board[14] = { chainId: 'friends', level: 1 }; m.board[15] = { chainId: 'friends', level: 1 }; m.board[20] = { chainId: 'friends', level: 2 }; m.orders[1] = m.makeOrder({ requirements: [{ chainId: 'friends', level: 3, quantity: 1 }] }); });
    const cell = async index => page.evaluate(index => { const v = mergeGame.view, r = v.cellRect(index); return { x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h / 2) * v.scale }; }, index);
    const drag = async (from, to) => { const a = await cell(from), b = typeof to === 'number' ? await cell(to) : to; await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); };
    await drag(14, 15); assert.equal(await page.evaluate(() => mergeGame.model.board[15].level), 2);
    await drag(15, 20); assert.equal(await page.evaluate(() => mergeGame.model.board[20].level), 3);
    const order = await page.evaluate(() => { const v = mergeGame.view, r = v.orderRects[1]; return { x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h - 12) * v.scale }; });
    await page.mouse.click(order.x, order.y); assert.equal(await page.evaluate(() => mergeGame.model.coins), 48);
    await page.mouse.click(order.x, order.y); assert.equal(await page.evaluate(() => mergeGame.model.coins), 48);
    const producer = await page.evaluate(() => { const v = mergeGame.view, r = v.producerRects[0]; return { x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h / 2) * v.scale }; });
    await page.evaluate(() => { mergeGame.model.random = () => 0.5; });
    await page.mouse.click(producer.x, producer.y); await page.mouse.click(producer.x, producer.y);
    assert.equal(await page.evaluate(() => mergeGame.model.energy), 98);
    const indices = await page.evaluate(() => mergeGame.model.board.map((item, index) => item ? index : -1).filter(index => index >= 0));
    const activeIndex = indices[1];
    let a = await cell(indices[0]), b = await cell(activeIndex); await page.mouse.click(a.x, a.y); await page.mouse.click(b.x, b.y);
    assert.equal(await page.evaluate(index => mergeGame.model.board[index].level, activeIndex), 2);
    for (const [roll, level] of [[0.7, 2], [0.9, 3], [0.97, 4]]) {
      const previous = await page.evaluate(() => ({energy: mergeGame.model.energy, cells: mergeGame.model.board.map(item => item && item.level)}));
      await page.evaluate(roll => { const draws = [0.5, roll]; mergeGame.model.random = () => draws.shift(); }, roll);
      await page.mouse.click(producer.x, producer.y);
      const after = await page.evaluate(() => ({energy: mergeGame.model.energy, cells: mergeGame.model.board.map(item => item && item.level), discovered: mergeGame.model.discovered.friends}));
      assert.equal(after.energy, previous.energy - 1); assert(after.discovered >= level);
      assert.deepEqual(after.cells.filter((value, i) => value !== previous.cells[i]), [level]);
    }
    await page.evaluate(() => { mergeGame.model.random = Math.random; });
    for (const name of ['merge.wav', 'spawn.wav', 'order.wav']) assert(await page.evaluate(name => previewAudioPlays.includes(name), name), 'Missing effect: ' + name);
    const decodedAudio = await page.evaluate(async () => {
      const audioContext = new AudioContext();
      const results = await Promise.all(['spawn', 'move', 'merge', 'combo', 'order', 'chapter', 'error'].map(async name => {
        const response = await fetch('/sounds/' + name + '.wav');
        const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
        return { name, ok: response.ok, channels: buffer.numberOfChannels, duration: buffer.duration };
      }));
      await audioContext.close(); return results;
    });
    assert(decodedAudio.every(result => result.ok && result.channels === 1 && result.duration > 0 && result.duration < 1));
    const before = await page.evaluate(() => mergeGame.model.snapshot()); await drag(activeIndex, { x: 2, y: 2 });
    assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), before);
    await page.reload(); await page.waitForFunction(() => Object.keys(mergeGame.view.images).length === 8);
    assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), before);
    // Cancelled touch leaves source intact and clears dragging visuals.
    await page.evaluate(index => { const v = mergeGame.view, r = v.cellRect(index), touch = { clientX: (r.x + 10) * v.scale, clientY: (r.y + 10) * v.scale }; mergeGame.touchStart({ touches: [touch] }); mergeGame.touchMove({ touches: [{ clientX: touch.clientX + 20, clientY: touch.clientY + 20 }] }); }, activeIndex);
    await page.evaluate(() => document.querySelector('canvas').dispatchEvent(new PointerEvent('pointercancel')));
    assert.equal(await page.evaluate(() => mergeGame.ui.drag), null);
    assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), before);
    // Cancelling a pressed producer cannot charge energy on a subsequent touchend.
    await page.evaluate(() => {
      const v = mergeGame.view, r = v.producerRects[0], touch = { clientX: (r.x + 30) * v.scale, clientY: (r.y + 30) * v.scale };
      mergeGame.touchStart({ touches: [touch] });
      document.querySelector('canvas').dispatchEvent(new PointerEvent('pointercancel'));
      mergeGame.touchEnd({ changedTouches: [touch] });
    });
    assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), before);
    // Screenshot fixture shows every character without changing a real player's save.
    await page.evaluate(() => { const m = mergeGame.model; m.reset(); [1, 2, 3, 4, 5, 6, 7, 8, 1, 2, 1, 3].forEach((level, index) => { m.board[index + 6] = { chainId: 'friends', level }; }); m.discovered.friends = 8; m.coins = 260; m.completed = 7; m.combo = 4; m.bestCombo = 8; m.merges = 12; mergeGame.ui.selected = -1; mergeGame.ui.toast = null; mergeGame.invalidate(); });
    await page.waitForTimeout(100); await page.screenshot({ path: path.join(output, 'gameplay-390.png') });
    const gallery = await page.evaluate(() => { const v = mergeGame.view, r = v.galleryButton; return { x: (r.x + 20) * v.scale, y: (r.y + 15) * v.scale }; });
    await page.mouse.click(gallery.x, gallery.y); assert.equal(await page.evaluate(() => mergeGame.ui.panel), 'gallery');
    await page.waitForTimeout(80); await page.screenshot({ path: path.join(output, 'gallery-390.png') });
    const galleryLabels = () => page.evaluate(() => {
      const v = mergeGame.view, labels = [], original = v.ctx.fillText;
      v.ctx.fillText = (...args) => { labels.push(args[0]); original.apply(v.ctx, args); };
      try { v.draw(mergeGame.model, mergeGame.ui, Date.now()); } finally { v.ctx.fillText = original; }
      return labels.filter(label => label.includes('Lv.'));
    });
    assert.deepEqual(await galleryLabels(), ['哈巴狗  Lv.1', '水豚噜噜  Lv.2', '月薪猫  Lv.3', '肥嘟嘟  Lv.4', '懵兔  Lv.5']);
    const swipe = async (from, to) => {
      await page.mouse.move(from, 410); await page.mouse.down(); await page.mouse.move(to, 410, {steps: 6}); await page.mouse.up();
    };
    await swipe(300, 90); assert.equal(await page.evaluate(() => mergeGame.ui.galleryPage), 1);
    assert.deepEqual(await galleryLabels(), ['耳朵龙  Lv.6', '黄油小熊  Lv.7', '爪爪鸟  Lv.8']);
    await page.screenshot({path: path.join(output, 'gallery-page2-390.png')});
    await swipe(90, 300); assert.equal(await page.evaluate(() => mergeGame.ui.galleryPage), 0);
    await page.evaluate(() => { mergeGame.ui.panel = 'settings'; mergeGame.invalidate(); });
    await page.waitForTimeout(80); await page.screenshot({ path: path.join(output, 'settings-390.png') });
    // Sound is triggered by real input, and a saved mute setting suppresses subsequent effects.
    const toggleSound = await page.evaluate(() => { const v = mergeGame.view, p = v.panelRect; return { x: 195 * v.scale, y: (p.y + 160) * v.scale }; });
    await page.mouse.click(toggleSound.x, toggleSound.y); assert.equal(await page.evaluate(() => mergeGame.model.soundEnabled), false);
    const plays = await page.evaluate(() => previewAudioPlays.length);
    await page.evaluate(() => { mergeGame.ui.panel = null; mergeGame.invalidate(); });
    await page.mouse.click(producer.x, producer.y); assert.equal(await page.evaluate(() => previewAudioPlays.length), plays);
    await page.reload(); await page.waitForFunction(() => Object.keys(mergeGame.view.images).length === 8);
    assert.equal(await page.evaluate(() => mergeGame.model.soundEnabled), false);
    await page.evaluate(() => { mergeGame.ui.panel = 'settings'; mergeGame.invalidate(); });
    await page.mouse.click(toggleSound.x, toggleSound.y); assert.equal(await page.evaluate(() => mergeGame.model.soundEnabled), true);
    // Refresh has a confirmation and leaves the two other orders alone.
    await page.evaluate(() => { mergeGame.ui.panel = null; mergeGame.ui.toast = null; mergeGame.invalidate(); });
    const refresh = await page.evaluate(() => { const v = mergeGame.view, r = v.refreshRects[2]; return { x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h / 2) * v.scale }; });
    const preRefresh = await page.evaluate(() => mergeGame.model.snapshot());
    page.once('dialog', dialog => dialog.dismiss()); await page.mouse.click(refresh.x, refresh.y); assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), preRefresh);
    page.once('dialog', dialog => dialog.accept()); await page.mouse.click(refresh.x, refresh.y);
    assert.equal(await page.evaluate(() => mergeGame.model.coins), preRefresh.coins - 40);
    assert.notEqual(await page.evaluate(() => mergeGame.model.orders[2].id), preRefresh.orders[2].id);
    assert.deepEqual(await page.evaluate(() => mergeGame.model.orders.slice(0, 2)), preRefresh.orders.slice(0, 2));
    // An existing late-game save with three hard wishes can recover through the actual refresh UI.
    await page.evaluate(() => {
      const m = mergeGame.model; m.completed = 25; m.discovered.friends = 8; m.coins = 500; m.random = () => 0.999;
      m.orders = [6, 7, 8].map((level, slot) => m.makeOrder({kind: slot === 2 ? 'challenge' : 'normal', requirements: [{chainId: 'friends', level, quantity: 3}]}));
      mergeGame.ui.toast = null; mergeGame.invalidate();
    });
    const easyRefresh = await page.evaluate(() => { const v = mergeGame.view, r = v.refreshRects[0]; return {x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h / 2) * v.scale}; });
    const beforeEasy = await page.evaluate(() => mergeGame.model.snapshot());
    page.once('dialog', dialog => dialog.dismiss()); await page.mouse.click(easyRefresh.x, easyRefresh.y);
    assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), beforeEasy);
    page.once('dialog', dialog => dialog.accept()); await page.mouse.click(easyRefresh.x, easyRefresh.y);
    assert(await page.evaluate(() => mergeGame.model.isEasyOrder(mergeGame.model.orders[0])));
    assert.equal(await page.evaluate(() => mergeGame.model.coins), 440);
    assert.deepEqual(await page.evaluate(() => mergeGame.model.orders.slice(1)), beforeEasy.orders.slice(1));
    await page.evaluate(() => { mergeGame.ui.toast = null; mergeGame.invalidate(); });
    await page.waitForTimeout(80); await page.screenshot({path: path.join(output, 'mixed-orders-390.png')});
    await page.evaluate(() => {
      const m = mergeGame.model; m.board.fill(null); let index = 0;
      m.orders[0].requirements.forEach(requirement => { for (let i = 0; i < requirement.quantity; i++) m.board[index++] = {chainId: requirement.chainId, level: requirement.level}; });
      mergeGame.ui.selected = -1; mergeGame.invalidate();
    });
    const easySubmit = await page.evaluate(() => { const v = mergeGame.view, r = v.orderRects[0]; return {x: (r.x + r.w / 2) * v.scale, y: (r.y + r.h - 12) * v.scale}; });
    const easyId = await page.evaluate(() => mergeGame.model.orders[0].id);
    await page.mouse.click(easySubmit.x, easySubmit.y);
    assert.notEqual(await page.evaluate(() => mergeGame.model.orders[0].id), easyId);
    assert(await page.evaluate(() => mergeGame.model.isEasyOrder(mergeGame.model.orders[0])));
    await page.reload(); await page.waitForFunction(() => Object.keys(mergeGame.view.images).length === 8);
    assert(await page.evaluate(() => mergeGame.model.isEasyOrder(mergeGame.model.orders[0])));
    await page.evaluate(() => { mergeGame.ui.panel = 'settings'; mergeGame.invalidate(); });
    // Free refill works through the actual UI and persists.
    await page.evaluate(() => { mergeGame.model.energy = 0; });
    const refill = await page.evaluate(() => { const v = mergeGame.view, p = v.panelRect; return { x: 195 * v.scale, y: (p.y + 207) * v.scale }; });
    await page.mouse.click(refill.x, refill.y); assert.equal(await page.evaluate(() => mergeGame.model.energy), 100);
    // Restart requires confirmation; cancellation cannot destroy progress.
    const reset = await page.evaluate(() => { const v = mergeGame.view, p = v.panelRect; return { x: 195 * v.scale, y: (p.y + 267) * v.scale }; });
    const preReset = await page.evaluate(() => mergeGame.model.snapshot());
    page.once('dialog', dialog => dialog.dismiss()); await page.mouse.click(reset.x, reset.y); assert.deepEqual(await page.evaluate(() => mergeGame.model.snapshot()), preReset);
    page.once('dialog', dialog => dialog.accept()); await page.mouse.click(reset.x, reset.y);
    assert.equal(await page.evaluate(() => mergeGame.model.coins), 0); assert.equal(await page.evaluate(() => mergeGame.model.completed), 0);
    assert.equal(await page.evaluate(() => mergeGame.model.board.filter(Boolean).length), 32);
    assert(await page.evaluate(() => previewAudioPlays.includes('move.wav')));
    await context.close();
    for (const [width, height, safeTop, safeBottom, capsule] of [[320, 568, 20, 0, false], [375, 667, 20, 0, false], [430, 932, 59, 34, true], [360, 640, 24, 0, true]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2 }); const p = await ctx.newPage(); p.on('pageerror', error => errors.push(error.message));
      await p.goto(`http://127.0.0.1:${server.address().port}/?safeTop=${safeTop}&safeBottom=${safeBottom}${capsule ? '&capsule=1' : ''}`);
      await p.waitForFunction(() => Object.keys(mergeGame.view.images).length === 8);
      const layout = await p.evaluate(() => ({ bottom: (mergeGame.view.footerY + 70) * mergeGame.view.scale, height: innerHeight, safeBottom: Number(new URLSearchParams(location.search).get('safeBottom')), cell: mergeGame.view.cell }));
      assert(layout.bottom <= layout.height - layout.safeBottom, `Clipped UI at ${width}x${height}`); assert(layout.cell >= 20);
      await p.screenshot({ path: path.join(output, `initial-${width}.png`) }); await ctx.close();
    }
    assert.deepEqual(errors, []); console.log('PASS: paw zoo title, 100 energy, image-only cells, 7x7, dense random start, producer/order row, merge, bundle UI, orders, production, cancellation, reload, gallery, audio/mute persistence, confirmed refresh/reset, 5 screen sizes, zero JS errors.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
