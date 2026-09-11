import type { Input } from './game';
export class Controls {
  keys = new Set<string>(); pointer = { x: 0, y: 0 }; fire = false; dodge = false;
  constructor(canvas: HTMLCanvasElement, pause: () => void) {
    window.addEventListener('keydown', e => { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); this.keys.add(e.code); if (e.code === 'Space' && !e.repeat) this.dodge = true; if (e.code === 'Escape' && !e.repeat) { this.clear(); pause(); } });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); this.pointer = { x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }; });
    canvas.addEventListener('pointerdown', e => { if (e.button === 0) this.fire = true; });
    window.addEventListener('pointerup', () => this.fire = false);
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  clear() { this.keys.clear(); this.fire = false; this.dodge = false; }
  read(aim: Input['aim']): Input { const i = { x: Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')), z: Number(this.keys.has('KeyS')) - Number(this.keys.has('KeyW')), aim, fire: this.fire, dodge: this.dodge }; this.dodge = false; return i; }
}
