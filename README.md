# Pat’s Bar · Last Call

A desktop-browser Three.js survival roguelike. Play a miniature photo-based hero on a wooden bar: survive three 60-second rounds of angry olives and bottle creatures, collect XP, choose upgrades, then take on the giant photo-based boss.

Choose **Normal** for the original three-round run and final boss, or **Endless** for increasingly difficult 60-second rounds until death. Endless bosses appear after rounds 3, 6, 9, and every third round thereafter. The first two bosses fight alone; starting with the boss after round 9, regular enemies reinforce the fight. Kill the boss and clear surviving enemies to advance.

Endless retains XP and upgrades between encounters. Clearing a round or boss encounter restores 20 health and banks leftover XP. Upgrade caps stay in place; after all upgrades are capped, level-ups restore 25 health. Results show rounds cleared, bosses defeated, survival time, kills, and level. Another Round restarts the same mode; Change Mode / Main Menu returns to mode selection. Nothing is saved between runs.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the local URL printed by Vite, normally http://127.0.0.1:5173. A pnpm lockfile is also provided; `pnpm install` and `pnpm dev` work.

## Controls

| Action | Control |
| --- | --- |
| Move | W A S D |
| Aim | Mouse |
| Throw bottle caps | Hold left mouse button |
| Dodge | Space; 2.5-second cooldown |
| Pause / resume | Escape |

Combat pauses for upgrade selection and when the browser loses focus. Start with 100 health; clearing a wave restores 20. Clear surviving enemies when each wave’s timer ends. The final boss alternates a marked charge and a radial burst, becoming faster at half health. Death and victory both offer a clean restart. Progress lasts for the current run only.

Upgrade cards have a 200 ms safety delay and wait for held mouse/activation keys to be released. Selecting one requires a fresh press after the delay. Each actual hit plays a short synthesized grunt; use the music-note button in the header to mute it. Audio starts after the first click or keypress and uses no downloaded recordings.

## Build and validate

```sh
npm test
npm run test:balance
npm run build
npm run preview
```

Browser regression checks run against the **development** server, which exposes a QA handle excluded from production:

```sh
npx playwright install chromium
npm run dev
# In another terminal:
npm run test:browser
```

Set `PLAYWRIGHT_CHANNEL=chrome` to use installed Chrome instead of Playwright’s bundled Chromium. Optionally set `PATS_BAR_URL` for another development-server address. Screenshots are written to `artifacts/`.

The browser suite exercises real movement/fire/dodge input, pause, upgrade selection, both mode selections, result screens, reset, focus loss, and resize. It sets up boss/outcome states to test those screens. Separately, three seeded simulations per mode play complete runs without health cheats. Normal offense-focused builds finish the boss in approximately 61–68 seconds, excluding time spent choosing upgrades. Extended Endless simulations check progression until death and entity limits. Human completion times depend on upgrades and aim.

## Structure

- `src/config.ts`: typed wave, enemy, weapon, and upgrade balance.
- `src/game.ts`: fixed-step simulation, combat, drops, progression, boss phases, and run state.
- `src/view.ts`: Three.js world, procedural props, photo sprites, shader transparency, and effects.
- `src/input.ts`, `src/ui.ts`, `src/main.ts`: controls, menus/HUD, and animation loop.
- `public/assets/`: generated character assets bundled with the game.

The world uses procedural geometry and a canvas wood texture. Character images were generated using the built-in imagegen tool from the supplied references. The generator returned RGB images, so green-screen versions are chroma-keyed by the sprite shader at runtime; the PNG source files themselves do not contain alpha. Faces and clothing are approximations. See `ASSETS.md` for the generation prompts.

No backend, account, mobile touch controls, multiplayer, or persistent progression. The CSS uses an optional Google Fonts request with local serif/sans-serif fallbacks. All gameplay and character assets are local. Production output is the static `dist/` directory.
