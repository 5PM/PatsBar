import './style.css';
import './modes.css';
import './shop.css';
import { isSelectionMode } from './config';
import { Game } from './game';
import { Controls } from './input';
import { View } from './view';
import { UI } from './ui';
import { GameAudio } from './audio';
import { createBrowserProfile, PROFILE_KEY } from './profile';

const audio = new GameAudio();
const profile = createBrowserProfile();
const game = new Game(Math.random, () => audio.hurt(), () => profile.awardBossToken());
const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
let view: View;
try { view = new View(canvas); } catch (error) { document.querySelector('#ui')!.innerHTML = '<div style="padding:15%;font:20px sans-serif">Pat’s Bar needs WebGL to open. Please enable hardware acceleration and reload.</div>'; throw error; }
const controls = new Controls(canvas, () => game.mode === 'shop' ? ui.closeShop() : game.pause());
const ui = new UI(game, () => controls.clear(), profile, view.skinPreviews);
window.addEventListener('storage', event => { if (event.key === PROFILE_KEY || event.key === null) profile.refresh(); });
const soundButton = document.createElement('button');
soundButton.className = 'icon-button sound-button'; soundButton.textContent = '♪';
soundButton.setAttribute('aria-label', 'Mute sound'); soundButton.setAttribute('aria-pressed', 'false');
soundButton.title = 'Mute sound';
soundButton.addEventListener('click', () => {
  audio.muted = !audio.muted; soundButton.textContent = audio.muted ? '♪̸' : '♪';
  soundButton.setAttribute('aria-pressed', String(audio.muted));
  soundButton.title = audio.muted ? 'Enable sound' : 'Mute sound'; soundButton.setAttribute('aria-label', soundButton.title);
});
document.querySelector('.header-right')!.append(soundButton);
window.addEventListener('blur', () => { if (game.mode === 'playing' || isSelectionMode(game.mode)) game.pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && (game.mode === 'playing' || isSelectionMode(game.mode))) { controls.clear(); game.pause(); } });
view.ready.then(() => ui.setReady()).catch(error => { console.error(error); const b = document.querySelector<HTMLButtonElement>('[data-action="start"]'); if (b) b.textContent = 'ASSETS FAILED TO LOAD · RELOAD'; });
let last = performance.now(), accumulated = 0, visualTime = 0, previousMode = game.mode;
function frame(now: number) {
  const delta = Math.min((now - last) / 1000, .1); last = now;
  const aim = view.aim(controls.pointer);
  if (game.mode !== previousMode) { controls.clear(); accumulated = 0; previousMode = game.mode; }
  if (game.mode === 'playing') {
    accumulated += delta;
    while (accumulated >= 1 / 60) { game.step(1 / 60, controls.read(aim)); accumulated -= 1 / 60; }
    visualTime += delta;
  } else if (game.mode === 'title' || game.mode === 'shop') visualTime += delta;
  view.update(game, aim, controls.keys.size > 0 && game.mode === 'playing', visualTime, profile.equippedSkin); ui.update(); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
// Read-only development snapshot for browser QA. Omitted from production builds.
if (import.meta.env.DEV) Object.defineProperty(window, '__patsBar', { value: { game, view, controls, audio, profile }, configurable: true });
