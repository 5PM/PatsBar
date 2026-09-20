import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, type Input } from './game';
import { EQUIPMENT, SUPER_BUFFS, UPGRADES, WEAPON, WEAPON_PROFILES, xpRequired, type EquipmentId } from './config';

const idle: Input = { x: 0, z: 0, aim: { x: 0, z: -5 }, fire: false, dodge: false };
const near = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
function game() { const g = new Game(() => .25); g.start('endless'); g.nextSpawn = 999; return g; }
function equip(g: Game, id: EquipmentId) { g.mode = 'bossReward'; g.bossChoices = [id]; g.chooseBossReward(id); }
function cap(g: Game) { for (const u of UPGRADES) g.upgrades[u.id] = u.cap; }
function clearBoss(g: Game) {
  g.round = 9; g.encounter = 'boss'; g.enemies = []; g.nextSpawn = 999;
  g.spawn('boss', { x: 10, z: -5 }).hp = 0; g.step(.01, idle);
}
function frozenEnemy(g: Game, x: number, z: number) {
  const e = g.spawn('bottle', { x, z }); e.hp = e.maxHp = 10000; e.speed = 0; e.cooldown = 999; return e;
}

test('boss rewards order healing/XP, all levels, one mixed reward, then a fresh round', () => {
  const g = game(); g.player.hp = 5; g.player.maxHp = 200; equip(g, 'apron');
  g.pickups.push({ id: 900, x: 12, z: 7, value: 32 });
  g.shoot({ x: 12, z: 7 }, 0, true); clearBoss(g);
  assert.equal(g.player.hp, 64); assert.equal(g.pickups.length, 0); assert.equal(g.bullets.length, 0);
  assert.equal(g.mode, 'upgrade'); assert.equal(g.level, 2);
  g.choose(g.choices.find(id => id !== 'health')!); assert.equal(g.mode, 'upgrade'); assert.equal(g.level, 3);
  g.choose(g.choices.find(id => id !== 'health')!); assert.equal(g.mode, 'bossReward');
  assert.equal(g.round, 9);
  const choices = [...g.bossChoices], elapsed = g.elapsed, waveTime = g.waveTime;
  g.pause(); g.step(20, idle); g.chooseBossReward(choices[0]);
  assert.deepEqual(g.bossChoices, choices); assert.equal(g.elapsed, elapsed);
  g.pause(); g.step(20, idle); assert.equal(g.waveTime, waveTime);
  g.chooseBossReward(null); assert.equal(g.mode, 'playing'); assert.equal(g.round, 10); assert.equal(g.waveTime, 0);
  assert.equal(g.player.hp, 64); assert.equal(g.armor, 'apron'); assert.equal(g.weapon, 'caps');
  g.chooseBossReward(choices[0]); g.step(.01, idle); assert.equal(g.player.hp, 64); assert.equal(g.bossChoices.length, 0);
});

test('reinforcements must be cleared before any boss rewards; simultaneous death wins over rewards', () => {
  const g = game(); g.round = 9; g.encounter = 'boss'; g.player.hp = 10;
  g.spawn('boss', { x: 10, z: -5 }).hp = 0;
  const survivor = frozenEnemy(g, 7, 7); g.step(.01, idle);
  assert.equal(g.mode, 'playing'); assert.equal(g.player.hp, 10); assert.equal(g.bossChoices.length, 0);
  survivor.hp = 0; g.step(.01, idle); assert.equal(g.player.hp, 55); assert.equal(g.mode, 'bossReward');
  const dead = game(); dead.round = 9; dead.encounter = 'boss'; dead.player.hp = 1;
  dead.spawn('boss', dead.player).hp = 0; dead.spawn('olive', dead.player); dead.step(.01, idle);
  assert.equal(dead.mode, 'defeat'); assert.equal(dead.player.hp, 0); assert.equal(dead.bossChoices.length, 0);
});

