# CLAUDE.md — HAMMER OF GLORY!

Audio-first High-Striker / Strongman fairground game built on the
syngen-template. Pitch-matching mini-game: a target pitch plays, a
sweep then slides from low to high, the player slams the hammer at
the moment they think the slide matches the target. Score depends on
how close the captured pitch is to the target.

For all template-level patterns (build commands, screen FSM, i18n,
controls, audio coordinate frame, etc.) see the parent template
documentation in this file's history (or any sibling game's CLAUDE.md).
This file only documents what's specific to HAMMER OF GLORY.

## Game flow

```
splash → menu → game → gameover → highscores → menu
              ↘ learn / help / language ↗
```

Per-level phases inside the `game` screen (each level is a single
swing — there are no rounds within a level):

```
intro → target → slide → hammer → preview → reaction → (next round | gameOver)
```

- `intro` — Plays the fairground "Charge!" fanfare (G C E G — E G)
  exactly once at the very first round. Subsequent rounds skip it.
- `target` — A sustained reference tone of the target pitch (~1.5 s),
  pure sine with gentle ADSR.
- `slide` — A sawtooth+lowpass voice that sweeps **low → high → low**
  in a single phase across a **fixed** range:
  `SLIDE_LOW = A1 (55 Hz) → SLIDE_HIGH = C6 (1046.5 Hz) → A1`. The
  range is intentionally NOT target-relative — if it were, the
  target would always sit at the same fraction of the duration and
  the player could memorise the timing and press without listening.
  Fixing the range means the time-to-target depends on the target's
  pitch, so the player has to actually hear when the slide reaches
  it. The player gets two passes through any given target per level
  (one going up, one coming back down). Total duration shrinks each
  level (`6.0 → 1.5 s`, `−0.25 s/level`, floored). The player
  presses space/enter to **smash**, capturing the current slide
  frequency.
- `hammer` — Heavy mallet impact: a low sine glide-down + noise burst,
  ~250 ms. Brief pause for drama.
- `preview` — A second slide (with reverb) sweeps up to a pitch
  proportional to the score (0..1), representing the puck on the
  tower. ~1.6 s.
- `reaction` — Outcome SFX. **Only score == 100 rings the bell**
  (CLANG); 50–99 plays crowd cheer/applause variants scaled by score;
  <50 plays crowd "oooooh" boo + game over.
- Score is announced (assertive aria-live) and added to total.

## Scoring

Distance in semitones = `12 * |log2(captured / target)|`.

```
score = clamp(100 - distance * 50, 0, 100)
```

Bands (per spec):
| distance (semitones) | label        | score |
|----------------------|--------------|-------|
| 0                    | WOW!         | 100   |
| 1/4                  | super good   | 87.5  |
| 2/4                  | great        | 75    |
| 3/4                  | better hit   | 62.5  |
| 1                    | almost fail  | 50    |
| > 1                  | fail         | < 50  |

A round below 50 ends the run. 50+ continues with a faster slide.

## Levels

There is **no separate "round" counter**. The level itself is the run
counter — every survived swing advances the level by one, and every
level is harder than the last.

| level | target pool                                    |
|-------|------------------------------------------------|
| 1     | a random discrete note from C3..C4 (13 notes)  |
| 2     | a random discrete note from C3..C5 (25 notes)  |
| 3+    | any continuous frequency in C3..C5             |

The target floor is **C3 (130.81 Hz)**, deliberately above C2.
Sub-100 Hz on laptop speakers is mushy, gets masked by the slide
sawtooth running through the same band, and is harder for non-
musicians to lock onto. Keep targets in the C3..C5 register; if a
future change needs to widen the pool, expand upward (toward G5)
rather than downward.

Slide duration tightens **every level**:
`6.0 → 1.5 s, −0.25 s/level, floored`. The pitch pool widens at L2
and goes continuous at L3+, then stays continuous forever — only the
slide duration keeps shrinking.

The `1.5 s` floor is chosen so that even at the cap, the up-pass
takes 0.75 s across ~63 semitones (≈ 12 ms per semitone). A
±1-semitone window for "passes" (score = 50) is therefore ~24 ms,
i.e. ~1.5 frames at 60 Hz — essentially impossible without
clairvoyance, which is the point: the run will eventually end.

## Audio design (stereo / non-spatial)

