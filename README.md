# Pat’s Bar · Last Call

A desktop-browser Three.js survival roguelike. Play a miniature photo-based hero on a wooden bar: survive three 60-second rounds of angry olives and bottle creatures, collect XP, choose upgrades, then take on the giant photo-based boss.

Choose **Normal** for the original three-round run and final boss, or **Endless** for increasingly difficult 60-second rounds until death. Endless bosses appear after rounds 3, 6, 9, and every third round thereafter. The first two bosses fight alone; starting with the boss after round 9, regular enemies reinforce the fight. Kill the boss and clear surviving enemies to advance.

Endless retains XP, upgrades, equipment, and training between encounters. Clearing a regular round restores 30 health; clearing an Endless boss encounter restores 45. Both bank leftover XP and cap healing at maximum health. After all regular upgrades are capped, level-ups restore 25 health; Endless also offers unlimited training. Results show rounds cleared, bosses defeated, survival time, kills, and level. Another Round restarts the same mode; Change Mode / Main Menu returns to mode selection. Nothing is saved between runs.

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
| Fire equipped weapon | Hold left mouse button |
| Dodge | Space; 2.5-second cooldown |
| Pause / resume | Escape |

Combat pauses for upgrade selection and when the browser loses focus. Start with 100 health; clearing a wave restores 30. Clear surviving enemies when each wave’s timer ends. The final boss alternates a marked charge and a radial burst, becoming faster at half health. Death and victory both offer a clean restart. Progress lasts for the current run only.

All reward cards and Keep current gear have a 200 ms safety delay and wait for held mouse/activation keys to be released. Selecting one requires a fresh press after the delay; Tab and Enter/Space also work. Combat and ability timers freeze during every reward screen. Escape and focus loss pause without discarding pending choices. Each actual hit plays a short synthesized grunt; use the music-note button in the header to mute it. Audio starts after the first click or keypress and uses no downloaded recordings.

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

The browser suites exercise real movement/fire/dodge input, all four reward screens, held-click/key protection, skipping equipment, pause, both mode selections, result screens, reset, focus loss, projectile visuals, and layouts at 1440×900 and 900×650. They set up boss/outcome states to test those screens. Separately, three seeded simulations per mode run without health cheats. Normal offense-focused builds finish the boss in approximately 59–61 seconds, excluding selection time. Endless simulations check progression and entity limits until death or a two-hour active-play limit. Use `pnpm test:balance --weapon=ricochet` or `--weapon=shotgun` to exercise the other weapon policies; picks are the default.

For seeds 4, 15, and 42, the pre-equipment version (`62d2473`) died in Endless rounds 39, 36, and 36 after 4960, 4461, and 4447 active seconds. With this update, the same movement/aim policy, Coaster Vest, and alternating Power/Endurance Training remained alive at the 7200-second limit: picks reached rounds 75/74/75, ricochet 73/73/74, and shotgun 51/51/50. Normal's time, kills, level, and remaining HP matched the baseline for all three seeds. These are automated balance checks, not guarantees of human survival; equipment offers also consume random draws, so subsequent spawn positions differ.

## Structure

- `src/config.ts`: typed wave, enemy, weapon, and upgrade balance.
- `src/game.ts`: fixed-step simulation, combat, drops, progression, boss phases, and run state.
- `src/view.ts`: Three.js world, procedural props, photo sprites, shader transparency, and effects.
- `src/input.ts`, `src/ui.ts`, `src/main.ts`: controls, menus/HUD, and animation loop.
- `public/assets/`: generated character assets bundled with the game.

The world uses procedural geometry and a canvas wood texture. Character images were generated using the built-in imagegen tool from the supplied references. The generator returned RGB images, so green-screen versions are chroma-keyed by the sprite shader at runtime; the PNG source files themselves do not contain alpha. Faces and clothing are approximations. See `ASSETS.md` for the generation prompts.

No backend, account, mobile touch controls, multiplayer, or persistent progression. The CSS uses an optional Google Fonts request with local serif/sans-serif fallbacks. All gameplay and character assets are local. Production output is the static `dist/` directory.