test('mixed offers exclude owned buffs and equipped items without forcing a category', () => {
  const compositions = new Set<string>();
  for (const random of [0, .21, .5, .99999]) {
    const g = new Game(() => random); g.start('endless'); equip(g, 'picks'); equip(g, 'glass');
    for (let i = 0; i < 5; i++) {
      clearBoss(g); assert.equal(g.mode, 'bossReward');
      assert.equal(g.bossChoices.length, 3); assert.equal(new Set(g.bossChoices).size, 3);
      assert.ok(g.bossChoices.every(id => id !== g.weapon && id !== g.armor));
      assert.ok(SUPER_BUFFS.filter(b => g.superBuffs.has(b.id)).every(b => !g.bossChoices.includes(b.id)));
      compositions.add(g.bossChoices.map(id => EQUIPMENT.find(e => e.id === id)?.slot ?? 'buff').sort().join(','));
      const selected = g.bossChoices[0], oldArmor = g.armor, oldWeapon = g.weapon, oldBuffs = g.superBuffs.size;
      const item = EQUIPMENT.find(e => e.id === selected);
      g.chooseBossReward(selected); assert.equal(g.mode, 'playing'); assert.equal(g.round, 10);
      assert.equal(g.weapon, item?.slot === 'weapon' ? selected : oldWeapon);
      assert.equal(g.armor, item?.slot === 'armor' ? selected : oldArmor);
      assert.equal(g.superBuffs.size, oldBuffs + (item ? 0 : 1));
    }
  }
  assert.ok(compositions.has('buff,buff,buff'));
  assert.ok(compositions.has('armor,armor,weapon'));
  assert.ok([...compositions].some(c => c.includes('buff') && c.includes('weapon')));
});

test('armor replacement separates capacity, fills glass directly, and preserves permanent upgrades', () => {
  const g = game(); equip(g, 'apron'); g.player.hp = 10;
  equip(g, 'glass'); assert.equal(g.player.hp, 85); assert.equal(g.player.maxHp, 175); assert.equal(g.armorHp, 75);
  g.mode = 'upgrade'; g.choices = ['health']; g.choose('health');
  assert.equal(g.player.maxHp, 200); assert.equal(g.permanentMaxHp, 125); assert.equal(g.player.hp, 120);
  g.mode = 'training'; g.chooseTraining('endurance');
  assert.equal(g.permanentMaxHp, 140); assert.equal(g.player.maxHp, 215); assert.equal(g.player.hp, 135);
  g.player.hp = 205; equip(g, 'vest');
  assert.equal(g.player.maxHp, 140); assert.equal(g.player.hp, 140); assert.equal(g.armorHp, 0);
  equip(g, 'picks'); assert.equal(g.armor, 'vest'); assert.equal(g.player.maxHp, 140);
  g.player.hp = 40; equip(g, 'glass'); assert.equal(g.player.hp, 115);
  g.player.hp = 25; equip(g, 'apron'); assert.equal(g.player.hp, 25); assert.equal(g.player.maxHp, 140);
});

test('apron rounds all healing sources, clamps HP, and applies before the next equipment choice', () => {
  const g = game(); equip(g, 'apron'); g.player.hp = 1;
  g.waveTime = 45; g.step(.01, idle); assert.equal(g.player.hp, 40);
  g.mode = 'upgrade'; g.choices = ['health']; g.choose('health'); assert.equal(g.player.hp, 86); assert.equal(g.player.maxHp, 125);
  cap(g); g.level = 29; g.player.hp = 1; g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.player.hp, 34);
  g.chooseTraining('endurance'); assert.equal(g.player.hp, 54); assert.equal(g.player.maxHp, 140);
  g.heal(1000); assert.equal(g.player.hp, 140);
  g.player.hp = 1; clearBoss(g); assert.equal(g.player.hp, 60);
  g.chooseBossReward(null); assert.equal(g.player.hp, 60);
});

test('vest reduces contact and projectile damage after dodge/grace/shield without extra hurt sounds', () => {
  let hurts = 0; const g = new Game(() => .5, () => hurts++); g.start('endless'); equip(g, 'vest'); g.nextSpawn = 999;
  const enemy = frozenEnemy(g, g.player.x, g.player.z); g.step(.01, idle); near(g.player.hp, 100 - enemy.damage * .8);
  g.enemies = []; g.player.invulnerable = 0;
  g.shoot(g.player, 0, true, 10); g.step(.01, idle); near(g.player.hp, 100 - enemy.damage * .8 - 8); assert.equal(hurts, 2);
  g.superBuffs.add('shield'); g.player.invulnerable = 0;
  g.step(.01, { ...idle, dodge: true }); g.damage(100); assert.equal(g.shieldCooldown, 0);
  g.player.invulnerable = 0; const hp = g.player.hp; g.damage(1000);
  assert.equal(g.player.hp, hp); assert.equal(g.shieldCooldown, 12); assert.equal(hurts, 2);
  g.damage(1000); assert.equal(g.player.hp, hp);
  g.player.invulnerable = 0; g.damage(10); near(g.player.hp, hp - 8); assert.equal(hurts, 3);
});

