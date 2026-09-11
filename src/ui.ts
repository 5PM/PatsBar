import { Game } from './game';
import { UPGRADES, WAVES, xpRequired, type UpgradeId } from './config';
const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export class UI {
  root: HTMLElement; overlay: HTMLElement; lastMode = ''; lastChoices = ''; health: HTMLElement; xp: HTMLElement; ready = false;
  private upgradeReadyAt = 0;
  private upgradeArmed = false;
  private heldPointers = new Set<number>();
  private heldKeys = new Set<string>();
  private pressedCard: HTMLButtonElement | null = null;
  private lastLevel = 0;
  constructor(public game: Game, public clear: () => void) {
    this.root = document.querySelector('#ui')!;
    this.root.innerHTML = `<div class="vignette"></div><header><a class="brand" href="#" aria-label="Pat’s Bar">P<span>✦</span>B</a><div class="brand-label">PAT’S BAR<span>A COUNTERTOP ROGUELIKE</span></div><div class="header-right"><span class="live-dot"></span> LAST CALL <span class="edition">VOL. 01</span><button class="icon-button" id="pause" aria-label="Pause game">Ⅱ</button></div></header><section id="hud" class="hidden"><div class="health-panel"><div class="micro">STILL STANDING <span id="hp-text"></span></div><div class="meter"><i id="health-fill"></i></div><div class="xp-row"><span id="level"></span><div class="meter xp"><i id="xp-fill"></i></div></div></div><div class="wave-panel"><div class="micro" id="wave-label"></div><strong id="timer"></strong><span id="wave-name"></span></div><div class="kill-panel"><div class="micro">HOUSE COUNT</div><strong id="kills">0</strong><span>troublemakers served</span></div></section><section id="boss-hud" class="hidden"><div class="micro"><span>THE BIG GUY</span><span id="boss-phase">LAST CALL</span></div><div class="meter boss"><i id="boss-fill"></i></div></section><div id="banner"></div><div id="overlay"></div><footer><span class="footer-note">SMALL HERO. <b>BIG NIGHT.</b></span><div id="bottom-controls"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>MOUSE</kbd> AIM & FIRE</span><span><kbd>SPACE</kbd> DODGE</span></div><span id="dodge-status">EST. TONIGHT</span></footer>`;
    this.overlay = document.querySelector('#overlay')!; this.health = document.querySelector('#health-fill')!; this.xp = document.querySelector('#xp-fill')!;
    document.querySelector('#pause')!.addEventListener('click', () => { clear(); game.pause(); });
    document.querySelector('.brand')!.addEventListener('click', e => e.preventDefault());
    window.addEventListener('pointerdown', e => this.heldPointers.add(e.pointerId), true);
    window.addEventListener('pointerup', e => this.heldPointers.delete(e.pointerId), true);
    window.addEventListener('pointercancel', e => { this.heldPointers.delete(e.pointerId); this.pressedCard = null; }, true);
    window.addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'Space') this.heldKeys.add(e.code); }, true);
    window.addEventListener('keyup', e => this.heldKeys.delete(e.code), true);
    window.addEventListener('blur', () => { this.heldPointers.clear(); this.heldKeys.clear(); this.pressedCard = null; });
    this.overlay.addEventListener('pointerdown', e => {
      const card = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade]');
      this.pressedCard = this.upgradeArmed && e.button === 0 && card && !card.disabled ? card : null;
    });
    this.overlay.addEventListener('keydown', e => {
      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        const card = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-upgrade]');
        this.pressedCard = this.upgradeArmed && card && !card.disabled ? card : null;
      }
    });
    this.overlay.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest('button'); if (!button) return;
      clear();
      if (button.dataset.action === 'start' && this.ready) { game.start(); this.lastMode = ''; }
      if (button.dataset.action === 'resume') game.pause();
      if (button.dataset.upgrade && this.upgradeArmed && this.pressedCard === button && !button.disabled) {
        this.pressedCard = null; this.upgradeArmed = false;
        game.choose(button.dataset.upgrade as UpgradeId);
      }
    });
  }
  setReady() { this.ready = true; this.lastMode = ''; }
  update() {
    const g = this.game; const title = g.mode === 'title'; const active = !title;
    document.querySelector('#hud')!.classList.toggle('hidden', !active);
    document.querySelector('#pause')!.classList.toggle('hidden', !['playing', 'paused', 'upgrade'].includes(g.mode));
    this.health.style.width = `${g.player.hp / g.player.maxHp * 100}%`; this.health.classList.toggle('low', g.player.hp < 30);
    document.querySelector('#hp-text')!.textContent = `${Math.ceil(g.player.hp)} / ${g.player.maxHp}`;
    this.xp.style.width = `${Math.min(100, g.xp / xpRequired(g.level) * 100)}%`; document.querySelector('#level')!.textContent = `LVL ${g.level.toString().padStart(2, '0')}`;
    document.querySelector('#wave-label')!.textContent = g.wave < 3 ? `ROUND ${g.wave + 1} OF 3` : 'FINAL ROUND';
    document.querySelector('#timer')!.textContent = g.wave < 3 ? time(Math.max(0, 60 - g.waveTime)) : time(g.waveTime);
    document.querySelector('#wave-name')!.textContent = g.wave < 3 ? (g.waveTime >= 60 ? 'Clear the countertop' : WAVES[g.wave].name) : 'The big guy';
    document.querySelector('#kills')!.textContent = g.kills.toString().padStart(2, '0');
    document.querySelector('#dodge-status')!.textContent = title ? 'EST. TONIGHT' : g.player.dodge > 0 ? `DODGE · ${g.player.dodge.toFixed(1)}s` : 'DODGE READY ↗';
    const boss = g.enemies.find(e => e.kind === 'boss'); document.querySelector('#boss-hud')!.classList.toggle('hidden', !boss);
    document.querySelector('.wave-panel')!.classList.toggle('hidden', !!boss);
    if (boss) { (document.querySelector('#boss-fill') as HTMLElement).style.width = `${boss.hp / boss.maxHp * 100}%`; document.querySelector('#boss-phase')!.textContent = boss.phase === 'warning' ? (boss.attack % 2 === 0 ? 'WATCH THE CHARGE' : 'INCOMING BURST') : boss.hp < boss.maxHp / 2 ? 'NO MORE MR. NICE GUY' : 'LAST CALL'; }
    const banner = document.querySelector('#banner')!; banner.textContent = g.bannerTime > 0 && g.mode === 'playing' ? g.banner : '';
    const key = g.choices.join(',');
    const changed = this.lastMode !== g.mode || this.lastChoices !== key || this.lastLevel !== g.level;
    if (g.mode === 'upgrade') {
      if (changed) {
        this.upgradeReadyAt = performance.now() + 200; this.upgradeArmed = false; this.pressedCard = null;
      } else if (!this.upgradeArmed && performance.now() >= this.upgradeReadyAt && !this.heldPointers.size && !this.heldKeys.size) {
        this.upgradeArmed = true;
        this.overlay.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b => b.disabled = false);
        this.overlay.querySelector('[data-upgrade-hint]')!.textContent = 'Take your time. The bar can wait.';
      }
    }
    if (!changed) return;
    this.lastLevel = g.level;
    this.lastMode = g.mode; this.lastChoices = key; this.overlay.className = g.mode === 'playing' ? 'hidden' : `overlay-${g.mode}`;
    document.body.dataset.mode = g.mode;
    if (title) this.overlay.innerHTML = `<main class="title-card"><div class="eyebrow"><span></span> WELCOME TO YOUR LOCAL</div><h1>Pat’s Bar<span>Last call.<br>First fight.</span></h1><p>The drinks are oversized.<br>The locals are hostile.<br>And you’re picking up the tab.</p><button class="primary" data-action="start" ${this.ready ? '' : 'disabled'}>${this.ready ? 'STEP UP TO THE BAR' : 'SETTING UP THE BAR…'} <span>↗</span></button><div class="run-note">3 ROUNDS <i>·</i> 1 BIG BOSS <i>·</i> ONE SHOT AT LAST CALL</div></main><aside class="scene-caption"><span class="tag">MEET YOUR REGULAR</span><h2>A little out<br>of his depth.</h2><p>Armed with bottle caps.<br>Running on pure instinct.</p><div class="caption-rule"></div><span class="micro">SURVIVE. LEVEL UP. SETTLE THE TAB.</span></aside><div class="title-index">01 <span>/ THE COUNTERTOP</span></div>`;
    else if (g.mode === 'upgrade') this.overlay.innerHTML = `<div class="modal upgrade-modal"><div class="eyebrow">A LITTLE SOMETHING ON THE HOUSE</div><h2>Make it a double.</h2><p>Level ${g.level} · Choose your next upgrade.</p><div class="upgrade-grid">${g.choices.map(id => { const u = UPGRADES.find(u => u.id === id)!; return `<button class="upgrade-card" data-upgrade="${id}"><span class="upgrade-icon">${u.icon}</span><span class="micro">${g.upgrades[id] ? `STACK ${g.upgrades[id] + 1}` : 'NEW UPGRADE'}</span><h3>${u.name}</h3><p>${u.description}</p><span class="choose">TAKE IT <b>↗</b></span></button>`; }).join('')}</div><small>Take your time. The bar can wait.</small></div>`;
    else if (g.mode === 'paused') this.overlay.innerHTML = `<div class="modal"><div class="eyebrow">HOLD THAT THOUGHT</div><h2>On the rocks.</h2><p>Your tab is safe. Catch your breath.</p><button class="primary" data-action="resume">BACK TO THE BAR <span>↗</span></button><small>Escape to resume</small></div>`;
    else if (g.mode === 'victory' || g.mode === 'defeat') this.overlay.innerHTML = `<div class="modal result"><div class="eyebrow">${g.mode === 'victory' ? 'THE HOUSE IS YOURS' : 'YOU’VE BEEN CUT OFF'}</div><h2>${g.mode === 'victory' ? 'Tab settled.' : 'One too many.'}</h2><p>${g.mode === 'victory' ? 'Three rounds. One big guy. A very small legend.' : 'The countertop always has room for a comeback.'}</p><div class="results"><div><strong>${time(g.elapsed)}</strong><span>TIME AT THE BAR</span></div><div><strong>${g.kills}</strong><span>ENEMIES SERVED</span></div><div><strong>${g.level}</strong><span>LEVEL REACHED</span></div></div><button class="primary" data-action="start">ANOTHER ROUND <span>↗</span></button></div>`;
    else this.overlay.innerHTML = '';
    if (g.mode === 'upgrade') {
      this.overlay.querySelectorAll<HTMLButtonElement>('[data-upgrade]').forEach(b => b.disabled = true);
      const hint = this.overlay.querySelector('small')!; hint.setAttribute('data-upgrade-hint', '');
      hint.setAttribute('aria-live', 'polite'); hint.textContent = 'Take a breath… release your controls to choose.';
    }
  }
}
