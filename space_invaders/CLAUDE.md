# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**SPACE INVADERS!** — an audio-first stereo Space Invaders-style game built on `syngen-template`. The player is fixed at the centre of the stereo field; ships approach from off-screen and the player shoots them down. Designed for skill ceiling: class identification by ear, weapon RPS matchup, energy discipline, and order-chain combo all stack.

The framework conventions (Gulp pipeline, three-namespace concatenation, screen FSM, storage / settings / controls / haptics, Electron quirks) are inherited from `syngen-template`'s root CLAUDE.md — read it for general framework background.

There is no test suite, no linter, and no `npm` scripts. All tasks run through Gulp.

## SPACE INVADERS! specifics

### Foundational decisions (already taken — don't re-ask)

1. **Perspective and movement.** 1D side-scroller, fixed player. Each enemy carries `(x, z)` where `x ∈ [-1, 1]` is stereo pan and `z ∈ [0, 1]` is approach distance (1 = far, 0 = at player). Ships drift laterally as they approach. The player never moves; only the aim crosshair `aim ∈ [-1, 1]` does.

2. **Audio listener.** **Stereo / non-spatial.** No `engine.position`, no listener yaw, no binaural pipeline. One `StereoPannerNode` per source. Per-source mix: voice osc(s) → voiceGain → lowpass → output → stereoPan → master. Lowpass cutoff opens and gain rises as `z → 0` (closer = brighter and louder). Urgency ticks ride the same panner via the SFX bus.

3. **Audio's role.** Audio-first / blind-accessible. Sighted UI is a minimal HUD; everything important is announced via `aria-live` or readable on F1–F4.

4. **Input.** Keyboard primary (Left/Right or A/D for aim, Space for fire, 1/2/3 for weapon select, Q/E to cycle, Esc to pause). Gamepad axis 0 (X) for aim, A / RT for fire, shoulder buttons cycle weapons. F1 = score, F2 = lives, F3 = energy + wave, F4 = next chain ship.

5. **Persistence.** High scores only. `app.autosave` is disabled (defensive call in `main.js`). Backed by `localStorage['si-highscores-v1']` (web) and `window.ElectronApi.{read,write}HighScores` (Electron).

6. **Progression.** Endless wave-based. Wave composition ramps: scouts only → + bombers → + battleships → + civilians (wave 4) → + chain tagging (wave 5) → faster spawns (wave 6+). No discrete bosses in v1.

7. **Synth aesthetic.** Modern arcade synth. Class voices: scout = bright square at 880 Hz, bomber = sine + sub-octave at 165 Hz, battleship = detuned saw at 82 Hz, civilian = soft triangle major-third dyad at 330 Hz. Chain tags are an ascending arpeggio (A4 / C5 / E5 / G5).

### Module map

```
src/js/content/
  audio.js     stereo voices, ADSR helper, per-source pan/lowpass/gain,
               event queue (drain → dispatch each frame), low-energy buzz,
               chain-tag pitches, learn previews. NEVER touches engine.position.
  enemies.js   per-class kinematics (approach time, drift, pulse rate),
               spawn / tick / hit / removeEnemy, nextChainShip query.
  weapons.js   matchup table (right / wrong / bounce), hitRadius per weapon,
               energy cost, setWeapon / cycleWeapon / tryFire (resolves hit).
  scoring.js   awardScore + extends, onEnemyKill / onCivilianKill / onLifeLost,
               chain advance + breakChain, awardWaveClear (incl. perfect bonus).
  state.js     session state singleton (score, lives, energy, weapon, chain,
               enemies, pendingGameOver, gameOverReasonKey). Designed as a
               clean snapshot for future co-op replay.
  game.js      top-level orchestration: startRun, tick (per syngen frame),
               wave manager (_composeWave, _scheduleNextWave, _beginWave),
               setAim / setFireRequested / requestGameOver, snapshot().
```

```
src/js/app/screen/
  splash.js     idle splash; honors #test and #learn hash routes on interact.
  menu.js       Start / Learn Sounds / High Scores / Language.
  language.js   shared template implementation (en + es).
  learn.js      audition each ship class drone, weapon SFX, hit / miss / bounce,
                low-energy buzz, shield refill, chain tags, urgency cue.
  test.js       diagnostic: ticks at hard left, centre, hard right.
  game.js       main loop. F1–F4 hotkeys (capture-phase preventDefault on
                F1/F3 only — F2/F4 don't conflict with browser defaults).
                Aim integrated from keys + gamepad.x. Rising-edge fire so
                holding Space doesn't auto-repeat.
  pause.js      silenceAll() on enter; Resume returns to game (state preserved),
                Main Menu calls content.game.endRun() and goes to menu.
  gameover.js   snapshots stats on enter (so the next startRun can reset
                state freely); name entry → app.highscores.add → highscores.
  highscores.js top-10 list rendered from app.highscores.list().
```

### Audio model rules

- **All audible game-side events go through `content.audio.enqueue({type, payload})`.** Drained at the end of `content.audio.frame()` each frame. The list of recognised types: `spawn`, `kill`, `breach`, `fire`, `hit`, `miss`, `bounce`, `civilian`, `weaponSwitch`, `shieldRefill`, `extraLife`, `waveStart`, `waveClear`, `urgencyTick`. New types added to `dispatch()`.
- **Why a queue?** Co-op-readiness — when network play arrives, host pushes events into the snapshot's `pendingAudioEvents` and clients drain locally with their own listener pose. Until then, we drain locally.
- **Per-source spatial mix is single-channel pan only.** Don't introduce binaural here; the stereo design is intentional. If you need a "behind" cue, use the lowpass cutoff or a low-energy drone — not a yaw flip.
- **silenceAll()** disconnects every enemy bin, stops the low-energy drone, and clears the queue. Call it when leaving the game screen for pause / menu / gameover (per the "Silence-all on screen exit" pattern).
- **`content.audio.frame()`** must be called inside the game-screen `onFrame` (not the learn / test screen — they manage voices manually). It updates each enemy bin's pan, output gain and lowpass cutoff from the current `enemy.x` and `enemy.z`, then drains the queue.