test('weapon profiles preserve upgrades, damage, projectile limits, speed, lifetime, hit count and firing interval', () => {
  for (const weapon of ['caps', 'ricochet', 'picks', 'shotgun'] as const) {
    const g = game(); g.weapon = weapon; g.upgrades.damage = 2; g.upgrades.rate = 3; g.upgrades.count = 2; g.upgrades.pierce = 2; g.training.power = 4;
    g.step(.01, { ...idle, fire: true }); const profile = WEAPON_PROFILES[weapon];
    assert.equal(g.bullets.length, weapon === 'shotgun' ? 7 : 3);
    near(g.fireTime, WEAPON.interval * profile.interval / 1.54);
    for (const bullet of g.bullets) {
      near(bullet.damage, 18 * 1.5 * 1.2 * profile.damage); near(Math.hypot(bullet.vx, bullet.vz), 21 * profile.speed);
      near(bullet.life, profile.lifetime - .01); assert.equal(bullet.remaining, profile.hits + 2); assert.equal(bullet.weapon, weapon);
    }
    if (weapon === 'shotgun') {
      const directions = g.bullets.map(b => Math.atan2(b.vx, -b.vz));
      near(Math.max(...directions) - Math.min(...directions), 40 * Math.PI / 180);
    }
    const count = g.bullets.length; g.step(.01, { ...idle, fire: true }); assert.equal(g.bullets.length, count);
    while (g.bullets.length < 239) g.shoot({ x: 0, z: 0 }, 0);
    g.fireTime = 0; g.step(.01, { ...idle, fire: true }); assert.equal(g.bullets.length, 240);
    g.shoot(g.player, 0, true); assert.equal(g.bullets.length, 240);
  }
});

test('shotgun pellets reach farther and expire at 0.7 seconds; picks keep their hit allowance', () => {
  const g = game(); equip(g, 'shotgun'); g.shoot({ x: 0, z: -5 }, 0);
  for (let i = 0; i < 41; i++) g.step(1 / 60, idle);
  assert.equal(g.bullets.length, 1); g.step(.02, idle); assert.equal(g.bullets.length, 0);
  for (const piercing of [0, 3]) {
    const picks = game(); equip(picks, 'picks'); picks.upgrades.pierce = piercing;
    const enemies = Array.from({ length: 7 }, (_, i) => frozenEnemy(picks, 0, -5 + i * 1.3));
    picks.shoot({ x: 0, z: -6 }, 0); for (let i = 0; i < 24; i++) picks.step(1 / 60, idle);
    assert.equal(enemies.filter(e => e.hp < e.maxHp).length, 3 + piercing);
    for (const e of enemies.filter(e => e.hp < e.maxHp)) near(e.hp, e.maxHp - 22.5);
  }
});

test('ricochet targets the nearest living unhit enemy within five units and cannot repeat a hit', () => {
  const g = game(); equip(g, 'ricochet');
  const first = frozenEnemy(g, 0, 0), nearest = frozenEnemy(g, 2, 0), farther = frozenEnemy(g, -3, 0);
  const dead = frozenEnemy(g, .5, 0); dead.hp = 0;
  g.shoot({ x: 0, z: 0 }, 0); const bullet = g.bullets[0]; g.step(0, idle);
  assert.equal(first.hp, first.maxHp - 18); near(bullet.vx, 21); near(bullet.vz, 0);
  g.step(0, idle); assert.equal(first.hp, first.maxHp - 18);
  bullet.x = nearest.x; bullet.z = nearest.z; g.step(0, idle); near(bullet.vx, -21);
  bullet.x = farther.x; bullet.z = farther.z; g.step(0, idle);
  assert.equal(bullet.hit.size, 3); assert.equal(g.bullets.length, 0);
  const isolated = game(); equip(isolated, 'ricochet'); isolated.upgrades.pierce = 3;
  frozenEnemy(isolated, 0, 0); frozenEnemy(isolated, 5.01, 0);
  isolated.shoot({ x: 0, z: 0 }, 0); isolated.step(0, idle); assert.equal(isolated.bullets.length, 0);
});

