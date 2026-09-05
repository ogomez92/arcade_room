# TREAD — Game Design Document

## Pitch

An audio-first, blind-accessible **tank battle** (Battle City lineage). You drive
a tank on a grid; enemy tanks roll in and push toward your BASE, shooting brick
out of the way and firing at you when they line up. You line up with them (same
row or column, clear lane) and fire to destroy them, DODGE their telegraphed
return fire by stepping off the line, and stop them breaching the base. The
collection's fixed shooters never let enemies shoot back or gave you a point to
defend — TREAD's mobile, dodge-and-defend loop is the fresh hook.

## The audio model (the whole game)

SCREEN-LOCKED, player-relative, never-rotating: the listener rides your tank with
a fixed yaw — north is always ahead, east right, south behind, west left — and
steering is absolute (Up = drive/face north).

- **Enemy tanks** blip from their bearing (faster + louder as they near; a sharper
  timbre when they have you lined up).
- **The aim tell** — a rising note from an enemy that has you on its row/column —
  is your warning to step off that line before its shell crosses.
- **Incoming shells** whistle as they travel toward you.
- **The base** hums from its direction (urgent when threatened) so you always know
  where home is and can race back to intercept.

## Controls

- **Arrow keys / WASD** — drive and face (absolute: Up = north). Pressing into a
  wall just turns you in place (to aim).
- **Space** — fire down your facing. Only one of your shells is in flight at a
  time, so line up on a tank's row or column first.
- `F1` status · `F2` nearest tank · `F3` the base · `F4` your facing · `Esc` pause.

## Rules & scoring

- **3 lives + a base with HP.** An enemy shell hitting you costs a life (respawn
  with brief invulnerability). A tank reaching the base or an enemy shell hitting
  it costs **1 base HP** (the base survives `BASE_HP` breaches, refreshed each
  wave); at 0 the base falls and it's game over — as is losing all three lives.
- A kill pays `KILL_POINTS × a combo multiplier`. Clearing a wave pays
  `200 × wave`.
- **Clear the wave's tanks** → a tougher one: more tanks, more at once, faster,
  firing sooner. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

`waveConfig(wave)` raises the tank count + how many press at once, speeds their
advance and fire, and shrinks their aim telegraph. The base sits behind a brick
shell so a breach takes several enemy actions (your window to intercept), and
`BASE_HP` gives margin so one leak isn't instant death. Headless validation
(`/tmp/tread-sim.js`, an AI that targets the tank nearest the base, aligns and
fires, and steps off the line only for *imminent* shells — aim + dodge reliability
scaled by skill): runs are **bounded** (0/20 reach the cap — you're eventually
shot out or the base falls in the late waves), clearly **winnable** (8–9 waves,
66–79 kills, ~2.5 min), with a monotonic **skill→score gradient** (~36k at low
skill → ~60k at high skill, ~1.7×). The sim's reliability knob is a crude proxy
for the real skills — positioning to intercept, target prioritisation, dodge
timing and clean line-ups — so a human's score range is wider than the sim's.
(A tuning note worth keeping: an over-eager dodge that abandons offence for every
distant/aiming threat *inverts* the skill curve — the AI must dodge only imminent
shells, or more "dodging skill" makes it worse.)

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — top-down 2D tile grid; drive + face + fire.
   Continuous loop via the game screen's `onFrame` → `content.game.update(delta)`.
2. **Audio listener — SCREEN-LOCKED, player-relative (fixed yaw, never rotates).**
   `LISTENER_YAW = Math.PI/2` (north = audio-front); sources at tile offsets
   relative to your tank, screen→audio y-flip per the gotcha. Steering + audio
   are both absolute (Up = north), so nothing rotates.
3. **Audio role — audio-first / blind-accessible.** Playable by ear via enemy
   blips, the aim tell, shell whistles, the base hum, and two `aria-live` regions.
   The grid viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse is unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless waves / score chase.** FSM screens: menu → game ↔
   pause, game → gameover → menu; plus help, highscores, language, and the hidden
   `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (sawtooth/square tank engines, a
   rising aim tell, highpassed gun cracks, sub-bass kill bursts, a wobble shell
   whistle, brick crumble, a base hum + breach alarm, a battlefield rumble bed).
   No retro waves.

## Possible future work

- **Tank types** (a fast scout, an armoured one that takes two hits, one that
  drops a smoke-screen) for target-priority variety.
- **Power-ups** dropped by the odd tank (rapid fire, a shovel that re-bricks the
  base, a freeze).
- **Destructible/!regenerating cover** and steel walls you can route shots around.
