# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Air Hockey** — an audio arcade sports game built on the [syngen](https://github.com/nicross/syngen) Web Audio engine, on top of the collection's `syngen-template`. A blind-accessible, audio-first 1-v-1 air hockey match against a CPU, with synth crafted to resemble a real air-hockey table (puck hiss, mallet clacks, rail thunks, the blower hum). Ships as an HTML5 app (`public/`) and an Electron desktop app (`electron/main.js`). No test suite, no linter, no `npm` scripts — everything runs through Gulp (use **pnpm/pnpx**, never plain npm).

This is a built game (in progress), NOT an empty template — the "Starting a new game" questions below do **not** apply. Foundational answers are settled (grill session 2026-06-13): **top-down 2D continuous**, **binaural listener riding your mallet**, audio-first/blind-accessible, keyboard + gamepad + mobile thumb-stick, local records + online leaderboard, first-to-7 vs CPU (Easy/Med/Hard), modern synth-only "real table" aesthetic.

### The game

You defend the near goal and attack the far one on a vertical table, mallet **confined to your half** (the center line is a hard wall). Move your mallet with Arrows / gamepad stick / mobile thumb-stick to intercept and strike a **frictionless puck**; first to **7 goals** (configurable 7/11/15) wins. The puck carries real momentum — **drive your mallet through it** to add pace (no strike button). Aiming is **pure physics: no aim assist, no aim-feedback cue** — you learn shot lines by ear. The CPU (Easy/Med/Hard) defends and counters with **telegraphed strikes** (an audible windup before it drives the puck; shorter at higher difficulty), its reaction sharpened by a **reaction-delay buffer** (reads the puck N frames in the past — beatable, tunable). Records (W-L + best win streak per difficulty) persist locally; best streak posts to the central leaderboard (id `air_hockey`).

After each goal the **conceding** player serves: the puck is placed on their half and a brief "ready → go" countdown precedes play. Status hotkeys F1–F4 (score / puck bearing+distance / your mallet position / serve+difficulty state) read on demand.

### Audio model — BINAURAL, listener rides your mallet (decided; expensive to change)

The **listener position = your mallet; yaw is a fixed constant facing the opponent's goal** (audio-front anchored to screen-north via the screen→audio y-flip — `LISTENER_YAW = Math.PI/2`). Up = front, your goal = behind, side walls = L/R; the field never re-bases as you move. `behindness()` reads the same constant. You **never hear your own mallet** — it is the point of view. Per-perspective by construction, so PeerJS 1-v-1 (listener at each player's own mallet) is cheap to add later.

Standing cues sit over a **subtle constant blower bed** (mono/ambient, ducks in rallies); **no in-play music** (jingles only for menu/goal/win/lose):
- **Puck** — the one always-on spatial voice: **never fades** (`gainModel.normalize`), airy filtered-noise hiss (the air cushion) + a low body tone, brightness & gain ∝ speed, a **broadband HF component so direction is localizable** (binaural needs the HF head-shadow — pure low tones sound centered), and a **behind-muffle lowpass** to kill front/back ambiguity.
- **Your goal** — continuous faint **home hum** (behind you, already muffled).
- **Opponent goal** — a **periodic aim ping** (~1/s) up-table; ducks when the puck sits on it.
- **Walls / center line** — an edge tick on mallet contact, plus the "you hit the wall" bump cue (your absolute position is otherwise silent — the listener rides you).
- **Threat alarm** — escalating, fires **only when the puck is predicted to enter your goal mouth** (project velocity to the goal line); intensifies as it nears.
- **Impacts** — realistic but **source-coded**: your-hit vs opp-hit distinct timbre, positioned rail thunks (which wall), bright vs dark goal drops (yours vs theirs).

Kill the global syngen reverb send in `main.js` (every cue authors its own ADSR + filter tail). Run `#test` (front/right/behind/left orientation tick) after any listener change; `#learn` auditions the whole cue vocabulary.

## Architecture (Air Hockey specifics)

`content/` modules (alphabetical concat — keep all cross-refs lazy, captured inside functions):
- **`constants.js`** — table dimensions, goal width, puck/mallet radii, near-zero friction, restitution, soft speed cap; the difficulty table (mallet max speed, reaction-delay frames, telegraph length, shot power) for Easy/Med/Hard; match target.
- **`events.js`** — tiny shared pub/sub bus decoupling sim from audio/announce.
- **`table.js`** — geometry helpers: walls, the two goal mouths, center line; `inBounds`, `whichWall`, goal detection.
- **`physics.js`** — sub-stepped integration (adapt sub-steps to puck speed vs collider radius), multi-pass collision (puck vs rails / both mallets / goal posts), **momentum-transfer** on mallet contact, soft speed cap (scale over cap, no hard clamp), velocity-aware normal fallback, stuck-puck force-drain.
- **`puck.js`** — puck state + serve placement (on the conceding half).
- **`mallet.js`** — your mallet: velocity from `app.controls.game()`, clamped to your half + the rails.
- **`ai.js`** — opponent mallet: reaction-delay ring buffer, defend/intercept vs attack states, telegraphed strike (windup → drive), per-difficulty params; symmetric in its own half.
- **`audio.js`** — all synth + `updateListener()` (position = mallet, fixed yaw): blower bed, the always-on puck voice, home hum, opp-goal aim ping, threat alarm, source-coded impacts, serve/countdown cues, menu/goal/win jingles, an `env()` ADSR helper, `sample()`/`testDirection()` for learn/test. `silenceAll()` on game-screen exit.
- **`game.js`** — facade + sim orchestrator: run/match state, per-frame step (physics → ai → audio frame → threat check), the in-play **goal → serve → ready → play** loop, win/lose at target, difficulty selection, view accessors for the screen.

