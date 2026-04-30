# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`beatstar` — an audio rhythm game built on the syngen template. Players hear a hint pattern (up / down / left / right cues) and must echo it back on the beat. Difficulty scales with level: BPM rises and the number of measures to memorize increases.

Ships as both an HTML5 app (served from `public/`) and an Electron desktop app (`electron/main.js`). There is no test suite, no linter, and no `npm` scripts. All tasks run through Gulp.

## beatstar — what's already decided

The foundational design questions in the template's BLOCKING checklist further down this file have **already been answered** for beatstar. Don't re-ask them. The decisions are:

1. **Perspective / movement.** Static / menu-driven — there is no avatar in space, just timed arrow presses. No collision, no grid, no continuous integration.
2. **Audio listener.** **Stereo / non-spatial.** No `engine.position` calls, no binaural ear. Every voice routes through a `StereoPannerNode` with a per-direction pan baked into `content.audio.NOTE`. The L/R panning *is* the spatial cue.
3. **Audio's role.** **Audio-first / blind-accessible.** The visual HUD is a courtesy; the entire game must be playable purely by ear.
4. **Input devices.** Keyboard arrow keys (and WASD as an alias). The game screen reads raw `keydown` rather than `app.controls.ui()` because rhythm judging needs zero added input latency. `app.controls.ui()` is still used inside menu screens for navigation.
5. **Persistence.** None for now. No `app.autosave`, no high scores. (Easy to add later — see "Possible extensions" below.)
6. **Progression.** Endless / score chase. Levels are infinite; difficulty just keeps rising until the player runs out of lives. There's no level-clear screen — the success cue plays in-place and the next level rolls in.
7. **Synth aesthetic.** Tonal synth, multiple lead voices (`bell`, `square`, `pluck`, `mellow`) selected per level by the active style. Hint = brighter shimmer; echo = warmer/dimmer flavor of the same voice family so the player can tell their own playing apart from the cue. No samples.

### Note layout (root + 3rd + 5th + octave, follows the active key)

Pans are **fixed** in `content.audio.NOTE`. Frequencies are **re-derived per level** by `content.audio.setTonality(rootSemitone, mode)` (called from `content.game.pickLevelParams()`), which delegates to `content.theory.arrowFreqs()`. The four arrow tones are scale degrees 1, 3, 5 from the active scale plus an octave above the root — so the *third* arrow shifts between major and minor 3rd as the mode flips, and all four shift together when the key modulates between levels.

| Arrow | Pan   | Default (C major) | Vibe |
|-------|-------|-------------------|-------|
| down  |  0.00 | C4  (261.63 Hz)   | low, centred — earth |
| left  | -0.70 | E4  (329.63 Hz)   | warm, panned left — moves to Eb in minor |
| right | +0.70 | G4  (392.00 Hz)   | bright, panned right |
| up    |  0.00 | C5  (523.25 Hz)   | high, centred — sky |

In any key they form a 1-3-5-8 arpeggio, which is what `audio.tonalArpeggio()` (used during the modulation bridge) exploits. Players who can't pitch the octave by ear still get unambiguous left/right pan plus high/low, so every direction has at least two distinguishing axes regardless of key.

### Difficulty curve

Defined in `content/game.js` and `content/styles.js`:

```
bpm           = clamp(72 + 8 * (level - 1), ≤ 168)  // cap at level-13 tempo
measures      = 1 + floor((level - 1) / 4)          // 1×4, 2×4, 3×4, …
meter         = pickMeter(style, level)             // 3, 4, 5, or 7 — palette per style
subdivision   = subdivisionProbs(level)             // q/e/s shares per beat (caps at L10)
patternsPerLv = max(3, level * 2)                   // clean rounds to advance
lives         = 3 (max 5; bonus life on clean level w/ avg accuracy ≥ 0.75)
tonality      = locked C major for L1-2; root shifts L3+; mode flips L4+
```

Hit window per note is the note's **slot duration** in beats — a quarter has a beat-wide window, an eighth a half-beat, a sixteenth a quarter-beat. Tighter slot → more points (100 / 150 / 250). Clean-level bonus is `500 * level`.

Patterns are probabilistic, not "every beat". For each beat, `subdivisionProbs(level)` rolls a quarter (1 note), eighth pair (2), or sixteenth quad (4); subdivision share rises with level. So levels 1–3 are pure quarters; by level 10+ ~65% of beats subdivide.

Each level is **multi-round**: the same level (style/meter/key) plays `patternsPerLevel(level)` clean patterns before advancing — L1=3, L2=4, L3=6, L4=8, L5=10. Style/meter/key only modulate at the level boundary; within a level the player gets fresh random patterns at the same difficulty so they can lock in.

### State machine (content/game.js)

```
idle → intro → hint → transition → echo → verdict
                                              ├→ next round (clean, more rounds left) — no pause
                                              ├→ next level (clean, level cleared)    — verdict pause + bridge
                                              ├→ retry round (miss, lives left)        — no pause
                                              └→ gameover (lives hit 0)               — verdict pause
```

Every phase boundary lands on a musical bar so beats never drift relative to the backing track. The procedural drums in `content.music` ARE the click track once it's running. During the **intro**, however, a meter count-in (`audio.countIn`) plays alongside the music — accented woodblock-style ticks marking beat 1 — so the player can lock the meter even if it's a less familiar 3/5/7.

All audio events for a level (count-in, hint notes, go cue, bridge chords) are pre-scheduled in `enterIntro()` at exact `audioContext.currentTime` times derived from a single `T0`. Subsequent `enterHint/Transition/Echo/Verdict` only flip game state — the audio is already queued.

- **intro** (1 measure) — count-in clicks across the measure; bridge chords on top: first half = OLD tonic in OLD style instruments, second half = NEW V7. Resolves on beat 1 of hint, where music switches to the NEW style and starts the new progression. Level-info announcement (level + previous-level accuracy) goes only on the FIRST round of a level.
- **hint** (M measures) — drums + bass + pad. Hint notes pre-scheduled at `introEnd + beat * beatDur + 2 ms` so the bell attack doesn't smear the kick transient.
- **transition** (0 or 1 measure) — collapsed to **0** for 1-measure patterns (no empty wait); **1 measure** for 2+ measure patterns to give the player a breather to mentally rewind. The `audio.go()` cue is always scheduled at `transitionEnd - 0.5 * beatDur` regardless — for 1-measure patterns it lands inside the last half-beat of hint.
- **echo** (M measures, no slack) — ends on the music's measure boundary so the next round's hint can start there with no gap. `handleArrow` gates on `state.echoStartTime` / `echoEndTime` (audio-clock), NOT on `state.phase`, because for 1-measure patterns hint→transition→echo can cross within a single audio sample and the frame pump is a tick behind.
- **verdict** (1.4 s) — only entered on level-clear or game-over. Round-clear-but-more-rounds-left and miss-with-lives-remaining both skip verdict entirely (music keeps rolling, fail cue plays, next pattern starts on the next bar).

