# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Audio Pinball** — a blind-accessible pinball game inspired by the Space Cadet table from 3D Pinball for Windows. Built on the [syngen](https://github.com/nicross/syngen) Web Audio engine. Ships as both an HTML5 app (served from `public/`) and an Electron desktop app (`electron/main.js`).

The original Windows source (Reloaded fan port) lives under `game_source/SpaceCadetPinball/` for reference only — code is not copied from it; layout and aesthetic inspiration only. The directory is **untracked on purpose** (not in `.gitignore`, just never `git add`ed) — don't bulk-stage it with `git add -A`.

The repo's `README.md` still describes the parent `syngen-template`. Treat this `CLAUDE.md` as authoritative; the README is generic boilerplate that hasn't been customised for the game.

There is no test suite, no linter, and no `npm` scripts. All tasks run through Gulp.

## Game design

- **Perspective.** 2D continuous physics, no tile grid. Coordinate frame: +x right, +y up the table, gravity pulls -y. Origin is bottom-center of the playfield.
- **Audio listener — screen-locked, fixed orientation.** Listener is anchored at `content.table.LISTENER` (just south of the playfield), facing +y (up the table). It never rotates and never moves. Because the player conceptually stands behind the machine, the ball never goes behind the listener — so we deliberately do **not** apply any "behindness" muffle or filter. Every event is in front of the player.
- **Audio role.** Audio-first / blind-accessible. Visuals exist (`content.render`) but are decorative; everything required to play is announced or audible.
- **Inputs.** Keyboard (Z/M or Shift pairs for flippers, Space for plunger/launch, P for position read-out, Esc for pause) and gamepad (LB/RB shoulder pairs, A for plunger, Start for pause). No mouse needed (the template's mouse pointer-lock still triggers on click but is harmless).
- **Persistence.** None. `app.autosave` could be enabled later, but the current build has no saved state — every game starts fresh.
- **Progression.** Endless score chase with a Cadet → Fleet Admiral rank ladder and a five-step mission queue (drop targets / bumpers / rollovers / repeat targets / survive-N-points). Three balls per game, then `gameover` screen.
- **Synth aesthetic.** Retro chiptune — squares for bumpers/targets, sawtooth for slingshots, brown-noise low-pass for the rolling rumble, square pulses for the flipper proximity beeps. No ambient pad; the rolling sound is the only continuous element while the ball is live.

### Audio coordinate translation (table → audio)

The conversion lives in `content.audio` and is small enough to keep in your head:

```js
// table.x = right (+) / left (−); table.y = up the table (+); +y_audio = LEFT
audio.x =  (table.y - LISTENER.y) * UNIT     // forward distance
audio.y = -(table.x - LISTENER.x) * UNIT     // negate to map "right of player" → -y_audio
audio.z = 0
// listener yaw = 0 (audio default forward = +x_audio)
```

The negate-y step is the same screen→audio fix described in the parent template's gotcha section: syngen's binaural ear places the LEFT ear at +y_audio. Without negation, "right of player" would sound like "left."

### Continuous ball-rolling sound

While the ball is live, `content.audio.rollUpdate(ball)` is called every frame. It drives three coupled parameters on a single persistent voice (started by `rollStart()` at game-begin, stopped by `rollStop()` at game-over or quit):

- **Rumble body** — looping brown-noise through a low-pass filter. Gain rises with ball speed (silent at 0, full ≈ 0.6 at speed 25); cutoff sweeps 180 Hz → 1500 Hz so a fast ball is also brighter.
- **Pitched undertone** — sine + sub-sine, frequency tracks `ball.y`. Low when ball is near the flippers, high near the bumpers — distance encoded as pitch on top of stereo pan + distance attenuation.
- **Spatial chain** — `StereoPanner` driven by `ball.x / (WIDTH/2)`, then a `distGain` that drops 1.0 → 0.55 as `y` rises.

Goes silent automatically when `ball.onPlunger` or `!ball.live`. There is no per-tick state to reset between balls, but `resetTracker()` is kept as a no-op for callsite compatibility.

### Flipper proximity sensor

`content.audio.proximityUpdate(ball)` runs every frame too. For each of the three flippers, when the ball is within `PROX_RANGE = 4.5` units of the tip-at-rest *and* its velocity points toward the tip (`(ball.v) · (tip - ball) > 0`), a square-wave tick fires panned to that flipper's `pivot.x`. Both rate and pitch climb with proximity:

- Period: 0.30 s (far) → 0.07 s (close).
- Pitch: 600 → 1700 Hz for lower flippers, 1000 → 2100 Hz for the upper one (kept higher so it doesn't blend into the lower pair).

The dot-product gate suppresses post-kick beeps so a ball flying *away* doesn't keep beeping. `resetProximity()` clears the per-flipper tick timers between balls.

### Live regions

Two `aria-live` regions are placed directly under `<main>` (so they're never inside a hidden screen wrapper):

- `.a-app--announce` — `aria-live="polite"`, used for routine events (`scored a target`, `rollover`, `plunger pulling`, position read-outs).
- `.a-app--announce-assertive` — `aria-live="assertive"`, used for state changes that interrupt (drain, ball ready, rank-up, pause, game over).

Both flow through `app.announce.polite(text)` / `app.announce.assertive(text)`.

## Module layout

`src/js/content/` is alphabetical-load-order, which means **siblings cannot be dereferenced at IIFE construction time** — `audio.js` loads before `table.js` even though it depends on `content.table`. Every module that crosses module boundaries does the lookup lazily:

- `audio.js`, `physics.js` — `const T = content.table` is repeated *inside each function* that needs it (and `physics.flippers` is built lazily in `ensureFlippers()` and exposed via a getter).
- `game.js`, `render.js` — declare `const T = () => content.table` (and `P`, `A`, `G` similarly) at the top of the IIFE and call `T().BUMPERS` etc. inside functions.

If you add a new content module, follow the same pattern. Don't capture `content.X` in module-top `const`s.

## Files

- `src/js/content/table.js` — pure data: dimensions, walls, bumpers, slings, targets, rollovers, plunger, listener position. No physics or audio code.
- `src/js/content/physics.js` — 2D circle-vs-segment + circle-vs-circle physics. Adaptive sub-stepping (8 floor, climbs to ~32 at the dt cap; see "Tunneling-prevention invariants" below). Pushes events into a queue (`bumper`, `sling`, `wall`, `target`, `rollover`, `flipperHit`, `flipperBlock`, `spin`, `drain`, `rearm`) consumed by the game module. Also owns spinner rotation state — see "Spinners" below.
- `src/js/content/audio.js` — per-event spatial SFX (`bumper(x,y,id)`, `target(x,y,id)`, `rollover(x,y,id)`, `sling`, `wall`, `flipperHit`, `flipperFlap`, `spinner(x,y,id)`, `plungerCharge`, `plungerLaunch`); continuous spatial rumble (`rollStart`/`rollUpdate`/`rollStop`); per-flipper proximity beep (`proximityUpdate`/`resetProximity`); a `ballReady` chime; and non-spatial big-event SFX (`drain`, `missionComplete`, `rankUp`, `extraBall`, `gameOver`). Each per-event SFX takes both the contact point and an `id` (so each bumper/target/rollover has its own pitch family).
- `src/js/content/game.js` — score, lives, ranks, mission progression, plunger state machine, event-to-audio-and-announcement routing, position read-out (`P` key).
- `src/js/content/render.js` — optional 2D canvas visualizer of walls / bumpers / flippers / ball. Decorative.
- `src/js/app/announce.js` — wraps the two aria-live regions; debounces repeated polite text.
- `src/js/app/screen/{splash,help,learn,game,pause,gameover}.js` — FSM screens. `game.onEnter` calls `content.game.newGame()` only if not already running so the pause→resume path doesn't reset the score.
- `src/js/app/controls/{mappings,keyboard,gamepad}.js` — pinball-specific game inputs (`flipLeft`, `flipRight`, `plunge`) plus UI inputs (`position`, `help`, `quit`, plus the standard back/pause/up/down/enter/space). `flipLeft` *also* drives the upper-left mini-flipper — they share a key.

## Screen flow

```
none ── activate ──▶ splash ──┬── interact ──▶ game ──┬── pause ──▶ pause ── resume ──▶ game
                              │                       │                    └─ quit ──▶ splash
                              │                       └── 3rd drain ──▶ gameover ──┬── restart ──▶ game
                              ├── help ──▶ help ── back ──▶ splash                  └── back ──▶ splash
                              └── learn ──▶ learn ── back ──▶ splash
```

`splash` is a three-item menu (Start Game / How to Play / Learn the Sounds) — each is a real `<button>` so Tab and Enter/Space "just work." Up/Down arrows also move focus. `game` listens for Esc to enter `pause` and dispatches `finish` itself when the third ball drains. `pause` listens for Esc/P to resume and Q to quit (resetting `content.game`). `help` and `learn` listen for Esc to return to `splash`.

The `learn` screen previews every game sound at its real table position. Each preview button calls into `content.audio` directly (`bumper(x, y, id)`, `target(x, y, id)`, etc.); the rolling sound has its own short-loop demo using `rollStart` / `rollUpdate` / `rollStop` with a synthesised ball state for the duration of the preview.

The `entryFrames` countdown on `game`, `gameover`, and `help` is what prevents the same key that triggered the transition from being immediately re-consumed on the destination screen.

## Common commands

```sh
npm install                # install deps (must run first; Gulpfile expects node_modules/syngen)
npx gulp build             # one-shot build of public/scripts.min.js + public/styles.min.css
npx gulp watch             # rebuild on src/** changes
npx gulp serve             # static server for public/
npx gulp dev               # serve + watch in parallel
npx gulp electron          # launch Electron against current public/ build
npx gulp electron-rebuild  # build then launch Electron
npx gulp dist              # build + package electron-packager + zip HTML5 build into dist/
```

`--debug` (e.g. `npx gulp build --debug`) skips minification and IIFE wrapping, and appends `-debug` to the version injected at the bottom of `scripts.min.js`. `app.storage` strips `-debug` when keying versions, so debug and release share saved state.

The build artifacts `public/scripts.min.js` and `public/styles.min.css` are gitignored — never edit them.

## Architecture

### Three globals, concatenated in order

`Gulpfile.js` concatenates all source files into a single `public/scripts.min.js`. There is no module system; everything lives on three namespaces attached to `window`:

- **`engine`** — alias for `syngen` (`src/js/engine.js` is just `const engine = syngen`). Use the [syngen API](https://syngen.shiftbacktick.io/) for audio, FSMs, pubsub, vectors, input polling, the frame loop, state import/export, etc.
- **`app`** — the UI scaffolding (screens, controls, settings, storage, updates, haptics, utilities). Defined incrementally across `src/js/app/**`.
- **`content`** — empty by default; this is where game-specific logic lives. Plug in via `src/js/content/`.

The Gulpfile's `getJs()` order matters: `node_modules/syngen/dist/syngen.js` → `src/js/engine.js` → `src/js/content.js` → `src/js/content/**` → `src/js/app.js` → `src/js/app/screen/base.js` → `src/js/app/utility/*.js` → `src/js/app/*.js` → `src/js/app/**/*.js` → `src/js/main.js`. New files placed in those directories are picked up automatically; nothing needs registering. **The base screen and utilities load before other app modules** because screens and other modules reference them at definition time.

`src/js/main.js` is the bootstrap: awaits `engine.ready()`, calls `app.storage.ready()`, `app.updates.apply()`, `app.settings.load()`, `app.screenManager.ready()`, configures the syngen mixer (reverb impulse + limiter params), starts `engine.loop` (paused), then dispatches `activate` to the screen FSM and calls `app.activate()`. HTML5 builds also wire a `beforeunload` confirmation when the loop is running.

### Screens (FSM-driven)

`app.screenManager` wraps `engine.tool.fsm`. Each screen is created with:

```js
app.screen.foo = app.screenManager.invent({
  id: 'foo',
  parentSelector: '.a-app--foo',  // outer wrapper that gets aria-hidden / hidden / animation classes
  rootSelector: '.a-foo',          // inner element where focus is trapped and placed
  transitions: { someEvent: function () { this.change('bar') } },
  state: { ... },
  onReady, onEnter, onExit, onFrame, onImport, onReset,
})
```

`invent` extends `app.screen.base` (in `src/js/app/screen/base.js`), which handles aria-hidden toggling, animation classes, focus trapping (`app.utility.focus.trap`), and dispatches the `on*` hooks. `engine.loop.on('frame', ...)` calls `onFrame` on the current screen each frame; `engine.state.on('import' | 'reset')` fans out to all screens so they can hydrate from a save.

The starting state is `none`; dispatching `activate` transitions to `splash`, which dispatches `interact` to enter `game`. To add a screen, drop a file in `src/js/app/screen/` and add the matching `.a-app--screen .a-app--<id>` markup in `public/index.html`.

### Controls

`app.controls.update()` runs every frame (`engine.loop.on('frame', ...)`). It merges output from three adapters — `app.controls.gamepad`, `app.controls.keyboard`, `app.controls.mouse` — each with `game(mappings)` and `ui(mappings)` methods. Mappings live in `src/js/app/controls/mappings.js` and are tagged by `type: 'gamepad' | 'keyboard' | 'mouse'`.

- `app.controls.game()` returns the current frame's continuous game inputs. **For pinball this is `{flipLeft, flipRight, plunge}` (booleans)** plus the legacy `{x, y, z, rotate: 0}` defaults inherited from the template — those zero fields aren't read by anything in the game and could be removed if you don't need backwards compatibility with the gamepad axis adapter. `flipLeft` activates *both* the lower-left and the upper-left flipper from the same key.
- `app.controls.ui()` returns *deltas* — only the UI inputs that just became active this frame, used for menu navigation (so a held key fires once). Pinball UI deltas include `position` (P), `help` (H), `pause` (Esc), `quit` (Q), and the standard `enter`/`space`/`back`.

The mouse adapter takes pointer lock when entering the `game` screen (and re-acquires it after Escape in Electron). Pinball doesn't read mouse input at all, so the pointer-lock click is harmless but cosmetic.

### Inherited scaffolding (currently unused)

The template ships several systems pinball doesn't touch. They still load (the modules exist in the bundle) but nothing in `content/` calls them. Touch them only if you're adding the relevant feature.

- **Storage / versioning / updates.** `app.storage` (IndexedDB-backed, per-version keys), `app.updates.register(semver, fn)` migrations, `app.utility.semver`. Pinball saves nothing.
- **Autosave.** `app.autosave` would debounce `engine.state.export()` to storage on a 30-second loop, but `engine.state` has no registered serializers in this game.
- **Settings.** `app.settings.register('fooBar', {default, compute, update})` auto-creates setters and a computed/raw/defaults triplet. See `src/js/app/settings/example.js` for the template; pinball defines no settings.
- **Haptics.** `app.haptics.enqueue({duration, startDelay, strongMagnitude, weakMagnitude})` queues dual-rumble effects, but `update(delta)` is never driven from any pinball screen, so nothing rumbles. Wire `app.haptics.update(dt)` into `content.game.frame()` and call `enqueue()` on bumper/flipper hits to activate.

### Electron specifics

`electron/main.js` creates a frameless fullscreen window with `contextIsolation: true` and `devTools: false`, removes the menu (so Ctrl+R/Ctrl+W can't reload/close), auto-grants `midi` and `pointerLock` permissions, and applies platform-specific GPU/composition flags. `electron/preload.js` exposes `window.ElectronApi = {quit}`. Renderer code uses `app.isElectron()` (presence of `ElectronApi`) to branch — e.g. `app.quit()` calls `ElectronApi.quit()` only in Electron, and the HTML5 build adds a `beforeunload` confirmation that Electron skips.

The `dist-electron` Gulp task packages only the current platform — to ship Windows + Linux + macOS, run `gulp dist` separately on each.

## Physics invariants (don't break these)

### Tunneling prevention

Five layered guards keep a fast-moving ball from escaping the table. Each one alone is insufficient; remove any of them and balls start exiting through walls.

- **Adaptive sub-stepping.** `numSubSteps = max(8, ceil(dt × MAX_SPEED / (0.7 × ball.r)))`. With `MAX_SPEED = 120` (real-pinball top speed): at dt=1/60 this is ~16; at the 0.05 s `dt` cap (slow frame, GC pause, backgrounded tab) it climbs to ~48. Guarantees no sub-step ever covers more than 70 % of the ball radius even at full speed.
- **Speed clamp at both ends of each sub-step.** `clampSpeed(ball)` runs *before* integration (start-of-sub-step) AND after the collision passes. Without the post-clamp, a chain of kicks (sling + bumper + flipper in one tick) compounds past `MAX_SPEED` and the next sub-step's travel exceeds `ball.r`. Real bug we saw: ball at 152 units/s exiting through the right outer wall in 16 ms.
- **Velocity-aware fallback normal.** When `circleVsSegment` finds the ball center exactly on a segment line (`dist < 1e-6`), the perpendicular is ambiguous. We pick the one that points *opposite* to the ball's velocity — i.e. back toward the side the ball came from. Without this, a fast ball landing on the horizontal top wall got normal `(0, +1)` and was *pushed out of the playfield* by the position correction, never reflecting. `collideSegments` passes `ball.vx, ball.vy` to `circleVsSegment` for this disambiguation.
- **Iterative collision resolution.** Each sub-step runs `collide*` up to `RESOLVE_PASSES = 4` times until no overlap remains. The first pass reflects velocity off whichever surfaces the ball hit; subsequent passes are pure position correction (each collide* gates the velocity-changing branch on `dot < 0`, which fails after the first pass since the ball is now moving away). Necessary because resolving overlap with segment A can push the ball into segment B at corners and narrow channels — at higher `MAX_SPEED` the "stuck in wall after one-pass resolution" failure mode becomes common.
- **NaN / out-of-bounds drain.** End-of-sub-step checks: if `ball.x/y/vx/vy` is non-finite OR if the ball is outside the playfield rectangle by more than `0.5` units, force a drain. This catches anything the four guards above missed — e.g. a runaway feedback loop, a divide-by-near-zero in the fallback normal, or a ball that genuinely tunnelled through a single-segment hole we didn't anticipate.

### Geometry footgun: rails into the gutter

The right side of the playfield has a vertical gutter (plunger lane) at `x ∈ [3.3, 4]` bounded by the inner gutter wall at `x = GUTTER_INNER = 3.3`. **Any diagonal segment that has one endpoint at `WIDTH/2` (= 4) and another at `x < 3.3` will slice through the plunger lane and intercept the launched ball.** We hit this twice this session — the lower side rail and the upper mid-rail both started at `(4, 2.2)` / `(4, 7)` and crossed the gutter on their way to the playfield interior. The launched ball at `x = 3.65` going straight up hit them at `y ≈ 1.85` and `y ≈ 6.4` and dissipated all its energy in the gutter floor.

Rule: **on the right side, any rail that needs to span a vertical range that overlaps the gutter must terminate at `GUTTER_INNER`, not `WIDTH/2`.** Compute the rail's `y` at `x = GUTTER_INNER` along its original line and use that as the new endpoint. Only the upper-right corner deflector at `(3.3, 16) → (4, 14)` is allowed to live inside the gutter zone — it's the *intended* obstacle for a launched ball.

The left side has no gutter and no analogous restriction — left rails span `(-4, *) → (-2.4 or -3.0, *)` cleanly.

### Drain mouth = full pivot-to-pivot width

`DRAIN_LEFT = -1.6`, `DRAIN_RIGHT = +1.6`. The drain mouth spans the full distance between the lower-flipper pivots, and the dead-floor segments only cover the *outboard* zones (`-4 → -1.6` on the left, `1.6 → 3.3` on the right). If you narrow the drain back to ±0.75 (the geometric flipper-tip-to-flipper-tip span), a ball that ended up on the dead floor *behind* a flipper has nowhere to drain — stuck-ball trap. We saw a ball oscillate at `(1.16, 0.18)` for 60 s before diagnosing it.

### One-way gutter return gate

Segment `(3.3, 14) → (3.3, 16)` with `kind: 'oneway'` and `normal: (-1, 0)`. Allowed direction is leftward (`vx < 0` → `into > 0` → skip). The launched ball passes through it on its way out (after bouncing off the corner deflector, ball moves leftward); a playfield ball drifting *rightward* into the gutter gets reflected back into the playfield. Without this gate, a ball wandering into the upper-right corner would fall into the gutter, settle, auto-rearm, and the player would see the ball "teleport back to the plunger for no reason."

### Auto-rearm: `gutterFrames > 30`

`physics.step` increments `ball.gutterFrames` whenever the ball satisfies `inGutter && slow` (inside the gutter x range, `y < 1.0`, speed `< 0.6`); resets it otherwise. After 30 consecutive frames (~0.5 s) a `rearm` event fires, the ball snaps to the plunger pose, and `onPlunger` flips back to true. The 30-frame debounce is what stops a freshly-launched ball — which briefly satisfies "y < 1, low speed" right at release before gravity has done its work — from instantly false-rearming.

### Spinners

A spinner is modelled as a thin sensor segment (`table.SPINNERS[i].a → b`) the ball passes *through* — no collision response, just a momentum-transfer event. Real spinners pivot the blade out of the way as the ball passes underneath.

- **Crossing detection.** Per sub-step, segment-segment intersection between the ball's path `(prevX, prevY) → (ball.x, ball.y)` and the blade footprint. Treats the ball as a point trajectory; the radius doesn't matter because the blade rotates out of the way in 3D. A straight line crosses a straight line at most once per sub-step, so no double-counting.
- **Momentum transfer.** `angularVel += SPIN_KICK_PER_SPEED · (v · n̂)` where `n̂` is the unit perpendicular to the blade. Signed → ball going one way spins one direction, ball going the other way spins the opposite direction. `SPIN_KICK_PER_SPEED = 0.7`.
- **Decay.** Exponential at `SPIN_DAMPING_PER_SEC = 0.4` per second (`ω *= 0.4^dt` per frame). Below `SPIN_STOP_THRESHOLD = 0.05 rad/s` we snap to zero so floating-point dust doesn't accumulate. With those constants, a 25 u/s perpendicular hit gives ω₀ ≈ 17.5 rad/s and total angle ≈ 19 rad ≈ 6 spins — matches the 4–12 spin range a real Bally/Williams unit produces.
- **Spin events.** Each π of *unsigned* travel (`angleTraveled`) emits one `spin` event — matching the real-life reed switch firing once per blade pass through vertical, regardless of rotation direction. The game module debounces the screen-reader announce (one "Spinner!" per chain) but plays the click on every spin and scores 100 each.
- **Reset between balls.** `physics.resetSpinners()` is called from `startBall()`. Without this, a ball draining mid-spin would queue up pending `spin` events that the next ball "inherits" — easy to test by holding the spinner on a long pass right before drain.

## Calibration math

When tuning kick / restitution / launch numbers, the constants worth keeping in your head:

- **Gravity.** `GRAVITY = -22 units/s²`. Real pinball tilts at ~6.5°, so on-table gravity is `g · sin(6.5°) ≈ 1.11 m/s²`. At our scale (1 unit ≈ 5 cm) that's ≈ 22 units/s² — the value matches reality, don't change it without reason.
- **Plunger.** Ballistic apex `≈ y_start + v² / (2g)`. With `g = 22` and start at `y = 0.6`, reaching the corner deflector at `y ≈ 15` requires `v ≥ √(2 · 22 · 14.4) ≈ 25.2`. Current `minPower = 30` and `maxPower = 42` give apexes ≈ 21 and ≈ 41 — comfortable margins (and impact velocity ≈ 13 / 33 at the deflector for a real reflection, not a stall).
- **Flipper kinematics — asymmetric.** `FLIPPER_ACTIVATE_SPEED = 30 rad/s` going up (matches a real solenoid stroke of ~50 ms), `FLIPPER_RETURN_SPEED = 9 rad/s` coming down (the spring is much weaker than the coil). Visual Pinball Engine recommends a Return Strength Ratio of 0.055-0.09; we're a bit faster on the return for playability but the *asymmetry* is what enables drop-catch and live-catch — without it, a ball can never settle on a held flipper.
- **Flipper tip speed.** `tip linear speed = angularVel × length = 30 × 1.4 = 42 units/s` for the lower flippers, `30 × 1.0 = 30` for the upper. With `e = 0.88` the relative-velocity reflection alone gives a stationary ball ≈ `(1+e) · tipSpeed = 79 u/s`, right at `MAX_SPEED = 80` — no separate "boost" term is needed (an additive boost on top of relative reflection is double-counting).
- **Flipper elasticity with falloff.** `FLIPPER_E_BASE = 0.88`, `FLIPPER_E_FALLOFF = 0.018`. Effective `e = 0.88 / (1 + 0.018 · impactSpeed)`. Soft tap (5 u/s): `e ≈ 0.81`. Hard slam (40 u/s): `e ≈ 0.46`. Without falloff a held-up flipper catapults any ball that lands on it; with falloff the rubber absorbs energy on hard hits — that's how cradling and catching work in real machines.
- **Flipper friction.** `FLIPPER_FRICTION = 0.18`. Tangential damping on contact, simulating rubber grip. Real rubber has μ ≈ 0.9 but a contact spans many sub-steps, so a fractional per-contact damping is what's numerically stable.
- **Restitution (other surfaces).** `WALL_RESTITUTION = 0.74` (wood/plastic apron, real pinball is 0.7–0.8 — below 0.7 feels dead), `BUMPER_RESTITUTION = 0.85`, `SLING_RESTITUTION = 0.85`. Bumpers and slings are powered actuators, so they ALSO add a fixed kick (`BUMPER_KICK = 22`, `SLING_KICK = 17`) on top of the rubber bounce — that's how a pop bumper feels "snappy" even on a glancing hit. Restitution > 1 (the old 1.05) is unphysical and lets passive bounces add energy.
- **Damping.** `0.9995` per sub-step. With 8 sub-steps × 60 fps = 480 Hz that's ~0.787× per second — subtle drag, just enough to settle a stuck ball without bleeding meaningful energy from in-play motion. The earlier 0.999 was bleeding ~38 %/s and made minPower launches stall short of the deflector.

## Conventions

- No build-time module system. All app code is written as IIFEs or assignments to the `app` / `content` namespaces. New files are picked up via the glob in `Gulpfile.js`'s `getJs()`/`getCss()` — no manual registration needed.
- Screens always extend `app.screen.base` via `app.screenManager.invent()`. Don't subclass it manually.
- CSS class prefixes are `.a-` (app-level layout/instances) and `.c-` (reusable components). The order in `getCss()` is `reset → main → utility/* → component/* → */*` — utilities and components must not depend on later files.
- Game state that should persist goes through `engine.state` (so `app.autosave` and screen `onImport`/`onReset` hooks pick it up), not directly through `app.storage`.

## Gotchas worth remembering

### Syngen spatial audio coordinate frame

Syngen's `engine.ear.binaural` (in `node_modules/syngen/src/syngen/ear/binaural.js`) uses listener-local axes where **+x = forward** and **+y = LEFT** (the LEFT monaural processor sits at `+headWidth/2` on the y axis). That's the opposite of natural 2D screen coords where +y points down. Without compensation, "right of player on screen" sounds like *left* in the audio.

Pinball compensates with a single rule: **every translation from table coordinates to audio negates y.** See `content.audio.tableToAudio()` and `relativeVector()` — both apply `audio.y = -(table.x - LISTENER.x) * UNIT`. The listener yaw is fixed at 0 and never rotated (no `setQuaternion` calls during play other than the constant identity in `setListener()`), so the rotation example you may have seen in the parent-template docs doesn't apply here. If you ever introduce a rotating listener, every other place that compares a source angle to facing yaw has to use the same y-flip or stereo will scramble.

### Listener orientation and per-frame state

`engine.position.setVector(...)` and `setQuaternion(...)` are sticky — set them once and they persist across frames until you set them again. The pinball listener never moves, so `content.audio.setListener()` is intentionally cheap and idempotent; `content.game.frame()` calls it every tick as a safeguard. The hazard to watch for is *another* module quietly overwriting `engine.position` (e.g. a future diagnostic screen that animates a moving listener) — anything that does so must restore the fixed pose on exit, or the next time `game` runs the binaural pan will be wrong until the first `setListener()` call lands.

### `app.controls.ui()` is a delta, but it can fire on the same tick as a click

Pressing Enter on a focused button fires both:
1. The browser's synthetic `click` event (handled by your `addEventListener` in `onReady`).
2. The next frame's `app.controls.ui()` returning `enter: true` to your `onFrame`.

If both paths call the same action, you'll dispatch twice. Usually the second dispatch is silently dropped because the source state changed, but for screens that have an Enter-to-go-back, the entering keypress can immediately bounce you back. Either:
- Add a small `entryFrames` countdown in the destination screen's state and ignore inputs for ~6 frames after `onEnter`, or
- Only listen for the click event and ignore the keyboard delta in `onFrame`.

### Audio context is suspended until first user gesture

Browser autoplay policy means the WebAudio context starts in `suspended` state. `main.js` registers `pointerdown`/`keydown`/`touchstart` listeners that call `ctx.resume()`. If you skip the splash screen and route straight to a screen that announces or plays SFX on `onEnter`, those calls happen before any user gesture and will be silent. The `aria-live` announce still works (it's not WebAudio), but synthesized SFX will start at the first interaction. Don't chase silent SFX as a bug if no user gesture has happened yet.

### Hash routing in screenManager

Pinball doesn't define any hash routes (no `#test`, `#music`, etc.) — `none → activate` always lands on `splash`. If you ever add a diagnostic route, the place to read `window.location.hash` is inside the `none.activate` transition in `app.screenManager`, *not* from `main.js` after `dispatch('activate')` — by then the FSM has already entered its destination state.
