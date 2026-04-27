# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**neverStop** — an audio-first driving game. The car must never come to a stop or the game ends. Built on the [syngen](https://github.com/nicross/syngen) Web Audio engine using a fork of the `syngen-template` scaffolding.

Ships as both an HTML5 app (served from `public/`) and an Electron desktop app (`electron/main.js`). No test suite, no linter. Everything runs through Gulp.

## Commands

```sh
npm install                 # install deps (must run first; Gulpfile expects node_modules/syngen)
npx gulp build              # build public/scripts.min.js + public/styles.min.css
npx gulp build --debug      # same, but no minification or IIFE wrap; appends -debug to version
npx gulp watch              # rebuild on src/** changes
npx gulp serve              # static server for public/
npx gulp dev                # serve + watch in parallel
npx gulp electron           # launch Electron against current public/ build
npx gulp electron-rebuild   # build then launch Electron
npx gulp dist               # build + package electron-packager + zip HTML5 build into dist/
```

The build artifacts `public/scripts.min.js` and `public/styles.min.css` are gitignored — never edit them. After source changes, also run `node --check public/scripts.min.js` (after `gulp build --debug`) for a quick syntax sanity check.

## Game design (current)

- **Player only steers.** No accel/brake input. Speed is a consequence, not a control.
- **Speed cones** add seconds of "virtual accelerator pressed" (`car.boostTimer`). Per-cone time decays with cones-already-collected (`SPEED_CONE_BOOST_BASE * exp(-conesCollected / SPEED_CONE_BOOST_DECAY)`, floored). Boost timer caps at `BOOST_TIMER_CAP` so you can't bank infinite acceleration.
- **Fuel cans** refill the tank. Without fuel, boost has no effect.
- **Hazards** are wide obstacles (`halfWidth` 0.35–0.7 lateral). Crashing applies `speed *= CRASH_INSTANT_FACTOR` immediately AND `CRASH_BRAKE_TIME` seconds of `BRAKE`. Crash beats boost when both timers are active.
- **No speed limit.** Higher speeds → more fuel burn + harsher crashes.
- **Game over** when `car.speed` reaches 0. Reason is recorded on `car.stopReason`.
- **Initial boost.** `car.create()` seeds `boostTimer = START_BOOST_SECONDS` so the player can reach the first pickup. Without it, `START_SPEED²/(2·COAST_DECEL)` is shorter than the first cone's `z`. Math is documented in `car.js` — re-do it if you change `START_SPEED`, `COAST_DECEL`, or `cones.HEADSTART`.

## Architecture

### Three globals, concatenated in order

`Gulpfile.js` concatenates all source files into a single `public/scripts.min.js`. There is no module system; everything lives on three globals:

