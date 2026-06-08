# Approach — Game Design Document

## One line
Audio-first air-traffic control: you are the tower, every plane is a sound, land them all before they run dry — and keep them apart.

## Pillars
- **Think under pressure, not twitch.** The action is in juggling many converging flights; the depth is in *sequencing* and *spatial reasoning by ear*. No reflex test, but never idle.
- **The airspace is heard, not seen.** Spatial audio is the gameplay, not decoration. A sighted player and a blind player play the exact same game.
- **Two clean failure modes.** Collision and fuel-out. Everything in the design serves the tension between "keep them apart" and "land them in time."

## The fantasy
A radar room. Planes check in from the edges of your scope, each an engine note placed where it actually is — north ahead, east right, south behind (and muffled), west left. You talk to one at a time: turn it, send it straight in, clear it to land, or tell it to hold. The runway takes one plane at a time, so you're always deciding *who's next* while keeping the rest safely spread out and watching the fuel.

## Core loop
1. A plane arrives at a radar edge on an inbound heading, with a fuel load.
2. You **select** it (Tab) and hear it foregrounded.
3. You **steer** it (turn / direct-to-field) or **hold** it to buy time.
4. When the approach corridor is clear, you **clear it to land**; it vectors to the centre and touches down for points.
5. Meanwhile more planes arrive faster than before. Keep every pair apart; keep every tank above empty.
6. A mid-air collision or a fuel-out ends the shift. Score = planes landed (+ fuel-efficiency bonus per landing).

## Controls (keyboard, cycle + command)
| Key | Action |
| --- | --- |
| `Tab` / `Shift+Tab` | Select next / previous plane (selected = louder + brighter) |
| `Left` / `Right` | Turn the selected plane 30° |
| `Up` | Vector it straight at the field |
| `L` / `Enter` | Clear it to land (one approach at a time) |
| `H` | Hold (orbit in place) |
| `Space` | Read selected plane: bearing, distance, fuel |
| `R` | Read shift status: airborne / landed / score |
| `P` / `Esc` | Pause / back to menu |
| `F1` / `F2` | Redundant status reads |

## Rules that make it work
- **Single runway, one approach at a time.** Clearing a second plane is refused while one is on approach. This is the scheduling spine and it dissolves the "everyone flies to the centre and collides" paradox.
- **Final approach is a protected corridor.** Once a cleared plane is inside the final-approach radius it is exempt from separation, so the landing plane can pass through the busy centre without a false collision.
- **Planes can't leave radar.** At the boundary they bank back in. So you can never lose a plane by "letting it fly off" — only by collision or fuel-out, the two intended pressures.
- **Fuel is the clock.** Holding is safe spatially but spends fuel; a low-fuel plane warbles with rising urgency. You're always trading separation safety against the fuel clock.

## Audio design
- **Listener:** screen-locked, pinned at the tower (yaw fixed north). Binaural + a dominant stereo-pan path per voice.
- **Plane voice:** a continuous engine drone (detuned saws + turbine whine + airflow + prop-chop tremolo), per-plane pitch jitter for identity, distance-attenuated gain, behind-muffle south of the tower. Selected = brighter; low fuel = warning-beep warble.
- **Cues:** inbound radio chirp (arrival), soft blip (select), rising "roger" (command ack), low double-buzz (refused), klaxon (conflict warning), tyre-chirp + ascending chime (touchdown), mid-air explosion vs. engine-sputter-then-impact (the two crash causes, distinct by ear).
- **Announcer:** polite for routine (arrivals, headings), assertive for state changes (cleared, landed, conflict, crash, pause). Optional built-in TTS.

## Progression
Endless, single continuous shift. `levelParams(difficulty, elapsedSeconds)` ramps plane speed up, fuel down, spawn interval shorter, and the concurrent-traffic cap higher as the shift goes on. Three unlocked difficulties — **Cadet / Controller / Nightmare** — set the starting points and ramps.

## Scoring
- Safe landing: base `POINTS.LAND` + `FUEL_BONUS_PER_S × remaining fuel` (rewards prompt landings).
- High scores kept per difficulty (local top-10), with soft online submission.

## Out of scope (v1)
- Altitude / speed commands (2D only; altitude abstracted away).
- Multiple runways, departures, weather, ground handling.
- Multiplayer.

## Possible future work
See `docs/ROADMAP.md` / `docs/TODO.md`. Candidates: a second runway that opens at high traffic; emergency/no-fuel priority flights; wind that pushes headings; a "handoff" departure lane; a learn-the-sounds screen.
