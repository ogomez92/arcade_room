# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`audio-pacman` — an accessible, audio-first Pac-Man built on the [syngen](https://github.com/nicross/syngen) Web Audio engine. Sighted UI is minimal; the game is meant to be played by ear via spatial audio cues for ghosts, fruit, walls, dots, and Pac-Man's own footsteps. Ships as both an HTML5 build (served from `public/`) and an Electron desktop app.

This repo is built on `syngen-template`. The framework conventions (Gulp pipeline, three-namespace concatenation, screen FSM, storage/versioning, settings, controls, haptics, Electron quirks) are documented once in `../template/CLAUDE.md`. **Read that file first.** This file only documents what is specific to or different in the Pac-Man game.

## Commands

Same as the template — all tasks run through Gulp, no `npm` scripts, no test suite, no linter. The most common loop is:

```sh
npx gulp dev               # serve + watch in parallel
npx gulp build             # one-shot build
npx gulp build --debug     # skip minification + IIFE wrapping; appends -debug to version
npx gulp electron-rebuild  # build then launch Electron
```

`public/scripts.min.js` and `public/styles.min.css` are gitignored build artifacts — never edit them.

## Architecture quick map

The framework's three globals (`engine`, `app`, `content`) are described in the template doc. Pac-Man-specific code lives almost entirely under `content/` and `app/screen/`.

### `content/` modules

Loaded alphabetically by the Gulp glob, so any `content/*.js` can reference any other at *runtime* (IIFE bodies run during script parse, but most cross-references happen later via events or method calls). Specific files:

- **`maze.js`** — classic 28×31 grid parsed from an ASCII layout. Exposes `isPassableForPacman` / `isPassableForGhost` (the latter respects the ghost-house door), `eatDot`, `nearestDotByPath` (BFS used by the dot beacon and the F2 announcement), `isRestrictedUp` (the four no-up intersections), and the row-14 tunnel wraparound.
- **`pacman.js`** — entity with queued-direction movement (classic "pre-buffer the turn at the next legal tile"), per-level speed lookup via `pacmanFactor()` keyed off `content.game.state.level` plus current `eatSlowTimer` / `powerTimer` flags, and the cornering shortcut (within `CORNER_RANGE` of a tile center, motion happens on both axes simultaneously). Emits `eat-pellet`, `eat-power`, `pacman-death`, `pacman-step` (per tile crossed), and `wall-hit`.
- **`ghosts.js`** — four-ghost arcade AI: target-tile chasing, mode-change reverse, no mid-corridor reversal, no-up restricted intersections (scatter/chase only), per-level scatter/chase schedule, Cruise Elroy (Blinky's late-level speed-up + refusal to scatter), per-level normal/frightened/tunnel speed factors, and the dot-counter ghost-release system (per-ghost counters at level start; global counter activates on Pac-Man death until Clyde leaves; force-release timer if no pellet eaten for 3-4 s). Eaten ghosts return as fast eyes via corridors.
- **`game.js`** — top-level FSM (`intro → ready → play → death/levelClear/gameOver`) and scoring. Exposes `frightenDuration()` keyed off the per-level Pac-Man Dossier table (L19+ returns 0 = power pellets stop frightening, matching arcade).
- **`fruit.js`** — classic 70/170 dots-eaten triggers, per-level fruit table.
- **`audio.js`** — spatial-audio orchestration. Builds looping binaural props for ghosts/fruit/wall, runs the dot beacon (BFS-pathfinds every 1.5 s and emits a tick at the next path step toward the nearest dot), applies a global "behind" muffle (per-source lowpass driven by `behindness()`), and drives the listener pose from Pac-Man each frame. **Coordinate convention is non-obvious — see Gotchas below.**
- **`sfx.js`** — non-spatial one-shots: `chompA`/`chompB` (waka-waka), `eatPower`, `eatGhost`, `eatFruit`, `death`, `wallHit`, `footstep`, `extraLife`, `levelClear`, `introJingle`, plus menu blips. All synthesized via WebAudio; the file is the single source of truth for tweaking sounds.
- **`events.js`** — tiny pubsub used between content modules.
- **`wiring.js`** — listens for content events and triggers SFX (chomp alternation, footsteps, eat-power, ghost-eaten, fruit, life-lost, level-clear, etc.). Loaded last so all the listeners exist by `init()`.

### `app/screen/`

In addition to the standard screens (`splash`, `menu`, `game`, `pause`, `gameover`, `settings`, `learn`, `highscores`), there are two diagnostic screens:

- **`test.js`** — spatial-audio orientation check. Plays a tick at front / right / behind / left around a static east-facing listener. Reachable via `#test` in the URL or pressing **T** on the menu.
- **`music.js`** — preview screen for `content.sfx.introJingle` so you can iterate on the melody without starting a game. Reachable via `#music` or pressing **M** on the menu.

`screenManager.js`'s `none → activate` transition honors `window.location.hash` for these. Boot routes to `menu` by default (the splash screen exists in markup but is bypassed).

### In-game function keys

`app/screen/game.js` reads keys directly each frame (not via the `app.controls.ui()` delta) so they can be held without firing repeatedly:

- **F1** — speak score, lives, level, dots remaining
- **F2** — speak the nearest target with BFS path distance and a compass direction (matching the fixed top-down audio frame). Active fruit/bonus items take precedence over dots while they're on the board. The direction is always the BFS next-step (the actual move to make) in integer tile coords, so it always lands on a clean cardinal and is always navigable — never reports a direction that would walk the player into a wall
- **F3** — speak dots remaining for the level
- **F4** — speak percent of the current level completed (eaten / total dots)
- **1-9** — set Pac-Man's speed multiplier (debugging)
- **Esc** — pause

## Pac-Man-specific gotchas

### Audio coordinate frame

Syngen's binaural treats `+y = LEFT` (the LEFT monaural processor sees `relative + (0, -headWidth/2, 0)`, meaning the left ear sits at +y/2). Screen tile coords have `+y = south`, which is the player's *right* when facing east. Without compensation, screen-south plays from the player's left.

`content/audio.js` fixes this by negating y on every screen → audio crossing: in `tileToM()` (listener position), in the source half of `relativeVector()`, in the yaw computed by `updateListener()` (`atan2(-d.y, d.x)`), and in `behindness()`'s `dy`. After those flips, audio-space axes are: **`+x = front`, `+y = left`, `-y = right`**. The `#test` diagnostic route exists specifically to verify this stays correct after any change.

There's a fuller writeup of this gotcha (and a few others, including the `app.controls.ui()` delta double-firing on Enter and the audio context's first-gesture requirement) in `../template/CLAUDE.md` under "Gotchas worth remembering."