## Endless super buffs

After clearing a boss and its reinforcements, finish pending XP upgrades and choose one of up to three random, unowned super buffs. Combat remains paused with the same 0.2-second input protection. Abilities last for the run, cannot be duplicated, and reset on restart. Once all four are owned, later bosses skip this choice and continue to equipment.

- **Explosive Caps:** first impact explodes within radius 1.5 for 40% cap damage, excluding the direct target; no chaining.
- **Bar Orbit:** a cap circles at radius 1.6 every two seconds, dealing current weapon damage at most once per enemy every 0.5 seconds.
- **House Shield:** silently blocks one hit, then recharges in 12 active seconds. Dodged hits do not consume it.
- **Hot Foot:** dodges leave a three-second trail with radius 0.6, dealing half current weapon damage every 0.5 seconds per enemy across all segments.

The Your power-ups inventory appears only on selection screens. It shows owned upgrades, stack counts, MAX labels, total stacks, and super buffs out of four; in Endless it also shows the equipped weapon and armor, their descriptions, and both training counts. Hover or focus an item to read its description. The selection panel scrolls on smaller screens.

Boss reinforcements begin after round 9 at one enemy every 3 seconds. Each subsequent boss increases that rate by 20% (2.5 seconds after round 12, approximately 2.1 after round 15), down to a minimum interval of 0.5 seconds. The first reinforcement uses the same delay; the 12-enemy cap still applies.

## Endless equipment and training

Start with Bottle Caps and no armor. Clearing an Endless boss and all reinforcements grants rewards exactly once in this order: healing and banked XP, pending level-up choices, an available super buff, one equipment choice, then the next numbered round. Normal's final boss goes directly to victory.

Equipment offers contain three distinct items: a random weapon, a random armor, and one more item of either type. Currently equipped items are excluded. Select one to replace that slot, or choose **Keep current gear**. Replaced items are discarded; there is no backpack or currency.

| Weapon | Effect |
| --- | --- |
| Ricochet Caps | Baseline damage, speed, and firing interval. Redirect to the nearest unhit enemy within 5 units; up to 3 + piercing stacks hits. Expire if no target is available. |
| Cocktail Picks | 125% baseline damage and projectile speed; firing interval ×1.1. Travel straight through 3 + piercing stacks enemies. |
| Bottle-Cap Shotgun | 5 + extra-projectile stacks pellets across a 40° cone. Each deals 50% baseline damage, lives 0.4 seconds, and hits 1 + piercing stacks enemies. Firing interval ×1.6. |

All weapons retain regular fire-rate and projectile-count upgrades. A projectile never hits the same enemy twice. Explosive Caps uses each projectile's damage on its first hit only. Orbit and Hot Foot use baseline upgraded damage, including Power Training, without a weapon-specific multiplier. Picks are pale blue needles, ricochet caps are green, and shotgun pellets are small amber particles.

| Armor | Effect |
| --- | --- |
| Coaster Vest | Reduce incoming contact/projectile damage by 20%, after dodge, damage grace, and House Shield checks. |
| Bottle-Glass Armor | +75 maximum HP, with the added capacity filled directly. Replacing it removes this capacity and clamps current HP; permanent maximum HP remains. |
| Bar Apron | Increase all healing by 30%, rounded to the nearest HP. Does not amplify the capacity fill from equipping glass armor. |

Boss healing uses the armor equipped before the reward choices. Once all seven regular upgrade categories are capped, each subsequent Endless level-up automatically restores 25 HP and then offers **Power Training** (+5% baseline damage per stack, additive across training stacks and multiplicative with regular damage upgrades) or **Endurance Training** (+15 permanent maximum HP and restore 15 HP). Both have unlimited stacks. Apron increases the 25/15 HP heals. Normal keeps its automatic 25 HP heal without training choices.

Equipment, armor capacity, training counts, and pending rewards all reset on restart or return to the menu. Existing bounds remain: 240 projectiles, 160 pickups, 80 effects, 32 trail segments, and the existing enemy population limits.
