const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('artifacts', { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.PATS_BAR_URL || 'http://127.0.0.1:5173');
    await page.waitForFunction(() => window.__patsBar?.view.hero);
    await page.locator('[data-run-mode=endless]').click(); await page.locator('[data-action=start]').click();
    // Enter a real boss reward transition while holding the combat click.
    await page.mouse.move(700, 400); await page.mouse.down();
    await page.evaluate(() => {
      const g = window.__patsBar.game; g.random = () => 0;
      for (const id of ['explosive', 'orbit', 'shield', 'trail']) g.superBuffs.add(id);
      g.round = 3; g.encounter = 'boss'; g.enemies = []; g.bullets = []; g.nextSpawn = 999;
      g.spawn('boss', { x: 10, z: -5 }).hp = 0;
    });
    await page.waitForSelector('[data-boss-reward]'); await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-boss-reward]:disabled').count(), 4, 'Held click locks equipment and skip');
    const elapsed = await page.evaluate(() => window.__patsBar.game.elapsed);
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelectorAll('[data-boss-reward]').length === 4 && document.querySelectorAll('[data-boss-reward]:disabled').length === 0);
    assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'bossReward');
    await page.locator('[data-boss-reward=skip]').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'bossReward', 'Skip needs a fresh press');
    await page.locator('[data-boss-reward]').first().dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'bossReward');
    const choices = await page.evaluate(() => [...window.__patsBar.game.bossChoices]);
    assert.equal(new Set(choices).size, 3);
    assert.ok(await page.locator('.gear-comparison').first().textContent().then(t => t.includes('Bottle Caps')));
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => window.__patsBar.game.mode === 'paused');
    await page.locator('[data-action=resume]').click();
    await page.waitForSelector('[data-boss-reward]');
    assert.deepEqual(await page.evaluate(() => window.__patsBar.game.bossChoices), choices);
    assert.equal(await page.evaluate(() => window.__patsBar.game.elapsed), elapsed);
    for (const [width, height] of [[1440, 900], [900, 650]]) {
      await page.setViewportSize({ width, height });
      await page.waitForFunction(() => document.querySelectorAll('[data-boss-reward]').length === 4 && document.querySelectorAll('[data-boss-reward]:disabled').length === 0);
      await page.locator('.upgrade-modal').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: `artifacts/equipment-${width}.png` });
      for (const card of await page.locator('[data-boss-reward]').all()) {
        await card.scrollIntoViewIfNeeded(); assert.equal(await card.isVisible(), true);
      }
      assert.ok(await page.locator('.upgrade-modal').evaluate(el => {
        const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1;
      }));
      await page.locator('.power-inventory').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `artifacts/equipment-inventory-${width}.png` });
    }
    await page.locator('[data-boss-reward=ricochet]').click();
    await page.waitForFunction(() => window.__patsBar.game.mode === 'playing');
    assert.deepEqual(await page.evaluate(() => { const g = window.__patsBar.game; return [g.weapon, g.armor, g.round]; }), ['ricochet', 'none', 4]);
    await page.waitForSelector('.power-inventory', { state: 'detached' });

    // A single pool can show a buff, weapon, and armor together; one click finishes the reward.
    await page.evaluate(() => {
      const g = window.__patsBar.game;
      g.superBuffs.clear(); g.round = 6; g.encounter = 'boss'; g.enemies = []; g.bullets = []; g.nextSpawn = 999;
      g.spawn('boss', { x: 10, z: -5 }).hp = 0;
      const draws = [.1, .55, .85]; g.random = () => draws.shift() ?? .5;
    });
    await page.waitForSelector('[data-boss-reward=explosive]');
    await page.waitForFunction(() => document.querySelector('[data-boss-reward=explosive]')?.disabled === false);
    assert.deepEqual(await page.evaluate(() => window.__patsBar.game.bossChoices), ['explosive', 'shotgun', 'glass']);
    assert.equal(await page.locator('.gear-comparison').count(), 2);
    for (const [width, height] of [[1440, 900], [900, 650]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.upgrade-modal').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: `artifacts/mixed-boss-rewards-${width}.png` });
      assert.ok(await page.locator('.upgrade-modal').evaluate(el => {
        const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth + 1;
      }));
    }
    await page.locator('[data-boss-reward=explosive]').click();
    await page.waitForFunction(() => window.__patsBar.game.mode === 'playing');
    assert.deepEqual(await page.evaluate(() => { const g = window.__patsBar.game; return [g.round, [...g.superBuffs], g.weapon, g.armor, g.bossChoices]; }), [7, ['explosive'], 'ricochet', 'none', []]);
    await page.waitForSelector('[data-boss-reward]', { state: 'detached' });

    // Multiple banked levels must require separate, protected training selections.
    await page.keyboard.down('Enter');
    await page.evaluate(() => {
      const g = window.__patsBar.game;
      Object.assign(g.upgrades, { damage: 5, rate: 5, count: 3, pierce: 3, speed: 4, health: 4, magnet: 4 });
      g.player.maxHp = 200; g.player.hp = 20; g.level = 29; g.xp = 236 + 244 + 252; g.checkLevel();
    });
    await page.waitForSelector('[data-training]'); await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-training]:disabled').count(), 2);
    await page.keyboard.up('Enter');
    await page.waitForFunction(() => document.querySelectorAll('[data-training]').length === 2 && document.querySelectorAll('[data-training]:disabled').length === 0);
    assert.equal(await page.evaluate(() => window.__patsBar.game.training.power), 0);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__patsBar.game.mode === 'paused');
    await page.locator('[data-action=resume]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-training]').length === 2 && document.querySelectorAll('[data-training]:disabled').length === 0);
    await page.locator('[data-training=power]').focus();
    await page.keyboard.down('Enter');
    await page.waitForFunction(() => window.__patsBar.game.level === 32);
    await page.waitForTimeout(300);
    assert.equal(await page.locator('[data-training]:disabled').count(), 2, 'Held key cannot accept the next training level');
    assert.equal(await page.evaluate(() => window.__patsBar.game.training.power), 1);
    await page.keyboard.up('Enter');
    await page.waitForFunction(() => document.querySelectorAll('[data-training]').length === 2 && document.querySelectorAll('[data-training]:disabled').length === 0);
    await page.locator('[data-training=endurance]').dispatchEvent('click');
    assert.equal(await page.evaluate(() => window.__patsBar.game.training.endurance), 0);
    for (const [width, height] of [[1440, 900], [900, 650]]) {
      await page.setViewportSize({ width, height });
      await page.locator('.upgrade-modal').evaluate(el => el.scrollTop = 0);
      await page.screenshot({ path: `artifacts/training-${width}.png` });
      await page.locator('.inventory-item').last().scrollIntoViewIfNeeded();
      await page.locator('.inventory-item').last().focus();
      assert.equal(await page.locator('.inventory-item').last().locator('.inventory-description').isVisible(), true);
      await page.screenshot({ path: `artifacts/training-inventory-${width}.png` });
      assert.ok(await page.locator('.upgrade-modal').evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    }
    const inventory = await page.locator('.power-inventory').textContent();
    assert.ok(inventory.includes('Ricochet Caps') && inventory.includes('Power Training1 STACK') && inventory.includes('Endurance Training0 STACKS'));
    await page.locator('[data-training=endurance]').focus();
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__patsBar.game.mode === 'playing');
    assert.deepEqual(await page.evaluate(() => { const g = window.__patsBar.game; return [g.training, g.player.maxHp, g.player.hp]; }), [{ power: 1, endurance: 1 }, 215, 110]);
    await page.waitForSelector('.power-inventory', { state: 'detached' });

    // Render every projectile at a frozen position to check geometry/color and reset behavior.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      const { game: g, view } = window.__patsBar;
      g.bullets = []; g.enemies = []; g.pickups = []; g.effects = []; g.player.invulnerable = 999;
      for (const [index, weapon] of ['caps', 'ricochet', 'picks', 'shotgun'].entries()) {
        g.weapon = weapon;
        for (let i = 0; i < 8; i++) g.shoot({ x: -7 + index * 4, z: -4 + i }, Math.PI / 4);
      }
      g.shoot({ x: 8, z: 0 }, 0, true);
      g.pause(); view.update(g, { x: 0, z: 0 }, false, 0);
    });
    const projectileVisuals = await page.evaluate(() => {
      const { game, view } = window.__patsBar;
      return ['caps', 'ricochet', 'picks', 'shotgun'].map(weapon => {
        const b = game.bullets.find(b => !b.hostile && b.weapon === weapon), mesh = view.actors.get(b.id);
        return [weapon, mesh.geometry.type, mesh.material.color.getHexString()];
      });
    });
    assert.equal(new Set(projectileVisuals.map(v => v[2])).size, 4);
    assert.equal(projectileVisuals[2][1], 'ConeGeometry'); assert.equal(projectileVisuals[3][1], 'IcosahedronGeometry');
    await page.locator('#overlay').evaluate(el => el.style.visibility = 'hidden');
    await page.screenshot({ path: 'artifacts/equipment-projectiles.png' });
    await page.locator('#overlay').evaluate(el => el.style.visibility = '');
    await page.locator('[data-action=resume]').click();
    await page.evaluate(() => {
      const g = window.__patsBar.game; g.player.invulnerable = 0; g.shieldCooldown = 12; g.damage(10000);
    });
    await page.locator('[data-action=start]').click();
    assert.deepEqual(await page.evaluate(() => { const g = window.__patsBar.game; return [g.runMode, g.weapon, g.armor, g.training, g.bossChoices, g.player.maxHp]; }), ['endless', 'caps', 'none', { power: 0, endurance: 0 }, [], 100]);
    assert.deepEqual(errors, []);
    console.log('Equipment browser QA passed: choices/skip, held mouse/key protection, successive training, pause/blur, slot comparisons, inventory tooltips, 1440×900 and 900×650 layouts, projectile visuals and restart.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
