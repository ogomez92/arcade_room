# TALON — Game Design Document

## Pitch

An audio-first, blind-accessible **Joust** (Williams, 1982). You ride a flying
mount: FLAP to fight gravity and steer your altitude, and unseat enemy riders by
MEETING each one at its own height the instant it reaches you. The collection had
no flying game and no altitude-vs-altitude contest — TALON's core is a brand-new
audio mechanic: match your continuous wing-tone's pitch to an incoming rider's
pitch. Endless, escalating waves; three lives; score chase.

## The audio model (the whole game)

PLAYER-LOCKED listener (fixed yaw, never rotates): riders close in from the eight
compass bearings — north ahead, east right, south behind (muffled), west left.

- **Your wing-tone** is a continuous tone whose PITCH is your ALTITUDE — it rises
  as you climb. Always-on self-reference.
- **Each rider** blips from its BEARING (pan) at a PITCH equal to ITS altitude,
  quickening as it closes. As a clash nears, the blip turns **bright** when you
  are matched (at its height) or **harsh** when you are not — so you climb or ease
  down to put your wing-tone onto its pitch.
- **The clash (matching, not "higher wins"):** meet a rider within a forgiving
  band of its altitude and you UNSEAT it (score); too high OR too low and it
  unseats YOU. There is no safe altitude — a low swooper needs you low, a high
  soarer needs you high — so you are always adjusting.
- **Riders by ear:** a low fast **swooper**, a mid **glider**, a high slow
  **soarer** (its blip pitch tells you how high to climb).

## Controls

- **Flap** — tap `Space` / `Up` (gamepad A): each beat lifts you; gravity pulls
  you back, so tap to climb, stop to glide down. Steer your wing-tone onto the
  rider's pitch.
- **Evade** — `Shift` / `Enter` (gamepad B): comb a rider you cannot match in
  time. The helm needs a moment to answer again.
- `F1` status · `F2` nearest rider (bearing + above/below/level) · `F3` best
  combo · `F4` altitude + stamina · `Esc` pause.

## Rules & scoring

- **3 lives.** A rider you fail to match (or evade) unseats you: −1 life, combo
  reset. Unseat a rider for its points × a combo multiplier (+1 every 6).
- **Stamina** refills slowly and is spent per flap — generous, so it only
  punishes frantic over-flapping; matching is the real challenge. Out of stamina,
  a flap gives no lift and you sink.
- **Clear a wave** for a `60 × wave` bonus and the next: more riders, faster, in
  bigger crowds at mixed altitudes you cannot all reach in time. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

Early waves send a few riders you can match one by one; late waves close fast
enough that arrivals BUNCH at mixed altitudes — you can match one and evade one
per cooldown, but a dense crowd exceeds that and overwhelms you. Flight is gentle
(`GRAVITY 1.5`, `FLAP_V 0.72`) so an altitude can be held and fine-tuned by ear,
and the match band (`MATCH_TOL 0.18`) is forgiving. Headless validation
(`/tmp/talon-sim.js`, a hover-to-match AI): runs are **bounded** (0/24 reach the
cap — everyone is overwhelmed around wave 14, ~5 minutes) and clearly **winnable**
(~140 unseats per run). The sim AI's outcome is roughly flat across its crude
"skill" knob because it cannot model the real skill — matching each rider's
altitude precisely by ear and prioritising under crowd pressure — so human skill
will spread the score far more than the sim suggests (as with `bound`).

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — fixed origin; your only state is ALTITUDE
   (flap-against-gravity). Riders approach on a ring by bearing. Continuous loop
   via the game screen's `onFrame` → `content.game.update(delta)`.
2. **Audio listener — PLAYER-LOCKED (fixed yaw).** `LISTENER_YAW = Math.PI/2`;
   riders placed on a ring by bearing (pan); altitude is pitch. Screen→audio
   y-flip per the gotcha. (Reuses salvo's compass ring + viz.)
3. **Audio role — audio-first / blind-accessible.** Playable by ear via the
   continuous wing-tone, rider blips (pan + pitch + matched/threat timbre), and
   two `aria-live` regions. The compass viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless score chase with escalating waves.** FSM screens:
   menu → game ↔ pause, game → gameover → menu; plus help, highscores, language,
   and the hidden `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (a continuous altitude wing-tone,
   wing-beat whooshes, rider blips with a bright "locked" fifth or a harsh
   dissonant "not-matched" beat, a clash/tumble on an unseat, a heavy hit, an
   airy sky bed). No retro waves.

## Possible future work

- **Eggs**: an unseated rider drops an egg that hatches into a tougher rider
  unless you collect it — classic Joust depth (needs a horizontal-position axis).
- A clearer **skill ramp** if playtests show the score spread is too narrow —
  e.g., a tighter match band at higher waves, or bonus for pixel-perfect matches.
