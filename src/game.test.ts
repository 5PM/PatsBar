import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from './game';
import { bossDifficulty, ENEMIES, UPGRADES, waveDifficulty, xpRequired } from './config';
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
    g.waveTime = 60; g.spawn('olive', { x: 10, z: 7 }); g.step(1 / 60, idle); assert.equal(g.round, wave + 1); assert.equal(g.encounter, 'wave');
    g.enemies = []; g.step(1 / 60, idle); assert.equal(g.round, Math.min(3, wave + 2));
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
  const g = new Game(); g.start(); g.round = 3; g.encounter = 'boss'; const boss = g.spawn('boss', { x: 0, z: -5 });
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phase, 'warning'); assert.equal(boss.phaseTime, 1.2);
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phase, 'charge');
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.attack, 1);
  boss.hp = boss.maxHp / 2 - 1; boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phaseTime, .85);
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(g.bullets.length, 22);
});
test('pause freezes the run, restart cleans all run state, and outcomes work', () => {
  const g = new Game(); g.start(); g.spawn('olive'); g.shoot(g.player, 0); g.upgrades.count = 2; g.pause(); g.step(1, idle); assert.equal(g.elapsed, 0);
  g.start(); assert.equal(g.bullets.length + g.enemies.length + g.pickups.length, 0); assert.equal(g.upgrades.count, 0); assert.equal(g.player.hp, 100);
  g.damage(100); assert.equal(g.mode, 'defeat'); g.start(); g.round = 3; g.encounter = 'boss'; g.spawn('boss').hp = 0; g.step(.01, idle); assert.equal(g.mode, 'victory');
});
test('projectiles hit and piercing cannot damage the same enemy twice', () => {
  const g = new Game(); g.start(); g.upgrades.pierce = 1; const e = g.spawn('bottle', { x: 0, z: 2.5 }); g.shoot(g.player, Math.PI); g.step(.01, idle); const hp = e.hp; assert.ok(hp < e.maxHp); g.step(.001, idle); assert.equal(e.hp, hp);
});

test('Endless cycles through bosses after 3, 6, 9, and 12 without victory', () => {
  const g = new Game(() => .5); g.start('endless'); g.player.invulnerable = 100;
  for (let round = 1; round <= 12; round++) {
    assert.equal(g.round, round); assert.equal(g.encounter, 'wave');
    g.waveTime = 60; g.step(.01, idle);
    assert.equal(g.roundsCompleted, round);
    if (round % 3 === 0) {
      assert.equal(g.encounter, 'boss'); assert.equal(g.bossNumber, round / 3);
      const boss = g.enemies.find(e => e.kind === 'boss')!;
      g.nextSpawn = 0; g.step(.01, idle);
      assert.equal(g.enemies.length, round >= 9 ? 2 : 1);
      boss.hp = 0; g.step(.01, idle);
      assert.equal(g.bossesDefeated, round / 3); assert.notEqual(g.mode, 'victory');
      if (round >= 9) {
        assert.equal(g.encounter, 'boss'); assert.equal(g.round, round);
        g.nextSpawn = 0; g.step(.01, idle); assert.equal(g.enemies.length, 1);
        g.enemies[0].hp = 0; g.step(.01, idle);
      }
      assert.equal(g.encounter, 'wave'); assert.equal(g.round, round + 1);
    }
    while (g.mode === 'upgrade') g.choose(g.choices[0]);
  }
});

test('difficulty preserves early rounds and scales every later round within population and speed caps', () => {
  for (let r = 1; r <= 3; r++) assert.deepEqual(waveDifficulty('normal', r), waveDifficulty('endless', r));
  const base = waveDifficulty('endless', 3), fourth = waveDifficulty('endless', 4);
  assert.equal(fourth.hp, base.hp * 1.12); assert.equal(fourth.damage, 1.08);
  for (const r of [6, 9, 12, 100, 10000]) {
    const d = waveDifficulty('endless', r), previous = waveDifficulty('endless', r - 1);
    assert.ok(d.hp > previous.hp && d.damage > previous.damage);
    assert.ok(d.speed <= base.speed * 1.5 && d.max <= 60 && d.interval >= .25 && d.bottleChance <= .6);
  }
  assert.deepEqual(bossDifficulty('endless', 1), bossDifficulty('normal', 1));
  assert.deepEqual(bossDifficulty('endless', 3), { hp: 1.6, damage: 1.3, recovery: 1.16 });
  assert.equal(bossDifficulty('endless', 100).recovery, 1.5);
});

