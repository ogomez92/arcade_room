# ROVER — Game Design Document

## Pitch

An audio-first, blind-accessible **moon-buggy side-scroller** (Moon Patrol
lineage). Your rover auto-scrolls across the lunar surface; hazards approach from
ahead and you JUMP craters, JUMP-or-SHOOT rocks, and SHOOT-UP the UFOs before they
reach you. Endless, escalating; three lives; score = distance + kills. It is the
collection's first game to fuse *platformer jumping over terrain* with *shooting*
in a *side-scroller* — hitting three of the requested genres at once, and distinct
from Strafe (pure lane-shooter, no terrain/jump) and Bound (pure jump/duck, no gun).

## The audio model (the whole game)

SIDE-VIEW, NON-ROTATING stereo: there is no binaural head. Position is carried by
stereo **PAN** (a hazard far ahead sits to the right and slides toward centre as it
arrives at the buggy; already-passed is to the left) and by **PITCH** (ground
hazards low, air hazards high). Each type has its own timbre.

- **Crater** — hollow, low, airy (a gap). JUMP only; cannot be shot.
- **Rock** — solid, gritty, low-mid. JUMP over it OR forward-shot.
- **UFO** — warbly, high. UP-shot only; jumping does not help.
- Each hazard **blips faster + louder as it nears**; a sharp **"act-now" tick**
  fires the instant it enters your action window (jump or shoot then). A low engine
  rumble rises in pitch with your speed.

## Controls

- **Space / W** — JUMP. Airborne briefly, then you must land (a short grounded
  recovery) before re-jumping, so you can't just hold it — time each jump.
- **Right arrow / J** — fire the cannon FORWARD (nearest rock ahead).
- **Up arrow / K** — fire the cannon UP (nearest UFO).
- `F1` status · `F2` nearest ground hazard · `F3` nearest UFO · `F4` cannon + jump
  state · `Esc` pause. Gamepad: A = jump, B = forward, X/Y = up, Start = pause.

## Rules & scoring

- **One shared cannon** with a cooldown (`SHOT_CD`): you aim it forward or up, so a
  tight cluster of UFOs (which can't be jumped) eventually outpaces it.
- Miss a hazard you didn't handle → you wreck, losing a life (brief invulnerability
  on recovery, immediate hazards cleared). **3 lives.**
- Score: distance ticks up as you roll (`DIST_POINTS`/unit), plus `CLEAR_POINTS`
  for jumping a hazard cleanly and `KILL_POINTS × combo` for shooting one. Combo
  chains across clears + kills and breaks on a crash.
- **Endless, escalating.** Every 20 s the SECTOR ticks up: faster scroll, tighter
  spacing, and more rocks + UFOs.

## Difficulty curve (the balance knob — `content/constants.js`)

`difficultyFor(elapsed)` raises `speed` (continuously, capped), tightens `minGap`
(spacing between hazards), and shifts the type `weights` toward rocks + UFOs. The
bound is structural: the shared cannon cooldown caps how many UFOs you can down per
second, and the jump's airtime + grounded-recovery caps crater throughput — so once
the spacing/mix demands more than that, a hit is unavoidable. Headless validation
(`/tmp/rover-sim.js`, a competent AI that jumps craters, shoots rocks/UFOs
cooldown-limited, times jumps to be airborne on arrival, and blunders a hazard now
and then — more at low skill / high speed): runs are **bounded** (0/25 reach the
cap — everyone wrecks), **winnable** (~1000–2400 m, sectors 2–4, ~40–75 s), with a
strong monotonic **skill→score gradient** (~6k → 13k → 33k, ~5.5×; kills 24 → 42 →
70). The gradient is steep because survival compounds distance + kills + combo, and
the blunder rate ties directly to skill — a clean, first-pass balance (no
non-monotonicity to chase, unlike the previous build).

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — side-view 2D auto-scroller; the buggy holds a fixed
   screen position, hazards approach (each has a `dist` that falls at the scroll
   speed). Continuous loop via the game screen's `onFrame` → `game.update(delta)`.
2. **Audio listener — SIDE-VIEW STEREO, NON-ROTATING.** No binaural; a
   `StereoPannerNode` per voice carries pan (ahead = right → centre on arrival),
   pitch carries the ground/air lane. Nothing rotates — ahead is always right.
3. **Audio role — audio-first / blind-accessible.** Playable by ear via the
   per-hazard approach blips (timbre = type, pitch = lane, pan = distance), the
   act-now tick, and two `aria-live` regions. The track viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless run / score chase.** FSM screens: menu → game ↔ pause,
   game → gameover → menu; plus help, highscores, language, hidden `#learn` /
   `#test` routes.
7. **Synth aesthetic — modern / realistic** (a continuous saw+noise engine rumble
   that tracks speed, hollow crater tones, gritty rock saws, a warbling UFO with an
   LFO, highpassed cannon cracks, sub-bass crash). No retro waves.

## Possible future work

- **Speed control** (accelerate / brake) to time hazards — Moon Patrol's signature
  extra axis (left out of v1 to keep the action window readable by ear).
- **Bombs** dropped by UFOs that crater the ground ahead (a chain you must then jump).
- **Checkpoints / terrain stretches** for a course structure over the endless run.
