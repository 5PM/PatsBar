import * as T from 'three';
import { Game, type Vec } from './game';

export class View {
  renderer: T.WebGLRenderer; scene = new T.Scene(); camera = new T.OrthographicCamera();
  world = new T.Group(); actors = new Map<number, T.Object3D>(); ray = new T.Raycaster(); floor = new T.Plane(new T.Vector3(0, 1, 0), 0);
  hero!: T.Sprite; heroShadow!: T.Mesh; ring!: T.Mesh; aimRing!: T.Mesh; warning!: T.Mesh; warningLine!: T.Mesh;
  textures: T.Texture[] = []; geometries = new Map<string, T.BufferGeometry>(); materials = new Map<string, T.MeshStandardMaterial>();
  spriteMaterials: T.SpriteMaterial[] = []; ready: Promise<void>;
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace; this.renderer.toneMapping = T.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.2;
    this.scene.background = new T.Color('#101a17'); this.scene.fog = new T.Fog('#101a17', 48, 85);
    this.camera.position.set(0, 27, 25); this.camera.lookAt(0, 0, 0);
    this.scene.add(new T.HemisphereLight('#ffe6bf', '#273d34', 2));
    const sun = new T.DirectionalLight('#ffe1ab', 3); sun.position.set(-8, 19, 8); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 }); sun.shadow.bias = -.001; this.scene.add(sun);
    const green = new T.PointLight('#68e5b0', 50, 28); green.position.set(0, 6, -13); this.scene.add(green);
    this.buildBar(); this.scene.add(this.world);
    this.heroShadow = this.shadow(.65); this.world.add(this.heroShadow);
    this.ring = this.flatRing(.56, .64, '#99dfb5'); this.aimRing = this.flatRing(.22, .26, '#f6d98a'); this.world.add(this.ring, this.aimRing);
    this.warning = this.flatRing(1.4, 1.55, '#ff775c'); this.warning.visible = false; this.world.add(this.warning);
    this.warningLine = new T.Mesh(new T.PlaneGeometry(1.5, 1), new T.MeshBasicMaterial({ color: '#ff775c', transparent: true, opacity: .3, depthWrite: false })); this.warningLine.rotation.x = -Math.PI / 2; this.warningLine.visible = false; this.world.add(this.warningLine);
    this.ready = this.loadSprites(); this.resize(); window.addEventListener('resize', () => this.resize());
  }
  material(color: string, metalness = 0, roughness = .7) {
    const key = `${color}/${metalness}/${roughness}`;
    if (!this.materials.has(key)) this.materials.set(key, new T.MeshStandardMaterial({ color, metalness, roughness }));
    return this.materials.get(key)!;
  }
  mesh(geometry: T.BufferGeometry, color: string, parent: T.Object3D, x = 0, y = 0, z = 0, metalness = 0) {
    const m = new T.Mesh(geometry, this.material(color, metalness)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  shape(key: string, create: () => T.BufferGeometry) { if (!this.geometries.has(key)) this.geometries.set(key, create()); return this.geometries.get(key)!; }
  flatRing(inner: number, outer: number, color: string) { const m = new T.Mesh(new T.RingGeometry(inner, outer, 48), new T.MeshBasicMaterial({ color, transparent: true, opacity: .8, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = .025; return m; }
  shadow(radius: number) { const m = new T.Mesh(this.shape('shadow', () => new T.CircleGeometry(1, 32)), new T.MeshBasicMaterial({ color: '#102015', transparent: true, opacity: .27, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.scale.set(radius, radius * .6, 1); m.position.y = .026; return m; }
  textTexture(text: string, color = '#f1d49a', size = 100, bg?: string) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const ctx = c.getContext('2d')!;
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.font = `bold ${size}px Georgia`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 512, 128);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; this.textures.push(tex); return tex;
  }
  buildBar() {
    const bar = new T.Group(); this.scene.add(bar);
    const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#98603a'; ctx.fillRect(0, 0, 1024, 1024);
    let seed = 12345; const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 4200; i++) { const y = rand() * 1024; ctx.strokeStyle = `rgba(${rand() > .5 ? '43,19,9' : '232,165,94'},${rand() * .12})`; ctx.lineWidth = rand() * 2; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(330, y + rand() * 12, 700, y - rand() * 12, 1024, y + 4); ctx.stroke(); }
    for (let i = 0; i < 8; i++) { ctx.fillStyle = '#57351f'; ctx.fillRect(0, i * 128, 1024, 3); ctx.fillStyle = '#b37a49'; ctx.fillRect(0, i * 128 + 3, 1024, 2); }
    const wood = new T.CanvasTexture(c); wood.colorSpace = T.SRGBColorSpace; wood.wrapS = wood.wrapT = T.RepeatWrapping; wood.repeat.set(2, 1); wood.anisotropy = 8; this.textures.push(wood);
    const top = new T.Mesh(new T.BoxGeometry(35, .8, 22), new T.MeshStandardMaterial({ map: wood, roughness: .53 })); top.position.y = -.45; top.receiveShadow = true; bar.add(top);
    this.mesh(new T.BoxGeometry(35.4, .3, 22.4), '#39271d', bar, 0, -.95);
    this.mesh(new T.BoxGeometry(35.4, .12, .15), '#cca461', bar, 0, -.6, 11.2, .65);
    this.mesh(new T.BoxGeometry(38, 9, 1), '#142b23', bar, 0, 2, -14);
    for (let x = -18; x < 20; x += 3) this.mesh(new T.BoxGeometry(.06, 8, .1), '#2a4332', bar, x, 2, -13.45);
    for (const x of [-12, 12]) {
      this.mesh(new T.BoxGeometry(9, .25, 1.8), '#3b2a20', bar, x, 3.1, -12.5);
      for (let n = 0; n < 7; n++) this.bottle(bar, x - 3.5 + n * 1.1, -12.5, 3.3, .65 + rand() * .4, ['#315a3e', '#845025', '#273e39'][n % 3]);
    }
    const signFrame = this.mesh(new T.BoxGeometry(12, 3.1, .2), '#bc9556', bar, 0, 3.7, -13.1, .45);
    const sign = new T.Mesh(new T.PlaneGeometry(11.7, 2.8), new T.MeshBasicMaterial({ map: this.textTexture('Pat’s Bar', '#efd89e', 130, '#122a20') })); sign.position.z = .12; signFrame.add(sign);
    for (const x of [-8, 8]) { this.mesh(new T.CylinderGeometry(.12, .12, 5), '#a98240', bar, x, 6, -10, .7); this.mesh(new T.ConeGeometry(1.5, .8, 32, 1, true), '#214539', bar, x, 3.6, -10); const l = new T.PointLight('#ffc577', 30, 12); l.position.set(x, 3, -10); bar.add(l); }
    // Oversized props stay beyond the playable rectangle.
    this.bottle(bar, -16, -5, 0, 2.1, '#244d36'); this.bottle(bar, 16, -7, 0, 2.5, '#664221'); this.bottle(bar, 15.9, 5, 0, 1.5, '#2c553c');
    for (const [x, z] of [[-16, 4], [12, -10], [-10, -10]]) this.glass(bar, x, z);
    for (const [x, z] of [[-11, 9.8], [9, 9.8], [16, 0]]) {
      this.mesh(new T.CylinderGeometry(1.25, 1.25, .06, 48), '#ddc18b', bar, x, .015, z);
      const mark = new T.Mesh(new T.PlaneGeometry(2.1, .6), new T.MeshBasicMaterial({ map: this.textTexture('PAT’S', '#56724f'), transparent: true })); mark.rotation.x = -Math.PI / 2; mark.position.set(x, .055, z); bar.add(mark);
    }
    const boundary = new T.LineLoop(new T.BufferGeometry().setFromPoints([new T.Vector3(-14, .01, -8), new T.Vector3(14, .01, -8), new T.Vector3(14, .01, 8), new T.Vector3(-14, .01, 8)]), new T.LineBasicMaterial({ color: '#ecd2a3', transparent: true, opacity: .16 })); bar.add(boundary);
  }
  bottle(parent: T.Object3D, x: number, z: number, y: number, scale: number, color: string) {
    const g = new T.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); parent.add(g);
    this.mesh(this.shape('bottle-body', () => new T.CylinderGeometry(.38, .42, 1.25, 12)), color, g, 0, .65);
    this.mesh(this.shape('bottle-shoulder', () => new T.CylinderGeometry(.16, .38, .32, 12)), color, g, 0, 1.43);
    this.mesh(this.shape('bottle-neck', () => new T.CylinderGeometry(.16, .16, .5, 12)), color, g, 0, 1.82);
    this.mesh(this.shape('bottle-cap', () => new T.CylinderGeometry(.18, .18, .13, 12)), '#d7b265', g, 0, 2.1, 0, .5);
    this.mesh(this.shape('bottle-label', () => new T.CylinderGeometry(.386, .406, .55, 12)), '#e6d4a5', g, 0, .72);
    return g;
  }
  glass(parent: T.Object3D, x: number, z: number) {
    const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
    const outer = new T.Mesh(new T.CylinderGeometry(.85, .65, 2.6, 32, 1, true), new T.MeshPhysicalMaterial({ color: '#f4e6c1', transparent: true, opacity: .22, roughness: .1, metalness: .1, side: T.DoubleSide })); outer.position.y = 1.3; g.add(outer);
    this.mesh(new T.CylinderGeometry(.74, .63, 1.8, 32), '#d9972d', g, 0, .95);
    this.mesh(new T.CylinderGeometry(.75, .75, .16, 32), '#ffebc6', g, 0, 1.91);
    const handle = this.mesh(new T.TorusGeometry(.65, .13, 10, 24), '#c9c8a4', g, 1, 1.2); handle.rotation.y = .3;
  }
  async loadSprites() {
    const loader = new T.TextureLoader();
    const textures = await Promise.all(['/assets/hero-key.png', '/assets/boss-key.png'].map(p => loader.loadAsync(p)));
    this.spriteMaterials = textures.map(t => {
      t.colorSpace = T.SRGBColorSpace; this.textures.push(t);
      const material = new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
      material.onBeforeCompile = shader => { shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float dominance = sampledDiffuseColor.g - max(sampledDiffuseColor.r, sampledDiffuseColor.b);
        float keyAlpha = 1.0 - smoothstep(0.05, 0.24, dominance);
        diffuseColor.a *= keyAlpha;
        if (diffuseColor.a < 0.06) discard;
        diffuseColor.g = min(diffuseColor.g, max(diffuseColor.r, diffuseColor.b) + 0.025);`); };
      return material;
    });
    this.hero = new T.Sprite(this.spriteMaterials[0].clone()); this.hero.material.onBeforeCompile = this.spriteMaterials[0].onBeforeCompile; this.hero.center.set(.5, .035); this.hero.scale.set(1.8, 2.7, 1); this.world.add(this.hero);
  }
  createEnemy(kind: string) {
    const g = new T.Group(); g.add(this.shadow(kind === 'boss' ? 1.5 : .55));
    if (kind === 'boss') {
      const m = this.spriteMaterials[1].clone(); m.onBeforeCompile = this.spriteMaterials[1].onBeforeCompile;
      const s = new T.Sprite(m); s.center.set(.5, .035); s.scale.set(6.3, 8.1, 1); g.add(s); g.userData.sprite = s;
    } else {
      const body = new T.Group(); g.add(body); g.userData.body = body;
      if (kind === 'olive') { const olive = this.mesh(this.shape('olive', () => new T.SphereGeometry(.55, 16, 12)), '#8c9a3e', body, 0, .6); olive.scale.y = 1.15; this.mesh(this.shape('pimento', () => new T.SphereGeometry(.22, 12, 8)), '#d85434', body, 0, .66, .48); }
      else this.bottle(body, 0, 0, 0, .83, '#3b7154');
      for (const x of [-.19, .19]) {
        this.mesh(this.shape('eye', () => new T.SphereGeometry(.14, 10, 8)), '#fff2cb', body, x, kind === 'olive' ? .92 : 1.18, .43);
        this.mesh(this.shape('pupil', () => new T.SphereGeometry(.063, 8, 8)), '#192722', body, x, kind === 'olive' ? .92 : 1.18, .54);
        const brow = this.mesh(this.shape('brow', () => new T.BoxGeometry(.29, .055, .06)), '#253321', body, x, kind === 'olive' ? 1.08 : 1.34, .47); brow.rotation.z = x < 0 ? -.25 : .25;
      }
    }
    return g;
  }
  resize() {
    const w = innerWidth, h = innerHeight, aspect = w / h, halfW = Math.max(19.5, 13.3 * aspect), halfH = halfW / aspect;
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH, near: .1, far: 120 }); this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h);
  }
  aim(pointer: { x: number; y: number }): Vec { this.ray.setFromCamera(new T.Vector2(pointer.x, pointer.y), this.camera); const p = new T.Vector3(); this.ray.ray.intersectPlane(this.floor, p); return { x: p.x, z: p.z }; }
  update(game: Game, aim: Vec, moving: boolean, time: number) {
    if (!this.hero) return;
    const title = game.mode === 'title'; const p = game.player;
    this.hero.position.set(title ? 6 : p.x, .08 + (moving ? Math.abs(Math.sin(time * 13)) * .13 : Math.sin(time * 2) * .025), title ? 5 : p.z);
    this.hero.scale.set(title ? 5.8 : 1.8, title ? 8.7 : 2.7, 1);
    this.hero.material.color.set(p.invulnerable > 0 && Math.sin(time * 40) > 0 ? '#ffbdab' : '#ffffff');
    this.heroShadow.position.set(this.hero.position.x, .026, this.hero.position.z); this.ring.position.set(this.hero.position.x, .028, this.hero.position.z);
    this.ring.rotation.z = time * .3; this.aimRing.position.set(aim.x, .035, aim.z); this.aimRing.visible = game.mode === 'playing';
    const live = new Set<number>(); this.warning.visible = false; this.warningLine.visible = false;
    if (game.superBuffs.has('orbit')) {
      live.add(-1);
      if (!this.actors.has(-1)) { const o = new T.Mesh(this.shape('orbit-cap', () => new T.CylinderGeometry(.25, .25, .12, 12)), this.material('#ffdf88', .7)); this.world.add(o); this.actors.set(-1, o); }
      const point = game.orbitPosition; this.actors.get(-1)!.position.set(point.x, .6, point.z); this.actors.get(-1)!.rotation.z = time * 8;
    }
    if (game.superBuffs.has('shield') && game.shieldCooldown <= 0) {
      live.add(-2);
      if (!this.actors.has(-2)) { const o = this.flatRing(.85, .94, '#93e9ff'); this.world.add(o); this.actors.set(-2, o); }
      this.actors.get(-2)!.position.set(p.x, .12, p.z);
    }
    for (const trail of game.trails) {
      live.add(trail.id);
      if (!this.actors.has(trail.id)) { const o = new T.Mesh(this.shape('trail', () => new T.CircleGeometry(.6, 16)), new T.MeshBasicMaterial({ color: '#ff914b', transparent: true, opacity: .45, depthWrite: false })); o.rotation.x = -Math.PI / 2; this.world.add(o); this.actors.set(trail.id, o); }
      const o = this.actors.get(trail.id)! as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>; o.position.set(trail.x, .06, trail.z); o.material.opacity = .4 * trail.life / 3;
    }
    for (const e of game.enemies) {
      live.add(e.id); if (!this.actors.has(e.id)) { const o = this.createEnemy(e.kind); this.world.add(o); this.actors.set(e.id, o); }
      const o = this.actors.get(e.id)!; o.position.set(e.x, 0, e.z);
      const b = o.userData.body as T.Group | undefined; if (b) { b.position.y = Math.abs(Math.sin(time * 5 + e.id)) * .08; b.rotation.z = e.flash > 0 ? .15 : 0; b.scale.setScalar(e.flash > 0 ? 1.13 : 1); }
      const s = o.userData.sprite as T.Sprite | undefined; if (s) { s.position.y = Math.sin(time * 3) * .06; s.material.color.set(e.flash > 0 ? '#ffc7a2' : '#ffffff'); }
      if (e.kind === 'boss' && e.phase === 'warning') {
        this.warning.visible = true; this.warning.position.set(e.attack % 2 === 0 ? e.target.x : e.x, .045, e.attack % 2 === 0 ? e.target.z : e.z); this.warning.scale.setScalar(e.attack % 2 === 0 ? 1 : 1 + .2 * Math.sin(time * 12));
        if (e.attack % 2 === 0) { const dx = e.target.x - e.x, dz = e.target.z - e.z; this.warningLine.visible = true; this.warningLine.position.set((e.x + e.target.x) / 2, .04, (e.z + e.target.z) / 2); this.warningLine.scale.y = Math.hypot(dx, dz); this.warningLine.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, dz)); }
      }
    }
    for (const b of game.bullets) {
      live.add(b.id); if (!this.actors.has(b.id)) {
        const o = new T.Mesh(b.hostile ? this.shape('shot', () => new T.SphereGeometry(.17, 8, 8)) : this.shape('cap', () => new T.CylinderGeometry(.18, .18, .08, 12)), b.hostile ? new T.MeshBasicMaterial({ color: '#ff825b' }) : this.material('#f6d48d', .6)); this.world.add(o); this.actors.set(b.id, o);
      } const o = this.actors.get(b.id)!; o.position.set(b.x, .48, b.z); o.rotation.z = time * 15;
    }
    for (const orb of game.pickups) {
      live.add(orb.id); if (!this.actors.has(orb.id)) { const o = new T.Mesh(this.shape('xp', () => new T.OctahedronGeometry(.18)), this.material('#9bffc7', .2)); this.world.add(o); this.actors.set(orb.id, o); }
      const o = this.actors.get(orb.id)!; o.position.set(orb.x, .22 + Math.sin(time * 3 + orb.id) * .07, orb.z); o.rotation.y = time;
    }
    for (const e of game.effects) { live.add(e.id); if (!this.actors.has(e.id)) { const o = this.flatRing(.15, .22, e.color); this.world.add(o); this.actors.set(e.id, o); } const o = this.actors.get(e.id)!; o.position.set(e.x, .1, e.z); o.scale.setScalar(e.radius ? e.radius / .22 * (1 - e.life / .4) : 1 + (1 - e.life / .4) * 3); (o as T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>).material.opacity = e.life / .4; }
    for (const [id, actor] of this.actors) if (!live.has(id)) { this.world.remove(actor); actor.traverse(o => { if (o instanceof T.Sprite) o.material.dispose(); if (o instanceof T.Mesh && ![...this.materials.values()].includes(o.material)) { (o.material as T.Material).dispose(); if (![...this.geometries.values()].includes(o.geometry)) o.geometry.dispose(); } }); this.actors.delete(id); }
    this.renderer.render(this.scene, this.camera);
  }
}