test('later enemy stats affect contact, shots, and boss recovery without shortening warnings', () => {
  const g = new Game(() => .5); g.start('endless'); g.round = 9; g.encounter = 'boss';
  const boss = g.spawn('boss', { x: 10, z: -5 });
  assert.equal(boss.maxHp, ENEMIES.boss.hp * 1.6);
  assert.equal(boss.damage, 22 * 1.3);
  boss.phaseTime = 0; g.step(.01, idle); assert.equal(boss.phaseTime, 1.2);
  boss.phase = 'warning'; boss.attack = 1; boss.phaseTime = 0; g.step(.01, idle);
  assert.equal(g.bullets[0].damage, 14 * 1.3); assert.equal(boss.phaseTime, 2.1 / 1.16);
  const bottle = g.spawn('bottle', { x: g.player.x, z: g.player.z });
  bottle.cooldown = 0; g.step(.01, idle);
  assert.equal(g.player.hp, 100 - bottle.damage);
  bottle.x = 5; bottle.cooldown = 0; g.step(.01, idle);
  assert.equal(g.bullets.at(-1)!.damage, 14 * waveDifficulty('endless', 9).damage);
});

test('reinforcements respect timing and the twelve-enemy cap', () => {
  const g = new Game(() => .5); g.start('endless'); g.round = 9; g.encounter = 'boss'; g.spawn('boss');
  g.player.invulnerable = 100; g.nextSpawn = 0; g.step(.01, idle);
  assert.equal(g.nextSpawn, g.difficulty.interval * 2);
  const count = g.enemies.length; g.step(.01, idle); assert.equal(g.enemies.length, count);
  for (let i = 0; i < 20; i++) { g.nextSpawn = 0; g.step(.01, idle); }
  assert.equal(g.enemies.filter(e => e.kind !== 'boss').length, 12);
});

test('transitions bank XP and heal once, retain upgrades, and wait during upgrade selection', () => {
  const g = new Game(); g.start('endless'); g.round = 3; g.waveTime = 60; g.player.hp = 50; g.upgrades.damage = 2;
  g.pickups.push({ id: 100, x: 10, z: 7, value: 3 }); g.shoot({ x: 10, z: 7 }, 0, true);
  g.step(.01, idle); assert.equal(g.player.hp, 70); assert.equal(g.xp, 3); assert.equal(g.pickups.length, 0); assert.equal(g.bullets.length, 0);
  g.enemies[0].hp = 0; g.step(.01, idle); assert.equal(g.player.hp, 90); assert.equal(g.round, 4); assert.equal(g.upgrades.damage, 2);
  g.step(.01, idle); assert.equal(g.player.hp, 90);
  for (const u of UPGRADES) g.upgrades[u.id] = u.cap;
  g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.player.hp, 100); assert.equal(g.mode, 'playing');
});

test('Endless death takes precedence over a cleared encounter; menu and mode changes reset run state', () => {
  const g = new Game(); g.start('endless'); g.round = 9; g.encounter = 'boss';
  const boss = g.spawn('boss', g.player); g.player.hp = 1;
  g.step(.01, idle); assert.equal(g.mode, 'defeat'); assert.equal(g.round, 9);
  g.menu(); assert.equal(g.mode, 'title'); assert.equal(g.runMode, 'endless'); assert.equal(g.enemies.length, 0);
  g.start('normal'); assert.equal(g.runMode, 'normal'); assert.equal(g.round, 1); assert.equal(g.bossesDefeated, 0); assert.equal(g.roundsCompleted, 0);
  assert.equal(g.encounter, 'wave'); assert.equal(g.player.hp, 100); assert.equal(g.elapsed, 0);
});
