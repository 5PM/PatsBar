const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('artifacts', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text()); });
    page.on('response', response => {
      // The existing app has no favicon; track real game-resource failures separately.
      if (response.status() >= 400 && new URL(response.url()).pathname !== '/favicon.ico') errors.push(`${response.status()} ${response.url()}`);
    });
    const url = process.env.PATS_BAR_URL || 'http://127.0.0.1:5173';
    const ready = () => page.waitForFunction(() => window.__patsBar?.view.skinPreviews.size === 6);
    const earn = (count, mode) => page.evaluate(({ count, mode }) => {
      const g = window.__patsBar.game, idle = { x: 0, z: 0, aim: { x: 0, z: 0 }, fire: false, dodge: false };
      for (let i = 0; i < count; i++) {
        g.start(mode); g.round = mode === 'normal' ? 3 : 9; g.encounter = 'boss'; g.nextSpawn = 999;
        g.spawn('boss', { x: 10, z: -5 }).hp = 0;
        if (mode === 'endless') g.spawn('bottle', { x: 10, z: 5 });
        g.step(.01, idle);
        if (mode === 'endless') { g.player.invulnerable = 0; g.damage(10000); }
      }
    }, { count, mode });
    await page.goto(url); await ready();
    assert.equal(await page.locator('#token-balance').textContent(), '0');
    for (const [width, height] of [[1440, 900], [900, 650]]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `artifacts/skins-title-${width}.png` });
      assert.ok(await page.locator('[data-action=shop]').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    }
    await page.locator('[data-action=shop]').click();
    assert.equal(await page.locator('.skin-card').count(), 6);
    assert.equal(await page.locator('[data-buy-skin=blue]').isDisabled(), true);
    await page.locator('[data-buy-skin=blue]').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.__patsBar.profile.tokens), 0);
    assert.equal(await page.evaluate(() => window.__patsBar.profile.owns('blue')), false);
    for (const [width, height] of [[1440, 900], [900, 650]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.shop-modal').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: `artifacts/skin-shop-${width}.png` });
      await page.locator('[data-skin=tshirt]').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/skin-shop-bottom-${width}.png` });
      assert.ok(await page.locator('.shop-modal').evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1; }));
    }
    // Inspect actual rendered thumbnails: alpha backgrounds, unchanged face, distinct hoodie colors.
    const pixels = await page.evaluate(async () => {
      const { view } = window.__patsBar, data = {};
      for (const [id, src] of view.skinPreviews) {
        const img = new Image(); img.src = src; await img.decode();
        const canvas = document.createElement('canvas'); canvas.width = 192; canvas.height = 288;
        const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); data[id] = ctx.getImageData(0, 0, 192, 288).data;
      }
      const at = (id, x, y) => [...data[id].slice((y * 192 + x) * 4, (y * 192 + x) * 4 + 4)];
      let changedFacePixels = 0;
      for (const id of ['blue', 'purple', 'black', 'gold']) for (let y = 7; y < 38; y++) for (let x = 75; x < 115; x++) {
        const offset = (y * 192 + x) * 4;
        if (data[id].slice(offset, offset + 4).some((v, c) => Math.abs(v - data.classic[offset + c]) > 1)) changedFacePixels++;
      }
      return { corners: Object.keys(data).map(id => at(id, 0, 0)[3]), shirtColors: ['classic', 'blue', 'purple', 'black', 'gold'].map(id => at(id, 94, 110).join(',')), changedFacePixels, tshirtOpaque: at('tshirt', 96, 100)[3] };
    });
    assert.deepEqual(pixels.corners, [0, 0, 0, 0, 0, 0]); assert.equal(pixels.changedFacePixels, 0);
    assert.equal(new Set(pixels.shirtColors).size, 5); assert.equal(pixels.tshirtOpaque, 255);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__patsBar.game.mode === 'title');
    await earn(30, 'normal');
    await page.waitForFunction(() => document.querySelector('#token-balance').textContent === '30');
    await page.locator('[data-action=shop]').click();
    await page.locator('[data-buy-skin=blue]').click();
    await page.waitForFunction(() => window.__patsBar.profile.equippedSkin === 'blue');
    assert.equal(await page.evaluate(() => window.__patsBar.profile.tokens), 0);
    await page.locator('[data-equip-skin=blue]').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.__patsBar.profile.tokens), 0);
    await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__patsBar.game.mode === 'victory');
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => window.__patsBar.profile.equippedSkin), 'blue');
    await page.waitForFunction(() => window.__patsBar.view.activeSkin === 'blue');
    await earn(50, 'endless');
    await page.waitForFunction(() => document.querySelector('#token-balance').textContent === '50');
    assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'defeat');
    await page.locator('[data-action=shop]').click();
    await page.locator('[data-buy-skin=tshirt]').click();
    await page.waitForFunction(() => window.__patsBar.profile.equippedSkin === 'tshirt');
    assert.equal(await page.evaluate(() => window.__patsBar.profile.tokens), 0);
    await page.keyboard.press('Escape'); await page.locator('[data-action=start]').click();
    await page.waitForFunction(() => window.__patsBar.game.mode === 'playing' && window.__patsBar.view.activeSkin === 'tshirt');
    assert.equal(await page.evaluate(() => window.__patsBar.game.player.maxHp), 100);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'artifacts/tshirt-gameplay.png' });
    await page.keyboard.press('Space'); await page.waitForFunction(() => window.__patsBar.game.player.dodge > 0);
    await page.mouse.move(900, 350); await page.mouse.down(); await page.waitForTimeout(200); await page.mouse.up();
    assert.ok(await page.evaluate(() => window.__patsBar.game.shots) > 0);
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => window.__patsBar.profile.equippedSkin), 'tshirt');
    await page.locator('[data-action=shop]').click(); await page.locator('[data-equip-skin=classic]').click();
    assert.equal(await page.evaluate(() => window.__patsBar.profile.equippedSkin), 'classic');
    assert.equal(await page.evaluate(() => window.__patsBar.profile.tokens), 0);
    // Corrupted saves recover without breaking startup.
    await page.evaluate(() => localStorage.setItem('pats-bar.profile.v1', '{broken'));
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => window.__patsBar.profile.tokens), 0);
    assert.equal(await page.evaluate(() => window.__patsBar.profile.equippedSkin), 'classic');
    assert.deepEqual(errors, []);
    console.log('Skin shop browser QA passed: 1 token per boss in both modes, 30/50 pricing, purchase/equip/reload, reset persistence, no stat bonuses, transparent previews, unchanged faces, responsive shop and T-Shirt Owen gameplay.');
    await context.close();
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