App layer: `app/screen/game.js` is the only place that reads raw input, drives the continuous voices each frame, fires F1–F4 status hotkeys, announces (polite score / assertive goals + danger), and handles the rising-edge wall-bump probe. Other screens follow the collection's menu pattern: `menu` (difficulty picker, target, records, language, help, start), `gameover` (win/lose + rematch), `language`, `help`, plus hidden `#test`/`#learn`. Records live in `app/records.js` outside `engine.state` (dual backend: Electron file / web localStorage), best Hard-mode streak posting to `air_hockey` via the online-scores modules. `app.autosave` is **off**. i18n EN/ES (`airhockey.lang`).

## Starting a new game from this template

*(Retained for reference; **N/A to Air Hockey** — it is already a built game with the foundational answers settled above.)*

**This is a BLOCKING requirement.** Whenever the user describes a brand-new game — i.e. `src/js/content/` is empty or stub-only, and there is no game-specific `CLAUDE.md` yet — you MUST ask the foundational design questions below before writing any `content/` code or making architectural commitments. Picking wrong and refactoring later is expensive (especially #2 — audio listener mode is hard to retrofit). Skip questions already answered in the first prompt; batch the rest into one message.

Once a game-specific `CLAUDE.md` exists in the project root, ongoing work is no longer "starting a new game" and these questions don't need re-asking.

### Required questions

1. **Perspective and movement model.** Top-down 2D tile-based (Pac-Man, Zelda 1)? Top-down 2D continuous? Side-scrolling 2D? First/third-person 3D? Static / turn-based / menu-driven? Determines the coordinate system, collision model, and how `app.controls.game()` is consumed.

2. **Audio listener behavior** — *the single most important question; ask it explicitly even if the user gave hints.*
   - **Screen-locked (Pac-Man style)** — listener yaw is **fixed**; sounds come from their actual screen position. A ghost south of the player always sounds behind. Best for fixed-camera 2D where the camera never turns.
   - **Player-locked (FPS-style)** — listener yaw tracks the player's facing; "front" is whatever the player faces. Best for first-person 3D / games where the avatar's heading IS the camera.
   - **Camera-locked (third-person)** — listener yaw tracks the camera, not the avatar. For when camera and avatar rotate independently.
   - **Stereo / non-spatial** — skip 3D entirely; `StereoPannerNode` per source, or mono cues. Best for menu-driven, turn-based, or musical games.

3. **Audio's role.** Audio-first / blind-accessible (playable purely by ear)? Equal (visuals and audio both first-class)? Audio supportive (visuals primary)? Affects effort on spatial cues, screen-reader announcements, visual UI.

4. **Input devices.** Keyboard only? + gamepad? + mouse? All three? The template ships all three adapters wired; the answer decides which mappings to define and which adapters to disable.

5. **Persistence.** Continuous autosave of full game state? Discrete/manual saves? High scores only? None? Decides whether `app.autosave` stays enabled and what `engine.state.export()` serializes.

6. **Progression structure.** Endless / score chase? Discrete levels? Branching? Single scenario? Drives the screen FSM (level-clear / game-over / high-scores screens?).

7. **Synth aesthetic.** Chiptune / retro (squares, saws)? Modern (filtered triangles, soft pads, sub-bass)? Procedural / generative? Template is synth-only — sampled audio needs extra wiring.

### Implementation pointers per answer

**Listener — screen-locked.** Set yaw to a constant in `content.audio.updateListener()`; don't update from player direction. Anchor audio-front to whichever screen direction reads as "up" (typically screen-north). With the screen→audio y-flip, `LISTENER_YAW = Math.PI / 2` puts audio-front at screen-north:

```js
const LISTENER_YAW = Math.PI / 2 // screen-north = audio-front
function updateListener() {
  const p = content.player.getPosition()
  engine.position.setVector(tileToM(p))
  engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
}
```

`behindness()` reads the same constant via `_lastYaw`, so a "behind" muffle still triggers for sources opposite the anchored front. Build a diagnostic screen emitting ticks at front/right/behind/left around a static listener at the same yaw, and verify by ear after any change. Reference: `../pacman/src/js/content/audio.js`.

**Listener — player-locked.** Update yaw from the player's facing every frame: `yaw = Math.atan2(-d.y, d.x)` (negate y for the screen→audio flip), then `setQuaternion(fromEuler({yaw}))`. `behindness()` then means "behind the player's heading" (FPS interpretation).

**Listener — camera-locked.** Track the camera's yaw, not the avatar's. Low-pass the yaw before applying if the camera lags the avatar, so orientation doesn't snap.

**Audio — stereo only.** Skip binaural. Per source: a `StereoPannerNode` whose `pan` is the source's screen-x relative to the player, clamped to `[-1, 1]`. No `engine.position`, no listener yaw.

**Movement — tile-based grid.** Queued-direction (store current `dir` + queued `dir`; at each tile center, swap if the new tile is passable) + a small "cornering" window near centers. Ref: pacman `content/pacman.js`. **Continuous free:** read `app.controls.game()` for `{x,y}` and integrate; collision is geometric (AABB / circle-vs-tile), no grid snap.

**Persistence — autosave.** Leave `app.autosave` running; expose import/export per `content.*` via `engine.state`; keep saved state small (rebuild most on level start). **High scores only:** disable `app.autosave` in `main.js`, add an `app.highscores` module with its own key (ref: pacman `src/js/app/highscores.js`).

**Progression — levels.** Add `levelClear` + `gameOver` screens. Top-level FSM typically: `intro → ready → play → death/levelClear → play (next) | gameOver`.

## Common commands

Do not start a dev server to test changes in this checkout — this folder is already served independently, so verification stops at build/static checks unless the user asks otherwise.

This is a **secure system**: plain `npm`/`npx` are disabled. Use **pnpm** / **pnpx** for everything (`command npm ...` bypasses the block — don't).

```sh
pnpm install               # install deps (run first; Gulpfile expects node_modules/syngen)
pnpx gulp build            # one-shot build of public/scripts.min.js + public/styles.min.css
pnpx gulp watch            # rebuild on src/** changes
pnpx gulp serve            # do not use here; folder is already served independently
pnpx gulp dev              # do not use here; folder is already served independently
pnpx gulp electron         # launch Electron against current public/ build
pnpx gulp electron-rebuild # build then launch Electron
pnpx gulp dist             # build + electron-packager + zip HTML5 build into dist/
```

`--debug` (e.g. `pnpx gulp build --debug`) skips minification and IIFE wrapping, and appends `-debug` to the injected version. `app.storage` strips `-debug` when keying versions, so debug and release share saved state.

Build artifacts `public/scripts.min.js` and `public/styles.min.css` are gitignored — never edit them.

## Architecture

### Three globals, concatenated in order

`Gulpfile.js` concatenates all source into one `public/scripts.min.js`. No module system; everything lives on three `window` namespaces:

- **`engine`** — alias for `syngen` (`src/js/engine.js` is just `const engine = syngen`). Use the [syngen API](https://syngen.shiftbacktick.io/) for audio, FSMs, pubsub, vectors, input, frame loop, state import/export.
- **`app`** — UI scaffolding (screens, controls, settings, storage, updates, haptics, utilities). Defined across `src/js/app/**`.
- **`content`** — empty by default; game-specific logic lives in `src/js/content/`.

`getJs()` order matters: `syngen.js` → `engine.js` → `content.js` → `content/**` → `app.js` → `app/screen/base.js` → `app/utility/*.js` → `app/*.js` → `app/**/*.js` → `main.js`. New files in those dirs are picked up automatically. **Base screen and utilities load before other app modules** because modules reference them at definition time.

`src/js/main.js` bootstraps: awaits `engine.ready()`, then `app.storage.ready()`, `app.updates.apply()`, `app.settings.load()`, `app.screenManager.ready()`, configures the mixer, starts `engine.loop` (paused), dispatches `activate`, calls `app.activate()`. HTML5 builds wire a `beforeunload` confirm when the loop runs.

### Screens (FSM-driven)

`app.screenManager` wraps `engine.tool.fsm`. Each screen:

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

`invent` extends `app.screen.base` (`src/js/app/screen/base.js`): aria-hidden toggling, animation classes, focus trapping (`app.utility.focus.trap`), and the `on*` hooks. `engine.loop.on('frame', ...)` calls `onFrame` on the current screen; `engine.state.on('import'|'reset')` fans out to all screens.

Starting state is `none`; dispatching `activate` transitions to `menu` (or a `#hash` route like `#test` / `#learn`). To add a screen, drop a file in `src/js/app/screen/` and add `.a-app--screen .a-app--<id>` markup in `public/index.html`.

**Don't add a splash screen.** "Press any key to begin" gates are vestigial — the menu is the entry point. The first menu button click satisfies the WebAudio user-gesture requirement (see `main.js`). For a title, use the menu's `<h1 class="c-menu--title">`. The Language picker lives on the menu, not a splash.

### Storage, versioning, and updates

Storage is *per app version*, backed by IndexedDB via `app.storage.api` (in-memory proxy + debounced writes). Keys are `[version, key]` pairs, so each release has its own namespace.

On boot, `app.updates.apply()` (`src/js/app/updates.js`): no saved versions → set current and exit; save for current version → use as-is; else clone the closest *earlier* version's data into the current namespace, then run every `app.updates.register(semver, fn)` migration later than that earlier version, in order. Compares use `app.utility.semver` (`MAJOR.MINOR.PATCH-LABEL`); `app.version()` is injected by `Gulpfile.js` from `package.json`.

`app.autosave` debounces saves of `engine.state.export()` to storage key `state` on a 30s loop while enabled.

### Settings

`app.settings.register('fooBar', {default, compute, update})` auto-creates `setFooBar(rawValue)` (recomputes + fires `update`) plus `computed.fooBar`, `raw.fooBar`, `defaults.fooBar`. `app.settings.load()` merges defaults with persisted raw values (storage key `settings`) and runs each `update` once; `app.settings.save()` persists. See `src/js/app/settings/example.js` (commented out).

### Controls

`app.controls.update()` runs every frame, merging three adapters — `gamepad`, `keyboard`, `mouse` — each with `game(mappings)` / `ui(mappings)`. Mappings live in `src/js/app/controls/mappings.js`, tagged by `type: 'gamepad' | 'keyboard' | 'mouse'`.

- `app.controls.game()` → current-frame continuous inputs (e.g. `{x, y, rotate}`).
- `app.controls.ui()` → *deltas* (only inputs that just became active this frame) for menu nav, so a held key fires once.

The mouse adapter takes pointer lock entering the `game` screen (re-acquires after Escape in Electron). Gamepad axes are inverted in `game` to match keyboard semantics.

### Haptics

`app.haptics.enqueue({duration, startDelay, strongMagnitude, weakMagnitude})` queues a dual-rumble effect; magnitudes are summed across active events each frame, attenuated by `setSensitivity`, dispatched to all dual-rumble actuators. The caller must drive `update(delta)` (typically a screen's `onFrame`).

### Unified accessible UI shell

Every game shares the same accessible scaffolding. Follow this shape rather than inventing one:

- **`.c-screen`** wraps each screen's content for focus-trap-friendly layout.
- **`.c-menu` + `.c-menu--title` / `--subtitle` / `--list` / `--button`** build menus, language pickers, gameover, help. CSS in `src/css/component/menu.css`. Press states use `aria-pressed="true"`.
- Sections have `tabindex="-1"` and a translated `aria-label` via `data-i18n-attr="aria-label:..."`.
- An always-present `aria-live="polite"` region (usually a separate `assertive` one too) sits under `<main>` for announcer output. The class varies (`.a-app--announce`, `.js-announcer`, `.a-live`) — pick one and route every runtime announcement through it.
- The main menu always exposes a `Language` button → `language` screen. Every game ships a `menu` screen — no splash, no "press any key" gate.
- Help screens are linear prose using `data-i18n-html` for items with `<kbd>` / `<strong>` to keep markup inline-translatable.

### Localization (English / Spanish, extensible)

Every game ships the same lightweight i18n module. Identical across `bumper`, `combat`, `neverStop`, `pacman`, `pinball`, `pong`, `roadsplat`, `vfb`, and this template — copy verbatim.

**Files (per game):**

- `src/js/app/i18n.js` — `app.i18n` with `t(key, params?)`, `applyDom(scope?)`, `setLocale(id)`, `locale()`, `available()`, `localeName(id)`, `onChange(fn)`. Body identical; only `STORAGE_KEY` (e.g. `'pacman.lang'`) and `dictionaries` change. Boot resolution: `localStorage[STORAGE_KEY]` → `navigator.language` prefix → `'en'`.
- `src/js/app/screen/language.js` — picker screen; `back` returns to `menu`.
- `src/css/component/menu.css` — the `.c-menu*` classes the picker relies on.
- `public/index.html` — language section uses `a-language` inside `a-app--language`, with an empty `ul.c-menu--list.a-language--list` that `renderList()` fills from `available()`.
- `src/js/main.js` — calls `applyDom()` between `settings.load()` and `screenManager.ready()` so static DOM is translated before any `onReady` reads it.

**Annotating static text** — `data-i18n="key"` (textContent), `data-i18n-html="key"` (innerHTML, keeps `<kbd>`/`<strong>`), `data-i18n-attr="aria-label:key;placeholder:key2"` (attributes); `<title>` is special-cased. The English in markup is a **fallback for the gap between page load and `applyDom()`**, not the source of truth — the dictionary is. Update the dictionary and let `applyDom()` re-render.

**Runtime strings:** `app.i18n.t('ann.score', {score: 1234, level: 5})`. Templates use `{name}` placeholders. Missing keys return the key itself, making typos visible.

**Adding the language screen:** add a `language` menu button (`data-action="language"` → `this.change('language')`); ensure `back` returns to the originator; add the HTML section; add `'menu.language'` + `language.*` keys to both dictionaries.

**Adding a locale:** add it to `localeNames` atop `i18n.js`; add a parallel `dictionaries` block (missing keys fall back through `FALLBACK = 'en'`). The picker discovers it automatically.

**Persistence:** each game uses its own `STORAGE_KEY` (`bumper.lang`, etc.) so locales don't leak between games on the same origin. Uses `localStorage` directly, not `app.storage`, because locale must resolve *before* `app.storage.ready()` finishes.

**Locale-stable state:** if a value is shown twice in different ways (e.g. neverStop's stop reason set in `content/car.js`, rendered in `gameover.js`), store the **i18n key**, not the rendered string, and translate at render time (`car.stopReasonKey = 'stop.fuel'`). A player who switches language mid-flight still gets a coherent message. Same reason the pinball table stores a `labelKey` per bumper/target/rollover.

### Electron specifics

`electron/main.js` creates a frameless fullscreen window (`contextIsolation: true`, `devTools: false`), removes the menu (so Ctrl+R/W can't reload/close), auto-grants `midi` + `pointerLock`, applies platform GPU flags. `electron/preload.js` exposes `window.ElectronApi = {quit}`; renderer branches on `app.isElectron()` (e.g. `app.quit()` → `ElectronApi.quit()` only in Electron; HTML5 adds a `beforeunload` confirm Electron skips). `dist-electron` packages only the current platform — run `gulp dist` per OS to ship all three.

## Audio patterns beyond binaural

Binaural alone is a thin cue; every shipped game layers more on top.

- **Behind-listener muffle.** Route looping voices through a shared lowpass + slight detune that opens in front, closes behind (`behindness()` 0=ahead, 1=behind). Sweep cutoff ~22 kHz → 700 Hz at ~0.05s; drop pitch a few % at max behindness. Ref: `../pacman/.../audio.js`, `../bumper/.../pickups.js`.
- **Per-source gain model.** Don't use one falloff everywhere. `gainModel.exponential` (steep `power`) for short-range FX; `gainModel.normalize` for sensors that must stay audible at any range; cubic for the local player's own car. Ref: `../bumper/.../{bullets,carEngine,targeting}.js`.
- **Continuous looping voice with parameter coupling.** For balls/engines/drones: open one osc/noise chain on screen-enter and shape each frame from world state — gain ∝ speed, cutoff sweeps with speed, fundamental tracks position. Cheap, easy to audition. Ref: `../pinball/.../audio.js`, `../pong/.../audio.js`, `../racing/public/js/audio.js`.
- **Stereo + binaural dual path for 2D one-shots.** Sum a `StereoPannerNode` (dominant L/R) with a quieter binaural ear at the same position. Stereo carries position and dominates at distance; binaural adds HRTF colour. Ref: `../pinball/src/js/content/audio.js:49`.
- **Solenoid kick on collision.** Add fixed energy on top of restitution (e.g. `BUMPER_KICK = 22 u/s`) for pop-bumpers/kickers/slings. Pure restitution feels dead even at e=1.0. Ref: `../pinball/src/js/content/physics.js:20`.
- **Pitch families for disambiguation.** Give each instance of a multiply-spawned type (bumpers, targets, ghosts, AI cars) a distinct base pitch (or head/body two-tone) so rapid sequential hits stay decipherable; tie enemy-class fundamentals to type so off-screen threats are ID'd by timbre. Ref: `../pinball/src/js/content/audio.js:98`, `../vfb/src/js/content/entities.js:47`.
- **Audio-clock scheduled lookahead.** Schedule repeated cues with `engine.synth.simple({when: t})` ~50 ms ahead of `audioContext.currentTime` so `setTimeout` jitter never causes gaps; the JS loop only refills the queue. Ref: `../neverStop/src/js/content/audio.js:378`.
- **Disposable per-frame ear for one-shots.** Fresh binaural ear per impact, schedule, `setTimeout`-disconnect after the tail. No voice-stealing. Don't reuse for high-rate streams (allocation cost) — pool/persist those. Ref: `../bumper/.../sounds.js:13`.
- **Reusable ADSR helper.** One `envelope(gain, t0, attack, hold, release, peak)` per game (cancels prior schedules, clean ramps); route every voice through it. Ref: `../bumper/.../sounds.js:53`.
- **Silence-all on screen exit.** On leaving the game screen, stop every looping spatial voice or a drone plays on under the menu. Ref: `../pacman/.../screen/game.js:85` (`silenceAll()`).
- **BFS-routed radar beacon.** When screen-locked and players must *reach* a target, pathfind every ~1.5s and tick at the next BFS step — "go this way", not just "it's over there." Ref: `../pacman/.../content/audio.js`.

## Announcer and screen-reader patterns

- **Two regions, polite + assertive.** Polite for routine events (score, pickup); assertive for state changes (drain, rank-up, pause, game-over). Don't flood polite — assistive tech queues it and a flood swallows everything. Ref: `../pinball/.../announce.js`.
- **Re-read identical strings.** Screen readers swallow back-to-back identical text. Either clear to `''`, yield via rAF / `setTimeout(…,50)`, re-set; or keep two buffers per key and ping-pong. Ref: `../pacman/.../announce.js`, `../bumper/.../announcer.js`.
- **Optional TTS fallback.** A `setUseTts(true)` toggle adds a SpeechSynthesis path for non-screen-reader users. Off by default; expose in settings. Ref: `../bumper/.../announcer.js:34`.
- **Function-key status hotkeys (F1–F7).** Wire F1–F4 (sometimes F7) to read a stat (score, lives, fuel, nearest target, time). Bind at `window` keydown so they work regardless of focus. Ref: every game's `screen/game.js`.
- **`preventDefault` on F1, F3, F5.** Browser maps these to Help/Find/Reload. Capture-phase preventDefault on the game screen to keep them — but **don't** bind F11 (let users fullscreen). In Electron only F11 matters and is already removed by the menu strip.
- **Opponent label switches by mode.** Branch "Computer" vs "opponent" on `isMultiplayer()` at i18n lookup time, not in the constant. Ref: `../pong/src/js/content/scoring.js:12`.

## AI patterns

- **Per-AI personality randomization.** Random `aggression`/`cooldown`/`reactionDelay` per AI so they feel distinct; tune the *ranges*. Ref: `../bumper/.../ai.js:20`.
- **Anti-gang targeting tax.** Subtract a penalty per other AI already chasing the same victim, so they spread out. Ref: `:71`.
- **Reaction-delay buffer.** Circular buffer of recent observed positions, read `N` frames in the past. Easier to tune than predictive, naturally beatable. Ref: `../pong/.../ai.js:10`.
- **Hysteresis on toggle decisions.** Throttle direction / target switching need a hysteresis flag so they don't flap on the threshold. Ref: `../bumper/.../ai.js:36`.
- **Post-action cooldown.** Force disengage for a randomized interval after a big action (ram, swing, fire), or AIs pin-and-spam. Ref: `:495`.
- **Schedule tables for arcade fidelity.** Pac-Man ghosts use per-level scatter/chase tables, dot-counter releases, Cruise Elroy speedups from the Dossier. For feel parity, port them verbatim — hand-tuning never converges. Ref: `../pacman/.../ghosts.js`.

## Physics patterns

- **Sub-stepped integration vs tunneling.** Adapt sub-step count from `MAX_SPEED / (collisionRadius * dt)` so per-substep travel stays < ~70% of the smallest collider. 8–48/frame is normal for fast 2D. Ref: `../pinball/.../physics.js:46`.
- **Multi-pass collision resolution.** ~4 passes per substep (first reflects velocity, rest are position correction), or corners push the body through neighbouring segments. Ref: `:54`.
- **Velocity-aware normal fallback.** When `dist < 1e-6` (centre on the line), pick the perpendicular sign opposite to velocity so fast bodies don't punch through. Ref: `:82`.
- **Velocity-dependent restitution.** `e = base / (1 + falloff * impactSpeed)` — hard hits absorb energy (cradling/drop-catch); without it a held flipper is a perfect catapult. Ref: `:36`.
- **Asymmetric actuator kinematics.** Solenoids snap fast, springs return slow (flippers 30 rad/s up vs 9 down). Symmetric speed prevents settling and breaks technique. Ref: `:25`.
- **Stuck-body force-drain.** After ~90 frames of speed < ε, force-drain or teleport — equilibrium in geometric wedges is otherwise unreachable. Ref: `:126`.
- **Asymmetric damage.** The aggressor (driving harder into the contact normal) eats less; the victim more. Rewards attacking. Ref: `../bumper/.../physics.js:24`.
- **Steering scales with speed + direction.** `steerMul = clamp(speed/v0,0,1) * sign(forwardSpeed)` so reversing inverts steering and parked cars don't spin. Ref: `:82`.
- **One-way gates.** Mark a segment `oneway` with a `normal`; resolve only where `dot(velocity, normal) > 0`. For ramps, return lanes. Ref: `../pinball/.../physics.js:316`.
- **Soft speed cap.** Scale by `k = vmax/|v|` over the cap instead of hard-clamping — smoother, no step discontinuity in derived audio. Ref: `../bumper/.../physics.js:76`.

## Progression, state, and persistence patterns

- **Persistent vs session state.** Separate run-state (lives, score, fuel, level) from cross-run state (cash, upgrades, high scores, unlocked locales). Persistent survives `engine.state.reset()`; session rebuilds each run. Ref: `../vfb/src/js/content/state.js`.
- **i18n keys for locale-stable values.** Any value computed in module A and rendered in B (stop reasons, rank names, mission/achievement/gameover text) stores the **key**, not the string. Ref: `../neverStop/src/js/content/car.js`, `../pinball/src/js/content/table.js`.
- **High scores dual backend.** Electron → JSON file via `window.ElectronApi.read/writeHighScores`; web → `localStorage[<game>-highscores-v1]`. Up to 10, sorted desc. Don't put these in `engine.state` if they must survive `reset()`. Ref: `../pacman/src/js/app/highscores.js`.
- **Combo with decay timer.** Track `comboValue` + `comboTimer` reset on each hit; expiry drops the combo. Bind the trigger to *impact*, not death. Ref: `../vfb/src/js/content/world.js:115`.
- **Score-threshold extends.** Extra life at *increasing* thresholds (20k, 60k, 120k, 200k…) to avoid late-game infinite extends. Ref: `../vfb/src/js/content/state.js:162`.
- **Rank tiers by score.** Score → rank lookup with i18n-keyed names; announce "promoted to X" on crossings. Cheap endless-game hook. Ref: `../pinball/src/js/content/game.js:24`.
- **Mission queue with per-mission `kind`.** Each mission's `kind` (`targets`, `bumpers`, `survive`…) selects the progress predicate; completing all advances state. Ref: `../pinball/src/js/content/game.js:41`.
- **Inventory as map of stacks.** `{shields, bullets, mines, boosts, teleports}`, stack on pickup with caps. Auto-consume items have a per-frame `autoCheck(state)`; manual ones consume on action. Ref: `../bumper/src/js/content/car.js:46`, `../neverStop/src/js/content/items.js`.
- **Checkpoint on landmark.** On death-with-lives, restart from the last passed checkpoint, not level start. Ref: `../vfb/src/js/content/entities.js:152`.
- **Game-over delay so audio finishes.** Set a `pendingGameOver` flag, keep audio ticking, transition only after the death sting (700–1500 ms) completes. Ref: `../neverStop/src/js/content/game.js:159`.

## Diagnostic, learn, and soundtest screens

Hidden screens are essential for audio-first games — to validate orientation, audition sounds, teach the cue vocabulary.

- **`#test` route** — ticks at front/right/behind/left around a static listener; verifies the screen→audio flip *by ear*. Run first whenever you touch listener code. Ref: `../pacman/.../screen/test.js`.
- **`#learn` route** — plays each spatial prop and one-shot SFX with labeled buttons. Call `content.audio.setStaticListener(0)` on enter so the listener doesn't drift; re-apply on re-entry from screens that moved it. Ref: `../pacman/.../screen/learn.js`.
- **Soundtest / variant preview** — for synth-variant tables, a hidden screen (T in neverStop) auditions each variant and lets the player pick one (avoids TTS timbre conflicts). Ref: `../neverStop/.../screen/soundtest.js`.
- **Wire diagnostic routes via `none → activate`** — honor `window.location.hash` there (see Gotchas), not from `main.js` after `dispatch('activate')`.

## Multiplayer (when adding network play)

The template ships single-player. For online play, copy the pattern the rest of oriolgomez.com's games use (`../bumper`, `../racing`) so the shared coturn server keeps working uniformly.

### Infrastructure (already running, don't redeploy)

- **Signalling:** free public **PeerJS broker** (`0.peerjs.com`). Host picks a deterministic id `<gameslug>-<roomcode>`; clients connect to it. Public ids are global, so always prefix with the game name.
- **Data plane:** direct **WebRTC data channels**, JSON over `DataConnection.send()`.
- **STUN/TURN/TURNS:** self-hosted **coturn** on the oriolgomez.com VPS. `turn.oriolgomez.com:3478` (UDP+TCP, STUN+TURN); `:5349` (TCP, TURNS/TLS, last resort). Hostname rides the `*.oriolgomez.com` wildcard. Config `/etc/turnserver.conf`, long-term user `gamesturn` (password public-by-design — WebRTC needs it client-side). TLS cert from Caddy, deployed by `coturn-cert-deploy` (re-run on renewal by `coturn-cert-watch.path`). UFW opens `3478`, `5349`, `49160-49200/udp`.

### The constants block (copy verbatim)

Put these at the top of the networking module (`net.js`), never inlined further down, so ops changes are a one-diff:

```js
const TURN_HOST = 'turn.oriolgomez.com'
const TURN_PORT = 3478
const TURNS_PORT = 5349
const TURN_USER = 'gamesturn'
const TURN_PASS = 'sin6V0gFokHz78gM0GDfXmat'
```

`iceServers` order is fixed — STUN first (most connections never relay), then TURN/UDP, TURN/TCP (firewalls dropping UDP), TURNS/TLS last:

```js
config: {
  iceServers: [
    {urls: `stun:${TURN_HOST}:${TURN_PORT}`},
    {urls: 'stun:stun.l.google.com:19302'},  // Google STUN backup
    {urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`, username: TURN_USER, credential: TURN_PASS},
    {urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`, username: TURN_USER, credential: TURN_PASS},
    {urls: `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`, username: TURN_USER, credential: TURN_PASS},
  ],
  iceCandidatePoolSize: 2,
}
```

Debugging ICE candidates: `host` = LAN (always present), `srflx` = STUN works, `relay` = TURN works. No `relay` + symmetric NAT = no path = silent timeout.

### Topology: star with host-authoritative sim

- **One host, N clients.** Host runs the full sim and broadcasts authoritative snapshots; clients send inputs only.
- **Wire protocol** is plain JSON, no schema. Tag every message with `type` (`hello`, `lobby`, `start`, `input`, `snap`, `event`, `end`, `kick`, `bye`). Validate `type`, trust the rest.
- **Tick/snap rate decoupled** (e.g. sim 60 Hz, snapshots 30 Hz). Clients lerp position; predict listener yaw immediately from steering so audio doesn't lag.
- **Sim events** ride inside the next snapshot's `pendingEvents` array; the client re-emits them via its own pubsub so audio/haptics fire from the local perspective. Never fire out-of-band — they can arrive before the snapshot establishing their state.
- **Round-end ordering:** push `roundEnd` into the next snapshot *before* locally clearing state, or clients never see the final state.
- **Disconnect:** client leave → host forfeits them; host leave → client catches `close` and exits to menu.

### Reference implementations

- **`../bumper/src/js/app/net.js`** — full: PeerJS wrapper, lobby, snapshot replication, items, heartbeat + timeout. Source-tree game, so `net.js` changes need `gulp build`. Has the most complete wire-protocol docstring at the top.
- **`../racing/public/js/net.js`** — leaner, no-build static game (PeerJS from CDN). Edit and reload.

### Things to remember

- **PeerJS channels don't throw on send-when-closed** — they silently drop. Ack at the app layer for delivery guarantees.
- **CDN PeerJS can fail offline.** Expose `libAvailable()`; the menu hides multiplayer when false instead of erroring in `host()`/`join()`.
- **No gameplay logic in `net.js`** — thin transport only (`on`/`send`/`broadcast`/`host`/`join`/`disconnect`); modules subscribe and translate.
- **Document the wire protocol in the game's own CLAUDE.md** — clients/hosts validate by trust, so the CLAUDE.md *is* the schema.

### Additional patterns (from shipped games)

- **Unambiguous room-code charset** `'BCDFGHJKLMNPQRSTVWXZ23456789'` (no `0/O`, `1/I/L`, no vowels — players read codes aloud). Ref: `../bumper/.../net.js:44`.
- **Explicit `NETWORKED_EVENTS` allow-list.** Only listed events ride in `pendingEvents`; prevents "works locally, missing for remotes". Ref: `../bumper/.../game.js:61`.
- **No `type` in event payloads** — the capture spreads `{type: eventName, ...payload}`, so a payload `type` clobbers it. Use `kind`/`action`. Ref: `../bumper/.../game.js:415`.
- **Role-guarded mutations.** Subscribers mutating authoritative state must `if (role !== 'client') return`, else scores double. Ref: `../bumper/.../game.js:138`.
- **Predict only what audio cares about.** Position can lag (lerp); listener orientation can't — predict from steering. Ref: `../bumper/.../game.js:1168`. **Shortest-arc lerp** for angles: `dh = atan2(sin(t-c), cos(t-c))` before lerping. Ref: `:1163`.
- **Items reconcile from snapshots,** not local sim — client diffs the authoritative list (create new, destroy missing, hard-set positions), optionally dead-reckons with `vx,vy`. Ref: `../bumper/.../game.js:355`, `../racing/.../main.js:415`.
- **Bot fill on host.** Under target count, fill with bots on the same snapshot fields; clients auto-discover. Ref: `../racing/.../main.js:83`.
- **Per-team listener flip.** In symmetric arenas team 2's listener sits at the opposite end; `calcPan`/`calcDepthT` factor in local team. Ref: `../pong/.../audio.js`, `teamManager.js`.
- **Audio-event relay queue.** Wrap `content.audio.*` to queue into `pendingAudioEvents` riding the next snapshot, so clients replay with their own pose. Ref: `../pong/.../audio.js:8`.
- **Per-peer profile swap.** Swap profiles 0 and `selfSlot` per-peer so each listener hears their own car as the gentlest profile. Ref: `../bumper/.../carEngine.js:14`.
- **Optimistic local action + host reconciliation.** Decrement ammo, play SFX, queue input now; host runs the authoritative shot a tick later (shared SFX masks latency). Ref: `../racing/.../main.js:243`.
- **Per-player pickup spawn timers** on the host so trailing players still see pickups. Ref: `../racing/.../pickups.js:34`. **Absolute spawn coords:** `zAbs = lap*trackLen + z` so "spawn 200 m ahead" survives loop boundaries. Ref: `:44`.
- **Two-paddle manual mode.** In MP the host drives both paddles via `setManualKeys()` to avoid double-reading its keyboard. Ref: `../pong/.../game.js:93`.
- **Heartbeat + peer timeout.** `ping` every ~2s; gone after ~6s silence (PeerJS sits "open" for minutes after a real disconnect). Ref: `../bumper/src/js/app/net.js`.
- **Source-tree games need `gulp build`** after editing `net.js`; static games (racing) are edit-and-reload.

## Conventions

- No build-time module system. App code is IIFEs or assignments to `app`/`content`. New files picked up via `getJs()`/`getCss()` globs — no registration.
- Screens always extend `app.screen.base` via `app.screenManager.invent()` — don't subclass manually.
- CSS prefixes: `.a-` (app-level layout/instances), `.c-` (reusable components). `getCss()` order is `reset → main → utility/* → component/* → */*` — earlier files mustn't depend on later ones.
- Persistent game state goes through `engine.state` (so autosave + `onImport`/`onReset` see it), not directly through `app.storage`.

## Gotchas worth remembering

### Syngen spatial audio coordinate frame

`engine.ear.binaural` (`node_modules/syngen/src/syngen/ear/binaural.js`) uses listener-local axes: **+x = forward**, **+y = LEFT** (left ear sits at +y/2), **-y = right**, **+z = up**. This is opposite to 2D screen coords where `+y` is down (south). Feed screen-y straight in and **left/right swap**.

Fix: a screen→audio translation that negates y everywhere it crosses the boundary:

```js
function tileToM(v) {
  return {x: v.x * TILE_TO_M, y: -v.y * TILE_TO_M, z: 0}
}

function relativeVector(x, y) {
  const listener = engine.position.getVector()
  const lq = engine.position.getQuaternion().conjugate()
  return engine.tool.vector3d.create({
    x:  x * TILE_TO_M - listener.x,
    y: -y * TILE_TO_M - listener.y,
    z: 0,
  }).rotateQuaternion(lq)
}

// Yaw: screen east (1,0) → audio yaw 0; screen south (0,1) → audio yaw -π/2.
const yaw = Math.atan2(-d.y, d.x)
engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))

// Any "behind" check vs facing yaw must use the same flipped y:
const dx = srcX - p.x, dy = -(srcY - p.y)
const angleVsFacing = Math.atan2(dy, dx) - yaw
```

When in doubt, play a tick at front/right/behind/left and verify by ear before assuming any other audio bug is real.

### Listener orientation is sticky

`engine.position.setVector(...)` / `setQuaternion(...)` persist across frames until set again. A screen calling `content.audio.setStaticListener(...)` once on enter needn't refresh it — but the game screen's `content.audio.frame()` overwrites both from the player pose. Diagnostic screens needing a fixed pose must (a) not call `frame()` and (b) re-apply their static listener on return from a screen that did.

### `app.controls.ui()` delta can fire on the same tick as a click

Pressing Enter on a focused button fires both the browser's synthetic `click` (`onReady` listener) and the next frame's `ui()` returning `enter: true` (`onFrame`). Both calling the same action dispatches twice — usually harmless, but an Enter-to-go-back bounces you straight back. Either add a ~6-frame `entryFrames` countdown after `onEnter`, or only handle the click and ignore the keyboard delta.

### Audio context suspended until first user gesture

Autoplay policy starts the context `suspended`; `main.js` resumes it on `pointerdown`/`keydown`/`touchstart`. SFX scheduled in `menu.onEnter` (before the first click) are silent — `aria-live` still works. Don't chase silent SFX as a bug before the first gesture; same for boot-time synth probes — never put audible tones in `main.js`.

### "Reverb" on a one-shot is usually a re-fired SFX

If a one-shot (e.g. the gameOver dirge) sounds reverb-y/smeared, **check whether an FSM phase re-enqueues the cue every frame** before suspecting the chain. A "wait N seconds then fire X" phase that never advances fires X ~60×/sec — ~200 stacked copies sound like a reverb wash. Guard with a flag or transition out immediately after firing:

```js
if (_state.phase === PHASE_DYING) {
  if (_state.t >= _state.pendingDeathAt && !_state._handledDeath) {
    _state._handledDeath = true
    content.audio.enqueue({type: 'gameOver'})
  }
  return
}
```

Reset the flag in `game.reset()`. Ref: `../_cl/src/js/content/game.js`.

**Belt-and-braces:** `engine.mixer.reverb` is active-by-default and permanently wired into master once active. Games authoring their own per-cue tails (all of them — ADSR + lowpass cover it) should kill the global send in `main.js` after `engine.loop.start().pause()`:

```js
engine.mixer.reverb.setActive(false)
```

Ref: `../climber/src/js/main.js`. For a genuine room sound, build a per-cue convolver instead.

### Hash routing in screenManager

Honor `window.location.hash` in the `none → activate` transition for diagnostic routes (`#test`, `#music`). Don't dispatch from `main.js` after `screenManager.dispatch('activate')` — the FSM is already at the destination.

### `engine.fn.normalizeAngleSigned` is broken

It subtracts π instead of wrapping into `[-π, π]`. Don't use it. Use `Math.atan2(Math.sin(a), Math.cos(a))`, or leave angles unwrapped (`cos`/`sin` tolerate drift).

### Cross-module references must be lazy

Alphabetical concat means `audio.js` runs before `table.js` defines `content.table`. Capture sibling refs inside *functions*, not at module top:

```js
const T = content.table       // Wrong — undefined here
const T = () => content.table  // Right — resolves on each call
```

Relying on `getJs()` alphabetical order breaks as soon as a file is added. Ref: `pinball/src/js/content/game.js`.

### Wrap `onFrame` in try/catch

A throw inside `onFrame` halts the loop until reload — every screen, including menus, dies. Wrap the body in `try { … } catch (e) { console.error(e) }`; one bad frame is recoverable, a dead loop isn't. Ref: `../vfb/src/js/app/screen/game.js:107`.

### Browser auto-repeat for held keys

Edge-triggered keydown fires on hold-repeat ~every 30 ms. For "press to start, press to stop" actions (horn, charge, plunger), gate with a local `isActive` flag so auto-repeat doesn't toggle off. `app.controls.ui()` protects menu input but not raw `window` keydown. Ref: `../bumper/src/js/app/screen/game.js:75`.

### Rising-edge probing for "why didn't I move?"

On an arrow key's up→down, run the same passability check the movement code uses and announce/buzz immediately if blocked — otherwise blind players think input was lost when they walked into a wall. Ref: `../pacman/src/js/app/screen/game.js:99`.
