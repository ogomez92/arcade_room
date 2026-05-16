# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`asteroids` — audio-first port of the 1979 arcade game built on the syngen-template. Newtonian flight (rotate / thrust / soft brake), toroidal wraparound field, splitting rocks, UFOs, hyperspace. Listener mode is **player-locked** (audio +x = whatever the ship is facing). Two play modes:

- **Classic** — vanilla Asteroids; online leaderboard id `asteroids`.
- **Arcade** — Classic plus powerups that spawn near the player and drift across the field; online leaderboard id `asteroids-arcade`. Both boards live on scores.oriolgomez.com.

Ships as both an HTML5 app (served from `public/`) and an Electron desktop app (`electron/main.js`). There is no test suite, no linter, and no `npm` scripts. All tasks run through Gulp.

## Arcade mode — powerup system

Arcade mode is opt-in via the **Arcade Mode** menu entry, which calls `content.game.setMode('arcade')` before transitioning to the game screen. The mode flag rides in `content.game.state.mode` ('classic' | 'arcade'). Re-running via the gameover screen's **Play Again** preserves the mode — the mode is only changed by the menu's mode buttons.

### Scalable registry (add a powerup in three steps)

The registry pattern lives in `src/js/content/powerups.js`. Each kind is a single entry in `DEFS`. To add a new powerup:

1. **Define it in `DEFS`** with shape:

    ```js
    myKind: {
      id: 'myKind', kind: 'myKind',
      weight: 2,                  // weighted roll across the registry
      durationS: 12, timed: true, // optional — set for timed buffs
      voice: 'myKind',            // ties to a timbre entry in audio.js _powerupTimbres()
      announceKey: 'ann.pwrMyKind',
      announceEndKey: 'ann.pwrMyKindEnd', // timed only
      pickupSoundKey: 'pwrPickMyKind',
      onPickup(state, ctx) { /* instant effect or state.activate(id, durationS) */ },
    },
    ```

2. **Add a timbre** in `content/audio.js` → `_powerupTimbres()` (osc `types`, `freqs`, `detuneC`, AM `wobbleHz`/`wobbleDepth`, optional FM `fmHz`/`fmDepth`, `lp` cutoff). The shared `buildPowerup()` reads this — you don't write a per-kind synth tree. FM vibrato is what gives the looping pickup voice its sci-fi shimmer; omit `fmHz`/`fmDepth` for AM-only timbres.

3. **Wire i18n + UI**:
   - Add `ann.pwrSpawnMyKind`, `ann.pwrMyKind`, `ann.kindPwrMyKind` keys to both `en` and `es` in `i18n.js`.
   - Add a `learn.pwrMyKind` button to `public/index.html` and route it through `app/screen/learn.js` → `previewPowerup('myKind')`.
   - Add a `help.arcadeMyKind` line to the help screen's `<ul class="a-help--arcade">`.

No other file needs touching — `content.bullets`, `content.game`, the spawn loop and the Tab override read the registry generically.

### How the running powerup state works

- At most one **world pickup** exists at a time: `content.powerups.current()` returns `{x, y, vx, vy, radius, def, _id, expiresAt}` or `null`. It drifts at `DRIFT_SPEED = 1.5 u/s`, self-despawns after `LIFETIME = 22 s`, and the next spawn is scheduled `SPAWN_GAP_MIN..MAX` (8–14 s) later.
- A **timed buff** lives in `state.active` as `id → expiresAt`. `content.powerups.isActive(id)` is the only thing the rest of the codebase reads — e.g. `bullets.fire()` checks `isActive('rapidFire')` to skip `MAX_BULLETS`, and `isActive('bigShots')` to scale `BULLET_RADIUS` by `BIG_SHOT_RADIUS_MUL`.
- Pickup detection: `circleHit(ship, pickup, 0.6)` per frame. The ship must be alive but can be invulnerable — pickups should never punish mid-respawn.
- The pickup despawn warning is **pitch-down + faster wobble** in the last ~3 s. Do **not** fade gain — it reads identical to "moving farther away" with our distance attenuation.
- **Timed buffs are signaled by one-shot stings, not a looping pad.** `audio.frame()` diffs the active-buff Set each frame and fires `emitBuffStart(id)` on activation, `emitBuffEnd(id)` on expiry (mirror sweep, dimmer). The in-between gameplay change (rapid pace, bigger bullets) is the cue — a looping "you have the buff" voice masked rocks and was removed.

