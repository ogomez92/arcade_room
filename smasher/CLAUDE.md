# CLAUDE.md — Smasher

Guidance for Claude Code when working in this repo. Smasher is a **shipped game**
built on `syngen-template`; ongoing work is normal game dev — the template's
"starting a new game" design questions do **not** need re-asking.

Read the template conventions below the game section for build/architecture rules
that still apply (three globals, screen FSM, i18n, gulp-only tooling, pnpm).

## What Smasher is

An accessible audio **side-scroller score-rush**. You walk an endless 1-D lane;
smashable objects line it around you. Throw balls of five sizes (`1`–`5`) to
smash things and rack up the highest score in **60 seconds**.

- **Perspective / movement:** side-scroller. Continuous left/right steering
  (`←`/`→` or `A`/`D`). The player has no facing; the world scrolls past a fixed
  centre.
- **Audio model:** **STEREO + PITCH, non-spatial** (the template's "stereo only"
  path — no binaural, no `engine.position`, no listener yaw, no y-flip traps).
  - **POSITION → pan.** An object's stereo pan is its lane position relative to
    the player, `clamp((objX - playerX) / PAN_RANGE, -1, 1)`. Centring an object
    (pan ≈ 0) makes it the throw **target**.
  - **SIZE → pitch.** Small = high & bright, big = low & round. Frequencies are an
    A-pentatonic set (`SIZE_FREQ`) so a field of overlapping voices stays consonant.
  - The **centred** object "lights up": louder, brighter, an added overtone, and a
    soft lock tick as it snaps to centre. That highlight is the primary targeting
    cue for blind play.
- **Audio role:** audio-first / blind-accessible. The visual lane is `aria-hidden`.
- **Progression:** timed 60-second rush; combo multiplier stacks; score at 0:00 is
  final. FSM: `menu → game → gameover → menu`, plus `pause`, `help`, `learn`,
  `highscores`, `language`, `test`.
- **Persistence:** local high scores (`app.highscores`, key
  `smasher-highscores-v1`) plus **opt-in online posting** to
  `scores.gomsen.com` (game id `smasher`, `app/onlineScores.js` +
  `app/onlineSubmit.js`; session opened at round start in `screen/game.js`,
  submitted from `screen/gameover.js` after a yes/no prompt when the run makes
  the local top ten). The local board is the always-available fallback. Autosave
  is disabled and the global reverb send is killed in `main.js`.
- **Synth aesthetic:** modern, soft, hand-shaped WebAudio voices (warm filtered
  triangles, soft noise, clean ADSR). Nothing retro/robotic. Smashes bend pitch
  downward for punch and carry a broadband HF transient for definition.

## Core loop & scoring (the design that makes it fun)

Throwing key `N` throws a ball of size `N` at the centre.

- **Size gate:** a ball must be **≥** the object's size or it just **bounces**
  (no break, and your streak resets). `EFF_BY_DIFF` rewards a **perfect** size
  match hardest and decays fast for overkill — brute-forcing everything with a
  size-5 ball is a poor score-per-throw.
- **Big balls are heavy:** `THROW_COOLDOWN_BY_SIZE` scales with size (0.12s for a
  1, 0.52s for a 5). This is the deliberate counterweight to a wide ball clearing
  a whole cluster in one action — it is what stops "spam size 5" from dominating a
  *timed* rush. **If you retune anything, re-check this vs `EFF_BY_DIFF`** (see
  the balance note below).
- **Wide window → combos:** `BALL_HALF` grows with ball size. Catch 2–3 objects in
  one throw for a spatial combo (`SPATIAL_PER_EXTRA`). Clusters (tight rows of
  small objects) are the combo bait — a small ball's window is narrower than the
  cluster gap, so clusters *want* a slightly-bigger ball.
- **Perfect-clean bonus:** a throw where every object hit was a perfect match gets
  `PERFECT_CLEAN_MULT`.
- **Streak multiplier:** consecutive smashes climb `STREAK_TIERS` (×1 → ×1.5 → ×2
  → ×3). A bounce, a caught hazard, or `STREAK_TIMEOUT` seconds without a smash
  resets it.
- **Gold** objects (shimmer timbre) pay `GOLD_PERFECT_MULT` on a perfect match.
- **Hazards** (dissonant buzz) caught in a throw's window **spoil the throw**:
  penalty, streak reset, no score. This is the risk tax on wide big-ball throws.

### Balance is validated by simulation — keep it that way

`content/{config,events,field,game}.js` reference no audio/engine/app globals, so
they run headless in Node. The intended strategy ordering is
**precision > mixed > mindless big-ball spam**. When you change any scoring or
throw constant, re-run a bot sim over several seeds and confirm a "always throw
size 5" bot does **not** beat a "perfect size-match" bot. (The scratch harness
loads those four files with `new Function('content', code)` and plays the round.)

