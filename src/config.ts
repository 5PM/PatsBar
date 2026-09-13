export type EnemyKind = 'olive' | 'bottle' | 'boss';
export type Mode = 'title' | 'playing' | 'upgrade' | 'super' | 'paused' | 'victory' | 'defeat';
export const HEALING = { round: 30, boss: 45 };
export type SuperBuffId = 'explosive' | 'orbit' | 'shield' | 'trail';
export const SUPER_BUFFS: { id: SuperBuffId; name: string; icon: string; description: string }[] = [
  { id: 'explosive', name: 'Explosive Caps', icon: '✹', description: 'First impact blasts nearby enemies for 40% cap damage.' },
  { id: 'orbit', name: 'Bar Orbit', icon: '◎', description: 'An orbiting cap deals weapon damage on contact every 0.5 seconds.' },
  { id: 'shield', name: 'House Shield', icon: '◇', description: 'Block one hit. Recharges after 12 seconds of active play.' },
  { id: 'trail', name: 'Hot Foot', icon: '♨', description: 'Dodging leaves a 3-second trail dealing 50% weapon damage every 0.5 seconds.' },
];
export type RunMode = 'normal' | 'endless';
export type Encounter = 'wave' | 'boss';
export type UpgradeId = 'damage' | 'rate' | 'count' | 'pierce' | 'speed' | 'health' | 'magnet';
export interface Upgrade { id: UpgradeId; name: string; description: string; icon: string; cap: number }
export const UPGRADES: Upgrade[] = [
  { id: 'damage', name: 'Heavy metal', description: '+25% bottle-cap damage. Make every hit count.', icon: '✦', cap: 5 },
  { id: 'rate', name: 'Quick pour', description: '+18% fire rate. Keep the caps coming.', icon: '»', cap: 5 },
  { id: 'count', name: 'On the house', description: '+1 cap per throw in a tight spread.', icon: '⋮', cap: 3 },
  { id: 'pierce', name: 'Through & through', description: 'Caps pass through one additional enemy.', icon: '➶', cap: 3 },
  { id: 'speed', name: 'Happy feet', description: '+10% movement speed. Stay one step ahead.', icon: '↗', cap: 4 },
  { id: 'health', name: 'Second wind', description: '+25 maximum health and restore 35 health.', icon: '♥', cap: 4 },
  { id: 'magnet', name: 'Tab collector', description: '+45% pickup radius. Bring the XP to you.', icon: '◎', cap: 4 },
];
export const ARENA = { x: 14, z: 8 };
export const WAVES = [
  { duration: 60, interval: 1.35, bottleChance: .12, max: 24, name: 'A quiet night' },
  { duration: 60, interval: .95, bottleChance: .30, max: 32, name: 'The usual trouble' },
  { duration: 60, interval: .68, bottleChance: .42, max: 42, name: 'One more round' },
];
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; radius: number; damage: number; xp: number }> = {
  olive: { hp: 32, speed: 1.65, radius: .48, damage: 12, xp: 3 },
  bottle: { hp: 64, speed: .85, radius: .55, damage: 16, xp: 5 },
  boss: { hp: 36000, speed: .65, radius: 1.2, damage: 22, xp: 0 },
};
export const WEAPON = { damage: 18, interval: .32, speed: 21, lifetime: 1.8 };
export const xpRequired = (level: number) => 12 + (level - 1) * 8;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function waveDifficulty(runMode: RunMode, round: number) {
  const index = clamp(round - 1, 0, 2);
  const base = WAVES[index];
  const n = runMode === 'endless' ? Math.max(0, round - 3) : 0;
  return {
    ...base,
    name: n ? 'Still on the house' : base.name,
    hp: (1 + index * .16) * (1 + .12 * n),
    damage: 1 + .08 * n,
    speed: (1 + index * .08) * Math.min(1.5, 1 + .025 * n),
    interval: Math.max(.25, base.interval / (1 + .08 * n)),
    max: Math.min(60, base.max + 2 * n),
    bottleChance: Math.min(.6, base.bottleChance + .01 * n),
  };
}

export function bossDifficulty(runMode: RunMode, bossNumber: number) {
  const n = runMode === 'endless' ? Math.max(0, bossNumber - 1) : 0;
  return { hp: 1 + .3 * n, damage: 1 + .15 * n, recovery: Math.min(1.5, 1 + .08 * n) };
}

export function bossReinforcementInterval(bossNumber: number) {
  return Math.max(.5, 3 / (1.2 ** Math.max(0, bossNumber - 3)));
}