### Tab targeting override

`content.game.aimAtMostDangerous()` is the Tab handler. In arcade mode, if a world pickup exists, Tab snaps the ship's heading toward the pickup instead of running the danger heuristic. The fallback (closing rocks beat drifting, UFO bullets > UFOs > rocks) is unchanged for classic mode and for arcade-mode-with-no-current-pickup.

### Rapid-fire input plumbing

`content.game.setFireHeld(on, side)` is called by `app/screen/game.js` from the raw `keydown/keyup` listeners. The fire loop in `tick()` only honours the held flag while `isActive('rapidFire')`. The 4-bullet cap is bypassed in `content.bullets.fire()` by checking the same flag. Cooldown drops to `RAPID_FIRE_COOLDOWN` (0.07 s) during the buff.

## Fire keys and directional shots

- **Space + S** — centre shot (bullet spawns at the ship's centre, pan is positional).
- **A** — left shot (bullet spawns at `SIDE_SHOT_OFFSET` perpendicular-left of centre, audio pan biased left).
- **D** — right shot (mirror of A).

All four routes go through `content.game.requestFire(side)`. The bullet's velocity vector is **always** along ship heading — the side only shifts the muzzle spawn point and the audio pan. This is the cheap "two cannons + one main" feel without complicating the physics or the player's mental model of where the shot will land.

Multiple sides can be held at once; arcade rapidFire's auto-re-fire follows the most recently pressed side, falling back to whatever is still down if that key is released.

## Bullet origin invariant

**Bullets always spawn at the ship's centre** (or the offset directly perpendicular for A / D). They do **not** spawn at the ship's "nose" (heading-aligned). Don't reintroduce the nose offset — the user noticed it sounded like the ship was shooting from one side, and verified the centre-spawn is what they want.

## Bullet aim-assist (small-target slack)

A hit registers when the bullet centre comes within `bullet.radius + target.radius (+ slack)` of the target centre. With raw radii a large rock's hit window (~4.7u) is ~3x wider than a small rock's (~1.4u) — brutal when aiming by ear. Two corrections, both applied to the **bullet** hit test only — ship-crash collisions stay honest so colliding with a small rock is still fair:

- **Per-size slack** — `AIM_SLACK` (rocks) and `UFO_AIM_SLACK` (UFOs) add extra slack that's larger for smaller bodies, equalising windows toward ~2.4u. Currently only small rocks (0.6) and small UFOs (0.4) get any. Passed as the `extraSlack` arg of `physics.circleHit` via `content.game._bulletSlack()`.
- **`BIG_SHOT_HIT_BONUS`** — a flat window bonus (0.8u) added while `bigShots` is active. The `BIG_SHOT_RADIUS_MUL` 3x alone barely moves the window (3x of a 0.2u bullet is still tiny); this bonus is what makes bigShots actually feel like wider aim.

Small-body radii were also bumped (small rock 1.2→1.5, small UFO 1.5→1.8) so they have more physical presence — this *does* affect ship-crash collision, intentionally.

## Player bullet audio

`audio.emitBullet(x, y, heading, side, big)` is the per-shot one-shot. The first version was a single thin sine sweep (900 → 200 Hz) — the user found it "soooo tiny." It is now three layers so it reads as a *shot*, not a beep:

- **Buzzy sweep** — a sawtooth through a lowpass that tracks the pitch down. The harmonics are what carry the laser character; a pure sine has none, which is why the old one sounded thin.
- **Sub thump** — a sine well below the sweep for body weight.
- **Attack transient** — a short bandpassed noise burst for the percussive snap.

Plus the existing quiet binaural triangle for HRTF colour. The `big` flag (passed through from `bullet.big`, the `bigShots` powerup) selects a heavy-cannon variant: lower fundamental (560 vs 1050 Hz), longer tail (0.22 vs 0.13 s), an extra-octave sub, darker noise, and more gain. Don't revert to a single-oscillator bullet — the layering is deliberate. `previewBullet()` (learn screen) plays the normal shot then the big shot ~420 ms later so players learn the contrast.

## Imminent-collision proximity beep

`audio.setProximityBeep(sources)` is the per-frame audio cue for "things relevant to the player." Called from `content.game.tick()` via `findProximitySources()`. Sources fall into two buckets:

- **Threats** (rocks of any size, the active UFO, every UFO bullet) — included only when they're on a collision course with the ship and will impact within `IMPACT_TTI_MAX` (2.5 s) at current relative velocity. Pitch family per kind (rocks descend large→medium→small low→high; UFO bullets at 300 Hz; UFO body higher). Pulse rate scales inversely with TTI so an immediate threat sounds like an alarm.
- **Powerups** (arcade mode only) — always included as a positive source when a pickup exists on the field, regardless of trajectory. Triangle waveform, higher pitch family (1175–1976 Hz), softer pulse rate (~3 Hz). The player always knows where a pickup is.

Up to `MAX = 4` sources play simultaneously, sorted by urgency (lowest TTI wins the early voice slots). The legacy `setTargetLock(on, info)` is preserved as a thin wrapper that collapses to a single proximity source with `tti=0.2`.

## UFO bullet audio

UFO bullets had no audio in v0.1 — the player just died invisibly. Three cues now cover the threat:

- **Muzzle ping** — `audio.emitUfoBulletFire(x, y)` fires on every UFO shot. Sci-fi "pew" sweep: sine 1600 → 500 Hz + triangle 2400 → 750 Hz over ~140 ms, panned from the shooter's position with a quieter binaural copy for HRTF colour. Distinct from the player's bullet, which is a three-layer buzzy shot (see *Player bullet audio*).
- **Continuous in-flight voice** — each UFO bullet carries a stable `id` (assigned in `ufo.js` `_fire`) and gets a continuous spatial voice via `makeSpatialVoice` / `buildUfoBullet`, synced in `audio.frame()` against `content.ufo.bullets()` exactly like the asteroid voices (`ensureUfoBulletVoice` / `dropUfoBulletVoice`, keyed by bullet id). Without it, a bullet that isn't on a collision course is unlocatable — the player can't hear where incoming fire *is*, only that a shot happened. The proximity-beep-only design was tried and the user found it impossible to locate bullets.
- **Proximity beep** — `setProximityBeep` includes UFO bullets when they're on a collision course (300 Hz pulse at the bullet's position, rate scales with TTI). This adds the collision-course *urgency alarm* on top of the always-on locating voice — same dual role rocks have (continuous voice + proximity beep).