### Arcade rule fidelity

The ghost AI in `content/ghosts.js` is intentionally close to the arcade. Things that look weird are usually intentional: ghosts can't reverse mid-corridor, scatter/chase mode changes force a reverse on all non-frightened/non-eaten ghosts, the four no-up intersections (rows 11 & 23, cols 12 & 15) are deliberate, and Cruise Elroy keeps Blinky in chase even during the scheduled scatter intervals once the dot count drops past the level threshold. Per-level speed and frighten-time tables are sourced from the Pac-Man Dossier. Don't simplify these without checking what they're modeling.

### Listener state is sticky and gets clobbered by the game frame

`engine.position.setVector(...)` / `setQuaternion(...)` persist across frames. Diagnostic screens that need a fixed pose (like `test`) call `content.audio.setStaticListener(...)` once on enter and don't keep refreshing it. But the moment the `game` screen runs, `content.audio.frame()` overwrites both based on Pac-Man's pose. If you add a new screen that needs a static listener and it returns from `game`, re-apply the static listener on enter.

### `app/screen/game.js` reads keys two ways

Movement inputs go through `engine.input.keyboard.is('ArrowUp')` etc. (raw held state) and feed `content.pacman.setQueuedDirection`. Menu-style inputs (Esc, Enter, Space) go through `app.controls.ui()` (delta-style — only newly-pressed). The function keys (F1/F2/F3) use raw held state with their own per-key edge-detection flags (`f1Pressed` etc.) so a held key doesn't spam announcements.

## Conventions

- See `../template/CLAUDE.md` for the framework conventions (no module system, screen base class, CSS class prefixes, persisting state through `engine.state`). Those all apply unchanged here.
- Game state that should survive a save/load round trip lives in `content.*.state` and is exported via `engine.state.export()` — but autosave/import wiring for the live game is light right now; most state is rebuilt on level start.