test('all equipment projectiles explode only on their first direct hit, with their own damage', () => {
  for (const weapon of ['ricochet', 'picks', 'shotgun'] as const) {
    const g = game(); equip(g, weapon); g.superBuffs.add('explosive'); g.upgrades.pierce = 2;
    const first = frozenEnemy(g, 0, 0), second = frozenEnemy(g, 1, 0), third = frozenEnemy(g, 2.4, 0);
    g.shoot({ x: 0, z: 0 }, 0); const bullet = g.bullets[0], damage = bullet.damage; g.step(0, idle);
    near(first.hp, first.maxHp - damage); near(second.hp, second.maxHp - damage * .4); near(third.hp, third.maxHp);
    bullet.x = second.x; bullet.z = second.z; g.step(0, idle);
    near(third.hp, third.maxHp); assert.equal(g.effects.filter(e => e.radius === 1.5).length, 1);
  }
});

test('orbit and trail scale with power training, not equipped weapon multipliers', () => {
  for (const weapon of ['picks', 'shotgun'] as const) {
    const g = game(); equip(g, weapon); g.training.power = 10; g.upgrades.damage = 3;
    g.superBuffs.add('orbit'); const orbit = frozenEnemy(g, g.orbitPosition.x, g.orbitPosition.z);
    const trail = frozenEnemy(g, 5, 0); g.trails.push({ x: 5, z: 0, id: 999, life: 3 });
    g.step(0, idle); near(orbit.hp, orbit.maxHp - 18 * 1.75 * 1.5); near(trail.hp, trail.maxHp - 18 * 1.75 * 1.5 * .5);
  }
});

test('last regular cap precedes training; multiple banked levels heal and train one at a time', () => {
  const g = game(); cap(g); g.upgrades.magnet--; g.player.hp = 1; g.player.maxHp = 1000;
  g.level = 28; g.xp = xpRequired(28) + xpRequired(29) + xpRequired(30) + xpRequired(31); g.checkLevel();
  assert.deepEqual(g.choices, ['magnet']); assert.equal(g.player.hp, 1);
  g.choose('magnet'); assert.equal(g.mode, 'training'); assert.equal(g.level, 30); assert.equal(g.player.hp, 26);
  const xp = g.xp; g.checkLevel(); assert.equal(g.xp, xp);
  g.pause(); g.chooseTraining('power'); g.step(50, idle); assert.equal(g.training.power, 0); g.pause();
  g.chooseTraining('power'); assert.equal(g.mode, 'training'); assert.equal(g.level, 32); assert.equal(g.player.hp, 76);
  g.chooseTraining('endurance'); assert.equal(g.mode, 'playing'); assert.equal(g.player.maxHp, 1015); assert.equal(g.player.hp, 91);
  assert.deepEqual(g.training, { power: 1, endurance: 1 }); near(g.weaponDamage, 18 * 2.25 * 1.05);
  for (let i = 0; i < 101; i++) {
    g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.mode, 'playing');
    g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.mode, 'training'); g.chooseTraining('power');
  }
  assert.equal(g.training.power, 102); near(g.weaponDamage, 18 * 2.25 * 6.1);
});

test('training starts at level 30, repeats on even levels, and waits behind any regular choice', () => {
  for (const mode of ['normal', 'endless'] as const) {
    const g = game(); g.start(mode); cap(g); g.player.maxHp = 1000; g.player.hp = 1;
    for (let level = 2; level <= 36; level++) {
      g.xp = xpRequired(g.level); g.checkLevel();
      assert.equal(g.level, level);
      assert.equal(g.mode, mode === 'endless' && level >= 30 && level % 2 === 0 ? 'training' : 'playing');
      if (g.mode === 'training') g.chooseTraining('power');
    }
    assert.equal(g.training.power, mode === 'endless' ? 4 : 0);
    assert.equal(g.player.hp, 1 + 35 * 25, 'Every capped level still heals, including odd levels');
  }
  const g = game(); g.level = 29; g.xp = xpRequired(29) + xpRequired(30);
  g.checkLevel(); assert.equal(g.mode, 'upgrade'); g.choose(g.choices[0]);
  assert.equal(g.mode, 'training'); assert.equal(g.level, 30);
  g.chooseTraining('endurance'); assert.equal(g.mode, 'upgrade'); assert.equal(g.level, 31);
  g.choose(g.choices[0]); assert.equal(g.mode, 'playing');
  g.level = 31; g.xp = xpRequired(31); g.checkLevel(); g.menu();
  g.start('endless'); g.xp = 12; g.checkLevel(); g.choose(g.choices[0]);
  assert.equal(g.mode, 'playing'); assert.equal(g.training.endurance, 0);
});