**The in-flight voice that was killed, and why this one is different.** An earlier per-bullet loop (low square + 60 Hz buzz tremolo through a narrow bandpass) was removed for flooding the field and sounding like a fart. `buildUfoBullet` deliberately avoids both failure modes: a *clean* pitched tone (triangle fundamental + a quiet sine shimmer partial + a gentle ~7 Hz AM — no buzz, no narrow bandpass), modest gain that sits between a small and medium rock, and a per-bullet ±4% pitch jitter so two in flight stay distinguishable. Flooding is not a real risk here — one UFO at a time, ~1.5 s fire period, 1.4 s bullet life → only 1–2 voices ever live. If a future change ever does spawn many bullets at once, cap the number of voiced bullets (nearest-N) rather than dropping the voice.

## Scoring, waves, and lives

The constants live in `constants.js`, but the *relationships* between them are what matter for tuning anything score-gated — keep this table in mind before touching a threshold.

- **Waves.** `content.game._startNextWave()` spawns wave N with `WAVE_BASE + (N-1)*WAVE_PER_LEVEL` large asteroids (4, 5, 6, …) and scales every rock's speed by `WAVE_SPEED_MUL^(N-1)` (~8 %/wave, compounding). A wave ends when the field is cleared; the next starts automatically.
- **Splitting.** `asteroids.split()` turns a large rock into 2 mediums, a medium into 2 smalls, a small into nothing. Children fly at the parent's heading ± `SPLIT_SPREAD` and inherit *at least* 1.4× the parent's speed, so a wave gets faster as it's whittled down.
- **Score per rock** (`SCORE`): large 20, medium 50, small 100 — so one large rock fully cascaded is 20 + 2×50 + 4×100 = **520 pts**. A full wave-N clear is `(3+N) × 520`: ≈ 2,080 / 2,600 / 3,120 for waves 1–3 → **cumulative ≈ 2,080 / 4,680 / 7,800**. UFOs add bigUfo 200 / smallUfo 1000.
- **Lives.** Start `START_LIVES` (3). The **first** extra life is awarded at `EXTEND_FIRST` (4,000); every one after is `EXTEND_INTERVAL` (8,000) further — 4k / 12k / 20k / 28k … `_award()` tracks `state.nextExtendAt`. The first threshold is split out from the interval on purpose: a flat 10k interval put the first life around wave 4, so a new player had no safety net through the hardest early waves.
- **Score-gated features.** `SMALL_UFO_THRESHOLD` (10,000) gates small UFOs — below it *every* UFO is big, which (per the cumulative table) means small UFOs cannot appear until ≈ wave 4. Any new score-gated mechanic should be sanity-checked against that table or it will effectively never trigger in normal play.

