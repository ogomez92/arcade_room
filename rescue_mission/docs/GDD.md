# AIRLIFT — Game Design Document

## Pitch

An audio-first, blind-accessible **rescue-chopper game** (Choplifter lineage). You
fly a rescue helicopter along a strip, hover over stranded survivors to winch them
aboard, and ferry them home to base — while ground tanks shell you from below.
Clear every survivor in a wave to advance; endless, escalating; three lives. The
collection's first **rescue / carry / deliver** loop — distinct from every shooter
and runner in it.

## The audio model (the whole game)

SIDE-VIEW, NON-ROTATING stereo: there is no binaural head — the listener rides the
chopper, and every source is carried by stereo **PAN** (its x relative to you;
left stays left, right stays right) and by **PITCH / timbre**.

- **Survivors** chirp a warm beacon from their direction, brighter as you get right
  over them (your cue to stop and winch).
- **Base** hums off to your left (it's the left edge); more insistent when you're
  carrying — a "bring them home" pull.
- **Tanks** rumble low from their column; each plays a rising **aim tell**, then a
  **climbing shell** when it fires — be off that column when it tops out.
- A pulsing **rotor bed** runs underneath (a touch faster while you move).

## Controls

- **Left / Right** (or **A / D**) — fly. You hover in place the instant you stop.
- Hover STILL over a survivor (don't move) for `HOVER_TIME` to winch them aboard —
  up to `CAP` at once. Reach BASE (fly left) to deliver the whole load.
- **Space / Down** — drop a bomb straight down; destroys any tank in your column.
  Bombs are limited (`BOMB_AMMO_START`, +`BOMB_AMMO_PER_WAVE` each cleared wave).
- `F1` status · `F2` nearest survivor · `F3` nearest tank · `F4` load + survivors
  left + base direction · `Esc` pause.

## Rules & scoring

- **3 lives.** A tank shell that tops out within `HIT_RADIUS` of your column costs
  a life (brief invulnerability after).
- Delivering a **full load at once** pays a stacking bonus (`deliverBonus`: 1→80,
  2→240, 3→480), so brave runs (carry more before heading home) beat one-at-a-time
  ferrying. Bombing a tank pays `TANK_POINTS`; clearing a wave pays `waveBonus`.
- **Clear every survivor in the wave** → next wave: more survivors farther out,
  more + faster + denser tanks. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

`waveConfig(wave)` grows the survivor count, the tank count (until their narrow
hit-columns crowd the strip into a gauntlet), their fire rate, and shrinks the aim
telegraph. **Bombs are the key bound**: they're limited, so you can't simply level
the field — once your ammo runs dry, the late-wave gauntlet has to be threaded by
dodging alone. Headless validation (`/tmp/airlift-sim.js`, an AI that fills to
capacity before delivering, bombs tanks it passes while ammo lasts, and — modelled
per aim-event, not by over-dodging — gets clear of a shell aimed at its column with
a skill-scaled probability): runs are **bounded** (0/25 reach the cap — everyone is
shot down), **winnable** (~33–45 survivors, waves 6–8, ~2–3 min), with a monotonic
**skill→score gradient** (~9k → 11k → 13k, ~1.4×). The sim's single avoid-roll is a
floor on the real skill — routing, ammo management, and *when to risk* a
tank-guarded rescue widen a human's range.

### Design notes worth keeping (hard-won)

Two structural fixes turned this from broken to clean. **(1) Unbounded → bounded:**
the first build let you bomb the whole field freely and dodge a lone tank trivially,
so nobody ever died (25/25 survived the cap, flat). Limiting bombs to **ammo** + a
**narrow hit-column** (`HIT_RADIUS` 3.5, so a dense tank line still leaves gaps to
dodge into, but you can't clear them all) made the late gauntlet lethal. **(2)
Non-monotonic → monotonic:** scaling *dodge frequency* by skill made the "expert"
over-dodge — abandoning hovers/rescues to sidestep — and score *less* than a
middling player (the same trap seen in Tread and Floe). The fix is the Rover model:
the AI is fixed-competent (always pursues rescue + bombs guards) and skill is rolled
**once per aim event** (clear this shell, or eat it), tying skill straight to
survival without starving the objective.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — side-view 1-D strip; fly left/right, hover to
   pick up, bomb down. Continuous loop via the game screen's `onFrame` →
   `game.update(delta)`.
2. **Audio listener — SIDE-VIEW STEREO, NON-ROTATING.** No binaural; a
   `StereoPannerNode` per voice carries pan (source x relative to the chopper;
   left stays left), pitch/timbre carries type. Nothing rotates.
3. **Audio role — audio-first / blind-accessible.** Playable by ear via survivor
   beacons, the base hum, the tank aim-tell + climbing shell, the winch + deliver
   chimes, and two `aria-live` regions. The strip viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless waves / score chase.** FSM screens: menu → game ↔
   pause, game → gameover → menu; plus help, highscores, language, hidden `#learn`
   / `#test` routes.
7. **Synth aesthetic — modern / realistic** (warm survivor beacons, a low base
   hum, sawtooth tank rumble + a rising aim tell + a climbing-shell tone, a
   highpassed bomb + sub-bass impact, a pulsing rotor bed). No retro waves.

## Possible future work

- **Jets** (a second, airborne threat that strafes along your altitude) for a
  shoot-forward axis on top of the bomb-down.
- **Survivors in peril** (a tank shelling a survivor group you must reach in time).
- **Altitude** as a real axis (descend to winch, climb to clear fire) if it can be
  conveyed cleanly by ear.