The pattern generator avoids three of the same arrow in a row — easy patterns get tedious, hard ones stop being audibly distinguishable. Each clean round generates a fresh random pattern; misses retry with a fresh pattern too (the same level is the contract, not the same notes).

Between levels the game can **modulate**: stay, up/down a 4th or 5th, up/down a whole step, and from level 4+ flip mode (major↔minor). Levels 1-2 stay in C major so the player can learn the four arrow tones first; root shifts begin at level 3. The modulation key is selected in `pickTonality()` and is announced to the player by ear — by the bridge measure that resolves into the new tonic.

### Audio architecture

Four content modules:

**`content.theory`** — pure-data music helpers, no Web Audio. Exposes:
- `arrowFreqs({rootSemitone, mode})` — Hz for the four arrows in the active key.
- `arrowSemitones(mode)` — `[1, 3, 5, 8]` scale degrees in semitones (major or minor 3rd by mode).
- `expand(descriptor, tonality)` → `{root, third, fifth, seventh, minor}` Hz — turns a `{r, t}` chord descriptor (relative to the active key) into concrete frequencies. `r` is semitones from the tonality root; `t` is one of the keys in `CHORD_TYPES` (`maj`, `min`, `maj7`, `min7`, `dom7`, `dim`, `halfdim`).
- `keyName(rootSemitone, mode)` — for accessibility announcements.

