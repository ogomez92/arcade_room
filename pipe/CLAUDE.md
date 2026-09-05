# CLAUDE.md — Pipe

A remake of **Pipe 1.0** (BSC / Dansoft, 2002) as an accessible audio game on
the syngen template. Plumber Joe fits leaking pipes against a draining-water
timer, dodging bees, bats, and Spanky the dog, across three cities (difficulties)
of twelve levels each, with a stereo pitch-matching bonus round. Demo/unlock and
score-charts-by-mail are intentionally dropped.

This file is the game-specific guide. For engine/template internals (syngen API,
screen FSM, storage/updates, i18n mechanics, audio gotchas, multiplayer), see
**`../template/CLAUDE.md`** — it is the canonical reference and is not duplicated
here.

## Design decisions (locked)

| Question | Choice | Why |
|---|---|---|
| Audio listener | **Stereo / non-spatial** | The original placed enemies and bonus items in the L/C/R stereo field; no binaural. `StereoPannerNode` per voice. |
| Synth aesthetic | **Modern synth** | Filtered triangles/sines, soft tails; closer to the original's recorded feel than chiptune. |
| Scope | **Full game** | All three cities, both bonus rounds, all enemy/trip events, full scoring. |
| Persistence | **Local top-10 + central leaderboard** | Mirrors the original's online BSC charts via `scores.gomsen.com`. |
| Input | Keyboard only | Desktop and laptop layouts (laptop tests with `/`). |

## Build

Secure host: use **pnpm / pnpx** (plain npm/npx are disabled).

```sh
pnpm install
pnpx gulp build            # public/scripts.min.js + styles.min.css
pnpx gulp build --debug    # unminified, no IIFE wrap (readable for debugging)
pnpx gulp watch
```

Do not run a dev server here — this folder is served independently; stop at the
build/static check. A headless sanity check that catches wiring/reference errors
without a browser: build `--debug`, then run the bundle under DOM/syngen stubs in
Node (see the smoke harness used during the initial build — stub `window`,
`document`, `localStorage`, and a deep callable `syngen` proxy, `eval` the
bundle, and confirm `main()` boots without throwing).

## Architecture

Three globals as usual (`engine` = syngen, `app` = UI scaffolding, `content` =
game). Concatenated by `Gulpfile.js`; cross-module refs are **lazy arrow
getters** because concat order is alphabetical.

### content/ (game logic)

- **`config.js`** — all static tables. `difficulties` (usa/canada/spain),
  per-level scaling `level(L)`, `scoring` constants, `BONUS_AFTER = [4, 8]`.
  Difficulty records carry an i18n `labelKey`, never a rendered name.
- **`audio.js`** — stereo synth. Graph: voice → gain(ADSR) → `StereoPanner` →
  sfx/music bus → `engine.mixer.input()`. `engine.context()` is the
  AudioContext. `stereoSign` (±1, from the speaker test) flips pan for reversed
  speakers. Loops (`startWater`/`setWaterUrgency`, `startEnemy`/`setEnemyPan`,
  `startBeep`, `startMusic`) are handles; `silenceAll()` kills them all. Optional
  `speak()` (SpeechSynthesis) is gated by the `useTts` setting.
- **`game.js`** — the core phase machine (one object `s`, no per-phase screens).
  Phases: `intro → fit → (slide|autoslide) → [enemy|trip|respawn] → levelClear →
  (bonus) → … → gameover`. The game screen forwards edge-triggered key actions to
  `onKey(action)` and time to `frame()`. On game over it stashes `result()` and
  dispatches the `gameover` screen.
- **`bonus.js`** — the bonus round; owns `onKey`/`frame` while `game` phase is
  `bonus`, calls back `onDone(items, points)`.
- **`scores.js`** — local top-10 per difficulty (localStorage, survives
  `state.reset`) + central leaderboard client (HMAC-signed, per
  `/home/scores/INTEGRATION.md`).

### app/ (screens + infra)

`announce.js` (two aria-live regions, polite/assertive, ping-pong re-read),
`settings/pipe.js` (registers speakPipeNumbers, backgroundMusic, useTts,
swapStereo, keyboardLayout), and screens: `menu`, `city`, `game`, `gameover`,
`highscores`, `learn`, `training`, `speakertest`, `settings`, `language`. Menu
screens follow the template's click-handler + `app.controls.ui()` pattern; the
`game` and `training` screens instead install their own window-level
keydown/keyup handler (held-codes Set for edge detection, preventDefault on game
keys + F1/F3/F5).

## Manual → parameters

`config.level(L)` for L in 1..12 (manual section 5/7/10):

- toolbox 3→7, total pipes 10→20, hammer hits 3→7, water 12s→4s, enemy react
  3s→1s, event chance 0.15→0.55.
- Difficulty: USA 3 lives / auto-slide / 1 avoid-press / 5000 max-pts/pipe /
  bonus 10; Canada 3 / manual-slide / 2 / 6000 / 12; Spain 5 / manual-slide / 3 /
  8000 / 14.
- Scoring: −500·s/level-equivalent drain over 10s, +1000 sub-second bonus, level
  clear 30000, perfect 15000, enemy avoided 5000, killed −50000, drenched
  −30000, wrong-hammer scream −2000 and halves the pipe's reward. Bonus item
  6000 + 200·n.

## Controls (in-game)

Up/Down cycle the toolbox; Enter or `/` test the selected pipe; Ctrl hammers /
avoids an animal (after the beep) / regains balance / grabs a bonus item / skips
intros; Left/Right slide to the next pipe (Canada/Spain) and move in trip-recover
and the bonus round; Shift reads level+score (double-tap = score digit-by-digit);
Tab reads lives + pipes left; Alt pauses (only while water is gushing); Escape
quits to the menu.

## Leaderboard registration (follow-up — required for online scores)

`content/scores.js` has three game ids — `pipe_usa`, `pipe_canada`, `pipe_spain`
(one per original BSC chart) — with **blank secrets**, so it runs **local-only**
until configured. To enable online:

1. In the scores admin (`https://scores.gomsen.com/admin`), register each id
   with `display_order: desc`, a realistic `max_score` (USA ~3M, Canada ~4M,
   Spain ~6M given 12 levels), and `meta_schema:
   [{"key":"level","type":"int","min":0,"max":12}]`.
2. Paste each returned secret into the `REMOTE` map in `content/scores.js`.
3. `pnpx gulp build`.

Do **not** post test scores to the live board during development (it's shared and
public) — validate signing locally if needed. The secret is obfuscation, not
crypto (threat model in `/home/scores/INTEGRATION.md`).

## Gotchas specific to Pipe

- **Stereo, not binaural.** Never reintroduce `engine.position`/`ear.binaural`;
  position is pan only. The speaker test sets `swapStereo`, applied as
  `audio.setStereoSign(±1)`.
- **One phase machine, not many screens.** Bonus runs inside the `game` screen
  via delegation — don't split it into its own screen or you'll have to juggle
  score/lives across transitions.
- **Game keys bypass `app.controls`.** The game/training screens read raw window
  keydown so Ctrl/Shift/Tab/Alt work; remember to add/remove the listener in
  `onEnter`/`onExit` and `content.audio.silenceAll()` on exit.
- **Reverb send is off** (`main.js`) — cues author their own tails. Re-enabling it
  will smear every one-shot.
- **Locale-stable values:** results store `diffId`, announcements use i18n keys,
  so switching language mid-game (or on the game-over screen) stays coherent.
