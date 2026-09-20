const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
fs.mkdirSync('artifacts', { recursive: true });
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.PATS_BAR_URL || 'http://127.0.0.1:5173');
  await page.waitForFunction(() => window.__patsBar?.view.hero);
  await page.screenshot({ path: 'artifacts/title.png' });
  await page.locator('[data-action=start]').click();
  await page.waitForTimeout(250);
  await page.waitForFunction(() => window.__patsBar.audio.context?.state === 'running');
  const audioCheck = await page.evaluate(() => {
    const { game, audio } = window.__patsBar; const ctx = audio.context;
    let played = 0, audible = false;
    const createSource = ctx.createBufferSource.bind(ctx);
    ctx.createBufferSource = () => {
      const source = createSource(); const start = source.start.bind(source);
      source.start = (...args) => { played++; audible = source.buffer.getChannelData(0).some(v => Math.abs(v) > .01); start(...args); };
      return source;
    };
    game.damage(1); game.damage(1); const afterHit = played;
    audio.muted = true; game.player.invulnerable = 0; game.damage(1);
    audio.muted = false; ctx.createBufferSource = createSource;
    return { afterHit, afterMute: played, audible };
  });
  assert.deepEqual(audioCheck, { afterHit: 1, afterMute: 1, audible: true });
  for (const mode of ['normal', 'endless']) {
    await page.evaluate(mode => {
      const g = window.__patsBar.game; g.start(mode); g.waveTime = 44.9; g.nextSpawn = 999;
      g.spawn('bottle', { x: 12, z: -7 }).speed = 0;
    }, mode);
    await page.waitForFunction(() => document.querySelector('#wave-name').textContent === 'Clear the countertop');
    assert.equal(await page.locator('#timer').textContent(), '00:00');
    assert.equal(await page.evaluate(() => window.__patsBar.game.round), 1);
    await page.evaluate(() => { window.__patsBar.game.enemies = []; });
    await page.waitForFunction(() => window.__patsBar.game.round === 2);
    assert.equal(await page.evaluate(() => window.__patsBar.game.difficulty.duration), 45);
  }
  await page.evaluate(() => window.__patsBar.game.start('normal'));
  const startX = await page.evaluate(() => window.__patsBar.game.player.x);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
  assert.ok(await page.evaluate(() => window.__patsBar.game.player.x) > startX);
  await page.mouse.move(900, 350); await page.mouse.down(); await page.waitForTimeout(450); await page.mouse.up();
  assert.ok(await page.evaluate(() => window.__patsBar.game.shots) > 0);
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  assert.ok(await page.evaluate(() => window.__patsBar.game.player.dodge) > 0);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'paused');
  const frozen = await page.evaluate(() => window.__patsBar.game.elapsed); await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.__patsBar.game.elapsed), frozen);
  await page.locator('[data-action=resume]').click();
  // Hold the combat click through level-up and beyond the delay.
  await page.mouse.move(500, 500); await page.mouse.down();
  await page.evaluate(() => { const g = window.__patsBar.game; g.xp = 12; g.checkLevel(); });
  await page.waitForFunction(() => document.querySelectorAll('[data-upgrade]:disabled').length === 3);
  const upgradeTime = await page.evaluate(() => window.__patsBar.game.elapsed);
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-upgrade]:disabled').count(), 3, 'Held combat click must keep upgrades locked');
  assert.equal(await page.evaluate(() => window.__patsBar.game.elapsed), upgradeTime, 'Combat stays paused');
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelectorAll('[data-upgrade]:disabled').length === 0);
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'upgrade', 'Releasing the old click must not select anything');
  // A click without a fresh press must also be rejected.
  await page.locator('[data-upgrade]').first().dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'upgrade');
  assert.ok((await page.locator('.power-inventory').textContent()).includes('No power-ups yet'));
  await page.screenshot({ path: 'artifacts/upgrades.png' }); await page.locator('[data-upgrade]').first().click();
  await page.evaluate(() => { const g = window.__patsBar.game; for (let i = 0; i < 8; i++) g.spawn(i % 3 ? 'olive' : 'bottle', { x: (i - 4) * 2.3, z: -3 + i % 2 * 3 }); });
  await page.waitForTimeout(500); await page.screenshot({ path: 'artifacts/gameplay.png' });
  await page.evaluate(() => { const g = window.__patsBar.game; g.enemies = []; g.bullets = []; g.round = 3; g.encounter = 'boss'; g.bannerTime = 0; const b = g.spawn('boss', { x: 0, z: -4 }); b.phase = 'warning'; b.phaseTime = 10; b.target = { ...g.player }; });
  await page.waitForTimeout(100); await page.screenshot({ path: 'artifacts/boss.png' });
  assert.ok(await page.evaluate(() => {
    const { game, view } = window.__patsBar; const b = game.enemies[0];
    const c = Math.cos(view.warningLine.rotation.z), s = Math.sin(view.warningLine.rotation.z);
    const dx = b.target.x - b.x, dz = b.target.z - b.z;
    return Math.abs((-s) * dz - (-c) * dx) < .001;
  }), 'Charge warning must align with the actual target path');
  await page.evaluate(() => { window.__patsBar.game.enemies[0].hp = 0; }); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'victory');
  await page.locator('[data-action=start]').click(); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__patsBar.game.kills), 0);
  await page.evaluate(() => { window.__patsBar.game.damage(100); }); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'defeat');
  await page.locator('[data-action=start]').click(); await page.waitForTimeout(100);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'paused');
  await page.setViewportSize({ width: 900, height: 650 }); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  // Switch modes through the actual result/menu controls.
  await page.locator('[data-action=resume]').click();
  await page.evaluate(() => { const g = window.__patsBar.game; g.player.invulnerable = 0; g.shieldCooldown = 12; g.damage(1000); });
  await page.locator('[data-action=menu]').click();
  await page.locator('[data-run-mode=endless]').click();
  await page.waitForFunction(() => document.querySelector('[data-run-mode=endless]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('[data-run-mode=endless]').getAttribute('aria-pressed'), 'true');
  await page.screenshot({ path: 'artifacts/endless-title-small.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'artifacts/endless-title.png' });
  await page.locator('[data-action=start]').click();
  await page.waitForFunction(() => window.__patsBar.game.runMode === 'endless' && window.__patsBar.game.mode === 'playing');
  assert.equal(await page.locator('#wave-label').textContent(), 'ENDLESS · ROUND 1');
  await page.evaluate(() => {
    const g = window.__patsBar.game; const idle = { x:0, z:0, aim:{x:0,z:0}, fire:false, dodge:false };
    g.player.invulnerable = 100;
    for (let r = 1; r <= 9; r++) {
      g.enemies = []; g.waveTime = 45; g.step(.01, idle);
      if (g.encounter === 'boss' && r < 9) { g.enemies[0].hp = 0; g.step(.01, idle); while (['upgrade','bossReward','training'].includes(g.mode)) { if(g.mode === 'upgrade') g.choose(g.choices[0]); else if(g.mode === 'training') g.chooseTraining('power'); else g.chooseBossReward(null); } }
    }
    g.nextSpawn = 0; g.step(.01, idle);
    g.enemies.find(e => e.kind === 'boss').phaseTime = 10; g.bannerTime = 0;
  });
  await page.waitForFunction(() => document.querySelector('#boss-name').textContent.includes('BOSS 3'));
  assert.equal(await page.evaluate(() => window.__patsBar.game.enemies.filter(e => e.kind !== 'boss').length), 1);
  await page.screenshot({ path: 'artifacts/endless-boss.png' });
  await page.evaluate(() => { const g = window.__patsBar.game; g.enemies.find(e => e.kind === 'boss').hp = 0; });
  await page.waitForFunction(() => window.__patsBar.game.bossCleared);
  assert.equal(await page.locator('#wave-name').textContent(), 'Clear the remaining enemies');
  assert.equal(await page.evaluate(() => window.__patsBar.game.round), 9);
  await page.evaluate(() => { const g = window.__patsBar.game; g.random = () => 0; g.enemies.forEach(e => e.hp = 0); });
  await page.waitForFunction(() => window.__patsBar.game.mode === 'bossReward');
  await page.waitForFunction(() => document.querySelectorAll('[data-boss-reward]:disabled').length === 0);
  const frozenSuper = await page.evaluate(() => window.__patsBar.game.elapsed);
  await page.locator('[data-boss-reward]').first().dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'bossReward');
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.__patsBar.game.mode), 'paused');
  await page.locator('[data-action=resume]').click();
  await page.screenshot({path:'artifacts/super-buffs.png'});
  await page.locator('[data-boss-reward]').first().click();
  await page.waitForFunction(() => window.__patsBar.game.round === 10);
  assert.equal(await page.evaluate(() => window.__patsBar.game.superBuffs.size), 1);
  assert.equal(await page.locator('.power-inventory').count(), 0);
  await page.evaluate(() => {
    const g = window.__patsBar.game;
    for (const id of ['explosive','orbit','shield','trail']) g.superBuffs.add(id);
    g.shieldCooldown = 0; g.player.invulnerable = 0;
    g.step(.01, {x:1,z:0,aim:{x:0,z:0},fire:false,dodge:true});
    g.effect({x:3,z:1}, '#ffb65e', 1.5);
  });
  await page.waitForTimeout(100);
  await page.screenshot({path:'artifacts/super-buffs-active.png'});
  assert.equal(await page.locator('#buff-hud').count(), 0);
  await page.evaluate(() => { const g = window.__patsBar.game; g.player.invulnerable=0; g.damage(1); });
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.power-inventory').count(), 0);
  await page.evaluate(() => { const g = window.__patsBar.game; g.player.invulnerable = 0; g.shieldCooldown = 12; g.damage(1000); });
  await page.waitForFunction(() => document.querySelector('.endless-results'));
  const stats = await page.locator('.endless-results').textContent();
  assert.ok(stats.includes('9ROUNDS CLEARED') && stats.includes('3BOSSES DEFEATED'));
  await page.screenshot({ path: 'artifacts/endless-results.png' });
  await page.locator('[data-action=start]').click();
  assert.deepEqual(await page.evaluate(() => { const g = window.__patsBar.game; return [g.runMode,g.round,g.roundsCompleted,g.bossesDefeated]; }), ['endless',1,0,0]);
  await page.evaluate(() => (window.__patsBar.game.shieldCooldown = 12, window.__patsBar.game.damage(1000)));
  await page.locator('[data-action=menu]').click();
  await page.locator('[data-run-mode=normal]').click();
  await page.locator('[data-action=start]').click();
  assert.equal(await page.evaluate(() => window.__patsBar.game.runMode), 'normal');
  await page.evaluate(() => {
    const g=window.__patsBar.game; g.upgrades.damage=2; g.upgrades.rate=5;
    g.superBuffs.add('shield'); g.xp=12; g.checkLevel();
  });
  await page.waitForSelector('.power-inventory');
  let inventory = await page.locator('.power-inventory').textContent();
  assert.ok(inventory.includes('Upgrade stacks: 7') && inventory.includes('2/5') && inventory.includes('5/5 MAX') && inventory.includes('Super buffs: 1/4'));
  await page.locator('.inventory-item').first().focus();
  assert.equal(await page.locator('.inventory-item').first().locator('.inventory-description').isVisible(), true);
  // Render the maximum inventory to check layout, even though all-capped levels normally heal.
  await page.evaluate(() => {
    const g=window.__patsBar.game; Object.assign(g.upgrades,{damage:5,rate:5,count:3,pierce:3,speed:4,health:4,magnet:4});
    for(const id of ['explosive','orbit','shield','trail'])g.superBuffs.add(id);
    g.level++;
  });
  await page.waitForFunction(() => document.querySelectorAll('.inventory-item').length===11);
  inventory=await page.locator('.power-inventory').textContent();
  assert.ok(inventory.includes('Upgrade stacks: 28') && inventory.includes('Super buffs: 4/4'));
  assert.equal((inventory.match(/MAX/g)||[]).length,7);
  for (const [width,height] of [[1440,900],[900,650]]) {
    await page.setViewportSize({width,height});
    await page.locator('.power-inventory').scrollIntoViewIfNeeded();
    await page.screenshot({path:`artifacts/inventory-${width}.png`});
    assert.ok(await page.locator('.upgrade-modal').evaluate(el => {
      const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight && el.scrollWidth<=el.clientWidth+1;
    }));
  }
  await page.evaluate(() => { const g=window.__patsBar.game; g.menu(); g.start(); g.xp=12; g.checkLevel(); });
  await page.waitForFunction(() => document.querySelector('.power-inventory')?.textContent.includes('No power-ups yet'));
  assert.deepEqual(errors, []); console.log('Browser QA passed: movement, mouse fire, dodge, pause, upgrades, boss, win/loss, restart, focus loss, resize; no page errors.');
  await browser.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
