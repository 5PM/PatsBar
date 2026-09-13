import test from 'node:test';
import assert from 'node:assert/strict';
import { Profile, PROFILE_KEY, parseProfile, type ProfileStorage } from './profile';
import { Game, type Input } from './game';
import { SKINS, type SkinId } from './skins';
const idle: Input = { x: 0, z: 0, aim: { x: 0, z: -5 }, fire: false, dodge: false };
class MemoryStorage implements ProfileStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
function bosses(profile: Profile, count: number) { for (let i = 0; i < count; i++) profile.awardBossToken(); }

test('fresh profiles own the original skin with zero tokens; all prices are exact', () => {
  const p = new Profile(); assert.equal(p.tokens, 0); assert.equal(p.equippedSkin, 'classic'); assert.ok(p.owns('classic'));
  assert.equal(p.buy('blue'), false); assert.equal(p.equip('tshirt'), false);
  assert.deepEqual(SKINS.map(s => s.price), [0, 30, 30, 30, 30, 50]);
});

test('boss deaths in both modes award once, immediately, and persist independently of the run', () => {
  for (const mode of ['normal', 'endless'] as const) {
    const storage = new MemoryStorage(), p = new Profile(storage);
    const g = new Game(() => .5, () => {}, () => p.awardBossToken()); g.start(mode);
    g.round = mode === 'normal' ? 3 : 9; g.encounter = 'boss'; g.nextSpawn = 999;
    g.spawn('boss', { x: 10, z: -5 }).hp = 0;
    if (mode === 'endless') g.spawn('bottle', { x: 10, z: 5 });
    g.step(.01, idle); assert.equal(p.tokens, 1); assert.equal(new Profile(storage).tokens, 1);
    assert.equal(g.mode, mode === 'normal' ? 'victory' : 'playing');
    g.step(.01, idle); assert.equal(p.tokens, 1);
    if (mode === 'endless') { g.player.invulnerable = 0; g.damage(10000); assert.equal(g.mode, 'defeat'); }
    g.menu(); g.start(mode); assert.equal(p.tokens, 1);
    g.spawn('boss', { x: 10, z: -5 }).hp = 0; g.step(.01, idle); assert.equal(p.tokens, 2);
  }
});

test('simultaneous defeat and boss death retains the token, with no encounter heal', () => {
  const p = new Profile(), g = new Game(() => .5, () => {}, () => p.awardBossToken()); g.start('endless');
  g.round = 9; g.encounter = 'boss'; g.player.hp = 1;
  g.spawn('boss', { x: 10, z: -5 }).hp = 0; g.spawn('olive', g.player);
  g.step(.01, idle); assert.equal(g.mode, 'defeat'); assert.equal(g.player.hp, 0); assert.equal(p.tokens, 1);
  g.step(10, idle); assert.equal(p.tokens, 1);
});

test('ordinary kills, round rewards, upgrades, and restart never award currency', () => {
  const p = new Profile(), g = new Game(() => .5, () => {}, () => p.awardBossToken()); g.start('endless');
  g.spawn('olive', { x: 10, z: 5 }).hp = 0; g.step(.01, idle); assert.equal(p.tokens, 0);
  g.waveTime = 60; g.step(.01, idle); assert.equal(p.tokens, 0);
  g.xp = 12; g.checkLevel(); g.choose(g.choices[0]); assert.equal(p.tokens, 0);
  g.start('normal'); assert.equal(p.tokens, 0);
});

test('purchase deducts once, unlocks and equips, and survives reload and switching looks', () => {
  const storage = new MemoryStorage(), p = new Profile(storage); bosses(p, 29);
  assert.equal(p.buy('blue'), false); assert.equal(p.tokens, 29);
  p.awardBossToken(); assert.equal(p.buy('blue'), true); assert.equal(p.tokens, 0); assert.equal(p.equippedSkin, 'blue');
  assert.equal(p.buy('blue'), false); assert.equal(p.equip('classic'), true); assert.equal(p.tokens, 0);
  const loaded = new Profile(storage); assert.ok(loaded.owns('blue')); assert.equal(loaded.equip('blue'), true);
  bosses(loaded, 50); assert.equal(loaded.buy('tshirt'), true); assert.equal(loaded.tokens, 0);
  const final = new Profile(storage); assert.equal(final.equippedSkin, 'tshirt'); assert.ok(final.owns('blue') && final.owns('classic'));
  assert.equal(final.equip('gold'), false); assert.equal(final.buy('unknown' as SkinId), false);
});

test('bad or older saved data recovers safely and cannot equip a locked or unknown skin', () => {
  const initial = parseProfile(null);
  for (const raw of ['bad json', '{}', 'null', '{"version":2,"tokens":1000}']) assert.deepEqual(parseProfile(raw), initial);
  for (const tokens of [-1, 1.5, 1e40, '50', null]) assert.equal(parseProfile(JSON.stringify({ version: 1, tokens })).tokens, 0);
  const fixed = parseProfile(JSON.stringify({ version: 1, tokens: 25, ownedSkins: ['blue', 'blue', 'hacked', 7], equippedSkin: 'tshirt' }));
  assert.deepEqual(fixed, { version: 1, tokens: 25, ownedSkins: ['classic', 'blue'], equippedSkin: 'classic' });
});

test('storage failures keep earned tokens and purchases in memory without resetting them', () => {
  let fail = true;
  const storage = new MemoryStorage();
  const set = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { if (fail) throw new Error('Unavailable'); set(key, value); };
  const p = new Profile(storage); bosses(p, 31); assert.equal(p.tokens, 31); assert.equal(p.persistent, false);
  p.refresh(); assert.equal(p.tokens, 31); assert.equal(p.buy('blue'), true); assert.equal(p.tokens, 1);
  fail = false; p.awardBossToken(); assert.equal(p.persistent, true);
  const restored = new Profile(storage); assert.equal(restored.tokens, 2); assert.equal(restored.equippedSkin, 'blue');
  const unreadable = new Profile({ getItem() { throw new Error('Unavailable'); }, setItem() { throw new Error('Unavailable'); } });
  unreadable.awardBossToken(); assert.equal(unreadable.tokens, 1); assert.equal(unreadable.persistent, false);
});

test('separate browser profiles refresh the latest balance before spending or earning', () => {
  const storage = new MemoryStorage(), first = new Profile(storage), second = new Profile(storage);
  bosses(first, 50); assert.equal(second.buy('tshirt'), true); assert.equal(second.tokens, 0);
  assert.equal(first.buy('gold'), false); assert.equal(first.tokens, 0);
  first.awardBossToken(); second.refresh(); assert.equal(second.tokens, 1); assert.equal(second.equippedSkin, 'tshirt');
  assert.equal(JSON.parse(storage.getItem(PROFILE_KEY)!).tokens, 1);
});
