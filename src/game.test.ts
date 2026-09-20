import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from './game';
import { isSelectionMode, bossDifficulty, bossReinforcementInterval, ENEMIES, SUPER_BUFFS, UPGRADES, waveDifficulty, xpRequired } from './config';
const idle: Input = { x: 0, z: 0, aim: { x: 0, z: -5 }, fire: false, dodge: false };
test('regular rounds stop spawning at 45 seconds and wait for survivor cleanup in both modes', () => {
  for (const mode of ['normal', 'endless'] as const) for (const round of [1, 2, 3, ...(mode === 'endless' ? [9, 15] : [])]) {
    const g = new Game(() => .5); g.start(mode); g.round = round; g.waveTime = 44.98; g.nextSpawn = 0;
    assert.equal(g.difficulty.duration, 45);
    g.step(.01, idle); assert.equal(g.enemies.length, 1);
    g.nextSpawn = 0; g.step(.02, idle);
    assert.equal(g.enemies.length, 1); assert.equal(g.round, round); assert.equal(g.encounter, 'wave');
    g.enemies = []; g.step(.01, idle); assert.equal(g.waveTime, 0);
    assert.equal(g.encounter, round % 3 === 0 ? 'boss' : 'wave');
    assert.equal(g.round, round % 3 === 0 ? round : round + 1);
  }
});
test('boss HP reductions and later bonuses apply to existing scaling without changing attacks', () => {
  for (const [boss, factor] of [[1,.875],[2,.875],[3,.875],[4,1],[5,1.025],[6,1.05],[10,1.15]]) {
    const g = new Game(); g.start('endless'); g.round = boss * 3; g.encounter = 'boss';
    const e = g.spawn('boss');
    assert.ok(Math.abs(e.maxHp - 36000 * (1 + .3 * (boss - 1)) * factor) < 1e-8);
    assert.equal(e.hp, e.maxHp); assert.equal(e.damage, 22 * (1 + .15 * (boss - 1)));
    assert.equal(e.recovery, Math.min(1.5, 1 + .08 * (boss - 1)));
  }
  const g = new Game(); g.start('normal'); g.round = 3;
  assert.equal(g.spawn('boss').maxHp, 31500);
});
function bossReward(g: Game) { g.round = 3; g.encounter = 'boss'; g.enemies = []; g.spawn('boss', { x: 10, z: -5 }).hp = 0; g.step(.01, idle); }
test('boss rewards follow banked XP upgrades, freeze gameplay, and apply only once', () => {
  const g = new Game(() => 0); g.start('endless'); g.player.hp = 10;
  g.pickups.push({ id: 900, x: 10, z: 7, value: 12 }); bossReward(g);
  assert.equal(g.player.hp, 55); assert.equal(g.mode, 'upgrade'); assert.equal(g.round, 3);
  const elapsed = g.elapsed; g.step(2, idle); assert.equal(g.elapsed, elapsed); assert.equal(g.player.hp, 55);
  g.choose(g.choices.find(id => id !== 'health')!); assert.equal(g.mode, 'bossReward');
  assert.equal(g.bossChoices.length, 3); assert.equal(new Set(g.bossChoices).size, 3);
  const choice = g.bossChoices[0]; g.pause(); g.step(10, idle); g.pause(); assert.equal(g.mode, 'bossReward');
  g.chooseBossReward(choice); assert.equal(g.mode, 'playing'); assert.equal(g.round, 4); assert.equal(g.waveTime, 0); assert.equal(g.superBuffs.size, 1);
  g.chooseBossReward(choice); assert.equal(g.superBuffs.size, 1); assert.equal(g.player.hp, 55);
});
test('unowned super buffs share the pool; collecting all four leaves equipment rewards', () => {
  const g = new Game(() => 0); g.start('endless');
  for (let i = 0; i < 4; i++) {
    bossReward(g); assert.equal(g.bossChoices.length, 3);
    assert.ok(SUPER_BUFFS.filter(b => g.superBuffs.has(b.id)).every(b => !g.bossChoices.includes(b.id)));
    g.chooseBossReward(g.bossChoices[0]); assert.equal(g.mode, 'playing');
  }
  assert.equal(g.superBuffs.size, 4);
  g.player.hp = 10; bossReward(g); assert.equal(g.player.hp, 55); assert.equal(g.mode, 'bossReward');
  assert.ok(g.bossChoices.every(id => !SUPER_BUFFS.some(b => b.id === id)));
  g.chooseBossReward(null); assert.equal(g.bossChoices.length, 0);
  g.shieldCooldown = 5; g.menu(); assert.equal(g.superBuffs.size, 0); assert.equal(g.shieldCooldown, 0); assert.equal(g.trails.length, 0);
});
test('regular healing is 30 in both modes, and dead players get no rewards', () => {
  for (const mode of ['normal','endless'] as const) { const g = new Game(); g.start(mode); g.player.hp = 25; g.waveTime = 45; g.step(.01,idle); assert.equal(g.player.hp,55); }
  const g = new Game(); g.start('endless'); g.player.hp = 1; g.waveTime = 45; g.spawn('olive',g.player); g.step(.01,idle); assert.equal(g.mode,'defeat'); assert.equal(g.player.hp,0); assert.equal(g.bossChoices.length,0);
});
test('explosions occur once per piercing cap and do not chain or double-hit their direct target', () => {
  const g = new Game(); g.start(); g.superBuffs.add('explosive'); g.upgrades.pierce = 2;
  const a = g.spawn('bottle',{x:0,z:2.5}), b = g.spawn('bottle',{x:1,z:2.5}), c = g.spawn('bottle',{x:2.4,z:2.5});
  for (const e of [a,b,c]) e.speed = 0;
  g.shoot(g.player,Math.PI); g.step(.01,idle);
  assert.equal(a.hp,a.maxHp-18); assert.equal(b.hp,b.maxHp-7.2); assert.equal(c.hp,c.maxHp);
  const shot=g.bullets[0]; shot.x=b.x; shot.z=b.z; shot.vx=shot.vz=0; g.step(.01,idle);
  assert.equal(c.hp,c.maxHp); assert.equal(g.effects.filter(e=>e.radius===1.5).length,1);
});
test('shield respects invulnerability, blocks silently, recharges during play, and freezes when paused', () => {
  let grunts=0; const g = new Game(Math.random,()=>grunts++); g.start(); g.superBuffs.add('shield');
  g.player.invulnerable=.2; g.damage(10); assert.equal(g.shieldCooldown,0);
  g.player.invulnerable=0; g.damage(10); assert.equal(g.player.hp,100); assert.equal(grunts,0); assert.equal(g.shieldCooldown,12);
  g.pause(); g.step(12,idle); assert.equal(g.shieldCooldown,12); g.pause();
  g.nextSpawn=999; for(let i=0;i<721;i++)g.step(1/60,idle);
  assert.equal(g.shieldCooldown,0); g.damage(10); assert.equal(g.player.hp,100);
  g.player.invulnerable=0; g.damage(10); assert.equal(g.player.hp,90); assert.equal(grunts,1);
});
test('orbit uses current damage, per-enemy cooldowns, and cleans dead records', () => {
  const g=new Game();g.start();g.superBuffs.add('orbit');g.upgrades.damage=2;
  const e=g.spawn('bottle',g.orbitPosition);e.speed=0;g.step(.01,idle);assert.equal(e.hp,e.maxHp-g.weaponDamage);
  Object.assign(e,g.orbitPosition);g.step(.01,idle);assert.equal(e.hp,e.maxHp-g.weaponDamage);
  g.orbitHits.set(e.id,0);Object.assign(e,g.orbitPosition);g.step(.01,idle);assert.equal(e.hp,e.maxHp-2*g.weaponDamage);
  e.hp=0;g.step(.01,idle);assert.equal(g.orbitHits.size,0);
});
test('dodge trail expires, stays bounded, and overlapping segments share a hit cooldown', () => {
  const g=new Game();g.start();g.superBuffs.add('trail');g.nextSpawn=999;
  g.step(.01,{...idle,dodge:true,x:1});assert.ok(g.trails.length>0);
  const e=g.spawn('bottle',{x:5,z:0});e.speed=0;
  for(let i=0;i<10;i++)g.trails.push({id:100+i,x:5,z:0,life:3});
  g.step(.01,idle);assert.equal(e.hp,e.maxHp-g.weaponDamage*.5);g.step(.01,idle);assert.equal(e.hp,e.maxHp-g.weaponDamage*.5);
  g.pause();const life=g.trails[0].life;g.step(3,idle);assert.equal(g.trails[0].life,life);g.pause();
  for(let i=0;i<40;i++){g.player.dash=.2;g.step(.01,idle);assert.ok(g.trails.length<=32);}
  g.player.dash=0;for(let i=0;i<190;i++)g.step(1/60,idle);assert.equal(g.trails.length,0);
});
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
    g.waveTime = 45; g.spawn('olive', { x: 10, z: 7 }); g.step(1 / 60, idle); assert.equal(g.round, wave + 1); assert.equal(g.encounter, 'wave');
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
    g.waveTime = 45; g.step(.01, idle);
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
      while (isSelectionMode(g.mode)) { if (g.mode === 'upgrade') g.choose(g.choices[0]); else if (g.mode === 'training') g.chooseTraining('power'); else g.chooseBossReward(null); }
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
  assert.deepEqual(bossDifficulty('endless', 3), { hp: 1.6 * .875, damage: 1.3, recovery: 1.16 });
  assert.equal(bossDifficulty('endless', 100).recovery, 1.5);
});