- **`engine`** — alias for `syngen` (`src/js/engine.js` is `const engine = syngen`). Use the [syngen API](https://syngen.shiftbacktick.io/) for audio, FSMs, vectors, input polling, the frame loop.
- **`app`** — UI scaffolding (screens, controls, settings, storage, updates).
- **`content`** — everything game-specific: `track`, `car`, `cones`, `hazards`, `audio`, `game`.

Load order from `Gulpfile.js`'s `getJs()`: `node_modules/syngen/dist/syngen.js` → `src/js/engine.js` → `src/js/content.js` → `src/js/content/**` → `src/js/app.js` → `src/js/app/screen/base.js` → `src/js/app/utility/*.js` → `src/js/app/*.js` → `src/js/app/**/*.js` → `src/js/main.js`. New files are picked up automatically.

### `content/` — game-specific modules

Each module is an IIFE assigned to `content.<name>`:

- **`track.js`** — looping procedural track of `SEGMENT_LENGTH`-long segments built from `addRoad(enter, hold, leave, curve)`. Exposes `length`, `wrap(z)`, `findSegment(z)`, `curveAt(z)`. The track is a single closed loop; the car wraps around it indefinitely.
- **`car.js`** — physics (z-along-track, x-lateral in normalized [-1, +1]), fuel, gears computed from speed (`gearFromSpeed`), `boostTimer` and `crashTimer` (the virtual accelerator/brake), stop detection. `update(car, dt, controls)` reads only `controls.steer`.
- **`cones.js`** — pickups (mix of `'speed'` and `'fuel'` types). `spawnAlongTrack` enforces a minimum z-gap of `MIN_GAP` (exported so hazards can honor it) and a `HEADSTART` empty runway. `audibleSnapshot(car)` returns `{id, type, pan, volume, behindFactor}` — pre-computed for the audio system.
- **`hazards.js`** — crash obstacles. Spawn loop reads `content.cones.list` and walks each candidate forward in `MIN_GAP` increments until it clears every pickup. Hazards are sparser than pickups and start later (`HAZARD_HEADSTART`).
- **`audio.js`** — top-down listener; engine drone, wind, off-track warning beeps, cone/fuel/hazard beacons, pickup chimes, crash, game-over jingle. **Does not use `engine.position` or `engine.ear` at all** — see "Audio" below.
- **`game.js`** — orchestrator. `start()` creates a fresh car, resets cones+hazards, calls `audio.startGameplay()`. `tick(dt, {steer})` runs the car update, processes pickup/hazard collisions, fires events (`gear`, `speedCone`, `fuelCone`, `crash`, `stop`).

Cones must be reset before hazards because `hazards.spawnAlongTrack` reads `content.cones.list`. `content.game.start()` does this in the right order.

### Audio

The listener is **top-down and never turns**. Sounds left of the road are always heard on the left, regardless of how the car is steering. Lateral cone position relative to the car becomes pan; longitudinal distance becomes volume falloff.

We do **not** use `engine.position` / `engine.ear.binaural` / the engine.position quaternion. Every source has its own `GainNode` + `StereoPannerNode` + (optionally) `BiquadFilterNode` and is connected to a private game bus that feeds `engine.mixer.input()`. This means the syngen-template's "screen→audio coordinate flip" gotcha **does not apply** here — there's no listener quaternion to mismatch.

**Beacon factories** (`makeSpeedConeBeacon`, `makeFuelConeBeacon`, `makeHazardBeacon`) all return objects with the same surface: `{kind, env, panner, filter, gainScale, pitchScale, setBehind(factor), stop(t)}`. The `update*Beacons` functions in `frame()` call `setBehind(item.behindFactor)` and ramp `env.gain` to `gainScale * item.volume`. To add a new beacon kind, follow that interface and add a registry like `coneBeacons` / `hazardBeacons`.

**Doppler / muffle for behind sources.** `muffleParams(behindFactor)` → `{cutoff, pitchScale}`. Cutoff sweeps 8000→700 Hz, pitch 1.0→0.78. For continuous synths (none currently), pitch is applied via `synth.param.frequency`. For percussive/scheduled beacons (the default cone bleep, fuel clank, hazard alarm), the scheduler reads `beacon.pitchScale` at pulse-creation time and constructs each new synth at the scaled frequency. **Don't pre-create the synths** for these beacons — they have to be made fresh on each pulse so the current pitch scale takes effect.

**Beacon scheduling pattern.** Looped percussive/pulsed beacons use a JS-side `setTimeout(loopFn, ms)` for the outer cadence and audio-clock-scheduled events (`engine.synth.simple({when: t})`) for the inner pulse timing. The loop checks a `stopped` flag set by `beacon.stop()` and returns. JS timer jitter is acceptable here — pulses are far apart relative to the jitter.

**Speed cone variants.** `SPEED_CONE_VARIANTS` is a data array of `{id, name, notes: [hz, ...], peaks?, dur?, gap?, cycleSilence?}`. `makeBleepBeacon(variant)` builds a beacon from a variant config. To add or tune one, edit the array. The current pick is held in `speedConeVariant` and persists in-process via `setSpeedConeVariant(id)` (see "Sound test" below).

**Critical syngen.synth.simple gain caveat.** When chaining a syngen synth through an external `GainNode` envelope, pass `gain: 1.0` to `syngen.synth.simple`. Its internal output gain is a constant multiplier — leaving it at the default `zeroGain` makes the chain silent regardless of what the external envelope does.

### Screens (FSM-driven)

`app.screenManager` wraps `engine.tool.fsm`. Each screen is created with `app.screenManager.invent({id, parentSelector, rootSelector, transitions, state, onReady, onEnter, onExit, onFrame})`. `invent` extends `app.screen.base`, which handles aria-hidden toggling, animation classes, focus trapping, and dispatches the `on*` hooks. `engine.loop.on('frame', ...)` calls `onFrame` on the current screen each frame.

State graph:
```
none → activate → splash → interact → menu
menu → start    → game → gameover → restart → game
                       → gameover → menu     → menu
menu → help     → help → back → menu
menu → learn    → learn → back → menu
menu → soundtest (hidden — 't' key) → soundtest → back → menu
```

The transition `none → activate` happens in `main.js` after bootstrap. The starting state is `splash`; the splash listens for any UI input and dispatches `interact`.

### Conventions

- No build-time module system. New files in `src/js/content/`, `src/js/app/screen/`, `src/css/app/`, etc. are picked up automatically by the Gulpfile globs — no manual registration.
- Screens always extend `app.screen.base` via `app.screenManager.invent()`.
- CSS prefixes: `.a-` (app-level layout/instances), `.c-` (reusable components). Order in `getCss()` is `reset → main → utility/* → component/* → */*`.
- Game state that should persist would go through `engine.state`, but currently there's no autosave (a `stop = end` game doesn't need one). High scores are not persisted yet.

