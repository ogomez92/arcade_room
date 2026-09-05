# SALVO — Game Design Document

## Pitch

An audio-first, blind-accessible **last-stand turret shooter** (Robotron /
Smash TV lineage). You are a fixed gun at the centre of a ring. Enemies close in
from the eight compass bearings; you hear each one and gun it down before it
reaches you. Survive escalating, endless waves; chase a high score.

## The audio model (the whole game)

- **Player-LOCKED listener.** The listener is parked at the origin with a fixed
  yaw. North is always in front, east always right, south always behind, west
  always left — it never rotates. A bearing's sound is always the same place in
  the headphones, so you can fire at it by reflex.
- **Proximity blips.** Each enemy pings a short spatial blip from its bearing.
  The blip rises in pitch, gets louder, and repeats faster as the enemy nears
  (distance 1 → 0). The most urgent threat is naturally the loudest, highest,
  fastest blip. Sources to the south are lowpass-muffled for a front/back cue.
- **Three foes by timbre:** a steady mid **grunt** (1 shot), a fast high-pitched
  **rusher** (1 shot, kill it first), a slow low-growling **brute** (2 shots).
- Your gunfire, kills, and an enemy breaching the centre all sound from their
  bearing (the breach is a heavy central alarm).

## Controls

- **Assist fire** — `Space` / `Enter` (gamepad A): auto-target the nearest
  threat. The one-button, fire-by-ear path. Slower rate; never wastes a shot.
- **Directional fire** — numpad `8 9 6 3 2 1 4 7`, or the `Q W E / A D / Z X C`
  cluster (X = south), or arrows for the four cardinals. Faster rate, but a
  wrong bearing wastes the shot. The skill path.
- `F1` status · `F2` nearest threat · `F3` best combo · `Esc` pause.

## Rules & scoring

- 3 lives. An enemy reaching the centre costs a life and breaks your combo.
- Kill: grunt 10, rusher 25, brute 45, × a combo multiplier (+1 every 8 kills).
  Combo only resets on a breach — wasted shots cost the cooldown, not the combo.
- Clear a wave (destroy its whole quota) for a `50 × wave` bonus and the next,
  faster, denser wave. Endless.

## Balance (see `src/js/content/constants.js`)

The fire cooldown caps directional fire at ~5.5 shots/sec and assist at
~3.3/sec; brutes cost two shots, so real kill capacity is ~3.5–4/sec. The spawn
interval is driven below that around the mid-teens (plus burst spawns and rising
speed), so the swarm eventually out-paces even a perfect shooter — that
escalation is what ends a run. Headless simulation (`/tmp/salvo-sim.js`,
optimal-tracking AIs) lands idealized runs at:

| playstyle             | final wave | survive | score |
|-----------------------|-----------|---------|-------|
| directional, perfect  | ~17       | ~4.4 min| ~230k |
| directional, sloppy   | ~16       | ~4.3 min| ~200k |
| assist masher         | ~14       | ~4.0 min| ~130k |
| assist, casual        | ~12       | ~3.7 min| ~75k  |

Directional fire-by-ear beats the assist fallback on both survival and score;
real players (reaction lag, tracking eight bearings) land earlier — a 2–4 min
arcade run. Score is the leaderboard's skill differentiator (~2–3× spread).

## Design decisions (template's required questions)

1. **Perspective / movement** — fixed turret at the origin; no avatar movement,
   only aim/fire. Continuous real-time loop (`onFrame` → `content.game.update`).
2. **Audio listener — PLAYER-LOCKED, fixed yaw** (`LISTENER_YAW = π/2`). Enemies
   are placed on a ring by compass bearing; screen→audio y-flip per the template
   gotcha.
3. **Audio role — audio-first / blind-accessible.** The compass viz is
   `aria-hidden`; everything is playable by ear plus two `aria-live` regions.
4. **Input — keyboard + gamepad.** Mouse is unused (neutered like the rest of the
   collection).
5. **Persistence — high scores only** (local `app.highscores` + online
   leaderboard). Each run rebuilds from scratch.
6. **Progression — endless score chase** with escalating waves. FSM: menu →
   game ↔ pause, game → gameover → menu; plus help, highscores, language, and the
   hidden `#learn` / `#test` diagnostics.
7. **Synth aesthetic — modern / realistic** (filtered saw/square mechanical
   blips, highpassed-noise weapon cracks, sub-bass + bandpass-swept explosions, a
   low tense ambient bed). No retro waves.

## Online scores

Game id `salvo`, `display_order: desc`, `max_score: 9999999`,
`meta_schema: [{"key":"wave","type":"int","min":0,"max":999}]`. REGISTRATION
PENDING — `app/onlineScores.js` carries a placeholder secret; submissions fall
back to the local board until the id is registered at
`https://scores.gomsen.com/admin`. See `/home/scores/INTEGRATION.md`.
