# GDD — Killing Spree

An audio-first, blind-accessible arcade driving game. You drive a wreck that
only runs on blood: health drains all the time and only pedestrians refill it.
Keep the car centred on a curving road, take each curve at a speed the tyres
can hold, and line up as many people as you can. **Stereo, car-centred audio**
— everything is heard from the driver's seat; there is no binaural head.

## Core loop

- Endless road, levels every `LEVEL_LENGTH` (750 m). Each level tightens the
  radii (`165–330 m` at L1 → `~47–110 m` at L10, hairpins < 40 m from L6),
  lengthens the arcs, shortens the straights and adds S-bends.
- Pedestrians are placed per generated segment: in the open early on, then
  "tough spots" (shoulder, apex inside, just past a curve exit, biased to the
  outside), joggers on the shoulder (L2+), crossers who wait at the kerb and
  step out when you are 2.2 s away (L3+), groups (L4+). Every placement is
  individually reachable (`|x| ≤ PED_MAX_X = 4.0`; the wall is at 5.4 and the
  car is 1.8 wide).
- Score per hit `(50 + 6·v) × (1 + 0.2·(combo−1))` (combo cap ×4); heal
  `3 + 0.28·v` (a fast hit heals ~3× a crawl). Miss (passed without hitting)
  or wall contact → combo lost.
- Drain `2.0 + 0.6·(level−1)` HP/s (cap 10). Barrier impact
  `6 + 2.2·vLat` HP (cap 48) plus a speed loss; a shallow scrape costs
  `2.5 + 0.16·v` HP/s and drags you. Health 0 → 1.8 s wreck sting → game over.

## Cue vocabulary (all synthesised)

| cue | what it encodes |
|---|---|
| **Engine** (saw firing-rate + half-order thump + AM-gated exhaust noise + intake whine, 5 gears, overrun pops) | rpm/gear = speed; **pan = your lateral offset** (right = steer left) |
| Wind (wide pink noise) + road hum | speed |
| Tyre squeal (wobbly bandpassed pink noise) | grip use ≥ 78 %; louder + lower = sliding |
| Rumble strip (lowpassed saw at wheel-rate) | you are on the shoulder, panned to that side |
| Barrier scrape (bandpassed pink + metallic resonators) + crash (sub thump, crunch, partials, glass) | contact; crash loudness ∝ lateral impact speed |
| **Road voice** (triangle + breathy bandpass, 220–670 Hz) | curvature: side + tightness; leads the car by 0.35 s |
| **Pacenote** (whoosh + 1–4 pips, 520–880 Hz) | curve ahead, `max(3 s·v, 45 m)` out: 1 lift, 2 brake, 3 hard, 4 hairpin (+ low drone) |
| Talker (formant babble, male/female f0), whistler (pentatonic sine + breath), phone (6-note ringtone), jogger (2.9 steps/s + breathing, moves 3.5 m/s), crosser (mutter at kerb → "hey!" + hard heel clicks 2.3 steps/s while crossing) | pedestrian identity; pan by relative x, gain/lowpass by distance, Doppler ×1.6 |
| Lined-up tick (1150 Hz tock every 0.2 s) | a pedestrian is inside the bonnet corridor within 2.6 s |
| Hit: wet thud + sub + yelp + rising two-note chime (third note at ×5, extra for groups) | kill + combo |
| Near miss: pass-by whoosh + "whoa" | passed within 2.3 m |
| Level-up arpeggio, low-health double beep + heartbeat, combo-lost two-note down, wreck sting, game-over dirge | state |
| Music: 124 BPM D-minor bed (pulse bass always; pad; drums at intensity > 0.3; arp > 0.62; sour tritone drone at low health); ducked on crashes | intensity = level + combo + speed |

Status keys: F1 speed/gear, F2 health, F3 score/kills/misses/combo, F4
level/distance, F5 next curve (direction, tier, distance, safe km/h).

## Physics (road frame)

`s` along the centreline, `x` lateral (+right), `psi` heading vs tangent
(+right), `kappa(s)` curvature (+right) with 14 m ramps. Steering demands a
lateral acceleration `steer × 9.8 m/s²`; tyres hold `A_GRIP = 8.5 m/s²`,
reduced by a friction ellipse under braking/throttle. Yaw rate
`omega = aLat / max(v, 8)`; over the limit yaw clamps and speed scrubs
(`0.3 × excess`). `dpsi = omega − kappa·ds/dt − K_ALIGN·psi` (self-alignment
2.2/s — what makes a position-only pan cue controllable by ear),
`dx = v·sin(psi)`, `ds = v·cos(psi)/(1 − kappa·x)`. Safe cornering speed
`sqrt(A_GRIP·R)`: R 100 → 29 m/s (105 km/h); R 40 → 18 m/s.

## Balance (headless sim, `tools/sim.js`, 12 seeds, keyboard-style bots)

| skill | score | kills/misses | level | time | deaths |
|---|---|---|---|---|---|
| 0.00 | 12 k | 46 / 55 | 6 | 161 s | drain 11, crash 1 |
| 0.25 | 22 k | 74 / 74 | 7 | 183 s | drain 9, crash 3 |
| 0.50 | 27 k | 89 / 84 | 8 | 195 s | drain 10, crash 2 |
| 0.75 | 43 k | 134 / 93 | 10 | 234 s | drain 12 |
| 1.00 | 44 k | 144 / 87 | 10 | 238 s | drain 12 |

Monotonic and bounded: even the perfect bot bleeds out around level 10 when
the drain outruns what the curves allow. Bots are better at cornering than a
human by ear (they never touch the walls), so real crash rates will be higher;
the drain is the guaranteed bound. Not yet browser-playtested.

## Screens

menu → game ⇄ pause; game → gameover (opt-in online post) → game | menu;
help, highscores, learn (`#learn` route), language.