## Online scores — dual mode

`app/onlineScores.js` keeps a `GAMES` map keyed by mode, each with `{id, secret}`. `app/screen/game.js` calls `app.onlineScores.setMode(content.game.isArcade() ? 'arcade' : 'classic')` before `openSession()`. The session captures the game id at open time, so even if the mode is changed mid-run the submit is signed with the right secret.

Both leaderboards are registered on `scores.oriolgomez.com`. **The admin API doesn't accept a chosen secret** — `adminCreateGame` always calls `randomSecret()`, `/rotate` does the same, and `adminUpdateGame` ignores the `secret` field. To set a specific secret, write directly to `/home/scores/data/scores.db` (the file is on the same VPS):

```sh
sqlite3 /home/scores/data/scores.db \
  "UPDATE games SET secret='<NEW>' WHERE id='asteroids-arcade';"
```

Then update `app/onlineScores.js` to match. Local highscores in `app/highscores.js` are **shared across modes** — keep this in mind if you ever want per-mode local boards.

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

The starting state is `none`; dispatching `activate` transitions directly to `menu` (or to a `#hash` route like `#test` / `#learn`). To add a screen, drop a file in `src/js/app/screen/` and add the matching `.a-app--screen .a-app--<id>` markup in `public/index.html`.

**Don't add a splash screen.** "Press any key to begin" gates are vestigial — the menu is the entry point. The first menu button click satisfies the WebAudio user-gesture requirement (any pointer/key event resumes the audio context, see `main.js`). If you find yourself wanting a title display, that's what the menu's `<h1 class="c-menu--title">` is for. The Language picker lives on the menu, not a separate splash.

### Storage, versioning, and updates

Storage is *per app version* and backed by IndexedDB through `app.storage.api` (with an in-memory proxy and debounced writes). Keys are `[version, key]` pairs, so each release version has its own namespace.

On boot, `app.updates.apply()` (in `src/js/app/updates.js`):
1. If no saved versions exist, sets the current version and exits.
2. If a save for the current version exists, uses it as-is.
3. Otherwise, finds the closest *earlier* saved version, clones its data into the current version's namespace, then runs every `app.updates.register(semver, fn)` migration whose semver is later than that earlier version, in order.

Version comparisons use `app.utility.semver` (parses `MAJOR.MINOR.PATCH-LABEL`). The injected `app.version()` value is replaced by `Gulpfile.js` from `package.json`'s `version` field.

`app.autosave` debounces saves of `engine.state.export()` to storage key `state` on a 30-second loop while enabled.

### Settings

`app.settings.register('fooBar', {default, compute, update})` auto-creates:
- `app.settings.setFooBar(rawValue)` — setter that recomputes and fires `update`.
- `app.settings.computed.fooBar`, `app.settings.raw.fooBar`, `app.settings.defaults.fooBar`.

`app.settings.load()` merges defaults with persisted raw values from storage key `settings` and runs each `update` once. Call `app.settings.save()` to persist after changes. See `src/js/app/settings/example.js` for the shape (commented out — uncomment or copy to define real settings).

### Controls

