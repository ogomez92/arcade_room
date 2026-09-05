# SKITTER — Game Design Document

## Pitch

An audio-first, blind-accessible **Centipede** (Atari, 1981). A segmented
creature crawls in from the top of a column grid and winds down toward your gun
at the bottom; you slide the gun left/right and fire UP a column to break the
creature apart. Shoot the head and it shortens; shoot a middle link and it
SPLITS into two creatures that turn around. A link reaching your line costs a
life. Endless, escalating waves; score chase.

## The audio model (the whole game)

The plot is a grid of COLS columns × ROWS rows. Your gun sits below the bottom
row. Everything is in FRONT of you, descending:

- **Column → PAN (player-LOCKED).** The listener (your gun) faces up the grid
  with a fixed yaw — west is always your left, east always your right, and it
  never rotates. A column always sounds from the same place in the headphones.
- **Row → PROXIMITY.** A link ticks higher, louder, and (because the creature
  steps faster) more urgently the closer it gets to your line.
- **Head vs body → TIMBRE.** The leading **head** ticks bright and high; the
  trailing **tail** ticks soft and low, so you hear which way the creature heads.
- **Aim lock.** When a link sits in your current column you hear a clean lock
  beep — sweep until you hear it, then fire. This is the core accessibility aid
  for aiming the column axis by ear.

## Controls

- **Slide gun** — `Left` / `Right` (or `A` / `D`, numpad `4` / `6`, gamepad dpad).
  Tap for one column; hold to sweep.
- **Fire** — hold `Space` / `Enter` (gamepad A): fire up the current column,
  destroying the lowest link there. Rapid fire, capped by a reload cooldown.
- `F1` status · `F2` nearest link (column + part + proximity) · `F3` best combo ·
  `F4` gun column · `Esc` pause.

## Rules & scoring

- **5 lives.** A link reaching the bottom row breaches your line: −1 life, the
  rest of that creature escapes (the chain is removed), and your combo resets.
- **Score:** body link 10, head 25, × a combo multiplier (+1 every 8 kills).
  Combo resets only on a breach.
- Shooting a middle link **splits** the creature in two (the tail half turns
  around) — more targets, more pressure, but heads score more, so leading the
  creature and decapitating it is the efficient line.
- **Clear every link** to advance; the next wave is longer, faster, descends
  harder, and arrives in more chains. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

Classic Centipede gets its pressure from the mushroom field forcing rapid,
erratic descent; SKITTER replaces mushrooms (illegible by ear) with a steady
**`dropPeriod`** — the creature drops a row every N steps, not just at the walls
— plus a faster step rate, longer creatures, and more **chains** entering on a
**stagger** (so a wave's threat arrives in a wave, not one lethal burst). One
fast gun defends a slow single creature easily; several chains descending fast
across scattered columns eventually reach your line faster than you can sweep
and fire — that is what ends a run. Headless balance (`/tmp/skitter-sim.js`, a
tracking AI with perfect cell-knowledge): runs terminate, and score scales ~2.7×
from a sloppy player (~wave 18, ~140k) to a sharp one (~wave 27–63, ~380k) over
2–3.5 minutes. Real human runs sit lower, since a person must decode the audio.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — fixed gun at the bottom of a column grid; only
   slide left/right + fire up. Continuous real-time loop via the game screen's
   `onFrame` → `content.game.update(delta)`.
2. **Audio listener — PLAYER-LOCKED (fixed yaw).** `LISTENER_YAW = Math.PI/2`;
   links placed in the front hemisphere by column (pan) and row (proximity).
   Screen→audio y-flip per the template gotcha.
3. **Audio role — audio-first / blind-accessible.** Everything is playable by ear
   via the column/row/timbre cues + the aim-lock beep + two `aria-live` regions.
   The grid viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless score chase with escalating waves.** FSM: menu →
   game ↔ pause, game → gameover → menu; plus help, highscores, language, and the
   hidden `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (chittering insectoid head/body
   ticks, an energy crack that zips up the column, wet-pop/ceramic-crack kills, a
   skitter flourish on a split, a heavy breach alarm, a low nest-like ambient
   bed). No retro waves.
