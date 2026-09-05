# SKEET — Game Design Document

## Pitch

An audio-first, blind-accessible **clay-shooting gallery**. Clays launch and
streak across the sky in front of you; you sweep a gun to track each one by ear
and fire when your aim lines up. The fresh hook the collection didn't have:
**moving sound sources** — you track and time a panning, pitch-arcing whir, not a
fixed blip — plus a **continuous "sight" tone** that locks onto a live clay.
Endless, escalating rounds; score chase.

## The audio model (the whole game)

Everything is in the FRONT hemisphere; the listener faces the field and never
rotates (player-LOCKED, fixed yaw — left is always your left, right always your
right).

- **Clay position → PAN.** Each clay is a moving binaural source; its whir pans
  left/right as it crosses. Aim (a swept gun angle) is the only axis you steer.
- **Elevation → PITCH (+ height).** The whir's pitch rides the arc: low near the
  horizon, high at the apex, then falling — you literally hear the parabola.
- **Class → TIMBRE.** A steady **clay**, a fast high **streaker** (worth most), a
  slow lazy **lob**, and a soft cooing **dove** (a decoy — do NOT shoot it).
- **The sight tone.** A soft continuous tone pans with your gun. When your aim
  lines up with a *live* clay, a clean lock overtone swells — that is the
  green light to fire. Doves never produce a lock, so "no lock" warns you off a
  decoy. This is the core accessibility aid: track the whir, wait for the lock,
  fire.

## Controls

- **Sweep gun** — `Left` / `Right` (or `A` / `D`, numpad `4` / `6`, gamepad dpad).
  Held = continuous sweep; a sight tone pans with the aim.
- **Fire** — `Space` / `Enter` (gamepad A): the shot hits whatever live clay is
  lined up with the aim. Pump-action cooldown between shots, so time it.
- `F1` status · `F2` nearest clay (side + seconds left) · `F3` best combo ·
  `F4` aim position · `Esc` pause.

## Rules & scoring

- **5 lives.** A live clay crossing un-hit gets away: −1 life + combo reset.
  Shooting a dove: −1 life + combo reset. Letting a dove pass is correct (no
  penalty).
- **Score:** clay 15, streaker 30, lob 12, × a combo multiplier (+1 every 8
  hits). Combo resets on a whiff (fired, hit nothing), an escape, or a dove-shot
  — so **sustained accuracy is the score lever**, and that is where skill pays.
- **Clear a round** (all clays launched and gone, hit or escaped) for an `80 ×
  round` bonus and the next round: more clays, faster, closer together, more at
  once, more doves. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

The pump-action `FIRE_COOLDOWN` caps your fire rate, so a dense volley of fast
crossers eventually out-paces you and clays leak through — that is what ends a
run. But the dominant skill is **fire discipline**: alignment above ~0.36 of the
lock band guarantees a hit, so firing only on a tight lock means no whiffs and an
unbroken combo, while spraying breaks the combo and wastes pump cycles. Headless
balance (`/tmp/skeet-sim.js`, a tracking AI whose only difference is trigger
discipline): runs terminate, and score scales **~6×** from a sloppy player
(~round 7, ~3.4k) to a sharp one (~round 15, up to 24, ~20k), over 2.5–6 minutes.
Real human runs start in the lower band and climb with practice.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — fixed shooting stand; only sweep the gun left/
   right + fire. Continuous real-time loop via the game screen's `onFrame` →
   `content.game.update(delta)`.
2. **Audio listener — PLAYER-LOCKED (fixed yaw).** `LISTENER_YAW = Math.PI/2`;
   clays placed in the front hemisphere by pan (position) + z (elevation).
   Screen→audio y-flip per the template gotcha.
3. **Audio role — audio-first / blind-accessible.** Playable by ear via the
   moving whirs + the swept sight tone + the lock cue + two `aria-live` regions.
   The sky strip viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless score chase with escalating rounds.** FSM: menu →
   game ↔ pause, game → gameover → menu; plus help, highscores, language, and the
   hidden `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (bandpassed clay whirs with a pitch
   arc, a continuous swept sight tone with a lock overtone, a noisy shotgun
   report, a bright ceramic shatter on a hit, a wrong-buzzer for a shot dove, a
   whoosh-away for an escape, a calm outdoor wind bed). No retro waves.

## Possible future work

- **Driven birds from behind.** Some targets could launch from the rear quarters
  and arc overhead into the front arc (audible behind/muffled first), using the
  full player-locked sphere. The gun still only fires the front arc, so the rear
  audio is a telegraph. Left out of v1 to keep aiming legible.