## Module map

- `content/config.js` — all tunables (one object; ops/balance changes are a single
  diff). Sizes are 1..5, index 0 unused.
- `content/events.js` — tiny pub/sub. `game` emits; `screen/game.js` subscribes and
  routes to audio + announcements.
- `content/field.js` — the endless lane: object spawn/despawn, player position,
  `target()` (centred object), `objectsInWindow()`, `audibleVoices()` (nearest N,
  decorated with pan/dist for audio), difficulty ramp via `setRoundT`.
- `content/game.js` — clock, steering, `throwBall()` resolution + scoring, streak
  tiers, emits semantic events. **No audio, no DOM.**
- `content/audio.js` — STEREO+PITCH engine. Persistent per-object voices
  (`updateField(list, targetId)` each frame, smooth create/update/destroy), the
  lock highlight, and all one-shots (throw / smash / bounce / whiff / combo /
  tierUp / hazard / timeWarn / countTick / buzzer) + a frame-driven music bed
  (`updateMusic(timeLeft)`, audio-clock lookahead, no setTimeout jitter).
- `app/screen/game.js` — real-time input (continuous steer, edge-triggered throws
  1–5, `F1`–`F4` status), event→audio/announce wiring, per-frame `updateField` /
  `updateMusic`, the `aria-hidden` visual lane. Order each frame: read keys → set
  steer + resolve throws → `game.update(delta)` → `postUpdate()` (audio + HUD).
- `app/highscores.js` — local top-10 (localStorage / Electron file), key
  `smasher-highscores-v1`.

## Gotchas specific to this game

- **Alphabetical concat loads `audio.js` before `config/field/game.js`.** All
  cross-module refs in `audio.js` resolve `content.config` / `content.field`
  **inside functions** (runtime), never at module top. Keep it that way.
- **Debug build exposes globals; release wraps them in an IIFE.** Headless tests
  that `page.evaluate(() => content.game...)` only work against `gulp build
  --debug`. Ship the plain (non-debug) build.
- **Throws are edge-triggered** (one per keypress); the size-based cooldown gates
  rate. Don't switch to hold-to-repeat without re-checking balance and the
  browser auto-repeat gotcha.
- **Pause silences via `game.onExit` → `silenceAll()`**; resume rebuilds voices +
  music on `game.onEnter`. The round clock freezes while paused (only the current
  screen's `onFrame` runs).
- **No listener to park** — `content.audio.setStaticListener()` is a no-op kept for
  collection-shape parity. Diagnostic route: `#test` (stereo/pitch by ear),
  `#learn` from the menu.

---

<!-- Template conventions below still apply. -->

# CLAUDE.md (template)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

Do not start a dev server to test changes in this checkout — this folder is already served independently, so verification stops at build/static checks unless the user asks otherwise.

This is a **secure system**: plain `npm`/`npx` are disabled. Use **pnpm** / **pnpx** for everything.

```sh
pnpm install               # install deps (run first; Gulpfile expects node_modules/syngen)
pnpx gulp build            # one-shot build of public/scripts.min.js + public/styles.min.css
pnpx gulp watch            # rebuild on src/** changes
pnpx gulp build --debug    # unminified, no IIFE wrap (exposes globals for headless tests)
pnpx gulp electron         # launch Electron against current public/ build
pnpx gulp dist             # build + package + zip HTML5 build into dist/
```

Build artifacts `public/scripts.min.js` and `public/styles.min.css` are gitignored — never edit them.

## Architecture (unchanged from template)

Three `window` globals concatenated in order by `Gulpfile.js` (`getJs()`):
`syngen.js` → `engine.js` → `content.js` → `content/**` → `app.js` →
`app/screen/base.js` → `app/utility/*.js` → `app/*.js` → `app/**/*.js` → `main.js`.

- **`engine`** — alias for `syngen` ([API](https://syngen.shiftbacktick.io/)):
  `engine.context()` (AudioContext), `engine.mixer.input()` (master bus),
  `engine.input.keyboard.is(code)` / `engine.input.gamepad`, `engine.loop`,
  `engine.tool.fsm`, `engine.state`.
- **`app`** — UI scaffolding (screens, controls, storage, i18n, highscores).
- **`content`** — game logic (this game's `content/**`).

Screens extend `app.screen.base` via `app.screenManager.invent({id, parentSelector,
rootSelector, transitions, onReady/onEnter/onExit/onFrame})`. Wrap every `onFrame`
body in `try/catch` (a throw halts the whole loop until reload).

Storage is per-app-version via `app.storage` (IndexedDB). Locale resolves before
storage is ready, so `app.i18n` uses `localStorage` directly (key `smasher.lang`).

CSS: `.a-` app-level, `.c-` reusable components; `getCss()` order is
`reset → main → utility/* → component/* → */*`.
