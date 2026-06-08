# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Audio-first reimagining of Marvin Glass / Bally Midway's *Tapper* (1983),
built on the syngen-template. The player is a bartender working four
horizontal bars stacked vertically; customers walk in from the right and
must be pushed back out by sliding full mugs at them, while empty mugs
get flung back left and have to be intercepted before they hit the floor.

## Build commands

There is no test suite, no linter, and no `npm` scripts. All tasks run
through Gulp.

```sh
npm install                # install deps (Gulpfile expects node_modules/syngen)
npx gulp build             # one-shot build → public/scripts.min.js + styles.min.css
npx gulp watch             # rebuild on src/** changes
npx gulp serve             # static server at http://localhost:3000
npx gulp dev               # serve + watch
npx gulp electron-rebuild  # build then launch Electron
npx gulp dist              # build + zip HTML5 + electron-packager
npx gulp build --debug     # skip minification + IIFE wrap; appends -debug to version
```

`public/scripts.min.js` and `public/styles.min.css` are gitignored build
artifacts — never edit them. Source lives under `src/js/**` and
`src/css/**`. Smoke-test the gameplay state machine in node without a
browser via `node /tmp/smoke2.js` (the script stubs WebAudio + DOM and
exercises pour → sling → catch).

## The three globals (`engine`, `app`, `content`)

`Gulpfile.js` concatenates all source files into a single
`public/scripts.min.js`. There is no module system; everything attaches
to three namespaces on `window`:

