import { Game } from '../src/game';
import assert from 'node:assert/strict';
for (const runMode of ['normal', 'endless'] as const) for (const seed of [4, 15, 42]) {
  let state = seed; const random = () => { state = state * 16807 % 2147483647; return state / 2147483647; };
  const g = new Game(random); g.start(runMode); let tick = 0, bossStart = 0;
  while (!['victory', 'defeat'].includes(g.mode) && tick < 60 * (runMode === 'normal' ? 420 : 3600)) {
    if (g.mode === 'upgrade') { const order = ['count', 'damage', 'rate', 'health', 'speed', 'pierce', 'magnet']; g.choose([...g.choices].sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]); }
    const p = g.player; const target = [...g.enemies].sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    const phase = g.elapsed * .23; let x = Math.cos(phase) * 9 - p.x, z = Math.sin(phase) * 5 - p.z;
    const orb = [...g.pickups].sort((a,b) => Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    if (orb && Math.hypot(orb.x-p.x,orb.z-p.z)<3.5 && (!target || Math.hypot(target.x-p.x,target.z-p.z)>3)) { x=orb.x-p.x; z=orb.z-p.z; }
    let danger = false;
    for (const e of g.enemies) { const d = Math.hypot(e.x-p.x,e.z-p.z); if(d<3) { x+=(p.x-e.x)/(d*d+.1)*10; z+=(p.z-e.z)/(d*d+.1)*10; } if(d<1.6) danger=true; }
    for (const b of g.bullets.filter(b=>b.hostile)) { const d=Math.hypot(b.x-p.x,b.z-p.z); if(d<1.8) { x+=(p.x-b.x)/(d*d+.1)*5; z+=(p.z-b.z)/(d*d+.1)*5; if(d<.9) danger=true; } }
    if(g.encounter==='boss' && !bossStart) bossStart=g.elapsed;
    g.step(1/60,{x,z,aim:target ?? {x:0,z:0},fire:true,dodge:danger}); tick++;
    assert.ok(g.enemies.length <= 60 && g.bullets.length <= 240 && g.pickups.length <= 160 && g.effects.length <= 80);
  }
  console.log(JSON.stringify({runMode,seed,mode:g.mode,time:Math.round(g.elapsed),round:g.round,bosses:g.bossesDefeated,bossTime:runMode === 'normal' ? Math.round(g.elapsed-bossStart) : undefined,level:g.level,kills:g.kills,hp:g.player.hp}));
  if (runMode === 'normal') {
    assert.equal(g.mode, 'victory', `Seed ${seed} should be winnable`);
    assert.ok(g.elapsed - bossStart >= 55 && g.elapsed - bossStart <= 95, 'Offense-focused boss fight should last about 60–90 seconds');
  } else {
    assert.equal(g.mode, 'defeat', 'Endless should end through death, not victory');
    assert.ok(g.round > 3 && g.bossesDefeated >= 1, 'Endless must continue beyond the original ending');
  }
}
