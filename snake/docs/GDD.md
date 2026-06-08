# COIL — Game Design Document

## Pitch

An audio-first, blind-accessible **Snake** — the iconic arcade classic, absent
from the collection until now. You steer a serpent around a walled board, eating
food to grow longer and faster. The twist that makes it a game: your own
lengthening body becomes the maze you must not bite. Endless, escalating speed,
three lives, score chase. It is a real-time *action* game (reflex steering at high
speed) with a genuine spatial-planning skill (don't box yourself in).

## The audio model (the whole game)

SCREEN-LOCKED, head-relative, never-rotating: the listener rides the snake's head
at a fixed yaw — **Up is north and north is always ahead** in the audio, east is
right, south behind, west left. Steering and audio are both absolute, so nothing
rotates as you turn.

- **Food beacon.** A ping pans to the food's direction and rings higher / brighter
  the closer you are. Your goal: head for it.
- **The clearance "cage" (the core safety sense).** Each step, every BLOCKED
  neighbour — a wall or a piece of your own body — ticks a harsh note from its
  absolute direction (the rear, your neck, is skipped). An open board is quiet; as
  you coil, the ticks close into a ring around the head, so you steer to the silent
  side. The cage tightening is how you *hear* yourself running out of room.
- **Slither step.** A soft tick each move; its pitch rises as you lengthen and
  speed up, so the quickening pulse is the pace.

## Controls

- **Arrow keys / WASD** — turn (absolute: Up = north, always). You can't reverse
  straight back into your neck. The snake auto-advances.
- `F1` status · `F2` food direction + distance · `F3` which sides are blocked ·
  `F4` your heading · `Esc` pause.

## Rules & scoring

- **3 lives.** Running the head into a wall or into your own body costs a life;
  you respawn short (length 3) at the centre, keeping your score and speed.
- Each food eaten grows you one segment, speeds the pace up a little, and pays
  `foodPoints` — worth more the further along you are (`10 × (1 + eaten/5)`), so a
  long fast run compounds. Score = food eaten.
- Endless: the board never resets; only your speed climbs and your body lengthens.

## Difficulty curve (the balance knob — `content/constants.js`)

`stepFor(eaten)` shrinks the per-cell step from `STEP_START 0.36 s` toward
`STEP_MIN 0.12 s` (×`STEP_DECAY 0.972` per food), so the longer + faster you get,
the less time you have to read the cage and the less room you have to turn — that
squeeze is the bound. Headless validation (`/tmp/coil-sim.js`, an AI that steers
to the food, never into a blocked cell, and — scaled by skill — uses a flood-fill
to keep the most open space rather than greedily trapping itself): runs are
**bounded** (0/16 reach the cap — everyone eventually tangles across three lives),
clearly **winnable** (80–117 food eaten, length ~30–42 per life), with a monotonic
**skill→score gradient** (~7.2k at low skill → ~14.7k at high skill, ~2×). The
skill axis is the authentic Snake skill — spatial planning to avoid boxing
yourself in — which the flood-fill models directly, so the gradient reflects real
play, not a sim artefact.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — top-down 2D **tile grid**; the snake auto-advances
   one cell per step, you set the heading. Continuous loop via the game screen's
   `onFrame` → `content.game.update(delta)`.
2. **Audio listener — SCREEN-LOCKED, head-relative (fixed yaw, never rotates).**
   `LISTENER_YAW = Math.PI/2` (north = audio-front); sources placed at tile offsets
   relative to the head with the screen→audio y-flip per the gotcha. Movement and
   audio are both absolute (Up = north), so there is no rotation to map.
3. **Audio role — audio-first / blind-accessible.** Playable by ear via the food
   beacon, the blocked-neighbour cage, the slither step, and two `aria-live`
   regions. The grid viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse is unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless score chase (escalating speed).** FSM screens: menu →
   game ↔ pause, game → gameover → menu; plus help, highscores, language, and the
   hidden `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (a soft pitched slither tick, harsh
   saw/square blocked-cage ticks, a bright triangle food beacon, a juicy eat
   chomp, a low crash, a soft ambient bed). No retro waves.

## Possible future work

- **Obstacles / interior walls** on later boards, and **portals** (wrap-around
  edges) as a variant.
- **A "dwindling" bonus food** that's worth more if you reach it fast.
- **One-life classic mode** alongside the 3-life accessible default.