test('later enemy stats affect contact, shots, and boss recovery without shortening warnings', () => {
  const g = new Game(() => .5); g.start('endless'); g.round = 9; g.encounter = 'boss';
  const boss = g.spawn('boss', { x: 10, z: -5 });
  assert.equal(boss.maxHp, ENEMIES.boss.hp * (1.6 * .875));
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
  assert.equal(g.nextSpawn, 3);
  const count = g.enemies.length; g.step(.01, idle); assert.equal(g.enemies.length, count);
  for (let i = 0; i < 20; i++) { g.nextSpawn = 0; g.step(.01, idle); }
  assert.equal(g.enemies.filter(e => e.kind !== 'boss').length, 12);
});

test('transitions bank XP and heal once, retain upgrades, and wait during upgrade selection', () => {
  const g = new Game(); g.start('endless'); g.round = 3; g.waveTime = 45; g.player.hp = 50; g.upgrades.damage = 2;
  g.pickups.push({ id: 100, x: 10, z: 7, value: 3 }); g.shoot({ x: 10, z: 7 }, 0, true);
  g.step(.01, idle); assert.equal(g.player.hp, 80); assert.equal(g.xp, 3); assert.equal(g.pickups.length, 0); assert.equal(g.bullets.length, 0);
  g.enemies[0].hp = 0; g.step(.01, idle); g.chooseBossReward(null); assert.equal(g.player.hp, 100); assert.equal(g.round, 4); assert.equal(g.upgrades.damage, 2);
  g.step(.01, idle); assert.equal(g.player.hp, 100);
  for (const u of UPGRADES) g.upgrades[u.id] = u.cap;
  g.level = 29; g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.player.hp, 100); assert.equal(g.mode, 'training'); g.chooseTraining('power');
});