- **`engine`** — alias for `syngen` (`src/js/engine.js` is just `const
  engine = syngen`). Use the [syngen API](https://syngen.shiftbacktick.io/)
  for audio nodes, FSMs, vectors, the frame loop, etc.
- **`app`** — UI scaffolding (screens, controls, settings, storage,
  i18n, announcer, highscores). Defined incrementally across `src/js/app/**`.
- **`content`** — game-specific logic (`game`, `audio`, `levels`,
  `announcer`). This is where TAPPER! lives.

Concat order in `Gulpfile.js`'s `getJs()` is: syngen → `engine.js` →
`content.js` → `src/js/content/**` → `app.js` → `src/js/app/screen/base.js`
→ `src/js/app/utility/*.js` → `src/js/app/*.js` → `src/js/app/**/*.js` →
`src/js/main.js`. New files in those directories are picked up
automatically — nothing needs registering.

`src/js/main.js` is the bootstrap: awaits `engine.ready()`, calls
`app.storage.ready()` / `app.updates.apply()` / `app.settings.load()` /
`app.i18n.applyDom()` / `app.screenManager.ready()`, **disables
`app.autosave` and `engine.mixer.reverb`**, configures the limiter,
starts the syngen loop paused, then dispatches `activate` to the screen
FSM.

## Game design at a glance

- **Perspective**: 2D, top-down, lane-based. Four horizontal lanes stacked
  vertically. Lane 0 = topmost = shortest; lane 3 = bottom = longest.
  Movement up/down is **instantaneous lane swap**; left/right is
  continuous walking along the current lane.
- **Coordinate system**: each lane has its own `length` in abstract
  units. `x = 0` is the kegs (far left); `x = length - 1` is the door
  (far right). Player's `x` carries across lane swaps but is clamped
  to the new lane's length.
- **Audio listener**: **stereo / non-spatial**. No `engine.position`,
  no binaural ear, no listener yaw. Every cue panned via a per-source
  `StereoPannerNode` whose `pan ∈ [-1, 1]` is mapped from
  `(x / (length-1)) * 2 - 1`. Lane is communicated by **pitch family**
  (lane 0 highest, lane 3 lowest, see `LANE_BASE_HZ`) — the listener
  never moves.
- **Audio's role**: audio-first. The visual HUD is a text-grid fallback;
  the game must be playable purely by ear.
- **Input**: keyboard primary (arrow keys / WASD / Space-Enter), gamepad
  fallback. See "Input handling" gotcha below.
- **Persistence**: high scores only (top 10), via `app.highscores`. No
  `engine.state` autosave — the run is entirely session-state.
- **Progression**: levels = themed bars. Four themes cycle
  (`saloon → discoteca → estadio → yates`); after each cycle, `round`
  ticks and difficulty scales (walk speed ×1.15, spawn interval ×0.9,
  customers +2, empty-mug speed ×1.1). Endless score chase.

## Three ways to lose (per Tapper)

Each loss costs **one life**; start with **3 lives**. Game over at 0.

1. **Customer breach** — a customer reaches `x = 0` (the kegs).
2. **Broken empty** — a returning empty mug slides past `x = 0`.
3. **Wasted drink** — a slung full mug reaches `x = length - 1` with
   no customer to catch it.

## Frame-loop (per `content.game.frame(dt)`)

```
1. Read input (laneDelta rising-edge, walk continuous, action edge).
2. Move player.x within current lane bounds.
3. Spawn customers per the level's spawn schedule.
4. Move customers leftward; dwelling customers freeze (drinking),
   floor-show freezes them all.
5. Move mugs (full = right; empty = left).
6. Detect mug↔customer overlap:
   - Full mug + customer at same x → consume: customer +PUSH_DISTANCE,
     dwell starts, mug removed.
   - Customer pushed past length → leaving=true, score += SCORE_PER_PUSH.
7. Loss checks: customer x ≤ 0 → breach; empty x ≤ 0 → shatter;
   full x ≥ length-1 → waste.
8. Auto-pickup: returning empties and tips on player overlap.
9. Level-clear: spawned == target AND all lanes empty (incl. empties).
```

## Module layout (`src/js/`)

| File | Role |
|---|---|
| `content/game.js` | World state, frame loop, input → action mapping, life/score/level rules |
| `content/levels.js` | Per-theme tables: lane lengths, customer schedule, walk speed, tip frequency |
| `content/audio.js` | Stereo audio engine: lane drones, customer + mug voices, pour voice, one-shot SFX |
| `content/announcer.js` | Maps game events to i18n keys for the polite/assertive aria-live regions |
| `app/announce.js` | Shared aria-live region driver (re-read fix, optional TTS) |
| `app/highscores.js` | Top-10 high score table (`tapper-highscores-v1` localStorage / Electron JSON) |
| `app/i18n.js` | EN/ES dictionaries; `STORAGE_KEY = 'bartender.lang'` |
| `app/screen/{menu,game,gameover,help,highscores,language}.js` | FSM screens |

## Audio map (the core of the game's identity)

Every cue stacks **lane pitch family** + **stereo pan from x** so the
player can place every event in the 4×length grid by ear. Don't reach
for binaural — the listener never moves and the lane is encoded by
pitch, not by 3D position.

**The canonical octave.** Every lane-pitched voice sings at the **lane
voice octave** = `laneVoice(lane) = LANE_BASE_HZ[lane] × 2` — the same
octave as the player's cursor (`LANE_VOICE_OCT = 2` in `audio.js`).
Customers, mugs, the pour's full-charge target, and the lane-relative
one-shots are all anchored here; ornaments stay within ~`[×0.5, ×1.6]`
of the anchor so **nothing ever reads a full octave off the cursor**
(that was the "sometimes a sound plays an octave higher/lower" bug). The
lane drone bed sits an octave below as quiet ambience — lane identity is
the *voice* pitch, not the drone. Re-octave the whole game by changing
`LANE_VOICE_OCT`, not by editing call sites.

- **Lane drone** (ambience) — continuous low sine + triangle at the
  lane's base pitch, on a deliberately **quiet** `droneBus` (gain 0.22).
  Active lane is *much* louder; other lanes audible at reduced gain so
  customers walking on bars you aren't standing on are still heard. Each
  lane's drone gain is also pulsed by an LFO at a distinctive rate —
  `LANE_DRONE_LFO_HZ = [3.4, 2.1, 1.3, 0.85]` — so the active lane reads
  as fast/slow heartbeat as well as high/low pitch.
  `LANE_BASE_HZ = [660, 440, 330, 220]`.
- **Player presence voice (the cursor)** — square wave at the lane voice
  octave (`laneVoice(lane)` = `LANE_BASE_HZ[lane] × 2`), panned by
  `player.x`. Pulses as **footsteps** when the player is walking (~5/s)
  and as a slow **heartbeat** when idle (~1.25/s). The player is
  otherwise audio-invisible; this voice is what tells them where they
  are along the bar and which lane they're on. Its octave is the
  reference everything else matches.
- **Customer voice** — triangle at the lane voice octave
  (`laneVoice(lane)`, so the customer is the same octave as your cursor
  and lanes stay separated by base), panned by customer.x; an ADSR
  footstep pulse fires per "step" at walk rate. Each customer gets a
  small random detune (±15 cents) so multiple customers on a lane don't
  collapse into one tap rhythm. Earlier builds put the customer at the
  bare base, and before that at `× 0.66` (a fifth below) which landed
  near the adjacent lane's pitch — don't reintroduce either.
- **Mug slide (full)** — sawtooth at the lane voice octave, continuous,
  loud, with a soft sine LFO shimmer. Pans rightward as it heads to the
  door.
- **Mug slide (empty)** — square at the lane voice octave (same octave/
  pitch family as the customer voice — that's what tells you which tap
  it's on), brighter filter + faster LFO than the full mug, so the
  timbre is the distinction. Pans leftward as it slides back to the
  kegs. Pitch is **fixed** for the mug's whole life — never ramp it with
  proximity, that wrecks lane identification.
- **Pour voice** — sawtooth held at the kegs; freq rises with `charge`
  from the lane fundamental to the lane voice octave at full charge.
- **One-shot SFX** — `sling`, `catch`, `catchEmpty`, `emptyFling`,
  `spawn` (door creak, pan = +1), `tipDrop`, `tipPickup` (centred chime
  + per-theme floor-show motif), and reason-specific loss stings:
  `breach` (low alarm at pan = -1), `shatter` (glass break, bright HP
  noise), `waste` (descending sawtooth at pan = +1).
- **Level clear** — ascending chord rooted on the lane voice octave.
- **Game over** — descending dirge guarded by `pendingGameOver` flag.

## Input handling (the non-obvious part)

The game screen reads gameplay keys directly via window-level
`keydown`/`keyup` listeners (capture phase) — **not** through
`app.controls.game()`. This is deliberate: the controls adapter has
non-obvious axis semantics that don't fit a lane-walker:

- forward/backward (Up/Down arrows or W/S) → `state.x` (not `state.y`)
- strafe (only **A/D**, no arrow keys) → `state.y`
- ArrowLeft/Right → `state.rotate` (not strafe)

If you read `g.x`/`g.y` thinking they map to screen-x/y, walking will
silently break. The window-level handler in `app/screen/game.js`
maintains a `keys` map and derives `laneDelta` (rising-edge in
`content.game`), `walk` (continuous), and `action` (edge-detected for
pour-start/sling-release) from it. `app.controls.game()` is only
consulted as a **gamepad fallback** when no keyboard key is held.

`Space`/`Enter`/`KeyJ`/`KeyK` are all aliases for the action button.
Auto-repeat is harmless because the rising-edge gate lives inside
`content.game.handleInput()`, not the listener.

## Status hotkeys (F1–F4)

Bound at window level, capture phase, with `preventDefault` on F1/F3/F5
(browser maps them to Help / Find / Reload). F11 is left alone for
fullscreen.

- **F1** — current lane and position label (kegs / mid / door).
- **F2** — score, level, lives.
- **F3** — closest customer: lane and percent toward the kegs.
- **F4** — count of returning empty mugs and which lanes they're in.

## Localization

Two locales: `en`, `es`. `STORAGE_KEY = 'bartender.lang'`. Resolution:
`localStorage(STORAGE_KEY)` → `navigator.language[0..2]` → fallback
`'en'`. **Don't translate flavor pools** — author per-locale phrase
pools instead. Translated flavor reads stilted.

State that is set in module A and rendered in module B (loss reasons,
theme names) stores the **i18n key**, not the rendered string. The
high-score entry stores `themeKey` so the table stays coherent across
locale switches.

## High scores

`app.highscores` — top-10 entries `{name, score, level, round,
themeKey, date}`, persisted to `localStorage['tapper-highscores-v1']`
in the browser, and to a JSON file via
`ElectronApi.readHighScores`/`writeHighScores` under Electron. The
gameover screen submits via `app.highscores.add(entry)`.

Online leaderboard via `app.scores` (`src/js/app/scores.js`) posting
to `scores.oriolgomez.com` — `game_id = 'tapper'`, secret embedded in
the bundle. Contract is `/home/scores/INTEGRATION.md`. Flow: `game.js`
`onEnter` calls `app.scores.openSession()` (fire-and-forget) so
`play_seconds` is measured from "pressed Play"; `gameover.handleSave`
always attempts `app.scores.submit({name, score, meta: {level, round}})`
in parallel with the local `app.highscores.add`, regardless of local
top-10 qualification (a non-local-qualifying score may still rank
globally). The highscores screen renders local immediately, then races
`fetchTop(10)` and replaces the list if online responds; failure keeps
the local list with a "couldn't reach" notice. Every method swallows
errors and returns null/false — the local board is always the
authoritative fallback. Player names are validated against the
server's safe-charset (`app.scores.isValidName`) before any save.

## Gotchas

- **`engine.mixer.reverb.setActive(false)`** in `main.js`. Every cue
  authors its own tail; we don't want the global convolver smearing the
  lose stings. (See "reverb on a one-shot" pattern from the sibling
  game collection.)
- **Cross-module references must be lazy.** Gulp's alphabetical concat
  means `audio.js` runs before `levels.js` defines `content.levels`.
  Capture sibling references inside *functions*, not at module top.
  `audio.js` and `game.js` use `const audio = () => content.audio`
  arrow getters for this reason.
- **`engine.position.setVector` / `setQuaternion` are unused** — TAPPER
  doesn't touch them. Don't add them; the listener is fixed and
  centred for stereo panning.
- **`pendingGameOver` flag** delays the screen transition until the
  game-over dirge has played (~1.6 s). Without the guard, an FSM phase
  that re-fires the dirge each frame produces a smeared "reverb-y"
  wash (the canonical syngen-template gotcha).
- **Customer push** is a one-shot delta, not a velocity. Customers
  only walk left at `walkSpeed`. A successful catch sets
  `customer.x += pushDistance` then `customer.dwell = pushDwell`.
  Leftward walk pauses for `dwell` seconds before resuming.
- **Empty-mug fling** — when a customer's dwell timer expires, with
  probability `returnEmptyChance` an empty is spawned at the customer's
  current x. The mug spawns where the customer is, not at the door,
  so the player can't camp the door for empties.
- **Lane-pitch consistency** — every voice on a lane reads its pitch
  from `content.levels.LANE_BASE_HZ[lane]`, almost always via the
  `laneVoice(lane)` helper (= base × `LANE_VOICE_OCT`, the cursor
  octave). Re-tuning lane 0 from 660 → 720 makes every cue on that lane
  follow; changing `LANE_VOICE_OCT` re-octaves the whole game at once.
  Don't hand-write per-call octave multipliers off the bare base — that
  is how cues drift an octave apart.
- **Pan is computed from each entity's *own* lane length** —
  `pan = (x / (LANE_LEN[lane] - 1)) * 2 - 1`. The top bar is shorter
  than the bottom; x = 5 maps to a different pan on lane 0 vs lane 3.
- **`onFrame` wrapped in try/catch** — a throw inside `onFrame` halts
  the syngen loop until reload, killing every screen including menus.
  The game-screen body is wrapped; keep it that way for any new
  per-frame code.

## Conventions

- No build-time module system. Everything attaches to `app` / `content`
  namespaces. New files in the right directories are picked up via
  the Gulp glob — no manual registration.
- Screens always extend `app.screen.base` via `app.screenManager.invent()`.
  Don't subclass it manually.
- CSS class prefixes are `.a-` (app-level layout/instances) and `.c-`
  (reusable components). The component CSS sits in
  `src/css/component/{game,menu,screen}.css`.
