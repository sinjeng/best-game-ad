# Emberfall Arena

[![Make the best game](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/sinjeng/best-game-ad/rank.svg)](https://make.fun/bounty/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/sinjeng/best-game-ad/reward.svg)](https://make.fun/bounty/best-game-01)

A top-down arena survival game, built for make.fun's **Make the best game** bounty.
Hold the arena against five waves of embers, pick an upgrade between waves, and slay the
Ember King — then keep going in endless mode if you dare. Dependency-free and fully offline:
plain ES modules, a 2D canvas, and WebAudio sound effects synthesised at runtime.

## How to play

- **WASD / arrow keys** — move
- **Mouse** — aim; **hold click or Space** — shoot
- **P / Esc** — pause · **M** — mute · **R** — restart
- Between waves, pick one of three upgrades — click it or press **1 / 2 / 3**

## The game

- **5 waves, then a boss.** Drifters chase you, spitters keep their distance and shoot back,
  brutes are slow and armoured and split into two drifters when they die. Wave 5 ends with
  the Ember King: radial bullet rings and summoned adds.
- **Upgrades:** damage, fire rate, multishot, piercing shots, speed, max HP, magnet, bullet
  speed — three choices after every cleared wave, each stackable up to a cap.
- **Pickups:** hearts heal, stars double your damage for 8 seconds.
- **Scoring:** kills, wave-clear bonuses and pickup caches; best score is kept in
  localStorage. Clearing wave 5 wins the run and unlocks endless mode.
- **Feel:** particles on every kill, screen shake, floating score text, hit flashes, boss
  health bar, wave banners, and a full set of synthesised sound effects (no audio files).

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

No build step, no network requests. `main.ts` (Node 22) copies `game/` and `screenshots/`
to the output directory and writes `dossier.json` via `vendor/makefun-game.ts`.

## Structure

- `game/index.html` — the page, canvas and styles
- `game/src/main.js` — boot, fixed-step loop, screen state machine
- `game/src/world.js` — the rules: player, enemies, waves, boss, upgrades, pickups, score
- `game/src/render.js` — the canvas painter: arena, entities, HUD, every screen
- `game/src/config.js` — all tuning: field, player, enemies, waves, upgrades, palette
- `game/src/input.js` — keyboard and pointer input
- `game/src/audio.js` — synthesised WebAudio sound effects
- `game/src/random.js` — seeded RNG (mulberry32)
- `game/src/shots.js` — deterministic screenshot scenes (`?shot=start|play|end|win&seed=n`)

## License

MIT — see [LICENSE](LICENSE).