## Player-facing controls

- **Steer:** Left/Right arrows or A/D.
- **Pause / back to menu:** Escape.
- **HUD readouts (game screen, F-keys with `preventDefault`):** F1 speed, F2 fuel, F3 gear, F4 distance, F5 time, F6 pickups & crashes, F7 all stats. Each writes to an assertive `aria-live` region.
- **Hidden:** From the menu, press `t` for the speed-cone sound test screen. Loops one variant at a time; selection is also applied as the in-game default for the rest of the session.

ArrowUp/W and ArrowDown/S are still in the keyboard mappings (template defaults) but the game screen ignores accel/brake — they're effectively dead in `game`. Left intact so menu navigation keeps working.

## Gotchas worth remembering

### Audio context is suspended until first user gesture

`main.js` registers `pointerdown`/`keydown`/`touchstart` listeners that call `ctx.resume()`. Menu buttons and the soundtest buttons also call `ctx.resume()` defensively before triggering audio. If you add a new entry point that plays audio, make sure a real user gesture has fired and the context is `running` first.

### `app.controls.ui()` is a delta but can fire on the same tick as a click

Pressing Enter on a focused button fires both the browser's synthetic `click` AND the next frame's `app.controls.ui()` returning `enter: true`. Game/help/learn/gameover/soundtest screens use `state.entryFrames` (a 6-frame countdown after `onEnter`) that drains the UI delta to prevent the entering keypress from immediately triggering the destination's "back" action.

### Doppler-pitched beacons must construct fresh synths per pulse

For percussive/pulsed beacons (`makeFuelConeBeacon`, `makeHazardBeacon`, `makeBleepBeacon`), the pulse scheduler reads `beacon.pitchScale` at the moment it creates each new synth. Don't try to "set frequency once at construction" or pitch-shift won't work. For continuous beacons (none currently — but if you add one), use `ramp(synth.param.frequency, base * pitchScale, ...)` inside `setBehind`.

### Spawning order matters

`content.game.start()` calls `content.cones.reset()` **before** `content.hazards.reset()`. Hazards' spawn loop reads `content.cones.list` to enforce a minimum z-gap between any hazard and any pickup. Reversing this order produces overlapping spawns.

### `node --check` on the debug build is your fastest sanity check

The minified bundle goes through uglify and an IIFE wrapper, which obscures syntax errors. After changes, run `npx gulp build --debug` (no IIFE, no minify) and then `node --check public/scripts.min.js`. Catches typos faster than loading the page.

### Reference repo for car panning

`../racing` is a related project and the original inspiration for the "car pans with the road" feel. It uses a different audio architecture (raw WebAudio + syngen, no engine.position) — useful as a comparison point if you're rethinking the audio pipeline.