### Weapon RPS matchup

```
              scout    bomber   battleship   civilian
pulse:        right    wrong    bounce       right (1-shot, but big penalty)
beam:         bounce   right    wrong        right
missile:      wrong    bounce   right        right
```

- **right** (×1.5 score, 1.0 dmg) one-shot kills hostiles (HP 1.0); battleships need 1 right shot (HP 1.4) — kills since 1.0 > 0.4 remaining, but not on a wrong.
- **wrong** (×0.5 score, 0.5 dmg) takes 2 shots on HP-1 ships, 3 shots on a battleship.
- **bounce** (0 dmg, "thud" SFX) never kills. The bounce is the player's diagnostic that they picked the wrong weapon.

Civilians are `right` for any weapon (1 shot kills) — the deterrent is the heavy score / life penalty in `scoring.onCivilianKill`, not the weapon math.

### Energy bus

Single 0–100 meter shared by shields and weapons:
- Each shot costs `pulse: 5`, `beam: 10`, `missile: 15` (in `content/weapons.js`).
- Each enemy reaching the player costs 25 energy first; if energy is below 25 the next breach costs a life and full-resets energy to 50.
- Regen +20/sec **only after 0.4s without firing** (`REGEN_LOCKOUT` in `game.js`).
- Low-energy buzz: hysteresis on at 30%, off at 50% — `setLowEnergy(true/false)` toggle in `audio.js`. A "shield refill" click fires when crossing the off threshold.

### Order-chain combo

Active from wave 5. Each wave assigns chain index 1..4 to the first 4 hostile spawns. Chain tags are pitched ticks (A4 / C5 / E5 / G5) on top of the urgency pulse.

- Killing in order: `chainMult` grows ×1 → ×2 → ×3 → ×4 (capped at ×4). Score multiplier stacks on top of class score and z multiplier.
- Out-of-order kill, civilian hit, or letting a tagged ship reach the player: chain breaks. `bestChainMult` records the run's high water.
- Wave clear with no chain break: bonus `+2000 × waveNum` (announced as "perfect chain" via assertive aria-live).
- Casual players can ignore chain entirely and still survive. High-score chasers play a different game: do I shoot the bomber that's about to ram me, or the scout I tagged for the chain?

### Wave composition (`_composeWave` in `content/game.js`)

- Total contacts: `min(28, 6 + wave * 2)`.
- Spawn interval: `max(0.65, 1.4 - 0.06 * wave)` seconds, with ±15% jitter.
- Class weights: scout 1.0, bomber 0.9 (wave 2+), battleship 0.6 (wave 3+).
- Civilian fraction: `min(0.20, 0.10 + 0.015 * (wave - 4))` from wave 4.
- Chain tags: 4 ships from wave 5; cap rises slightly past wave 6.

### Locale-stable values

All cross-module strings stored as i18n keys, never rendered text:
- `gameOverReasonKey` on `state` — translated only at gameover screen render.
- Class names ("learn.scout" etc.) referenced by key in F4 announce.
- Weapon names ("game.weaponPulse" etc.) computed from `s.weapon` at HUD render.

A locale switch mid-run keeps everything coherent.

### Co-op-readiness (no transport shipped)

- The audio event queue means future host→client replay is "swap `enqueue` for `peer.broadcast(events)`," not a refactor.
- `content.game.snapshot()` returns a clean object: `{wave, score, lives, energy, weapon, aim, chainMult, chainExpected, enemies: [{id, kind, x, z, chainIndex, hp}]}`. No closures, no DOM refs.
- Player-specific state (selected weapon, aim) lives on `state.player`-shaped fields rather than module locals.

We do **not** ship `app/net.js`, lobby UI, or PeerJS in v1. Multiplayer is a later PR.

## Common commands

```sh
npm install                # install deps
npx gulp build             # one-shot build of public/scripts.min.js + public/styles.min.css
npx gulp watch             # rebuild on src/** changes
npx gulp serve             # static server for public/
npx gulp dev               # serve + watch in parallel
npx gulp dist              # build + zip HTML5 build into dist/
```

`--debug` (e.g. `npx gulp build --debug`) skips minification and IIFE wrapping. The build artifacts `public/scripts.min.js` and `public/styles.min.css` are gitignored — never edit them.

## Diagnostics + learn

- `#test` route: ticks at hard left, centre, hard right. Verify the L/R mapping stays correct.
- `#learn` route or main-menu "Learn Sounds": each ship class drone + each weapon + every sting + low-energy buzz + chain tags + urgency cue, individually.

After any change to `content/audio.js`, run `#test` first by ear.

## Out of scope for v1 (deferred mechanics)

- Multiplayer / co-op (state shapes ready; no transport).
- 2D pitch-elevation aim (vertical aim using oscillator pitch as elevation).
- Decoy ships (false echoes mimicking a real class voice).
- Doppler-lead shooting (fast scouts require predictive aim).
- Sonar-ping radar (active scan that reveals positions briefly).
- Formation generators (procedural attack patterns).
- Bosses.
