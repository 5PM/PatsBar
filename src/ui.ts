import { Game } from './game';
import { Profile } from './profile';
import { SKINS, isSkinId, type SkinId } from './skins';
import { EQUIPMENT, TRAINING, gearName, isSelectionMode, type BossRewardId, type TrainingId, SUPER_BUFFS, UPGRADES, xpRequired, type UpgradeId, type RunMode } from './config';
const time = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const choiceSelector = '[data-upgrade], [data-boss-reward], [data-training]';
export class UI {
  root: HTMLElement; overlay: HTMLElement; lastMode = ''; lastChoices = ''; health: HTMLElement; xp: HTMLElement; ready = false;
  private upgradeReadyAt = 0;
  private upgradeArmed = false;
  private heldPointers = new Set<number>();
  private heldKeys = new Set<string>();
  private pressedCard: HTMLButtonElement | null = null;
  private lastLevel = 0;
  private shopReturnMode: 'title' | 'victory' | 'defeat' = 'title';
  private shopMessage = '';
  private shopRevision = 0;
  constructor(public game: Game, public clear: () => void, public profile = new Profile(), private skinPreviews = new Map<SkinId, string>()) {
    this.root = document.querySelector('#ui')!;
    this.root.innerHTML = `<div class="vignette"></div><header><a class="brand" href="#" aria-label="Pat’s Bar">P<span>✦</span>B</a><div class="brand-label">PAT’S BAR<span>A COUNTERTOP ROGUELIKE</span></div><div class="header-right"><span class="live-dot"></span> LAST CALL <span class="edition">VOL. 01</span><span class="token-wallet" title="Bar Tokens · Earn 1 for every boss defeated">◎ <b id="token-balance">0</b><span>TOKENS</span></span><button class="icon-button" id="pause" aria-label="Pause game">Ⅱ</button></div></header><section id="hud" class="hidden"><div class="health-panel"><div class="micro">STILL STANDING <span id="hp-text"></span></div><div class="meter"><i id="health-fill"></i></div><div class="xp-row"><span id="level"></span><div class="meter xp"><i id="xp-fill"></i></div></div></div><div class="wave-panel"><div class="micro" id="wave-label"></div><strong id="timer"></strong><span id="wave-name"></span></div><div class="kill-panel"><div class="micro">HOUSE COUNT</div><strong id="kills">0</strong><span>troublemakers served</span></div></section><section id="boss-hud" class="hidden"><div class="micro"><span id="boss-name">THE BIG GUY</span><span id="boss-phase">LAST CALL</span></div><div class="meter boss"><i id="boss-fill"></i></div></section><div id="banner"></div><div id="token-notice" class="hidden" role="status">+1 BAR TOKEN · SAVED TO YOUR WALLET</div><div id="overlay"></div><footer><span class="footer-note">SMALL HERO. <b>BIG NIGHT.</b></span><div id="bottom-controls"><span><kbd>W A S D</kbd> MOVE</span><span><kbd>MOUSE</kbd> AIM & FIRE</span><span><kbd>SPACE</kbd> DODGE</span></div><span id="dodge-status">EST. TONIGHT</span></footer>`;
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
      const card = (e.target as HTMLElement).closest<HTMLButtonElement>(choiceSelector);
      this.pressedCard = this.upgradeArmed && e.button === 0 && card && !card.disabled ? card : null;
    });
    this.overlay.addEventListener('keydown', e => {
      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        const card = (e.target as HTMLElement).closest<HTMLButtonElement>(choiceSelector);
        this.pressedCard = this.upgradeArmed && card && !card.disabled ? card : null;
      }
    });
    this.overlay.addEventListener('click', e => {
      const button = (e.target as HTMLElement).closest('button'); if (!button) return;
      clear();
      if (button.dataset.action === 'start' && this.ready) { game.start(game.runMode); this.lastMode = ''; }
      if (button.dataset.action === 'shop') this.openShop();
      if (button.dataset.action === 'close-shop') this.closeShop();
      if (game.mode === 'shop' && isSkinId(button.dataset.buySkin)) {
        this.shopMessage = this.profile.buy(button.dataset.buySkin) ? 'Purchased and equipped. Enjoy the new look.' : 'This skin is already owned or you need more tokens.'; this.shopRevision++;
      }
      if (game.mode === 'shop' && isSkinId(button.dataset.equipSkin)) {
        this.profile.equip(button.dataset.equipSkin); this.shopMessage = 'Skin equipped for your next round.'; this.shopRevision++;
      }
      if (button.dataset.action === 'resume') game.pause();
      if (button.dataset.action === 'menu') { game.menu(); this.lastMode = ''; }
      if (button.dataset.runMode && game.mode === 'title') { game.runMode = button.dataset.runMode as RunMode; this.lastMode = ''; }
      if (button.matches(choiceSelector) && this.upgradeArmed && this.pressedCard === button && !button.disabled) {
        this.pressedCard = null; this.upgradeArmed = false;
        if (button.dataset.bossReward) game.chooseBossReward(button.dataset.bossReward === 'skip' ? null : button.dataset.bossReward as BossRewardId);
        else if (button.dataset.training) game.chooseTraining(button.dataset.training as TrainingId);
        else game.choose(button.dataset.upgrade as UpgradeId);
      }
    });
  }
  private openShop() {
    if (!this.ready || !['title', 'victory', 'defeat'].includes(this.game.mode)) return;
    this.shopReturnMode = this.game.mode as 'title' | 'victory' | 'defeat';
    this.profile.refresh(); this.shopMessage = ''; this.game.mode = 'shop'; this.clear();
  }
  closeShop() {
    if (this.game.mode !== 'shop') return;
    this.game.mode = this.shopReturnMode; this.clear();
  }
  private shop() {
    const p = this.profile;
    return `<section class="modal shop-modal" aria-label="Skin shop"><div class="shop-heading"><div><div class="eyebrow">PAT’S BAR · THE WARDROBE</div><h2>A new kind of regular.</h2></div><button class="shop-back" data-action="close-shop">← Back</button></div><div class="shop-summary"><p>1 boss defeated = 1 Bar Token. All looks, no stat changes.</p><strong>◎ ${p.tokens} <span>BAR TOKENS</span></strong></div><div class="skin-grid">${SKINS.map(skin => {
      const owned = p.owns(skin.id), equipped = p.equippedSkin === skin.id;
      return `<article class="skin-card ${equipped ? 'skin-equipped' : ''}" data-skin="${skin.id}"><div class="skin-preview"><img src="${this.skinPreviews.get(skin.id) ?? ''}" alt="${skin.name} full-body preview"><span class="skin-price">${owned ? (equipped ? 'EQUIPPED' : 'OWNED') : skin.price + ' TOKENS'}</span></div><div class="skin-detail"><h3>${skin.name}</h3><p>${skin.description}</p>${owned ? `<button data-equip-skin="${skin.id}" ${equipped ? 'disabled' : ''}>${equipped ? 'Currently equipped' : 'Equip skin'}</button>` : `<button data-buy-skin="${skin.id}" ${p.tokens < skin.price ? 'disabled' : ''}>${p.tokens < skin.price ? 'Need ' + (skin.price - p.tokens) + ' more tokens' : 'Buy & equip · ' + skin.price + ' tokens'}</button>`}</div></article>`;
    }).join('')}</div><p class="shop-feedback" role="status">${this.shopMessage}</p><p class="save-note">${p.persistent ? 'Saved in this browser on this device. Clearing site data removes your wallet and skins.' : 'Browser saving is unavailable. Your wallet and skins will last until this page closes.'}</p></section>`;
  }
  private inventory() {
    const g = this.game;
    const regular = UPGRADES.filter(u => g.upgrades[u.id] > 0);
    const supers = SUPER_BUFFS.filter(b => g.superBuffs.has(b.id));
    const total = Object.values(g.upgrades).reduce((sum, n) => sum + n, 0);
    const item = (icon: string, name: string, detail: string, description: string) => `<div class="inventory-item" tabindex="0" aria-label="${name}: ${detail}. ${description}"><span>${icon} ${name}</span><b>${detail}</b><span class="inventory-description" role="tooltip">${description}</span></div>`;
    return `<section class="power-inventory" aria-label="Your power-ups"><div class="inventory-heading"><h3>Your power-ups</h3><span>Upgrade stacks: ${total} · Super buffs: ${supers.length}/4</span></div>${!regular.length && !supers.length ? '<p>No power-ups yet</p>' : `<div class="inventory-grid">${regular.map(u => item(u.icon, u.name, `${g.upgrades[u.id]}/${u.cap}${g.upgrades[u.id] === u.cap ? ' MAX' : ''}`, u.description)).join('')}${supers.map(b => item(b.icon, b.name, 'SUPER', b.description)).join('')}</div>`}${g.runMode === 'endless' ? `<div class="inventory-subheading">Equipped gear & training</div><div class="inventory-grid">${(['weapon', 'armor'] as const).map(slot => { const gear = EQUIPMENT.find(e => e.id === g[slot]); return item(gear?.icon ?? (slot === 'weapon' ? '◎' : '—'), gearName(g[slot]), slot.toUpperCase(), gear?.description ?? (slot === 'weapon' ? 'Your original bottle caps, with regular upgrades.' : 'No armor equipped.')); }).join('')}${TRAINING.map(t => item(t.icon, t.name, String(g.training[t.id]) + (g.training[t.id] === 1 ? ' STACK' : ' STACKS'), t.description)).join('')}</div>` : ''}</section>`;
  }
  setReady() { this.ready = true; this.lastMode = ''; }
  update() {
    const g = this.game; const title = g.mode === 'title'; const active = !title && g.mode !== 'shop';
    document.querySelector('#token-balance')!.textContent = String(this.profile.tokens);
    const notice = document.querySelector('#token-notice')!;
    notice.classList.toggle('hidden', g.tokenNoticeTime <= 0 || g.mode !== 'playing');
    notice.textContent = this.profile.persistent ? '+1 BAR TOKEN · SAVED TO YOUR WALLET' : '+1 BAR TOKEN · IN YOUR SESSION WALLET';
    document.querySelector('#hud')!.classList.toggle('hidden', !active);
    document.querySelector('#pause')!.classList.toggle('hidden', !(g.mode === 'playing' || g.mode === 'paused' || isSelectionMode(g.mode)));
    this.health.style.width = `${g.player.hp / g.player.maxHp * 100}%`; this.health.classList.toggle('low', g.player.hp < 30);
    document.querySelector('#hp-text')!.textContent = `${Math.ceil(g.player.hp)} / ${g.player.maxHp}`;
    this.xp.style.width = `${Math.min(100, g.xp / xpRequired(g.level) * 100)}%`; document.querySelector('#level')!.textContent = `LVL ${g.level.toString().padStart(2, '0')}`;
    document.querySelector('#wave-label')!.textContent = g.encounter === 'boss' ? `BOSS ${g.bossNumber}` : g.runMode === 'endless' ? `ENDLESS · ROUND ${g.round}` : `NORMAL · ROUND ${g.round} OF 3`;
    document.querySelector('#timer')!.textContent = g.encounter === 'wave' ? time(Math.max(0, g.difficulty.duration - g.waveTime)) : time(g.waveTime);
    document.querySelector('#wave-name')!.textContent = g.encounter === 'wave' ? (g.waveTime >= 60 ? 'Clear the countertop' : g.difficulty.name) : 'Clear the remaining enemies';
    document.querySelector('#kills')!.textContent = g.kills.toString().padStart(2, '0');
    document.querySelector('#dodge-status')!.textContent = title ? 'EST. TONIGHT' : g.player.dodge > 0 ? `DODGE · ${g.player.dodge.toFixed(1)}s` : 'DODGE READY ↗';
    const boss = g.enemies.find(e => e.kind === 'boss'); document.querySelector('#boss-hud')!.classList.toggle('hidden', !boss);
    document.querySelector('.wave-panel')!.classList.toggle('hidden', !!boss);
    if (boss) { document.querySelector('#boss-name')!.textContent = g.runMode === 'endless' ? `BOSS ${g.bossNumber} · THE BIG GUY` : 'THE BIG GUY'; (document.querySelector('#boss-fill') as HTMLElement).style.width = `${boss.hp / boss.maxHp * 100}%`; document.querySelector('#boss-phase')!.textContent = boss.phase === 'warning' ? (boss.attack % 2 === 0 ? 'WATCH THE CHARGE' : 'INCOMING BURST') : boss.hp < boss.maxHp / 2 ? 'NO MORE MR. NICE GUY' : 'LAST CALL'; }
    const banner = document.querySelector('#banner')!; banner.textContent = g.bannerTime > 0 && g.mode === 'playing' ? g.banner : '';
    const key = g.choices.join(',') + '/' + g.bossChoices.join(',') + '/' + this.profile.revision + '/' + this.shopRevision;
    const changed = this.lastMode !== g.mode || this.lastChoices !== key || this.lastLevel !== g.level;
    if (isSelectionMode(g.mode)) {
      if (changed) {
        this.upgradeReadyAt = performance.now() + 200; this.upgradeArmed = false; this.pressedCard = null;
      } else if (!this.upgradeArmed && performance.now() >= this.upgradeReadyAt && !this.heldPointers.size && !this.heldKeys.size) {
        this.upgradeArmed = true;
        this.overlay.querySelectorAll<HTMLButtonElement>(choiceSelector).forEach(b => b.disabled = false);
        this.overlay.querySelector('[data-upgrade-hint]')!.textContent = 'Take your time. The bar can wait.';
      }
    }
    if (!changed) return;
    this.lastLevel = g.level;
    this.lastMode = g.mode; this.lastChoices = key; this.overlay.className = g.mode === 'playing' ? 'hidden' : `overlay-${g.mode}`;
    document.body.dataset.mode = g.mode;
    if (title) this.overlay.innerHTML = `<main class="title-card"><div class="eyebrow"><span></span> WELCOME TO YOUR LOCAL</div><h1>Pat’s Bar<span>Last call.<br>First fight.</span></h1><p>The drinks are oversized.<br>The locals are hostile.<br>And you’re picking up the tab.</p><div class="mode-picker" role="group" aria-label="Game mode">${(['normal', 'endless'] as const).map(mode => `<button data-run-mode="${mode}" aria-pressed="${g.runMode === mode}"><strong>${mode === 'normal' ? 'Normal' : 'Endless ∞'}</strong><span>${mode === 'normal' ? '3 rounds + the big guy' : 'Keep going until last call'}</span></button>`).join('')}</div><button class="primary" data-action="start" ${this.ready ? '' : 'disabled'}>${this.ready ? 'STEP UP TO THE BAR' : 'SETTING UP THE BAR…'} <span>↗</span></button><div class="run-note">${g.runMode === 'normal' ? '3 ROUNDS · 1 BIG BOSS · ONE SHOT AT LAST CALL' : 'BOSS EVERY 3 ROUNDS · REINFORCEMENTS FROM BOSS 3'}</div><button class="shop-link" data-action="shop" ${this.ready ? '' : 'disabled'}>SKIN SHOP <span>◎ ${this.profile.tokens}</span> ↗</button></main><aside class="scene-caption"><span class="tag">MEET YOUR REGULAR</span><h2>A little out<br>of his depth.</h2><p>Armed with bottle caps.<br>Running on pure instinct.</p><div class="caption-rule"></div><span class="micro">SURVIVE. LEVEL UP. SETTLE THE TAB.</span></aside><div class="title-index">01 <span>/ THE COUNTERTOP</span></div>`;
    else if (g.mode === 'shop') this.overlay.innerHTML = this.shop();
    else if (g.mode === 'bossReward') this.overlay.innerHTML = `<div class="modal upgrade-modal equipment-modal"><div class="eyebrow">BOSS CLEARED · HEALTH RESTORED</div><h2>The house special.</h2><p>Choose one reward: a super buff, weapon, or armor. Gear replaces its matching slot.</p><div class="upgrade-grid">${g.bossChoices.map(id => {
      const item = EQUIPMENT.find(e => e.id === id) ?? SUPER_BUFFS.find(b => b.id === id)!;
      const slot = 'slot' in item ? item.slot : null;
      const current = slot ? g[slot] : null;
      const comparison = current ? `<div class="gear-comparison"><b>Current: ${gearName(current)}</b><span>${EQUIPMENT.find(e => e.id === current)?.description ?? (slot === 'weapon' ? 'Your original bottle caps, with regular upgrades.' : 'No armor bonus.')}</span></div>` : '';
      return `<button class="upgrade-card" data-boss-reward="${id}"><span class="upgrade-icon">${item.icon}</span><span class="micro">${slot ? 'REPLACES ' + slot.toUpperCase() + ' SLOT' : 'UNIQUE SUPER BUFF'}</span><h3>${item.name}</h3><p>${item.description}</p>${comparison}<span class="choose">${slot ? 'EQUIP IT' : 'TAKE IT'} <b>↗</b></span></button>`;
    }).join('')}</div><button class="menu-button gear-skip" data-boss-reward="skip">Skip reward · keep current loadout</button><small></small></div>`;
    else if (g.mode === 'training') this.overlay.innerHTML = `<div class="modal upgrade-modal training-modal"><div class="eyebrow">LEVEL ${g.level} · HEALTH RESTORED</div><h2>Stronger by the round.</h2><p>Train every two levels from level 30. Choose power or endurance; neither has a stack limit.</p><div class="upgrade-grid">${TRAINING.map(t => `<button class="upgrade-card" data-training="${t.id}"><span class="upgrade-icon">${t.icon}</span><span class="micro">TRAINING STACK ${g.training[t.id] + 1}</span><h3>${t.name}</h3><p>${t.description}</p><span class="choose">TRAIN <b>↗</b></span></button>`).join('')}</div><small></small></div>`;
    else if (g.mode === 'upgrade') this.overlay.innerHTML = `<div class="modal upgrade-modal"><div class="eyebrow">A LITTLE SOMETHING ON THE HOUSE</div><h2>Make it a double.</h2><p>Level ${g.level} · Choose your next upgrade.</p><div class="upgrade-grid">${g.choices.map(id => { const u = UPGRADES.find(u => u.id === id)!; return `<button class="upgrade-card" data-upgrade="${id}"><span class="upgrade-icon">${u.icon}</span><span class="micro">${g.upgrades[id] ? `STACK ${g.upgrades[id] + 1}` : 'NEW UPGRADE'}</span><h3>${u.name}</h3><p>${u.description}</p><span class="choose">TAKE IT <b>↗</b></span></button>`; }).join('')}</div><small>Take your time. The bar can wait.</small></div>`;
    else if (g.mode === 'paused') this.overlay.innerHTML = `<div class="modal"><div class="eyebrow">HOLD THAT THOUGHT</div><h2>On the rocks.</h2><p>Your tab is safe. Catch your breath.</p><button class="primary" data-action="resume">BACK TO THE BAR <span>↗</span></button><small>Escape to resume</small></div>`;
    else if (g.mode === 'victory' || g.mode === 'defeat') this.overlay.innerHTML = `<div class="modal result"><div class="eyebrow">${g.mode === 'victory' ? 'THE HOUSE IS YOURS' : 'YOU’VE BEEN CUT OFF'}</div><h2>${g.mode === 'victory' ? 'Tab settled.' : 'One too many.'}</h2><p>${g.mode === 'victory' ? 'Three rounds. One big guy. A very small legend.' : 'The countertop always has room for a comeback.'}</p><div class="results ${g.runMode === 'endless' ? 'endless-results' : ''}">${g.runMode === 'endless' ? `<div><strong>${g.roundsCompleted}</strong><span>ROUNDS CLEARED</span></div><div><strong>${g.bossesDefeated}</strong><span>BOSSES DEFEATED</span></div>` : ''}<div><strong>${time(g.elapsed)}</strong><span>TIME AT THE BAR</span></div><div><strong>${g.kills}</strong><span>ENEMIES SERVED</span></div><div><strong>${g.level}</strong><span>LEVEL REACHED</span></div></div><button class="primary" data-action="start">ANOTHER ROUND <span>↗</span></button><button class="menu-button" data-action="menu">CHANGE MODE / MAIN MENU</button><div class="result-wallet">+${g.bossesDefeated} Bar Token${g.bossesDefeated === 1 ? '' : 's'} earned this run · Wallet: ${this.profile.tokens}</div><button class="shop-link" data-action="shop">VISIT SKIN SHOP ↗</button></div>`;
    else this.overlay.innerHTML = '';
    if (isSelectionMode(g.mode)) {
      (this.overlay.querySelector('.gear-skip') ?? this.overlay.querySelector('.upgrade-grid'))!.insertAdjacentHTML('afterend', this.inventory());
      this.overlay.querySelectorAll<HTMLButtonElement>(choiceSelector).forEach(b => b.disabled = true);
      const hint = this.overlay.querySelector('small')!; hint.setAttribute('data-upgrade-hint', '');
      hint.setAttribute('aria-live', 'polite'); hint.textContent = 'Take a breath… release your controls to choose.';
    }
  }
}
