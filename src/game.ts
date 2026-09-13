import { ARENA, bossDifficulty, bossReinforcementInterval, clamp, ENEMIES, HEALING, SUPER_BUFFS, type SuperBuffId, type EnemyKind, type Mode, type RunMode, type Encounter, UPGRADES, type UpgradeId, waveDifficulty, WEAPON, xpRequired } from './config';
import { EQUIPMENT, isSelectionMode, WEAPON_PROFILES, type ArmorId, type WeaponId, type EquipmentId, type TrainingId, type SelectionMode } from './config';
export interface Vec { x: number; z: number }
export interface Enemy extends Vec { id: number; kind: EnemyKind; hp: number; maxHp: number; radius: number; speed: number; damage: number; projectileDamage: number; recovery: number; cooldown: number; flash: number; phase: 'rest' | 'warning' | 'charge'; phaseTime: number; target: Vec; attack: number }
export interface Bullet extends Vec { id: number; vx: number; vz: number; life: number; hostile: boolean; weapon: WeaponId; damage: number; remaining: number; hit: Set<number> }
export interface Pickup extends Vec { id: number; value: number }
export interface Effect extends Vec { id: number; life: number; color: string; radius?: number }
export interface Trail extends Vec { id: number; life: number }
export interface Input { x: number; z: number; aim: Vec; fire: boolean; dodge: boolean }
export class Game {
  mode: Mode = 'title'; resumeMode: 'playing' | SelectionMode = 'playing';
  weapon: WeaponId = 'caps'; armor: ArmorId = 'none'; armorHp = 0;
  equipmentChoices: EquipmentId[] = []; training: Record<TrainingId, number> = { power: 0, endurance: 0 };
  get permanentMaxHp() { return this.player.maxHp - this.armorHp; }
  get activeWeapon() { return this.runMode === 'endless' ? this.weapon : 'caps'; }
  superBuffs = new Set<SuperBuffId>(); superChoices: SuperBuffId[] = [];
  shieldCooldown = 0; trails: Trail[] = []; orbitHits = new Map<number, number>(); trailHits = new Map<number, number>();
  private pendingEncounter = false; private pendingSuper = false; private pendingEquipment = false;
  get weaponDamage() { return WEAPON.damage * (1 + this.upgrades.damage * .25) * (this.runMode === 'endless' ? 1 + .05 * this.training.power : 1); }
  get orbitPosition() { return { x: this.player.x + Math.cos(this.elapsed * Math.PI) * 1.6, z: this.player.z + Math.sin(this.elapsed * Math.PI) * 1.6 }; }
  runMode: RunMode = 'normal'; encounter: Encounter = 'wave'; round = 1; roundsCompleted = 0; bossesDefeated = 0;
  bossCleared = false;
  get bossNumber() { return Math.floor(this.round / 3); }
  get difficulty() { return waveDifficulty(this.runMode, this.round); }
  player = { x: 0, z: 3, hp: 100, maxHp: 100, invulnerable: 0, dodge: 0, dash: 0, dx: 0, dz: -1 };
  enemies: Enemy[] = []; bullets: Bullet[] = []; pickups: Pickup[] = []; effects: Effect[] = [];
  upgrades: Record<UpgradeId, number> = { damage: 0, rate: 0, count: 0, pierce: 0, speed: 0, health: 0, magnet: 0 };
  choices: UpgradeId[] = []; waveTime = 0; elapsed = 0; level = 1; xp = 0; kills = 0; shots = 0; nextSpawn = .8; fireTime = 0; sequence = 0; banner = ''; bannerTime = 0;
  constructor(public random: () => number = Math.random, public onHurt: () => void = () => {}) {}
  start(runMode: RunMode = 'normal') {
    const fresh = new Game(this.random, this.onHurt); Object.assign(this, fresh); this.runMode = runMode; this.mode = 'playing'; this.announce('ROUND 01 · A QUIET NIGHT');
  }
  menu() { const selected = this.runMode; this.start(selected); this.mode = 'title'; }
  private advanceEncounter() {
    this.pendingEncounter = true;
    this.pendingSuper = this.encounter === 'boss' && this.runMode === 'endless';
    this.pendingEquipment = this.pendingSuper;
    this.heal(this.pendingSuper ? HEALING.boss : HEALING.round);
    this.xp += this.pickups.reduce((sum, o) => sum + o.value, 0); this.pickups = [];
    this.bullets = this.bullets.filter(b => !b.hostile);
    this.continueRewards();
  }
  private continueRewards() {
    while (this.xp >= xpRequired(this.level)) { this.checkLevel(); if (isSelectionMode(this.mode)) return; }
    if (this.pendingSuper) {
      this.pendingSuper = false;
      const available = SUPER_BUFFS.map(b => b.id).filter(id => !this.superBuffs.has(id));
      this.superChoices = [];
      while (available.length && this.superChoices.length < 3) this.superChoices.push(available.splice(Math.floor(this.random() * available.length), 1)[0]);
      if (this.superChoices.length) { this.mode = 'super'; return; }
    }
    if (this.pendingEquipment) {
      this.pendingEquipment = false;
      const available = EQUIPMENT.filter(e => e.id !== this.weapon && e.id !== this.armor);
      const take = (slot?: 'weapon' | 'armor') => {
        const pool = available.filter(e => !slot || e.slot === slot);
        const item = pool[Math.floor(this.random() * pool.length)];
        available.splice(available.indexOf(item), 1); this.equipmentChoices.push(item.id);
      };
      this.equipmentChoices = []; take('weapon'); take('armor'); take();
      this.mode = 'equipment'; return;
    }
    if (this.pendingEncounter) { this.pendingEncounter = false; this.beginNextEncounter(); }
  }
  chooseSuper(id: SuperBuffId) {
    if (this.mode !== 'super' || !this.superChoices.includes(id) || this.superBuffs.has(id)) return;
    this.superBuffs.add(id); this.superChoices = []; this.mode = 'playing'; this.continueRewards();
  }
  chooseEquipment(id: EquipmentId | null) {
    if (this.mode !== 'equipment' || this.runMode !== 'endless' || (id !== null && !this.equipmentChoices.includes(id))) return;
    if (id !== null) {
      const item = EQUIPMENT.find(e => e.id === id)!;
      if (item.slot === 'weapon') this.weapon = item.id;
      else {
        const permanentHp = this.permanentMaxHp;
        const addedHp = item.id === 'glass' ? 75 : 0;
        // Armor capacity is filled directly, after the outgoing armor is removed.
        const currentHp = Math.min(this.player.hp, permanentHp);
        this.armor = item.id; this.armorHp = addedHp;
        this.player.maxHp = permanentHp + addedHp; this.player.hp = currentHp + addedHp;
      }
    }
    this.equipmentChoices = []; this.mode = 'playing'; this.continueRewards();
  }
  chooseTraining(id: TrainingId) {
    if (this.mode !== 'training' || this.runMode !== 'endless' || (id !== 'power' && id !== 'endurance')) return;
    this.training[id]++;
    if (id === 'endurance') { this.player.maxHp += 15; this.heal(15); }
    this.mode = 'playing'; this.continueRewards();
  }
  heal(amount: number) {
    const received = Math.round(amount * (this.runMode === 'endless' && this.armor === 'apron' ? 1.3 : 1));
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + received);
  }
  private beginNextEncounter() {
    const finishedWave = this.encounter === 'wave';
    this.waveTime = 0; this.nextSpawn = 1.5;
    if (finishedWave) this.roundsCompleted++;
    if (finishedWave && this.round % 3 === 0) {
      this.encounter = 'boss'; this.bossCleared = false;
      this.spawn('boss', { x: 0, z: -5 });
      if (this.runMode === 'endless' && this.bossNumber >= 3) this.nextSpawn = bossReinforcementInterval(this.bossNumber);
      this.announce(this.runMode === 'normal' ? 'LAST CALL · THE BIG GUY' : `BOSS ${this.bossNumber} · ${this.bossNumber >= 3 ? 'HE BROUGHT COMPANY' : 'THE BIG GUY'}`);
    } else {
      this.round++; this.encounter = 'wave'; this.bossCleared = false;
      this.announce(`ROUND ${String(this.round).padStart(2, '0')} · ${this.difficulty.name.toUpperCase()}`);
    }
  }
  announce(text: string) { this.banner = text; this.bannerTime = 3; }
  pause() { if (this.mode === 'playing' || isSelectionMode(this.mode)) { this.resumeMode = this.mode; this.mode = 'paused'; } else if (this.mode === 'paused') this.mode = this.resumeMode; }
  choose(id: UpgradeId) {
    if (this.mode !== 'upgrade' || !this.choices.includes(id)) return;
    const config = UPGRADES.find(u => u.id === id)!;
    if (this.upgrades[id] >= config.cap) return;
    this.upgrades[id]++;
    if (id === 'health') { this.player.maxHp += 25; this.heal(35); }
    this.choices = []; this.mode = 'playing'; this.continueRewards();
  }
  checkLevel() {
    if (this.mode !== 'playing' || this.xp < xpRequired(this.level)) return;
    this.xp -= xpRequired(this.level); this.level++;
    const available = UPGRADES.filter(u => this.upgrades[u.id] < u.cap).map(u => u.id);
    this.choices = [];
    while (available.length && this.choices.length < 3) this.choices.push(available.splice(Math.floor(this.random() * available.length), 1)[0]);
    if (this.choices.length) this.mode = 'upgrade';
    else { this.heal(25); if (this.runMode === 'endless') this.mode = 'training'; }
  }
  spawn(kind: EnemyKind, pos?: Vec) {
    const side = Math.floor(this.random() * 4);
    const p = pos ?? { x: side < 2 ? (side ? -1 : 1) * 13.4 : (this.random() * 2 - 1) * 13, z: side >= 2 ? (side === 2 ? -1 : 1) * 7.4 : (this.random() * 2 - 1) * 7 };
    const c = ENEMIES[kind], wave = this.difficulty, boss = bossDifficulty(this.runMode, this.bossNumber);
    const hp = c.hp * (kind === 'boss' ? boss.hp : wave.hp);
    const damageScale = kind === 'boss' ? boss.damage : wave.damage;
    const e: Enemy = { ...p, id: ++this.sequence, kind, hp, maxHp: hp, radius: c.radius,
      speed: c.speed * (kind === 'boss' ? 1.16 : wave.speed), damage: c.damage * damageScale,
      projectileDamage: 14 * damageScale, recovery: kind === 'boss' ? boss.recovery : 1,
      cooldown: 1.5 + this.random(), flash: 0, phase: 'rest', phaseTime: 2.4 / (kind === 'boss' ? boss.recovery : 1), target: { x: 0, z: 0 }, attack: 0 };
    this.enemies.push(e); return e;
  }
  damage(amount: number) {
    if (amount <= 0 || this.player.invulnerable > 0 || this.mode !== 'playing') return;
    if (this.superBuffs.has('shield') && this.shieldCooldown <= 0) {
      this.shieldCooldown = 12; this.player.invulnerable = .9; this.effect(this.player, '#93e9ff', 1); return;
    }
    const reduction = this.runMode === 'endless' && this.armor === 'vest' ? .8 : 1;
    this.player.hp = Math.max(0, this.player.hp - amount * reduction); this.player.invulnerable = .9;
    this.effect(this.player, '#ff745c');
    this.onHurt();
    if (!this.player.hp) this.mode = 'defeat';
  }
  effect(pos: Vec, color: string, radius?: number) { if (this.effects.length < 80) this.effects.push({ ...pos, id: ++this.sequence, life: .4, color, radius }); }
  shoot(pos: Vec, angle: number, hostile = false, hostileDamage = 14) {
    if (this.bullets.length >= 240) return;
    const weapon = hostile ? 'caps' : this.activeWeapon, profile = WEAPON_PROFILES[weapon];
    const speed = hostile ? 5.2 : WEAPON.speed * profile.speed;
    this.bullets.push({ ...pos, id: ++this.sequence, weapon, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, life: hostile ? 6 : profile.lifetime, hostile, damage: hostile ? hostileDamage : this.weaponDamage * profile.damage, remaining: hostile ? 1 : profile.hits + this.upgrades.pierce, hit: new Set() });
  }
  step(dt: number, input: Input) {
    if (this.mode !== 'playing') return;
    this.elapsed += dt; this.bannerTime -= dt; this.waveTime += dt;
    this.shieldCooldown = Math.max(0, this.shieldCooldown - dt);
    this.trails.forEach(t => t.life -= dt); this.trails = this.trails.filter(t => t.life > 0);
    const p = this.player; p.invulnerable = Math.max(0, p.invulnerable - dt); p.dodge = Math.max(0, p.dodge - dt); p.dash = Math.max(0, p.dash - dt);
    const length = Math.hypot(input.x, input.z); const mx = length ? input.x / length : 0, mz = length ? input.z / length : 0;
    if (input.dodge && p.dodge === 0) { const a = Math.atan2(input.aim.x - p.x, input.aim.z - p.z); p.dx = length ? mx : Math.sin(a); p.dz = length ? mz : Math.cos(a); p.dash = .2; p.dodge = 2.5; p.invulnerable = .32; this.effect(p, '#b4f3d2'); }
    const speed = 4.6 * (1 + this.upgrades.speed * .1);
    p.x = clamp(p.x + (p.dash > 0 ? p.dx * 17 : mx * speed) * dt, -ARENA.x + .5, ARENA.x - .5);
    p.z = clamp(p.z + (p.dash > 0 ? p.dz * 17 : mz * speed) * dt, -ARENA.z + .5, ARENA.z - .5);
    if (p.dash > 0 && this.superBuffs.has('trail')) {
      if (this.trails.length >= 32) this.trails.shift();
      this.trails.push({ x: p.x, z: p.z, id: ++this.sequence, life: 3 });
    }
    this.fireTime -= dt;
    if (input.fire && this.fireTime <= 0) {
      const weapon = this.activeWeapon;
      this.fireTime = WEAPON.interval * WEAPON_PROFILES[weapon].interval / (1 + this.upgrades.rate * .18); this.shots++;
      const angle = Math.atan2(input.aim.x - p.x, input.aim.z - p.z), count = (weapon === 'shotgun' ? 5 : 1) + this.upgrades.count;
      const spacing = weapon === 'shotgun' ? (40 * Math.PI / 180) / (count - 1) : .11;
      for (let i = 0; i < count; i++) this.shoot(p, angle + (i - (count - 1) / 2) * spacing);
    }
    const difficulty = this.difficulty;
    const reinforcements = this.runMode === 'endless' && this.encounter === 'boss' && this.bossNumber >= 3 && this.enemies.some(e => e.kind === 'boss' && e.hp > 0);
    if ((this.encounter === 'wave' && this.waveTime < difficulty.duration) || reinforcements) {
      this.nextSpawn -= dt;
      if (this.nextSpawn <= 0 && this.enemies.filter(e => e.kind !== 'boss').length < (reinforcements ? 12 : difficulty.max)) {
        this.nextSpawn = reinforcements ? bossReinforcementInterval(this.bossNumber) : difficulty.interval; this.spawn(this.random() < difficulty.bottleChance ? 'bottle' : 'olive');
      }
    }
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt); e.cooldown -= dt;
      const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz) || 1;
      let move = e.speed;
      if (e.kind === 'boss') {
        e.phaseTime -= dt; const rage = e.hp < e.maxHp * .5;
        if (e.phase === 'rest' && e.phaseTime <= 0) { e.phase = 'warning'; e.phaseTime = rage ? .85 : 1.2; e.target = { x: p.x, z: p.z }; }
        else if (e.phase === 'warning' && e.phaseTime <= 0) {
          if (e.attack % 2 === 0) { e.phase = 'charge'; e.phaseTime = .75; }
          else { for (let i = 0; i < (rage ? 22 : 16); i++) this.shoot(e, i * Math.PI * 2 / (rage ? 22 : 16) + this.elapsed * .2, true, e.projectileDamage); e.phase = 'rest'; e.phaseTime = (rage ? 1.3 : 2.1) / e.recovery; e.attack++; }
        } else if (e.phase === 'charge' && e.phaseTime <= 0) { e.phase = 'rest'; e.phaseTime = (rage ? 1.3 : 2.1) / e.recovery; e.attack++; }
        if (e.phase === 'charge') { const tx = e.target.x - e.x, tz = e.target.z - e.z, d = Math.hypot(tx, tz); if (d > .2) { const travel = Math.min(d, dt * 16); e.x += tx / d * travel; e.z += tz / d * travel; } move = 0; }
        else if (e.phase === 'warning') move = 0;
      } else if (e.kind === 'bottle') {
        if (dist < 7) move = 0;
        if (e.cooldown <= 0) { this.shoot(e, Math.atan2(dx, dz), true, e.projectileDamage); e.cooldown = 2.8; }
      }
      e.x = clamp(e.x + dx / dist * move * dt, -13.4, 13.4); e.z = clamp(e.z + dz / dist * move * dt, -7.4, 7.4);
      if (Math.hypot(e.x - p.x, e.z - p.z) < e.radius + .35) this.damage(e.damage);
    }
    for (const b of this.bullets) {
      b.life -= dt; b.x += b.vx * dt; b.z += b.vz * dt;
      if (Math.abs(b.x) > 16 || Math.abs(b.z) > 10) b.life = 0;
      if (b.hostile) { if (Math.hypot(b.x - p.x, b.z - p.z) < .48) { this.damage(b.damage); b.life = 0; } }
      else for (const e of this.enemies) {
        if (b.life <= 0 || e.hp <= 0 || b.hit.has(e.id)) continue;
        if (Math.hypot(b.x - e.x, b.z - e.z) < e.radius + .2) {
          if (!b.hit.size && this.superBuffs.has('explosive')) {
            this.effect(e, '#ffb65e', 1.5);
            for (const other of this.enemies) if (other.id !== e.id && other.hp > 0 && Math.hypot(other.x - e.x, other.z - e.z) <= 1.5) { other.hp -= b.damage * .4; other.flash = .12; }
          }
          e.hp -= b.damage; e.flash = .12; b.hit.add(e.id); b.remaining--; this.effect(e, '#e9c978'); if (b.remaining <= 0) b.life = 0;
          if (b.weapon === 'ricochet' && b.life > 0) {
            let target: Enemy | undefined, nearest = 5;
            for (const other of this.enemies) {
              const distance = Math.hypot(other.x - b.x, other.z - b.z);
              if (other.hp > 0 && !b.hit.has(other.id) && distance <= nearest) { target = other; nearest = distance; }
            }
            if (!target) b.life = 0;
            else {
              const angle = Math.atan2(target.x - b.x, target.z - b.z), speed = Math.hypot(b.vx, b.vz);
              b.vx = Math.sin(angle) * speed; b.vz = Math.cos(angle) * speed;
            }
            break;
          }
        }
      }
    }
    const orbit = this.orbitPosition;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (this.superBuffs.has('orbit') && Math.hypot(e.x - orbit.x, e.z - orbit.z) <= e.radius + .2 && (this.orbitHits.get(e.id) ?? 0) <= this.elapsed) {
        e.hp -= this.weaponDamage; e.flash = .12; this.orbitHits.set(e.id, this.elapsed + .5); this.effect(e, '#f8da8a');
      }
      if (e.hp > 0 && this.trails.some(t => Math.hypot(e.x - t.x, e.z - t.z) <= .6) && (this.trailHits.get(e.id) ?? 0) <= this.elapsed) {
        e.hp -= this.weaponDamage * .5; e.flash = .12; this.trailHits.set(e.id, this.elapsed + .5); this.effect(e, '#ff9559');
      }
    }
    for (const e of this.enemies.filter(e => e.hp <= 0)) {
      this.kills++; this.effect(e, '#94d9a4');
      if (e.kind === 'boss') {
        this.bossesDefeated++; this.bossCleared = true;
        if (this.mode === 'playing' && this.runMode === 'normal') this.mode = 'victory';
      }
      else {
        const value = ENEMIES[e.kind].xp;
        if (this.pickups.length < 160) this.pickups.push({ x: e.x, z: e.z, value, id: ++this.sequence });
        else this.pickups[0].value += value;
      }
    }
    this.enemies = this.enemies.filter(e => e.hp > 0); this.bullets = this.bullets.filter(b => b.life > 0);
    const living = new Set(this.enemies.map(e => e.id));
    for (const hits of [this.orbitHits, this.trailHits]) for (const [id, until] of hits) if (!living.has(id) || until <= this.elapsed) hits.delete(id);
    for (const orb of this.pickups) {
      const dx = p.x - orb.x, dz = p.z - orb.z, d = Math.hypot(dx, dz);
      if (d < 2 * (1 + this.upgrades.magnet * .45)) { const amount = Math.min(d, dt * 10); orb.x += dx / (d || 1) * amount; orb.z += dz / (d || 1) * amount; }
      if (d < .55) { this.xp += orb.value; orb.value = 0; }
    }
    this.pickups = this.pickups.filter(o => o.value > 0);
    this.effects.forEach(e => e.life -= dt); this.effects = this.effects.filter(e => e.life > 0);
    if (this.mode !== 'playing') return;
    const cleared = this.encounter === 'wave' ? this.waveTime >= difficulty.duration : this.bossCleared;
    if (cleared && !this.enemies.length) this.advanceEncounter();
    else this.checkLevel();
  }
}