`app.controls.update()` runs every frame (`engine.loop.on('frame', ...)`). It merges output from three adapters — `app.controls.gamepad`, `app.controls.keyboard`, `app.controls.mouse` — each with `game(mappings)` and `ui(mappings)` methods. Mappings live in `src/js/app/controls/mappings.js` and are tagged by `type: 'gamepad' | 'keyboard' | 'mouse'`.

- `app.controls.game()` returns the current frame's continuous game inputs (e.g. `{x, y, rotate}`).
- `app.controls.ui()` returns *deltas* — only the UI inputs that just became active this frame, used for menu navigation (so a held key fires once).

The mouse adapter takes pointer lock when entering the `game` screen (and re-acquires it after Escape in Electron). Gamepad axes are inverted in `game` to match keyboard semantics.

### Haptics

`app.haptics.enqueue({duration, startDelay, strongMagnitude, weakMagnitude})` queues a dual-rumble effect; magnitudes are summed across active events each frame, attenuated by `setSensitivity`, and dispatched to all dual-rumble gamepad actuators. `update(delta)` must be driven by the caller (typically by a screen's `onFrame`).

### Unified accessible UI shell

Every game in this collection shares the same accessible UI scaffolding so players (and screen-reader users) get the same shape across games. When you add a new game, follow this shape rather than inventing a new one:

- **`.c-screen`** wraps each screen's content with focus-trap-friendly layout.
- **`.c-menu` + `.c-menu--title` + `.c-menu--subtitle` + `.c-menu--list` + `.c-menu--button`** are the building blocks for menus, language pickers, gameover, help, etc. The CSS lives in `src/css/component/menu.css`. Press states are denoted with `aria-pressed="true"` (the language picker uses this for the active locale).
- Sections have `tabindex="-1"` and a translated `aria-label` via `data-i18n-attr="aria-label:..."`.
- An always-present `aria-live="polite"` region (and usually a separate `assertive` one) sits directly under `<main>` for announcer output. The exact element / class varies by game (`.a-app--announce`, `.js-announcer`, `.a-live`) — pick one and route every runtime announcement through it.
- The main menu always exposes a `Language` button that transitions to the `language` screen. Every game ships a `menu` screen — there is no splash, no "press any key to begin" gate.
- Help / How-to-play screens are linear prose using `data-i18n-html` for items containing `<kbd>` / `<strong>` so the markup stays inline-translatable.

### Localization (English / Spanish, extensible)

Every game in this collection ships with the same lightweight i18n module so menus, HUD labels, help text, and announcer strings can be served in the player's language. The system is identical across `bumper`, `combat`, `neverStop`, `pacman`, `pinball`, `pong`, `roadsplat`, `vfb`, and this template — copy the pattern verbatim when adding a new game.

**Files (per game):**

- `src/js/app/i18n.js` — the i18n module itself. Exposes `app.i18n` with `t(key, params?)`, `applyDom(scope?)`, `setLocale(id)`, `locale()`, `available()`, `localeName(id)`, and `onChange(fn)`. The module body is identical across games; only the `STORAGE_KEY` constant (e.g. `'pacman.lang'`) and the `dictionaries` object change. Resolution order on boot: `localStorage[STORAGE_KEY]` → `navigator.language` 2-letter prefix → `'en'`.
- `src/js/app/screen/language.js` — the language picker screen. Same logic in every game; the `back` transition returns to `menu` (the only entry-point screen).
- `src/css/component/menu.css` — provides `.c-menu`, `.c-menu--list`, `.c-menu--button`, `.c-menu--button[aria-pressed="true"]`. The language screen relies on these.
- `public/index.html` — the language section uses class `a-language` inside `a-app--language`, with an empty `ul.c-menu--list.a-language--list` that the screen's `renderList()` populates from `app.i18n.available()`.
- `src/js/main.js` — calls `app.i18n.applyDom()` between `app.settings.load()` and `app.screenManager.ready()` so static DOM is translated before any screen's `onReady` reads it.

**Annotating static text:**

```html
<button data-i18n="menu.start">Start Game</button>             <!-- textContent -->
<li data-i18n-html="help.controlUp"><kbd>Up</kbd> — accelerate</li>  <!-- innerHTML, preserves inline tags -->
<section data-i18n-attr="aria-label:menu.aria;placeholder:foo.bar"></section>  <!-- attributes -->
<title data-i18n="doc.title">…</title>  <!-- the document title is special-cased by applyDom() -->
```

The English text in the markup is a **fallback for the moment between page load and `applyDom()`**, not the source of truth — the dictionary is. When you update a string, change the dictionary and let `applyDom()` re-render.

**Runtime strings:**

```js
app.announce.polite(app.i18n.t('ann.score', {score: 1234, level: 5}))
hud.statusEl.textContent = app.i18n.t('game.statusBoost', {seconds: 2.4})
```

Templates use `{name}` placeholders. Missing keys return the key itself (`'menu.unknown'`), which makes typos visible in the UI rather than silently empty.

**Adding the language screen to a new game:**

1. Add a `language` button to the main menu and wire its `data-action="language"` to a transition that runs `this.change('language')`.
2. Make sure the language screen's `back` transition returns to the originating screen.
3. Add the HTML language section: `<div class="a-app--screen a-app--language"><section class="c-screen c-menu a-language" tabindex="-1" data-i18n-attr="aria-label:language.aria">…</section></div>`.
4. Add an entry like `'menu.language': 'Language'` (and the matching `'language.*'` keys) to both the `en` and `es` dictionaries.

**Adding a new locale:**

1. Add the language to `localeNames` at the top of `i18n.js`.
2. Add a parallel block to `dictionaries` keyed by the same id. Missing keys fall back through `FALLBACK = 'en'` so partial translations are safe to ship.
3. The language screen will pick the new locale up automatically.

**Persistence rules:**

- Each game has its own `STORAGE_KEY` (`bumper.lang`, `pong.lang`, etc.) so locale choices don't leak between games when they're hosted under the same origin.
- `localStorage` is used directly, not `app.storage`, because the locale must resolve **before** `app.storage.ready()` finishes (some games run audio probes and announcer strings on boot, before the IndexedDB store is open).

**State that should be locale-stable:**

If a value is shown to the player twice in different ways — e.g. neverStop's stop reason is set in `content/car.js` and rendered later in `app/screen/gameover.js` — store the **i18n key**, not the rendered string, and translate at render time. neverStop does this with `car.stopReasonKey = 'stop.fuel'`. Rendering `app.i18n.t(car.stopReasonKey)` at the gameover screen means a player who switches language between dying and seeing the gameover screen still gets a coherent message.

For the same reason, the pinball table stores a `labelKey` alongside each bumper / target / rollover — runtime announcements look up the translated label fresh from the table rather than copying the English string into the event payload.

### Electron specifics

`electron/main.js` creates a frameless fullscreen window with `contextIsolation: true` and `devTools: false`, removes the menu (so Ctrl+R/Ctrl+W can't reload/close), auto-grants `midi` and `pointerLock` permissions, and applies platform-specific GPU/composition flags. `electron/preload.js` exposes `window.ElectronApi = {quit}`. Renderer code uses `app.isElectron()` (presence of `ElectronApi`) to branch — e.g. `app.quit()` calls `ElectronApi.quit()` only in Electron, and the HTML5 build adds a `beforeunload` confirmation that Electron skips.

The `dist-electron` Gulp task packages only the current platform — to ship Windows + Linux + macOS, run `gulp dist` separately on each.

## Conventions

- No build-time module system. All app code is written as IIFEs or assignments to the `app` / `content` namespaces. New files are picked up via the glob in `Gulpfile.js`'s `getJs()`/`getCss()` — no manual registration needed.
- Screens always extend `app.screen.base` via `app.screenManager.invent()`. Don't subclass it manually.
- CSS class prefixes are `.a-` (app-level layout/instances) and `.c-` (reusable components). The order in `getCss()` is `reset → main → utility/* → component/* → */*` — utilities and components must not depend on later files.
- Game state that should persist goes through `engine.state` (so `app.autosave` and screen `onImport`/`onReset` hooks pick it up), not directly through `app.storage`.

## Gotchas worth remembering

### Syngen spatial audio coordinate frame

Syngen's `engine.ear.binaural` uses a non-obvious convention. From `node_modules/syngen/src/syngen/ear/binaural.js`, the listener-local axes are:

- **+x = forward** (the direction the listener is facing)
- **+y = LEFT** (because the LEFT monaural processor receives `relative + (0, -headWidth/2, 0)`, which means the left ear sits at +y/2)
- **-y = right**
- **+z = up**

This is the opposite of the y axis in most 2D screen-coordinate setups, where `+y` points down (south) and the player's right when facing east is `+y`. If you feed screen-y straight into the binaural without compensating, **left and right will be swapped** in the audio.

The fix is a screen → audio coordinate translation that negates y everywhere it crosses the boundary:

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

// Yaw: screen east-facing dir = (1, 0) → audio yaw 0; screen south-facer
// = (0, 1) → audio yaw -π/2.
const yaw = Math.atan2(-d.y, d.x)
engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))

