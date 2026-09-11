import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from './game';
import { UPGRADES, xpRequired } from './config';
const idle: Input = { x: 0, z: 0, aim: { x: 0, z: -5 }, fire: false, dodge: false };
test('hurt sound fires only on actual damage and remains connected after restart', () => {
  let grunts = 0; const g = new Game(Math.random, () => grunts++); g.start();
  g.damage(0); assert.equal(grunts, 0);
  g.damage(12); g.damage(12); assert.equal(grunts, 1);
  g.player.invulnerable = 0; g.pause(); g.damage(12); assert.equal(grunts, 1);
  g.start(); g.damage(100); assert.equal(grunts, 2); assert.equal(g.mode, 'defeat');
});
test('three timed waves require clearing enemies before the boss', () => {
  const g = new Game(() => .5); g.start();
  for (let wave = 0; wave < 3; wave++) {
    g.waveTime = 60; g.spawn('olive', { x: 10, z: 7 }); g.step(1 / 60, idle); assert.equal(g.wave, wave);
    g.enemies = []; g.step(1 / 60, idle); assert.equal(g.wave, wave + 1);
  }
  assert.equal(g.enemies[0].kind, 'boss');
});
test('upgrade choices are distinct, capped, and banked XP can level again', () => {
  const g = new Game(() => .4); g.start(); g.xp = 100; g.checkLevel();
  assert.equal(g.mode, 'upgrade'); assert.equal(new Set(g.choices).size, 3); assert.equal(g.level, 2);
  g.choose(g.choices[0]); assert.equal(g.level, 3);
  for (const u of UPGRADES) g.upgrades[u.id] = u.cap;
  g.mode = 'playing'; g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.choices.length, 0); assert.equal(g.mode, 'playing');
});
test('damage grace and dodge prevent hits, while cooldown prevents repeat dodge', () => {
  const g = new Game(); g.start(); g.damage(12); g.damage(12); assert.equal(g.player.hp, 88);
  g.player.invulnerable = 0; g.step(1 / 60, { ...idle, dodge: true }); g.damage(50); assert.equal(g.player.hp, 88);
  const cooldown = g.player.dodge; g.step(1 / 60, { ...idle, dodge: true }); assert.ok(g.player.dodge < cooldown);
});
test('boss alternates telegraphed charge and burst, and enrages below half health', () => {
  const g = new Game(); g.start(); g.wave = 3; const boss = g.spawn('boss', { x: 0, z: -5 });
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phase, 'warning'); assert.equal(boss.phaseTime, 1.2);
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phase, 'charge');
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.attack, 1);
  boss.hp = boss.maxHp / 2 - 1; boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phaseTime, .85);
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(g.bullets.length, 22);
});
test('pause freezes the run, restart cleans all run state, and outcomes work', () => {
  const g = new Game(); g.start(); g.spawn('olive'); g.shoot(g.player, 0); g.upgrades.count = 2; g.pause(); g.step(1, idle); assert.equal(g.elapsed, 0);
  g.start(); assert.equal(g.bullets.length + g.enemies.length + g.pickups.length, 0); assert.equal(g.upgrades.count, 0); assert.equal(g.player.hp, 100);
  g.damage(100); assert.equal(g.mode, 'defeat'); g.start(); g.wave = 3; g.spawn('boss').hp = 0; g.step(.01, idle); assert.equal(g.mode, 'victory');
});
test('projectiles hit and piercing cannot damage the same enemy twice', () => {
  const g = new Game(); g.start(); g.upgrades.pierce = 1; const e = g.spawn('bottle', { x: 0, z: 2.5 }); g.shoot(g.player, Math.PI); g.step(.01, idle); const hp = e.hp; assert.ok(hp < e.maxHp); g.step(.001, idle); assert.equal(e.hp, hp);
});