**`content.styles`** — registry of musical styles. Each style is a bag of knobs (`bpmRange`, `meterPalette`, `progressions`, `minorProgressions`, `drumKit`, `bassVoice`, `padVoice`, `leadVoice`, `pad` volume). Currently shipped: `lounge`, `synthwave`, `house`, `chiptune`, `rock`, `waltz`, `funk`, `jazz`, `ambient`, `latin`, `disco`. Picker functions: `pickFor(prevId)` (avoids repeating the previous level's style), `pickMeter(style, level)` (canonical meter under level 3, palette mix above), `pickProgression(style, mode)`, `subdivisionProbs(level)`. The `bpmRange` knob is currently descriptive only — every style plays at the level's BPM so the difficulty curve stays consistent.

**`content.audio`** — short one-shot cues. All voices route through `engine.mixer.input()` and use `StereoPannerNode`s; no binaural ear, no `engine.position`.
- `hint(direction, when?)` / `echo(direction, when?)` — arrow timbres. Both adapt to the current `leadVoice` set by `setLeadVoice(name)` (`bell` / `square` / `pluck` / `mellow`). Same frequency + pan; hint is brighter (e.g. for `bell`, sine + 5th harmonic shimmer), echo is warmer (sub-octave / triangle), so the player tells own-playing from cue.
- `go(when?)` — listen→echo cue. Outside the four-arrow note set, with semitone tension that pulls toward the active up-arrow tone. Centre-panned, louder than a hint.
- `countIn(t0, beatDur, beatsPerMeasure)` — woodblock-style ticks across the intro measure; beat 1 is accented.
- `tonalArpeggio(t0, span)` — plays down/left/right/up for the active tonality. Used during the modulation bridge and on level intros.
- `success`, `fail`, `levelUp`, `gameOver` — short fanfares composed from the four arrow voices in the active key.
- `setLeadVoice(name)` / `setTonality(rootSemitone, mode)` — called by `content.game.pickLevelParams()` per level.
- `now()` — passthrough to `audioContext.currentTime`.

**`content.music`** — continuous procedural backing track. Audio-clock lookahead scheduler on `engine.loop.on('frame', tick)`; refills a 150 ms queue of upcoming 16th-step events. Voice families branch by the active style's `drumKit` / `bassVoice` / `padVoice`. Master bus at 0.32 with a fade-in/fade-out so transitions don't pop.

Voicing keeps the bed out of the C4–C5 arrow band: bass starts at C2 (`content.theory.BASS_C`), pad sits an octave above, drums are broadband transients. Hints and echoes own the C4–C5 register (`content.theory.LEAD_C`).

**Pad envelope is per-voice, not per-style.** `padChord()` reads the voice name (`saw`, `organ`, `rhodes`, `soft`, `strings`, `arp`) and picks both the timbre AND an attack/hold/release fraction. Bright pads (saw, organ) get a fast attack capped at 80 ms so the chord change lands ON the downbeat — a single shared `dur * 0.15` attack used to make the synthwave saw pad sound a half-beat late on every chord change. If you add a new pad voice, set its envelope explicitly; don't fall back to the default sine/triangle path expecting it to feel right.

`content.music` exposes `start(opts)`, `stop()`, `configure(opts)` (called per level — switches style/meter/progression/tonality and optionally schedules a one-measure bridge in the OLD style starting at `alignAt`), `nextDownbeat()`, `bpm()` / `level()` getters. The bridge is scheduled by `content.game.enterIntro()` so the intro measure plays in the OLD style with old-tonic→new-V7 chord assignments per beat, and from measure 2 onward the lookahead automatically picks up the NEW style + progression.

### Hooking up announcer / phase / judgement events

`content.game` exposes three pubsub-style hooks so the UI layer doesn't have to poll game state:

- `onAnnounce((key, params, level) => ...)` — i18n key + params + 'polite'|'assertive'. The game screen routes these to `app.announce.polite/assertive`.
- `onPhaseChange((newPhase, prevPhase) => ...)` — used by the game screen to refresh its HUD and to defer the screen swap to `gameover` until the gameOver cue has had ~1.2 s to play.
- `onJudgement((beatIndex, 'hit'|'miss') => ...)` — currently unused by the UI but available if you want to flash a visual or trigger haptics on each press.

### Input handling

The game screen binds raw `window.keydown` and dispatches to `content.game.handleArrow(direction)` immediately. Two reasons not to use `app.controls.ui()` here:

1. `ui()` is edge-triggered per frame, so the reported press time is *the next frame after* the actual keydown — at 60 fps that's up to 16 ms of jitter, which at 140 BPM (≈430 ms/beat) is ~4% of the hit window.
2. `ui()` debounces to one fire per direction per frame, but a rhythm game can absolutely take two presses of the same arrow within one frame at high BPM.

`F1`–`F4` are reserved for screen-reader status reads (level / score / lives / phase) and are `preventDefault`-ed in capture phase along with `F3` and `F5` so the browser doesn't open Help / Find / Reload while focus is in the app.

### Learn screen

A `learn` screen (`src/js/app/screen/learn.js`, reached from the main menu) auditions each of the four arrow voices in isolation — `hint` first, then `echo` ~600 ms later — so players can map timbre/pan/pitch to direction before committing to a real round. Buttons trigger via click; arrow keys also trigger via `app.controls.ui()`. The screen does NOT call `setLeadVoice` or `setTonality`, so it auditions whatever the last level left configured (defaults to `bell` in C major before any game has been played).

### Level-select and persistence

There's a player-visible `levelSelect` screen (`src/js/app/screen/levelSelect.js`, reached from the main menu) that lets players start at any previously-reached level. The "highest unlocked" level is bumped every time `pickLevelParams()` runs and persisted directly to `localStorage["beatstar.highestLevel"]` — NOT through `app.storage`, because the value should survive `engine.state` resets and there's no other persistent state in this game. `content.game` exposes `setStartLevel(n)` / `getStartLevel()` / `getHighestUnlocked()` / `bpmForLevel(level)` for the UI.

The Main Menu's plain "Start Game" button always resets to level 1; "Start at Level…" goes through the picker. The gameover screen's "Play Again" honours whatever start level was last set, so a player practising level 10 doesn't get bumped to level 1 on death.

### Hidden style-preview screen

`Ctrl+Shift+P` from the main menu opens `src/js/app/screen/stylePreview.js` — a hidden audition screen that lists every style and plays a few measures (in C major) plus a short hint-note pass through the four arrows when Enter is pressed. Left/Right adjust a "preview level" that drives the BPM via `content.game.bpmForLevel`, and changing level mid-preview restarts the audition at the new tempo so timbre and tempo can be evaluated together. Useful for quickly catching when a style sounds out-of-sync or muddy at high BPM. There's no menu button — the hotkey is the only entry.

### Menu nav utility

`app.utility.menuNav.handle(ui, root)` translates an `app.controls.ui()` delta into focus moves through the focusable buttons inside `root` — Up = previous, Down = next. Wired into every menu-style screen (menu, language, gameover, levelSelect, stylePreview) so arrow keys navigate menus the way most players expect; Tab still works (focus-trap is untouched). Enter/Space activate the focused button via browser default — never wire an unconditional `if (ui.enter) dispatch('foo')` in a menu screen, that bypasses the focused selection.

### Possible extensions

- **High scores** — drop in `app.highscores` (Pac-Man's `src/js/app/highscores.js` is the reference) with a `beatstar-highscores-v1` localStorage key. Wire the gameover screen to write the score and a `Top Scores` menu button to read it. The `beatstar.highestLevel` localStorage key already demonstrates this pattern (small, persistent-across-resets values go to localStorage; richer state would still go through `app.storage`).
- **Game-feel polish** — small haptic pulse on each hit/miss via `app.haptics.enqueue`. Per-beat visual flash in the HUD by subscribing to `onJudgement`.
- **Style variant preview** — already implemented as a hidden screen (see "Hidden screens" below). For a player-facing version, surface the same screen via a menu button and add an "audition both major and minor" toggle, then store a forced-style preference in `app.settings` (override `content.styles.pickFor` when set).
- **Note density** — add a difficulty floor knob: at low levels only beats 1 and 3 carry notes (call beats 2 and 4 "rests" and skip the hint scheduler for them). Raises the floor and stretches the curve.
- **Two-player** — the multiplayer pattern in the template's CLAUDE.md fits well: host generates the pattern, both peers race to echo it. Star topology, score-per-beat broadcast in the snapshot.

When in doubt about wiring screens, audio scheduling, or timing-window semantics, the implementation is small — `content/{audio,music,theory,styles,game}.js` and `app/screen/game.js` — just read it.

## Starting a new game from this template

**This is a BLOCKING requirement.** Whenever the user describes a brand-new game to build on top of this template — i.e. `src/js/content/` is empty or contains only stub/example code, and the project does not yet have a game-specific `CLAUDE.md` of its own — you MUST ask the foundational design questions below before writing any `content/` code or making any architectural commitments. Picking wrong and refactoring later is expensive (especially #2 — audio listener mode is hard to retrofit). Skip questions the user has already answered explicitly in their first prompt; batch the remaining questions into a single message so the user answers them all at once.

Once you have an existing game-specific `CLAUDE.md` in the project root, ongoing work is no longer "starting a new game" and these questions do not need to be re-asked.

### Required questions

1. **Perspective and movement model.** Top-down 2D tile-based (Pac-Man, Zelda 1)? Top-down 2D continuous? Side-scrolling 2D? First-person 3D? Third-person 3D? Static / turn-based / menu-driven? This determines the coordinate system, collision model, and how `app.controls.game()` is consumed.

2. **Audio listener behavior** — *the single most important question, ask it explicitly even if the user gave hints.*
   - **Screen-locked (Pac-Man style)** — listener yaw is **fixed**; sounds always come from their actual screen position. A ghost south of the player always sounds behind, no matter which way the player last moved. Best for fixed-camera 2D games where the player views the world from above and the camera never turns.
   - **Player-locked (FPS-style)** — listener yaw tracks the player's facing direction; "front" is whatever the player is facing. Best for first-person 3D and games where the avatar's heading IS the camera.
   - **Camera-locked (third-person)** — listener yaw tracks the camera, not the avatar. Useful when camera and avatar can rotate independently.
   - **Stereo / non-spatial** — skip 3D positioning entirely; use `StereoPannerNode` per source, or mono cues. Best for menu-driven, turn-based, or purely musical games.

3. **Audio's role.** Audio-first / blind-accessible (sighted UI minimal, must be playable purely by ear)? Equal (visuals and audio both first-class)? Audio supportive (visuals primary, audio feedback only)? This affects how much effort goes into spatial cues, screen-reader announcements, and visual UI.

4. **Input devices.** Keyboard only? Keyboard + gamepad? Keyboard + mouse? All three? The template ships with all three adapters wired; the answer determines which mappings to define and which adapters to disable.

5. **Persistence.** Continuous autosave of full game state? Discrete saves (manual / per level)? High scores only? No persistence? This determines whether `app.autosave` stays enabled and what `engine.state.export()` should serialize.

6. **Progression structure.** Endless / score chase? Levels with discrete progression? Branching / non-linear? Single fixed scenario? Drives the screen FSM (need a level-clear screen? a game-over screen? a high-scores screen?).

7. **Synth aesthetic.** Chiptune / retro (raw squares and saws)? Modern synth (filtered triangles, soft pads, sub-bass)? Procedural / generative? The template is synth-only — sampled audio needs additional wiring.

### Implementation pointers per answer

**Audio listener — screen-locked.** Set yaw to a constant in `content.audio.updateListener()` and don't update it from player direction. Anchor audio-front to whichever screen direction feels like "up" to the player (typically screen-north). With the screen→audio y-flip in place, `LISTENER_YAW = Math.PI / 2` puts audio-front at screen-north:

```js
const LISTENER_YAW = Math.PI / 2 // screen-north = audio-front
function updateListener() {
  const p = content.player.getPosition()
  engine.position.setVector(tileToM(p))
  engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
}
```

`behindness()` reads the same constant via `_lastYaw`, so a "behind" muffle still triggers for sources opposite the anchored front. Build a diagnostic screen that emits ticks at front/right/behind/left around a static listener with the same yaw, and verify by ear after any change. The `audio-pacman` repo (`../pacman/src/js/content/audio.js`) is the reference implementation.

**Audio listener — player-locked.** Update yaw from the player's facing every frame:

```js
const d = content.player.state.dir
const yaw = Math.atan2(-d.y, d.x) // negate y to match the screen→audio flip
engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))
```

`behindness()` then naturally means "behind the player's heading" — the FPS interpretation.

**Audio listener — camera-locked.** Track the camera's yaw, not the avatar's. If the camera lags behind the avatar (smoothed follow), low-pass the yaw before applying so listener orientation doesn't snap.

**Audio — stereo only.** Skip the binaural pipeline entirely. Per source: a `StereoPannerNode` whose `pan` is the source's screen-x relative to the player, clamped to `[-1, 1]`. No `engine.position`, no listener yaw.

**Movement — tile-based grid.** Use queued-direction movement (store current `dir` and a queued `dir`; on each tile center, swap if the new tile is passable). Add a small "cornering" window near tile centers where motion happens on both axes for smoothness. The pacman repo's `content/pacman.js` is the reference.

**Movement — continuous free.** Read `app.controls.game()` each frame for `{x, y}` and integrate position. Collision is geometric (AABB or circle-vs-tile), no grid snap needed.

**Persistence — autosave.** Leave `app.autosave` running. Each `content.*` module exposes import/export hooks via `engine.state`. Keep saved state small — most gameplay state should rebuild on level start.

**Persistence — high scores only.** Disable `app.autosave` in `main.js`. Add a dedicated `app.highscores` module reading/writing its own storage key. The pacman repo's `src/js/app/highscores.js` is a reference.

**Progression — levels.** Add `levelClear` and `gameOver` screens to the FSM. The game's top-level FSM (in `content/game.js` or similar) typically transitions `intro → ready → play → death/levelClear → play (next level) | gameOver`.

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
- The main menu always exposes a `Language` button that transitions to the `language` screen. If the game has no main menu (`roadsplat`, `template`), the splash carries the button instead.
- Help / How-to-play screens are linear prose using `data-i18n-html` for items containing `<kbd>` / `<strong>` so the markup stays inline-translatable.

### Localization (English / Spanish, extensible)

Every game in this collection ships with the same lightweight i18n module so menus, HUD labels, help text, and announcer strings can be served in the player's language. The system is identical across `bumper`, `combat`, `neverStop`, `pacman`, `pinball`, `pong`, `roadsplat`, `vfb`, and this template — copy the pattern verbatim when adding a new game.

**Files (per game):**

- `src/js/app/i18n.js` — the i18n module itself. Exposes `app.i18n` with `t(key, params?)`, `applyDom(scope?)`, `setLocale(id)`, `locale()`, `available()`, `localeName(id)`, and `onChange(fn)`. The module body is identical across games; only the `STORAGE_KEY` constant (e.g. `'pacman.lang'`) and the `dictionaries` object change. Resolution order on boot: `localStorage[STORAGE_KEY]` → `navigator.language` 2-letter prefix → `'en'`.
- `src/js/app/screen/language.js` — the language picker screen. Same logic in every game; only the `back` transition target differs (it should return to whichever screen reaches it — usually `menu`, or `splash` for menu-less games like `roadsplat` and `template`).
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

1. Add a `language` button to the main menu (or splash, for menu-less games) and wire its `data-action="language"` to a transition that runs `this.change('language')`.
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

## Audio patterns beyond binaural

The template wires up `engine.ear.binaural` via `setVector` / `setQuaternion`, but binaural alone is a thin cue — every shipped game in this collection layers extra shaping on top. When you build a new game, reach for these patterns rather than treating raw binaural as the whole story.

- **Behind-listener muffle.** Looping voices route through a shared lowpass + slight detune that opens as the source moves in front of the listener and closes behind it (`behindness()` returning 0 = ahead, 1 = directly behind). Sweep cutoff e.g. 22 kHz → 700 Hz with a `~0.05s` time constant; drop pitch by a few percent at maximum behindness. Stacks a strong front/back cue on top of binaural's weak HRTF nulls. Reference: `../pacman/src/js/content/audio.js`, `../bumper/src/js/content/pickups.js`.
- **Per-source gain model.** Don't apply the same distance falloff everywhere. Use `gainModel.exponential` with a steep `power` for short-range FX (bullets, footsteps); `gainModel.normalize` for sensors that should stay audible at any range (proximity walls, off-screen indicators); cubic falloff for the local player's own car so it's loud locally but dies fast at distance for other peers. Reference: `../bumper/src/js/content/{bullets,carEngine,targeting}.js`.
- **Continuous looping voice with parameter coupling.** For balls, engines, ball-rolls, danger drones, fan whooshes: open one oscillator/noise chain on screen-enter and shape it every frame from world state — gain ∝ speed, lowpass cutoff sweeps with speed, fundamental tracks position. Cheap, much easier to audition than discrete impacts, and gives constant ambient presence. Reference: `../pinball/src/js/content/audio.js` (rolling sound), `../pong/src/js/content/audio.js` (ball tone), `../racing/public/js/audio.js` (engine harmonics + turbo whine).
- **Stereo + binaural dual path for one-shot SFX in 2D.** Sum a `StereoPannerNode` (dominant L/R, no head-shadow nulls) with a quieter binaural ear at the same position. Stereo carries position; binaural adds HRTF colour. Stereo dominates at distance because binaural drops off harder. Reference: `../pinball/src/js/content/audio.js:49`.
- **Solenoid-style kick on collision.** Fixed energy added on top of restitution (e.g. `BUMPER_KICK = 22 u/s`) gives pop-bumpers, kickers, fan-blades, slings their snap. Pure restitution alone feels dead even at e = 1.0. Reference: `../pinball/src/js/content/physics.js:20`.
- **Pitch families for disambiguation.** When the same entity type spawns in multiples (bumpers, drop targets, rollovers, ghosts, AI cars), give each instance a distinct base pitch (or a head/body two-tone pair) so rapid sequential hits stay decipherable. Same logic applies to enemy classes in shooters: tie a fundamental frequency to type so the player identifies an off-screen threat by timbre. Reference: `../pinball/src/js/content/audio.js:98`, `../vfb/src/js/content/entities.js:47`.
- **Audio-clock scheduled lookahead.** For repeated cues (bleeps, pulses, beacons), schedule the next event with `engine.synth.simple({when: t})` ~50 ms ahead of `audioContext.currentTime` so `setTimeout` jitter never causes audible gaps. The outer JS loop only refills the queue. Reference: `../neverStop/src/js/content/audio.js:378`.
- **Disposable per-frame ear for one-shots.** Spawn a fresh binaural ear per impact, schedule the graph, `setTimeout`-disconnect after the tail decays. Cheap and avoids voice-stealing logic. Don't reuse for high-rate streams (allocation cost dominates) — use a pooled or persistent voice instead. Reference: `../bumper/src/js/content/sounds.js:13`.
- **Reusable ADSR helper.** Most games end up writing an `envelope(gain, t0, attack, hold, release, peak)` helper that cancels prior schedules and applies clean `setValueAtTime` + `linearRampToValueAtTime` curves. Write it once per game and route every synth voice through it. Reference: `../bumper/src/js/content/sounds.js:53`.
- **Silence-all on screen exit.** When leaving the game screen for pause/menu/gameover, stop every looping spatial voice. Otherwise an enemy drone keeps playing under the menu, which is both distracting and confusing for screen-reader users. Reference: `../pacman/src/js/app/screen/game.js:85` calls `content.audio.silenceAll()`.
- **BFS-routed radar beacon for navigation games.** When the listener is screen-locked and players need to *reach* a target (not just hear where it is), pathfind from the player to the target every ~1.5s and emit a directional tick at the next BFS step — "go this way to actually get there", not just "the target is over there." Reference: `../pacman/src/js/content/audio.js`.

## Announcer and screen-reader patterns

The accessible UI shell section above covers basic `aria-live`. The shipped games converge on a richer announcer than the bare minimum:

- **Two regions, polite and assertive.** Polite carries routine events (score, pickup, rollover); assertive carries state changes (drain, rank-up, pause, game-over, boss spawn). Don't overload polite — assistive tech queues polite messages and a flood swallows everything. Reference: `../pinball/src/js/app/announce.js`, `../pacman/src/js/app/announce.js`, `../vfb/src/js/content/world.js`.
- **Re-read identical strings.** Screen readers swallow back-to-back identical text. Either (a) clear the region to `''`, yield via `requestAnimationFrame` or `setTimeout(…, 50)`, then re-set, or (b) keep two parallel buffers per key and ping-pong between them. Reference: `../pacman/src/js/app/announce.js`, `../bumper/src/js/content/announcer.js`.
- **Optional TTS fallback.** A `setUseTts(true)` toggle that adds a SpeechSynthesis path so users without a screen reader still get spoken cues. Off by default; expose in settings. Reference: `../bumper/src/js/content/announcer.js:34`.
- **Function-key status hotkeys (F1–F7).** Every game in the collection wires F1–F4 (sometimes through F7) to read out a stat — score, lives, position, fuel, gear, nearest target, time. Bind at `window` keydown so they work regardless of focus. Without these, blind players have no way to query state mid-action. Reference: every game's `src/js/app/screen/game.js`.
- **`preventDefault` on F1, F3, F5.** The browser maps F1 to Help, F3 to Find, F5 to Reload, F11 to Fullscreen. Capture-phase preventDefault on the game screen to keep them — but **don't** bind F11 (let users fullscreen). F1/F3/F5 are the dangerous ones in browsers; in Electron only F11 matters and is already removed by the menu strip.
- **Opponent label switches by mode.** "Computer" vs "opponent" reads differently. Branch on `isMultiplayer()` at i18n lookup time, not in the message constant. Reference: `../pong/src/js/content/scoring.js:12`.

## AI patterns

- **Per-AI personality randomization.** Construct each AI with random `aggression`, `cooldown`, `reactionDelay`, etc. so they feel distinct and don't dogpile in unison. Tune the *ranges* not the values. Reference: `../bumper/src/js/content/ai.js:20`.
- **Anti-gang targeting tax.** When picking a target, subtract a penalty per other AI already chasing the same victim — spreads attention instead of all five chasing the player. Reference: `../bumper/src/js/content/ai.js:71`.
- **Reaction-delay buffer.** For human-feeling AI (paddle, follower, AI car), keep a circular buffer of recent observed positions and read it `N` frames in the past instead of the current frame. Easier to tune than predictive AI, naturally beatable, and reads as "human reflexes" rather than "perfect tracking." Reference: `../pong/src/js/content/ai.js:10`.
- **Hysteresis on toggle decisions.** AI throttle direction, target switching, and similar binary choices need a hysteresis flag so the value doesn't flap when the underlying signal sits on the threshold. Reference: `../bumper/src/js/content/ai.js:36`.
- **Post-action cooldown / breather.** After a big action (ram, swing, fire), force the AI to disengage for a randomized interval scaled by personality. Without it, AIs pin-and-spam. Reference: `../bumper/src/js/content/ai.js:495`.
- **Schedule tables for arcade-fidelity behavior.** Pac-Man ghosts use per-level scatter/chase tables, dot-counter release thresholds, and Cruise Elroy speedups straight from the Pac-Man Dossier. If a port needs feel parity, port the tables verbatim — feel-tuning by hand never converges. Reference: `../pacman/src/js/content/ghosts.js`.

## Physics patterns

- **Sub-stepped integration to prevent tunneling.** Adapt sub-step count from `MAX_SPEED / (collisionRadius * dt)` so per-substep travel stays below ~70% of the smallest collider. 8–48 substeps/frame is normal for fast 2D games. Reference: `../pinball/src/js/content/physics.js:46`.
- **Multi-pass collision resolution.** A single resolve against segment A can push the body into segment B at corners. Loop up to ~4 passes per substep — first pass reflects velocity, subsequent passes are pure position correction. Reference: `../pinball/src/js/content/physics.js:54`.
- **Velocity-aware normal fallback.** When a circle's centre lands exactly on a line (`dist < 1e-6`), the perpendicular has two valid signs. Pick the one opposite to velocity so fast bodies don't get punched through the wall. Reference: `../pinball/src/js/content/physics.js:82`.
- **Velocity-dependent restitution.** Rubber-on-flipper compression: `e = base / (1 + falloff * impactSpeed)`. Hard hits absorb energy, allowing cradling and drop-catch. Without it a held flipper acts as a perfect catapult. Reference: `../pinball/src/js/content/physics.js:36`.
- **Asymmetric kinematics for actuators.** Real solenoids snap fast, springs return slow. Pinball flippers use 30 rad/s up vs 9 rad/s down. Symmetric speed prevents ball settling and breaks every advanced technique. Reference: `../pinball/src/js/content/physics.js:25`.
- **Stuck-body force-drain.** Track frames where speed < ε; after ~90 frames force-drain or teleport. Numerical equilibrium in geometric wedges is otherwise unreachable. Reference: `../pinball/src/js/content/physics.js:126`.
- **Asymmetric damage on collision.** The aggressor (body driving harder into the contact normal) eats less damage; the victim eats more. Encourages attacking and rewards positioning. Reference: `../bumper/src/js/content/physics.js:24`.
- **Steering scales with speed and direction.** `steerMul = clamp(speed/v0, 0, 1) * sign(forwardSpeed)` so reversing inverts steering naturally — like a real car. Without the speed gate, parked cars spin in place. Reference: `../bumper/src/js/content/physics.js:82`.
- **One-way gates.** Mark a segment as `oneway` with a `normal`; only resolve collisions where `dot(velocity, normal) > 0`. Useful for ramps, gutter return lanes, no-back-tracking corridors. Reference: `../pinball/src/js/content/physics.js:316`.
- **Soft speed cap.** Instead of hard-clamping `|v| ≤ vmax`, scale by `k = vmax / |v|` when over the cap. Smoother and avoids step discontinuities in derived audio (engine pitch). Reference: `../bumper/src/js/content/physics.js:76`.

## Progression, state, and persistence patterns

- **Persistent vs session state.** Distinguish run-state (lives, score, fuel, current level) from cross-run state (cash, permanent upgrades, high scores, unlocked locales). Persistent state survives `engine.state.reset()`; session is rebuilt every run. The store screen mutates persistent values, then session re-baselines from persistent on the next run. Reference: `../vfb/src/js/content/state.js`.
- **i18n keys for locale-stable values.** The template's i18n section mentions `stopReasonKey` — generalize it: any value computed in module A and rendered in module B (stop reasons, label keys, rank names, mission descriptions, achievement titles, gameover messages) must store the **key**, not the rendered string. Translates fresh at render time even if locale changed mid-flight. Reference: `../neverStop/src/js/content/car.js`, `../pinball/src/js/content/table.js`.
- **High scores dual backend.** Electron writes to a JSON file via the preload bridge (`window.ElectronApi.readHighScores/writeHighScores`); web falls back to `localStorage[<game>-highscores-v1]`. Up to 10 entries, sorted descending. Don't put high scores in `engine.state` if they should survive a `state.reset()`. Reference: `../pacman/src/js/app/highscores.js`.
- **Combo with decay timer.** Track `comboValue` and a `comboTimer` that resets on each kill/hit. Timer expiring drops the combo; chained hits scale the reward. Bind the combo trigger to *impact*, not death, so the visual/audio frame is right. Reference: `../vfb/src/js/content/world.js:115`.
- **Score-threshold extends.** Award an extra life at thresholds that **increase with each extend** (20k, 60k, 120k, 200k, …) rather than a fixed period. Avoids late-game infinite extends. Reference: `../vfb/src/js/content/state.js:162`.
- **Rank tiers driven by score.** Score → rank lookup with i18n-keyed names announces "promoted to X" on cross-thresholds. Cheap progression hook for endless games. Reference: `../pinball/src/js/content/game.js:24`.
- **Mission queue with per-mission `kind`.** Each mission has a `kind` (`targets`, `bumpers`, `rollovers`, `survive`, …) that selects the progress predicate. Completing all advances to a final state. Easier to add new missions than to write a custom state machine. Reference: `../pinball/src/js/content/game.js:41`.
- **Inventory as map of stacks.** `inventory = {shields, bullets, mines, boosts, teleports}`. Stack on pickup with optional caps. Auto-consume items have a per-frame `autoCheck(state)` (e.g. fuel pack triggers when `fuel < 0.15`); manual items consume on player action. A "random box" pickup runs a weighted roll on the registry. Reference: `../bumper/src/js/content/car.js:46`, `../neverStop/src/js/content/items.js`.
- **Checkpoint on intermediate landmark.** When the player dies but has lives left, restart from the last passed checkpoint (tower destroyed, boss flag, midpoint), not the level start. Removes the "lost 5 minutes of progress" friction. Reference: `../vfb/src/js/content/entities.js:152`.
- **Game-over delay so audio finishes.** A crash/death often has a satisfying audio sting (700–1500 ms). Set a `pendingGameOver` flag, keep audio ticking, and only transition the screen after the cue completes. Reference: `../neverStop/src/js/content/game.js:159`.

## Diagnostic, learn, and soundtest screens

Hidden screens are essential for an audio-first game — without them you can't validate spatial audio orientation, audition new sounds, or let players learn the cue vocabulary. The collection converges on three:

- **`#test` route** — plays ticks at front / right / behind / left around a static listener at the canonical orientation. Verifies the screen→audio coordinate flip is correct *by ear*. Run this first whenever you touch listener code. Reference: `../pacman/src/js/app/screen/test.js`.
- **`#learn` (or "learn sounds") route** — plays each spatial prop (enemy types, pickup types, hazards) and one-shot SFX individually with labeled buttons. Calls `content.audio.setStaticListener(0)` once on enter so the listener doesn't drift, and re-applies it on re-entry from screens that may have moved it. Reference: `../pacman/src/js/app/screen/learn.js`, `../pinball/src/js/app/screen/learn.js`.
- **Soundtest / variant preview** — for games with synth variant tables (bleeps, drones), expose a hidden screen reachable by a key press from the menu (T in neverStop) that auditions each variant and lets the player select one for the session. Useful for tuning and for letting screen-reader users pick a timbre that doesn't conflict with their TTS. Reference: `../neverStop/src/js/app/screen/soundtest.js`.
- **Wire diagnostic routes via `none → activate`.** Honor `window.location.hash` in the FSM's `activate` transition (see existing gotcha). Don't try to dispatch from `main.js` after `app.screenManager.dispatch('activate')` — at that point the FSM is already at the destination.

## Multiplayer (when adding network play)

The template ships single-player. If a game needs online multiplayer,
the rest of `oriolgomez.com`'s games (`../bumper`, `../racing`) follow
a fixed pattern — copy it instead of inventing something new, so the
shared coturn server keeps working uniformly.

### Infrastructure (already running, don't redeploy)

- **Signalling**: free public **PeerJS broker** (`0.peerjs.com`). No
  backend to host, no ports to open. Each peer gets a string id; the
  host picks a deterministic id like `<gameslug>-<roomcode>` and
  clients connect to it. Public PeerJS ids are global, so always
  prefix with the game's name to avoid collisions.
- **Data plane**: direct **WebRTC data channels** between peers. JSON
  over `DataConnection.send()`.
- **STUN / TURN / TURNS**: self-hosted **coturn** on the VPS that
  serves oriolgomez.com.
  - `turn.oriolgomez.com:3478` UDP+TCP — STUN + TURN.
  - `turn.oriolgomez.com:5349` TCP — TURNS (TLS, last-resort path
    through restrictive firewalls).
  - Hostname rides the wildcard `*.oriolgomez.com` A record. If the
    VPS IP ever changes, only the wildcard updates — no game rebuild.
  - Server config: `/etc/turnserver.conf`. Long-term creds, single
    user `gamesturn` (the password lives in the games' source — it's
    public-by-design because WebRTC requires the browser to know it).
  - TLS cert is provisioned by Caddy (Caddyfile entry for
    `turn.oriolgomez.com`) and copied into `/etc/coturn/{turn.crt,
    turn.key}` by `/usr/local/bin/coturn-cert-deploy`. The systemd
    path unit `coturn-cert-watch.path` re-runs the deploy on Let's
    Encrypt renewal.
  - UFW: `3478/udp+tcp`, `5349/tcp+udp`, `49160-49200/udp` (relay
    range, kept narrow on purpose).

### The constants block (copy this verbatim)

In whichever module owns networking (call it `net.js` or
`src/js/app/net.js`), put these five constants at the top — never
inline the host/port/creds further down. Future ops changes (server
move, cred rotation, port shift) should be one diff in five lines.

```js
const TURN_HOST = 'turn.oriolgomez.com'
const TURN_PORT = 3478
const TURNS_PORT = 5349
const TURN_USER = 'gamesturn'
const TURN_PASS = 'sin6V0gFokHz78gM0GDfXmat'
```

The `iceServers` array fed to `new Peer({config: {iceServers}})` (or
to a raw `RTCPeerConnection`) follows a fixed order — STUN first
because most connections never need a relay, then TURN/UDP, then
TURN/TCP for firewalls that drop UDP, then TURNS/TLS as the last
resort:

```js
config: {
  iceServers: [
    {urls: `stun:${TURN_HOST}:${TURN_PORT}`},
    {urls: 'stun:stun.l.google.com:19302'},  // Google STUN as backup
    {
      urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
  ],
  iceCandidatePoolSize: 2,
}
```

ICE candidate types in the browser console (when debugging connection
failures, this is the most useful signal):
- `host` — local LAN address (always present).
- `srflx` — public address discovered via STUN (means STUN works).
- `relay` — TURN-allocated address (means TURN works).
- No `relay` candidates + symmetric NAT = no path = silent timeout.

### Topology: star with host-authoritative sim

Both reference games use the same shape, and you should too unless
there's a strong reason not to:

- **One host, N clients.** Host runs the full simulation (physics,
  AI, scoring, item state) and broadcasts authoritative snapshots.
  Clients send inputs only.
- **Wire protocol** is plain JSON, no schema. Tag every message with
  a `type` field. Typical types: `hello`, `lobby`, `start`, `input`,
  `snap`, `event`, `end`, `kick`, `bye`. Validate `type` on receive,
  trust the rest (same code on both sides).
- **Tick / snap rate** is decoupled. Bumper runs the sim at 60 Hz on
  the host but only emits snapshots at 30 Hz. Clients lerp between
  snapshots and dead-reckon between them where it matters (e.g. car
  position uses lerp; listener yaw uses an immediate steering
  prediction so spatial audio doesn't lag a tick).
- **Events** that fire from the sim (collisions, pickups, weapon
  fires, eliminations) ride along inside the next snapshot in a
  `pendingEvents` array. The client re-emits them through its own
  pubsub so audio / haptics / announcer subscribers fire from the
  *local* player's perspective. Don't fire events out-of-band — they
  can arrive before the snapshot that establishes the state they
  describe.
- **Round-end ordering**: on the host, push the `roundEnd` event into
  the next snapshot **before** locally emitting any "stop the round"
  signal that would clear the cars/state. Otherwise clients never see
  the final state.
- **Disconnect handling**: mid-round client leave → host treats them
  as eliminated (forfeit). Mid-round host disconnect → client catches
  the `close` event and exits to the menu.

### Reference implementations

- **`../bumper/src/js/app/net.js`** — full implementation: PeerJS
  wrapper, lobby flow, snapshot replication, arcade items, heartbeat
  + peer timeout. Source-tree game with a Gulp build step, so changes
  to `net.js` need `gulp build` to land in `public/scripts.min.js`.
  Has the most complete docstring at the top of the file — read that
  for the wire-protocol schema and message-flow examples.
- **`../racing/public/js/net.js`** — leaner version of the same idea
  for a no-build static game. Plain `<script>` tag in
  `public/index.html` loads PeerJS from CDN, then `net.js` is served
  as-is. Edit and reload.

### Things to remember

- **PeerJS data channels don't throw on send when closed.** They
  silently drop. If you need delivery guarantees, ack at the app
  layer.
- **Loading PeerJS from CDN can fail offline.** `net.js` should
  expose `libAvailable()` and the menu should hide multiplayer when
  it returns false, instead of erroring inside `host()` / `join()`.
- **Don't put gameplay logic in `net.js`.** Keep it a thin transport
  with `on(event, cb)` / `send(msg)` / `broadcast(msg)` /
  `host(opts)` / `join(opts)` / `disconnect()`. Game modules
  subscribe and translate.
- **Document this game's wire protocol in its own CLAUDE.md.** A
  `Multiplayer` section listing every `type` and its payload shape is
  essential — clients and hosts share validation by trust, so the
  CLAUDE.md *is* the schema.

### Additional patterns (drawn from the shipped games)

- **Room codes use an unambiguous charset.** `'BCDFGHJKLMNPQRSTVWXZ23456789'` — no `0/O`, `1/I/L`, no vowels (avoids accidental words). Players read codes aloud over voice chat, so this matters more than it looks. Reference: `../bumper/src/js/app/net.js:44`.
- **Networked vs local events allow-list.** Define an explicit `NETWORKED_EVENTS` array. Only events in the list ride in `pendingEvents`; everything else stays local. Side-channel events that aren't in the list silently won't replicate, so making the allow-list explicit prevents "works locally, missing for remote players" bugs. Reference: `../bumper/src/js/content/game.js:61`.
- **Don't put `type` in event payloads.** The capture spreads `{type: eventName, ...payload}` into the wire message — a payload field named `type` clobbers the event name. Use `kind` / `category` / `action` instead. Reference: `../bumper/src/js/content/game.js:415`.
- **Role-guarded mutations.** Subscribers that mutate authoritative state (score, health, inventory) must `if (role !== 'client') return` — clients receive the result via the next snapshot, not by re-running the logic. Otherwise scores double. Reference: `../bumper/src/js/content/game.js:138`.
- **Predict only what audio cares about.** Position can lag a tick (lerp between snapshots). Listener orientation can't — predict it locally from steering input so spatial audio doesn't lag the controls. Position drift corrects naturally over the next snapshot. Reference: `../bumper/src/js/content/game.js:1168`.
- **Shortest-arc lerp for angles.** `dh = atan2(sin(target - current), cos(target - current))` to wrap the difference into `[-π, π]` before lerping. Raw subtraction snaps 359° → 0° and the avatar flips. Reference: `../bumper/src/js/content/game.js:1163`.
- **Items reconcile from snapshots, not local logic.** Clients don't simulate pickups / bullets / mines. Each snapshot carries the authoritative item list; the client diffs it: create voices for new ids, destroy voices for missing ids, hard-set positions. Optionally dead-reckon between snapshots using `vx, vy`. Reference: `../bumper/src/js/content/game.js:355`, `../racing/public/js/main.js:415`.
- **Bot fill on host.** If the lobby has fewer than the target player count, fill with AI bots so the round always has a full roster. Bots ride the same snapshot fields as remote players. Clients auto-discover bots from the first snapshot. Reference: `../racing/public/js/main.js:83`.
- **Per-team listener flip.** In symmetric arena games (pong, head-to-head), the listener for team 2 sits at the opposite end. Helper functions `calcPan(ev)` and `calcDepthT(ev)` take the local team into account so audio events broadcast in world coords play with the right perspective on each peer. Reference: `../pong/src/js/content/audio.js`, `teamManager.js`.
- **Audio-event relay queue.** Wrap `content.audio.*` with a relay that queues events to `pendingAudioEvents`; ride them in the next snapshot so clients replay locally with their own listener pose. Don't fire audio out-of-band — it can race the snapshot that establishes the source's position. Reference: `../pong/src/js/content/audio.js:8`.
- **Per-peer profile swap for self-comfort.** If cars / players have audio profiles (timbre, color), swap profiles 0 and `selfSlot` per-peer so each listener hears their own car as the gentlest profile (the loud aggressive timbre is fine on someone else's screen). Side effect: the same player has different perceived audio per peer. Reference: `../bumper/src/js/content/carEngine.js:14`.
- **Optimistic local action with host reconciliation.** Decrement bullet count, play fire SFX, queue the input — all locally and immediately. Host runs the authoritative shot a tick later. The shared SFX masks the latency; the eventual host-broadcast result corrects state. Reference: `../racing/public/js/main.js:243`.
- **Per-player pickup spawn timers.** A leader-only spawn schedule means trailing players never see pickups. Track spawn timing per-player on the host so everyone gets the same item rate regardless of position. Reference: `../racing/public/js/pickups.js:34`.
- **Use absolute (monotonic) coordinates for spawn math.** Never compute spawn positions in wrapping coordinates. Promote to a monotonic absolute (e.g. `zAbs = lap * trackLen + z`) so "spawn 200 m ahead of player" works across lap / loop boundaries. Reference: `../racing/public/js/pickups.js:44`.
- **Two-paddle manual mode.** In multiplayer the host drives both paddles via `setManualKeys()` rather than each peer reading its own keyboard for its paddle. Avoids double-reading the host's keys when both adapters are on the same machine. Reference: `../pong/src/js/content/game.js:93`.
- **Heartbeat + peer timeout.** Send a tiny `ping` every ~2s; treat a peer as gone after ~6s without traffic. PeerJS connections can sit "open" for minutes after a real disconnect. Reference: `../bumper/src/js/app/net.js`.
- **Static games still need `gulp build`.** Source-tree games like `bumper` require rebuilding `public/scripts.min.js` after editing `net.js`. Static games like `racing` are edit-and-reload. Don't burn time debugging stale builds — check which kind you're in.

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

Browser autoplay policy means the WebAudio context starts in `suspended` state. `main.js` registers `pointerdown`/`keydown`/`touchstart` listeners that call `ctx.resume()`. If you skip the splash screen and route straight to a screen that announces or plays SFX on `onEnter`, those calls happen before any user gesture and will be silent. The `aria-live` announce still works (it's not WebAudio), but synthesized SFX will start at the first interaction. Don't chase silent SFX as a bug if no user gesture has happened yet.

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