// Anywhere else that compares a source angle to facing yaw (e.g. a "behind"
// check) must use the same flipped y so it stays consistent:
const dx = srcX - p.x, dy = -(srcY - p.y)
const angleVsFacing = Math.atan2(dy, dx) - yaw
```

When in doubt, build a route that plays a tick at front (+x), right (-y in audio = +y in screen flipped), behind (-x), and left (+y in audio = -y in screen flipped) and verify by ear before assuming any other audio bug is real.

### Listener orientation and per-frame state

`engine.position.setVector(...)` and `setQuaternion(...)` are sticky — set them once and they persist across frames until you set them again. So a screen that calls `content.audio.setStaticListener(...)` once on enter doesn't need to keep refreshing it. But the moment the game screen runs, its `content.audio.frame()` will overwrite both based on Pac-Man's pose. Diagnostic screens that need a fixed listener pose must (a) not call `content.audio.frame()` and (b) re-apply their static listener if they ever return from a screen that did.

### `app.controls.ui()` is a delta, but it can fire on the same tick as a click

Pressing Enter on a focused button fires both:
1. The browser's synthetic `click` event (handled by your `addEventListener` in `onReady`).
2. The next frame's `app.controls.ui()` returning `enter: true` to your `onFrame`.

If both paths call the same action, you'll dispatch twice. Usually the second dispatch is silently dropped because the source state changed, but for screens that have an Enter-to-go-back, the entering keypress can immediately bounce you back. Either:
- Add a small `entryFrames` countdown in the destination screen's state and ignore inputs for ~6 frames after `onEnter`, or
- Only listen for the click event and ignore the keyboard delta in `onFrame`.

### Audio context is suspended until first user gesture

Browser autoplay policy means the WebAudio context starts in `suspended` state. `main.js` registers `pointerdown`/`keydown`/`touchstart` listeners that call `ctx.resume()`. The menu is the entry screen, so any SFX scheduled in `menu.onEnter` (before the user's first click on a menu button) will be silent. The `aria-live` announce still works (it's not WebAudio). Don't chase silent SFX as a bug before the first user gesture has happened.

### "Reverb" on a one-shot is usually a re-fired SFX, not real reverb

If a player reports the gameOver dirge (or any one-shot SFX) sounds reverb-y / smeared, **check first whether an FSM phase is re-enqueueing the cue every frame** before suspecting the audio chain. A phase that does "wait N seconds, then fire X" but never advances will fire X ~60×/sec for the rest of the wait. ~200 stacked copies of a 1.5s dirge sound exactly like a big reverb wash.

The general shape — guard the one-shot with a flag, or transition out immediately after firing:

```js
if (_state.phase === PHASE_DYING) {
  if (_state.t >= _state.pendingDeathAt && !_state._handledDeath) {
    _state._handledDeath = true
    content.audio.enqueue({type: 'gameOver'})
    // ... callback into screen, etc.
  }
  return
}
```

Reset the flag in `game.reset()` (and any path that re-enters the phase). Reference: `../_cl/src/js/content/game.js` PHASE_DYING.

**Belt-and-braces:** `engine.mixer.reverb` is also active-by-default in syngen — its wet output is permanently wired into the master mix once active, even if no game code explicitly calls `mixer.reverb.createBus()`. For games that author their own per-cue tails (essentially all of them in this collection — ADSR + lowpass shaping cover what reverb would do), kill the global send in `main.js`:

```js
// after engine.loop.start().pause():
engine.mixer.reverb.setActive(false)
```

CRAZY CLIMBER! (`../climber/src/js/main.js`) does this. If a specific cue genuinely needs a room sound, build a per-cue convolver on that signal chain instead of leaning on the global send.

### Loops for short-lived buffs and per-bullet trails flood the field

A continuous looping voice on the listener (e.g. "you have rapidFire") or on every projectile (e.g. an in-flight UFO bullet drone) sounds informative in isolation but **drowns the rest of the field** when the player is doing the thing the loop is meant to advertise — i.e. all the time. Symptom: the player reports "I can't hear the rocks anymore" while a buff is active, or "everything sounds like noise" while multiple UFO bullets are airborne.

Prefer **one-shot stings on transitions** — start sting on activation, end sting on expiry — and let the in-between gameplay change (different fire rate, bigger bullets, proximity-beep ping at the threat) be the cue. The buff/threat is what the player is currently *doing or reacting to*; they don't need a constant reminder.

Reference: `content/audio.js` `emitBuffStart`/`emitBuffEnd` (replaces the old `startBuffVoice`/`stopBuffVoice` pad).

The rule is about *flooding*, not about looping voices being banned outright. UFO bullets *do* now carry a continuous in-flight voice (`buildUfoBullet`) — the original proximity-beep-only design left them unlocatable. It's safe here because the bullet count is naturally tiny (1–2 live at once) and the timbre is a clean tone, not the old buzz drone. The danger is a loop that's both *numerous* and *masking*; one or two clean-toned voices are neither. If projectile counts ever balloon, cap voiced bullets to the nearest N rather than removing the voice. See *UFO bullet audio*.

### Hash routing in screenManager

The `none → activate` transition is the place to honor `window.location.hash` for diagnostic routes (e.g. `#test`, `#music`). Don't try to dispatch from `main.js` after `app.screenManager.dispatch('activate')` — at that point the FSM is already in the destination state and the hash is too late.

