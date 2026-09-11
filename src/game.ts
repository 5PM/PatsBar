import { ARENA, clamp, ENEMIES, type EnemyKind, type Mode, UPGRADES, type UpgradeId, WAVES, WEAPON, xpRequired } from './config';
export interface Vec { x: number; z: number }
export interface Enemy extends Vec { id: number; kind: EnemyKind; hp: number; maxHp: number; radius: number; cooldown: number; flash: number; phase: 'rest' | 'warning' | 'charge'; phaseTime: number; target: Vec; attack: number }
export interface Bullet extends Vec { id: number; vx: number; vz: number; life: number; hostile: boolean; damage: number; remaining: number; hit: Set<number> }
export interface Pickup extends Vec { id: number; value: number }
export interface Effect extends Vec { id: number; life: number; color: string }
export interface Input { x: number; z: number; aim: Vec; fire: boolean; dodge: boolean }
export class Game {
  mode: Mode = 'title'; resumeMode: 'playing' | 'upgrade' = 'playing';
  player = { x: 0, z: 3, hp: 100, maxHp: 100, invulnerable: 0, dodge: 0, dash: 0, dx: 0, dz: -1 };
  enemies: Enemy[] = []; bullets: Bullet[] = []; pickups: Pickup[] = []; effects: Effect[] = [];
  upgrades: Record<UpgradeId, number> = { damage: 0, rate: 0, count: 0, pierce: 0, speed: 0, health: 0, magnet: 0 };
  choices: UpgradeId[] = []; wave = 0; waveTime = 0; elapsed = 0; level = 1; xp = 0; kills = 0; shots = 0; nextSpawn = .8; fireTime = 0; sequence = 0; banner = ''; bannerTime = 0;
  constructor(public random: () => number = Math.random, public onHurt: () => void = () => {}) {}
  start() {
    const fresh = new Game(this.random, this.onHurt); Object.assign(this, fresh); this.mode = 'playing'; this.announce('ROUND 01 · A QUIET NIGHT');
  }
  announce(text: string) { this.banner = text; this.bannerTime = 3; }
  pause() { if (this.mode === 'playing' || this.mode === 'upgrade') { this.resumeMode = this.mode; this.mode = 'paused'; } else if (this.mode === 'paused') this.mode = this.resumeMode; }
  choose(id: UpgradeId) {
    if (this.mode !== 'upgrade' || !this.choices.includes(id)) return;
    const config = UPGRADES.find(u => u.id === id)!;
    if (this.upgrades[id] >= config.cap) return;
    this.upgrades[id]++;
    if (id === 'health') { this.player.maxHp += 25; this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35); }
    this.choices = []; this.mode = 'playing'; this.checkLevel();
  }
  checkLevel() {
    if (this.xp < xpRequired(this.level)) return;
    this.xp -= xpRequired(this.level); this.level++;
    const available = UPGRADES.filter(u => this.upgrades[u.id] < u.cap).map(u => u.id);
    this.choices = [];
    while (available.length && this.choices.length < 3) this.choices.push(available.splice(Math.floor(this.random() * available.length), 1)[0]);
    if (this.choices.length) this.mode = 'upgrade';
    else this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
  }
  spawn(kind: EnemyKind, pos?: Vec) {
    const side = Math.floor(this.random() * 4);
    const p = pos ?? { x: side < 2 ? (side ? -1 : 1) * 13.4 : (this.random() * 2 - 1) * 13, z: side >= 2 ? (side === 2 ? -1 : 1) * 7.4 : (this.random() * 2 - 1) * 7 };
    const c = ENEMIES[kind]; const hp = c.hp * (kind === 'boss' ? 1 : 1 + this.wave * .16);
    const e: Enemy = { ...p, id: ++this.sequence, kind, hp, maxHp: hp, radius: c.radius, cooldown: 1.5 + this.random(), flash: 0, phase: 'rest', phaseTime: 2.4, target: { x: 0, z: 0 }, attack: 0 };
    this.enemies.push(e); return e;
  }
  damage(amount: number) {
    if (amount <= 0 || this.player.invulnerable > 0 || this.mode !== 'playing') return;
    this.player.hp = Math.max(0, this.player.hp - amount); this.player.invulnerable = .9;
    this.effect(this.player, '#ff745c');
    this.onHurt();
    if (!this.player.hp) this.mode = 'defeat';
  }
  effect(pos: Vec, color: string) { if (this.effects.length < 80) this.effects.push({ ...pos, id: ++this.sequence, life: .4, color }); }
  shoot(pos: Vec, angle: number, hostile = false) {
    if (this.bullets.length >= 240) return;
    const speed = hostile ? 5.2 : WEAPON.speed;
    this.bullets.push({ ...pos, id: ++this.sequence, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, life: hostile ? 6 : WEAPON.lifetime, hostile, damage: hostile ? 14 : WEAPON.damage * (1 + this.upgrades.damage * .25), remaining: 1 + (hostile ? 0 : this.upgrades.pierce), hit: new Set() });
  }
  step(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    this.elapsed += dt; this.bannerTime -= dt; this.waveTime += dt;
    const p = this.player; p.invulnerable = Math.max(0, p.invulnerable - dt); p.dodge = Math.max(0, p.dodge - dt); p.dash = Math.max(0, p.dash - dt);
    const length = Math.hypot(input.x, input.z); const mx = length ? input.x / length : 0, mz = length ? input.z / length : 0;
    if (input.dodge && p.dodge === 0) { const a = Math.atan2(input.aim.x - p.x, input.aim.z - p.z); p.dx = length ? mx : Math.sin(a); p.dz = length ? mz : Math.cos(a); p.dash = .2; p.dodge = 2.5; p.invulnerable = .32; this.effect(p, '#b4f3d2'); }
    const speed = 4.6 * (1 + this.upgrades.speed * .1);
    p.x = clamp(p.x + (p.dash > 0 ? p.dx * 17 : mx * speed) * dt, -ARENA.x + .5, ARENA.x - .5);
    p.z = clamp(p.z + (p.dash > 0 ? p.dz * 17 : mz * speed) * dt, -ARENA.z + .5, ARENA.z - .5);
    this.fireTime -= dt;
    if (input.fire && this.fireTime <= 0) {
      this.fireTime = WEAPON.interval / (1 + this.upgrades.rate * .18); this.shots++;
      const angle = Math.atan2(input.aim.x - p.x, input.aim.z - p.z), count = 1 + this.upgrades.count;
      for (let i = 0; i < count; i++) this.shoot(p, angle + (i - (count - 1) / 2) * .11);
    }
    if (this.wave < 3 && this.waveTime < WAVES[this.wave].duration) {
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0 && this.enemies.length < WAVES[this.wave].max) {
        this.nextSpawn = WAVES[this.wave].interval; this.spawn(this.random() < WAVES[this.wave].bottleChance ? 'bottle' : 'olive');
      }
    }
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt); e.cooldown -= dt;
      const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz) || 1;
      let move = ENEMIES[e.kind].speed * (1 + Math.min(this.wave, 2) * .08);
      if (e.kind === 'boss') {
        e.phaseTime -= dt; const rage = e.hp < e.maxHp * .5;
        if (e.phase === 'rest' && e.phaseTime <= 0) { e.phase = 'warning'; e.phaseTime = rage ? .85 : 1.2; e.target = { x: p.x, z: p.z }; }
        else if (e.phase === 'warning' && e.phaseTime <= 0) {
          if (e.attack % 2 === 0) { e.phase = 'charge'; e.phaseTime = .75; }
          else { for (let i = 0; i < (rage ? 22 : 16); i++) this.shoot(e, i * Math.PI * 2 / (rage ? 22 : 16) + this.elapsed * .2, true); e.phase = 'rest'; e.phaseTime = rage ? 1.3 : 2.1; e.attack++; }
        } else if (e.phase === 'charge' && e.phaseTime <= 0) { e.phase = 'rest'; e.phaseTime = rage ? 1.3 : 2.1; e.attack++; }
        if (e.phase === 'charge') { const tx = e.target.x - e.x, tz = e.target.z - e.z, d = Math.hypot(tx, tz); if (d > .2) { const travel = Math.min(d, dt * 16); e.x += tx / d * travel; e.z += tz / d * travel; } move = 0; }
        else if (e.phase === 'warning') move = 0;
      } else if (e.kind === 'bottle') {
        if (dist < 7) move = 0;
        if (e.cooldown <= 0) { this.shoot(e, Math.atan2(dx, dz), true); e.cooldown = 2.8; }
      }
      e.x = clamp(e.x + dx / dist * move * dt, -13.4, 13.4); e.z = clamp(e.z + dz / dist * move * dt, -7.4, 7.4);
      if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius + .35) this.damage(ENEMIES[e.kind].damage);
    }
    for (const b of this.bullets) {
      b.life -= dt; b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.x) > 16 || Math.abs(b.z) > 10) b.life = 0;
      if (b.hostile) { if (Math.hypot(b.x - p.x, b.z - p.z) < .48) { this.damage(b.damage); b.life = 0; } }
      else for (const e of this.enemies) {
        if (b.life <= 0 || e.hp <= 0 || b.hit.has(e.id)) continue;
        if (Math.hypot(b.x - e.x, b.z - e.z) < e.radius + .2) { e.hp -= b.damage; e.flash = .12; b.hit.add(e.id); b.remaining--; this.effect(e, '#e9c978'); if (b.remaining <= 0) b.life = 0; }
      }
    }
    for (const e of this.enemies.filter(e => e.hp <= 0)) {
      this.kills++; this.effect(e, '#94d9a4');
      if (e.kind === 'boss') { if (this.mode === 'playing') this.mode = 'victory'; }
      else {
        const value = ENEMIES[e.kind].xp;
        if (this.pickups.length < 160) this.pickups.push({ x: e.x, z: e.z, value, id: ++this.sequence });
        else this.pickups[0].value += value;
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0); this.bullets = this.bullets.filter(b => b.life > 0);
    for (const orb of this.pickups) {
      const dx = p.x - orb.x, dz = p.z - orb.z, d = Math.hypot(dx, dz);
      if (d < 2 * (1 + this.upgrades.magnet * .45)) { const amount = Math.min(d, dt * 10); orb.x += dx / (d || 1) * amount; orb.z += dz / (d || 1) * amount; }
      if (d < .55) { this.xp += orb.value; orb.value = 0; }
    }
    this.pickups = this.pickups.filter(o => o.value > 0);
    this.effects.forEach(e => e.life -= dt); this.effects = this.effects.filter(e => e.life > 0);
    if (this.mode !== 'playing') return;
    this.checkLevel();
    if (this.wave < 3 && this.waveTime >= WAVES[this.wave].duration && !this.enemies.length) {
      this.wave++; this.waveTime = 0; this.nextSpawn = 1.5; this.bullets = this.bullets.filter(b => !b.hostile); p.hp = Math.min(p.maxHp, p.hp + 20);
      // Bank leftover XP between waves so no upgrade is lost to an arena transition.
      this.xp += this.pickups.reduce((sum, o) => sum + o.value, 0); this.pickups = [];
      if (this.wave === 3) { this.spawn('boss', { x: 0, z: -5 }); this.announce('LAST CALL · THE BIG GUY'); }
      else this.announce(`ROUND 0${this.wave + 1} · ${WAVES[this.wave].name.toUpperCase()}`);
    }
  }
}
