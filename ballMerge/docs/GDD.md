# Basket — Game Design Document

## One line

Catch falling balls in your basket and throw them into each other so they crash
and merge into bigger, heavier balls. Bigger balls are easier to hit but fall
faster. If a single ball touches the ground, the run is over.

## Fantasy

You are alone on a strip of ground under an open sky. Balls keep dropping. You
never let one land. Each merge is a small victory you can hear: two pitches
sliding into one, then the new, lower voice starting its faster fall.

## Core loop

1. A **seed** ball (size 1) drops near you. Run under it (pan to centre) and it
   lands in the basket: *plop*. You now hold it — a soft centred hum.
2. An **incoming** ball appears (bell, panned where it is) and falls, ticking.
   Run under it. When the hum brightens and chimes, a throw right now would hit.
3. **Throw.** Whoosh up; the two voices converge; the merged ball blooms and
   starts falling — faster, and veering if you hit it off-centre. Get under it.
4. Repeat until the round's quota is merged and the ball is in your hands: the
   ball is **banked** (pitch whooshes skyward, arpeggio) and the next round
   starts with a fresh seed.

Miss the throw and the thrown ball comes back down onto you; the incoming keeps
falling. You can catch whichever comes first with empty hands, and a ball that
lands on the ball you hold **bumps** and merges anyway (low thud, small hop,
fewer points). Nothing is ever lost until something hits the ground.

## Audio vocabulary (stereo, player-centred)

| Meaning | Sound |
|---|---|
| Where a ball is | Stereo pan; centre = straight above you |
| How big a ball is | Pitch (hyperbolic map, 640 Hz → ~80 Hz), timbre weight (sub, slow wobble, wind rumble) |
| How fast it will land | Proximity ticks whose interval is proportional to seconds-to-basket; louder + brighter as it descends |
| Straight above you | Lock overtone + lock tick |
| Holding something | Centred hum pitched by mass |
| A throw now hits | Hum gains a fifth and brightens; chime on the moment |
| Thrown / caught / merged / bumped / wall / edge / dropped / cleared | Distinct one-shots (see Learn the sounds) |

## Difficulty curve

Per round: more merges (2 → 7), bigger incoming (1 → 4), faster cadence,
more sideways drift with wall bounces, farther spawns, and from round 4 the
next ball appears while the previous is still in the air. The held ball's
throw apex drops with mass, so late in a round the target must come lower
before a throw can reach it — the window narrows exactly as the fall speeds
up.

A **fairness guarantee** keeps it beatable: the next ball never lands sooner
than a run's worth of time after the one you're waiting for. Difficulty comes
from cadence and precision, never from geometry you cannot reach.

Validated by a headless bot sim (see CLAUDE.md): sharp play clears all ten
rounds most of the time; ordinary play dies around round 7; sloppy play dies
around round 4.

## Arcade mode

Same game plus **lives** and **power-ups**. You start with two extra lives: a
dropped ball costs one and comes back from the sky a moment later. Power-ups
hang from the ceiling on a string, each with its own repeating jingle panned
where it is (rising triad = extra life, coin ding-ding = bonus points,
tick-tock = slow time, wide swell = wide basket). Throw a ball up into one to
collect it. It lowers for eight seconds, its jingle hurrying at the end, then
is pulled back up. Light balls reach it at once; heavy balls must wait for it
to come down and race the vanish. Slow time and wide basket last a few seconds
and keep a soft presence while active. Arcade has its own high-score board.

## Scoring

- Air merge: 10 × mass × (1 + height / sky height). Bump: 10 × mass.
- Catch: 4 × mass.
- Round clear: 100 × round + 20 × merges, +60 × round if every merge was in the air.
- Ten rounds cleared = you beat the game; score still recorded.
- Local top ten per mode; optional online posting (game ids `basket` and `basket_arcade`).

## Accessibility

Audio-first; the visual sky is decorative. Two aria-live regions (polite for
routine events, assertive for state changes). F1 score/round, F2 held ball +
range, F3 balls in the air (size, side, altitude, seconds to land), F4 round
progress. Keyboard and gamepad; no mouse. English and Spanish.