### `engine.fn.normalizeAngleSigned` is broken

Despite the name, it subtracts π instead of wrapping into `[-π, π]`. Don't use it. Either `Math.atan2(Math.sin(a), Math.cos(a))` for an explicit wrap, or leave angles unwrapped — `cos`/`sin` tolerate drift. Reference: `../bumper/src/js/content/{physics,ai}.js`.

### Cross-module references must be lazy

Gulp's alphabetical concat means an IIFE in `audio.js` runs *before* `table.js` defines `content.table`. Capture sibling references inside *functions*, not at module top:

```js
// Wrong — content.table is undefined at this point:
const T = content.table

// Right — resolves on each call, after all modules have loaded:
const T = () => content.table
```

`pinball/src/js/content/game.js` uses arrow-function getters for this; `audio.js` and `physics.js` capture their references inside their own functions. The Gulpfile's `getJs()` order isn't a viable workaround — relying on alphabetical accident breaks as soon as someone adds a file.

### Wrap `onFrame` in try/catch

A throw inside `onFrame` halts the syngen loop until reload — every screen render dies, including menus. Wrap the body in `try { … } catch (e) { console.error(e) }` and log; one bad frame is recoverable, a dead loop is not. Especially important for game screens that touch network state, audio scheduling, or anything that can throw on bad input. Reference: `../vfb/src/js/app/screen/game.js:107`.

### Browser auto-repeat for held keys

Edge-triggered keydown fires on hold-repeat ≈ every 30 ms. For "press to start, press again to stop" actions (horn, charge, plunger pull), gate with a local `isActive` flag so the auto-repeat doesn't toggle off on the second autorepeat tick. The `app.controls.ui()` delta protects menu input but not raw `window.addEventListener('keydown')`. Reference: `../bumper/src/js/app/screen/game.js:75`.

### Rising-edge probing for "why didn't I move?"

When an arrow key transitions up→down, run the same passability check the movement code uses and announce / buzz immediately if blocked. Without it, blind players think input was lost when actually they walked into a wall. Reference: `../pacman/src/js/app/screen/game.js:99`.

### Audio context resume vs. early SFX

Already covered in "Audio context is suspended until first user gesture" above. Add: synth probes that run on boot for diagnostics (e.g. measure context sample rate) must happen *after* the first user gesture too. Don't put audible test tones in `main.js` — they'll be silent on first load and audible on every reload after, which makes them look broken.