test('Endless death takes precedence over a cleared encounter; menu and mode changes reset run state', () => {
  const g = new Game(); g.start('endless'); g.round = 9; g.encounter = 'boss';
  const boss = g.spawn('boss', g.player); g.player.hp = 1;
  g.step(.01, idle); assert.equal(g.mode, 'defeat'); assert.equal(g.round, 9);
  g.menu(); assert.equal(g.mode, 'title'); assert.equal(g.runMode, 'endless'); assert.equal(g.enemies.length, 0);
  g.start('normal'); assert.equal(g.runMode, 'normal'); assert.equal(g.round, 1); assert.equal(g.bossesDefeated, 0); assert.equal(g.roundsCompleted, 0);
  assert.equal(g.encounter, 'wave'); assert.equal(g.player.hp, 100); assert.equal(g.elapsed, 0);
});

test('boss reinforcements start slowly after round 9 and accelerate between bosses', () => {
  assert.equal(bossReinforcementInterval(3), 3);
  assert.equal(bossReinforcementInterval(4), 2.5);
  assert.ok(Math.abs(bossReinforcementInterval(5) - 3 / 1.44) < 1e-10);
  assert.equal(bossReinforcementInterval(100), .5);
  const g = new Game(() => .5); g.start('endless'); g.round = 9; g.waveTime = 45;
  g.step(.01, idle); assert.equal(g.encounter, 'boss'); assert.equal(g.nextSpawn, 3);
  g.player.invulnerable = 10;
  for (let i = 0; i < 179; i++) g.step(1 / 60, idle);
  assert.equal(g.enemies.filter(e => e.kind !== 'boss').length, 0);
  g.step(.04, idle); assert.equal(g.enemies.filter(e => e.kind !== 'boss').length, 1);
  g.enemies.find(e => e.kind === 'boss')!.hp = 0; g.step(.01, idle);
  g.nextSpawn = 0; g.step(.01, idle);
  assert.equal(g.enemies.filter(e => e.kind !== 'boss').length, 1);
});