test('buffed shotgun more than doubles sustained close-range damage and reaches beyond the old range', () => {
  function damageOverTime(legacy: boolean, distance: number) {
    const g = game(); equip(g, 'shotgun');
    const e = frozenEnemy(g, 0, g.player.z - distance);
    // Wrap shots to reproduce the old profile without changing the shared configuration.
    const shoot = g.shoot.bind(g);
    if (legacy) g.shoot = (...args) => {
      const count = g.bullets.length; shoot(...args);
      if (g.bullets.length > count) { const b = g.bullets.at(-1)!; b.damage = g.weaponDamage * .5; b.life = .4; }
    };
    for (let i = 0; i < 600; i++) {
      const shots = g.shots;
      g.step(1 / 60, { ...idle, aim: e, fire: true });
      if (legacy && g.shots > shots) g.fireTime = .32 * 1.6;
    }
    return e.maxHp - e.hp;
  }
  assert.ok(damageOverTime(false, 1.5) > damageOverTime(true, 1.5) * 2);
  assert.equal(damageOverTime(true, 11), 0);
  assert.ok(damageOverTime(false, 11) > 0);
});

test('boss-bank training completes before the mixed reward, and menu/restart erase pending rewards', () => {
  const g = game(); cap(g); g.player.hp = 1; g.player.maxHp = 200; g.level = 29;
  g.pickups.push({ id: 999, x: 10, z: 7, value: xpRequired(29) + xpRequired(30) + xpRequired(31) }); clearBoss(g);
  assert.equal(g.mode, 'training'); assert.equal(g.player.hp, 71);
  g.chooseTraining('power'); assert.equal(g.mode, 'training'); assert.equal(g.player.hp, 121);
  g.chooseTraining('endurance'); assert.equal(g.mode, 'bossReward'); assert.equal(g.player.hp, 136);
  const selected = g.bossChoices[0]; g.chooseBossReward(selected); assert.equal(g.round, 10);
  clearBoss(g); g.menu();
  assert.equal(g.weapon, 'caps'); assert.equal(g.armor, 'none'); assert.equal(g.armorHp, 0);
  assert.deepEqual(g.training, { power: 0, endurance: 0 }); assert.equal(g.bossChoices.length, 0);
  g.start('normal'); g.xp = 12; g.checkLevel(); g.choose(g.choices[0]);
  assert.equal(g.mode, 'playing'); assert.equal(g.round, 1); assert.equal(g.encounter, 'wave');
  assert.equal(g.player.maxHp, 100); assert.equal(g.bossChoices.length, 0);
});

test('Normal never offers equipment/training and ignores Endless combat and healing bonuses', () => {
  const g = game(); equip(g, 'glass'); g.training.endurance = 5; g.training.power = 10;
  g.start('normal'); assert.equal(g.player.maxHp, 100); assert.deepEqual(g.training, { power: 0, endurance: 0 });
  cap(g); g.player.hp = 10; g.xp = xpRequired(g.level); g.checkLevel(); assert.equal(g.mode, 'playing'); assert.equal(g.player.hp, 35);
  g.weapon = 'shotgun'; g.armor = 'apron'; g.training.power = 100;
  g.heal(25); assert.equal(g.player.hp, 60); near(g.weaponDamage, 18 * 2.25);
  g.shoot(g.player, 0); assert.equal(g.bullets[0].weapon, 'caps');
  g.armor = 'vest'; g.damage(10); assert.equal(g.player.hp, 50);
  g.round = 3; g.encounter = 'boss'; g.spawn('boss', { x: 10, z: -5 }).hp = 0; g.step(.01, idle);
  assert.equal(g.mode, 'victory'); assert.equal(g.bossChoices.length, 0); assert.equal(g.bossChoices.length, 0);
});