Listener mode is **stereo / non-spatial**. The whole game is a
single-source experience (you're standing at the booth) so no
`engine.position`, no listener yaw, no binaural ear. Two buses on
top of `engine.mixer.input()`:

- `sfxBus` — one-shots (hammer, clang, target tone, slide, fanfare,
  whoosh).
- `crowdBus` — a slight stereo widening (left/right delay split via
  two `StereoPannerNode`s) so cheers/booos feel like a crowd around
  the booth, not a single mouth.

A separate `engine.mixer.reverb` send is used for the score-preview
sweep and the bell tail (per template main.js setup).

### Voices

- **Target tone** — sine at `targetFreq`, ADSR (0.05 / 0.9 / 0.5),
  peak ~0.45.
- **Slide** — sawtooth into a 24 dB lowpass that tracks pitch (cutoff
  `= 4×freq`). Exponential ramp `SLIDE_LOW → SLIDE_HIGH → SLIDE_LOW`
  over `slideDuration`, where `SLIDE_LOW = 55 Hz (A1)` and
  `SLIDE_HIGH = 1046.5 Hz (C6)` are **fixed constants** — the same
  every level. The capture frequency in `content/game.js` is
  computed via the same triangle: `p = 2*min(t, 1-t)` where
  `t = phaseT/slideDuration`, then
  `freq = SLIDE_LOW * (SLIDE_HIGH/SLIDE_LOW)^p`. Stops immediately on
  smash.
- **Hammer** — `playHammer(strength)`, four layers (click transient,
  body thump, two-partial metallic ring, crisp top click). All
  amplitudes scale by `strength`; the body's start frequency widens
  with strength too so heavier strikes have more chest.
  **Both hammers scale with the swing's score**, so the closer the
  swing was to a perfect 100, the harder both impacts hit:
  - Swing impact (in `captureAndAdvance`) — `strength = 0.3 + score/100 * 1.1`.
  - Launch impact (at start of `preview`) — `strength = 0.4 + score/100`.
  The function clamps `strength` to `[0.25, 1.4]`.
- **Preview sweep** — triangle into reverb send. Exp ramp from C2 to a
  target frequency `C2 * 2^(score/100 * 4)` (covers ~4 octaves at
  100). 1.6 s. Tail decays into reverb.
- **Bell clang (== 100 only)** — three inharmonic FM partials at 880 / 2200 /
  3300 Hz with exponential decay (0.3 / 0.6 / 1.4 s) and slight
  detuning. Sent into reverb. Stereo: partials panned mildly L/M/R.
- **Crowd cheer (50–99)** — bandpassed white noise with amplitude
  modulation that sounds like a clap/cheer texture (random ~10 Hz
  envelope) + a thin sawtooth pad on top for the "yeah" warmth. ~1.5 s.
- **Crowd boo / "oooooh" (<50)** — three detuned saw oscillators on a
  fundamental that glides from `~220 → 110 Hz` over 1.6 s, low LP
  filter, soft vibrato. Layered with a low rumble (sine 60 Hz).
- **Fairground fanfare (intro)** — square-with-detune trumpet voice
  (two saws +5/-5 cents through a band-pass at 1500 Hz) playing the
  "Charge!" motif. Notes scheduled at audio-clock times via
  `engine.synth.simple` lookahead so timing is exact.

### Per-round flow timing (rough)

| phase    | ~duration            |
|----------|----------------------|
| intro    | 2.4 s (round 1 only) |
| target   | 1.6 s                |
| slide    | round-dependent      |
| hammer   | 0.35 s               |
| preview  | 1.7 s                |
| reaction | 1.8 s                |

## Input

- **Space / Enter / Gamepad A** — smash the hammer (only meaningful in
  the `slide` phase; ignored otherwise).
- **F1** — announce score.
- **F2** — announce level.

**Never announce or display the target pitch.** It's the whole point
of the game — the player must memorise it by ear during the
target-tone phase. The HUD shows a generic "Target pitch" label, the
announcer says nothing on round start (apart from the level-up
sting), and there is intentionally no F4-style "reveal target"
hotkey. If you find yourself adding one for "accessibility", route
it through the learn-the-sounds screen instead so it's pre-game
vocabulary, not in-round cheating.

**Never make the slide range target-relative.** Same reasoning as
above: if the slide low/high are derived from the target, the target
always sits at the same fraction of the duration, and the player
can press at "25% of the way through" every round and ace the game
without listening. The slide range MUST be a fixed pair of
constants. If you want to make the game easier on level 1, do it by
extending the slide duration, not by narrowing the range to wrap
the target.

The mouse adapter is left enabled but does nothing in-game; the
template's pointer-lock behavior is harmless here. No `app.controls.game()`
integration — there's no continuous input.

## Persistence

- High scores (top 10) via `app.highscores` — dual backend (Electron
  file / `localStorage['hammer-highscores-v1']`). Entries store
  `{name, score, level}`.
- `app.autosave` is **disabled** in `main.js` — there's no in-progress
  save state worth restoring, and the high score table is its own
  storage path.
- Locale via `localStorage['hammer.lang']` resolved before
  `app.storage.ready()` (template pattern).

## Notable patterns used

- **Audio-clock scheduled lookahead** for the intro fanfare and bell
  partials. Don't fire notes via `setTimeout` — they jitter.
- **Re-read identical strings** in announce (polite re-set is helped by
  ping-pong via `''` then real value next frame).
- **Two aria-live regions**, polite (round score, level up) and
  assertive (game over, F1–F4 hotkey readouts).
- **Try/catch in `onFrame`**, every screen.
- **Lazy cross-module references** (`const G = () => content.game`)
  inside functions that touch sibling modules.
- **Disable autoplay-on-mount audio** — the game screen waits a frame
  before starting the round so the WebAudio context is unlocked from
  the user's click.
