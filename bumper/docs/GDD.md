# Bumper Cars — Game Design Document

A blind-accessible, audio-first bumper-cars arena game built on
[syngen](https://github.com/nicross/syngen).
The full game state is conveyed through real-time synthesized 3D audio plus a
screen-reader-friendly ARIA live region. No visual information is required.

---

## 1. Goals & Pillars

1. **Audio-first.** Every game-state change is announced through both
   synthesized audio and an ARIA live region.
2. **Real bumper-car feel.** One gear, no brakes, momentum-driven physics.
   Spinning out and bouncing off walls is the point.
3. **Scalable to multiplayer.** Cars are anonymous "controllers" — player,
   AI, and (future) remote network controllers all expose the same input
   interface.

---

## 2. Coordinate system & units

- World is the **XY plane** (Z is unused, kept at 0 so syngen's binaural ear
  still works).
- Distances are in metres.
- Headings/angles are in radians, with `0` = facing **+X** (east) and
  positive yaw rotating toward **+Y** (north). This matches syngen's
  default Euler convention.
- The listener (`syngen.position`) tracks the **local player's** car.
  All other cars (and event sounds) are spatialised relative to it.

---

## 3. Arena

- Rectangular floor, **100 m × 70 m**. At `maxSpeed = 5 m/s` this is
  ~20 s straight-across, ~24 s diagonal — long enough that blind players
  have real time to listen, navigate, and choose a target instead of
  immediately bouncing off something.
- Four walls (top/bottom/left/right). Walls are infinite-mass, perfectly
  elastic except for an energy-loss factor (`wallRestitution = 0.55`) that
  models real bumper-car rubber.
- Cars spawn evenly spaced around an inner ellipse (7 m inset) so they
  never start inside one another.

---

## 4. Cars & physics

### 4.1 State

```
Car {
  id, controller,            // 'player' | 'ai' | 'remote' (future)
  position {x, y},
  velocity {x, y},
  heading,                   // radians
  angularVelocity,           // rad/s
  health,                    // 0..100
  radius:  0.95 m,
  mass:    1.0,
  throttle:    -1..1         // input
  steering:    -1..1         // input
}
```

### 4.2 Inputs

Real bumper cars have **one always-on gear**. To still let players actively
manage speed without breaking realism we map:

| Key            | Action                                         |
| -------------- | ---------------------------------------------- |
| Up arrow / W   | Throttle forward (full power)                  |
| Down arrow / S | "Reverse pedal" — slow throttle backward (25%) |
| Left  / A      | Steer left                                     |
| Right / D      | Steer right                                    |
| Q              | Announce surrounding cars (targeting sweep)    |
| Escape / P     | Pause                                          |
| Enter / Space  | Confirm in menus                               |

Because steering only changes the car's *heading* (not its velocity vector),
hard-turning at speed produces realistic slide / spin-out — and yes, the
car can slide briefly backwards relative to its facing direction.

### 4.3 Per-frame integration (ΔT = `engine.loop.delta()`)

```
forwardForce  = throttle > 0 ? engineForward * throttle
                             : engineReverse * throttle      // engineReverse < engineForward
acceleration  = forwardForce * dir(heading) / mass
velocity      += acceleration * ΔT
velocity      *= 1 - linearDrag * ΔT                          // viscous drag
heading       += steering * turnRate * speedFactor * ΔT       // speedFactor = clamp(|v|/2, 0..1)
position      += velocity * ΔT
```

Tuning constants:

```
engineForward   = 6   N
engineReverse   = 1.5 N
linearDrag      = 0.6
turnRate        = 3.2 rad/s
maxSpeed        = 5   m/s   (soft-cap via drag)
```

### 4.4 Collisions

**Car ↔ car** — circle-on-circle elastic impulse:

```
n           = normalize(b.pos - a.pos)
relVel      = a.vel - b.vel
vAlongN     = dot(relVel, n)
if vAlongN > 0: skip                          // already separating
restitution = 0.85
j           = -(1 + restitution) * vAlongN / (1/aMass + 1/bMass)
a.vel      += (j / aMass) * n
b.vel      -= (j / bMass) * n
```

Cars are also pushed apart by penetration depth so they never tunnel.

**Car ↔ wall** — reflect the velocity component along the wall normal:

```
v_along   = dot(velocity, normal)
if v_along < 0:
  velocity -= (1 + wallRestitution) * v_along * normal
position  = clamp inside walls
```

### 4.5 Damage

```
impactSpeed = max(0, -vAlongN)            // approach speed at impact
damage      = impactSpeed * damageScale   // damageScale = 6
```

For car-vs-car the impact damage is then **split asymmetrically** to
reward attacking: the *aggressor* (the car with the larger velocity
component along the contact normal toward the other) takes
`aggressorDamageShare = 0.25` of `damage`; the victim takes the
remaining 0.75. So ramming a stationary opponent costs you ~⅓ of what
they lose, and head-on crashes still hurt both sides — but the more
committed attacker still comes out ahead.

The same base formula is reused for walls (`damageScale = 2.5`, no
split — wall damage is whatever you drove into). Below
`minDamage = 1.5` no health is deducted (prevents nuisance ticks). Each
frame a car spends in contact with a wall while moving deducts a small
**scrape damage** (`scrapeRate = 0.4 hp/m`).

---

## 5. AI

A simple finite-state machine per AI car. Updated at 10 Hz.

States:

- **WANDER** — drives toward a random arena point. Re-rolls the target every
  3–6 s or whenever a target is reached.
- **PURSUE** — has a target enemy car. Computes a steering vector toward the
  target and full-throttles forward.
- **FLEE** — own health < 25. Picks the corner farthest from the nearest
  threat and drives there.

Target selection (re-evaluated every 0.5 s):

```
score(enemy) = -enemy.health * 1.0
              - distance(self, enemy) * 0.5
              + (enemy === lastDamager ? 30 : 0)
```

Steering math (used in PURSUE/FLEE):

```
desired         = target - self.position
angleToDesired  = atan2(desired.y, desired.x) - self.heading
self.steering   = clamp(sin(angleToDesired) * 2, -1, 1)
self.throttle   = cos(angleToDesired) > -0.2 ? 1 : -0.25
```

Wall avoidance is implicit through bumping (it costs health, so the AI
adjusts target choice naturally), but PURSUE also adds a small repulsion
from any wall closer than 1 m.

---

## 6. Spatial audio

### 6.1 Listener

Listener position == local-player car position. Yaw == player heading.
Done once per frame in `content.game`.

### 6.2 Per-car engine sound

Each car owns a `CarSoundProp` that exposes:

- `update(carState)` — called every frame; sets pitch, gain, position.
- `destroy()` — disconnects nodes.

The synth is an **FM oscillator** + a **sub** + a **rumble noise** layer,
all routed through the car's binaural ear. Engine pitch and rumble depth
follow `|velocity| + |throttle|`, so braked-but-revving cars still hum.

Six distinct timbres are pre-baked (`carEngine.profiles[0..5]`), differing
in carrier frequency, modulator ratio, modulator depth, and noise mix —
so players can tell cars apart by ear alone.

### 6.3 Proximity / targeting cues

Two distinct timbre families so the player can tell sources apart:

| Source | Type                                         | Range     | Notes |
| ------ | -------------------------------------------- | --------- | ----- |
| Cars   | Discrete sine beeps, 1400 Hz front / 520 Hz behind | 14 m | Off out of range |
| Walls  | Continuous filtered-noise *whoosh* per wall  | only while alive | One looping voice per wall, spatialised at the wall's perpendicular projection. Gain scales with proximity^4 over a 50 m reference distance (so the centre of the arena is essentially silent, the last 10 m emerges, the last 1 m dominates), 0 at far → `wallMaxGain` 0.16 at impact. Distance falloff in the binaural ear is bypassed (`gainModel.normalize`). Silenced when the local player is eliminated — walls are a navigational aid for *driving*, not for spectating. |

For each non-player car, every frame:

```
relative = car.position - listener.position
distance = |relative|
if distance < proximityRange (5 m):
  beepRate = lerp(slowBeep, fastBeep, 1 - distance/proximityRange)
  beepPitch = inFrontOfPlayer(car) ? highBeep : lowBeep
```

For each wall, every frame:

```
dist = signed distance from car-edge to wall-face
if dist < wallRange (2.5 m):
  closing = velocity · direction-to-wall
  rate = lerp(slow, fast, proximity*0.7 + closing*0.3)
  beep at the wall point perpendicular to the car
```

The beep is spatialised at the car's position (or the wall's nearest
point) so its bearing is audible. The player's own car engine is mixed
~3× quieter than other cars' so the world is not drowned out.

### 6.4 Other sounds

| Event        | Synthesis                                                                          |
| ------------ | ---------------------------------------------------------------------------------- |
| Collision    | white-noise burst + sine thump, gain ∝ damage                                      |
| Wall scrape  | filtered pink noise, gain ∝ tangential speed                                       |
| Elimination  | descending sine sweep + low boom                                                   |
| Round start  | three rising chirps + go-tone                                                      |
| Round end    | win: ascending arpeggio; lose: low sustained tone                                  |
| UI focus     | soft 800 Hz pluck                                                                  |
| UI activate  | brighter 1200 Hz pluck                                                             |
| Heartbeat    | slow low pulse when own health < 25, faster as it drops                            |

All UI sounds are spawned monaurally (no spatialisation) so menus work
identically with or without headphones.

---

## 7. Announcer (ARIA)

A single live region (`#a-announcer`) is updated by a `content.announcer`
module. Two priority lanes:

- `polite` — menu navigation, settings.
- `assertive` — combat events ("Hit AI 2, 18 damage.", "AI 3 eliminated.",
  "Health low.").

Pressing **Q** during the game triggers a **targeting sweep**: every other
car is listed in order of distance with its bearing (front / behind /
left / right + diagonals) and a relative motion verb ("approaching" /
"moving away" / "circling"). The sweep is also scheduled to run
automatically on round start.

---

## 8. Game flow & screens

```
splash → menu ─┬─ setup → game → gameOver → menu
               ├─ multiplayer (stubbed; announces "Coming soon")
               ├─ learnSounds → menu
               └─ help → menu
```

`screenManager` (built into the template) drives the FSM. Each screen owns
its DOM node, focus trap, and `onFrame` hook for input polling.

---

## 9. Win conditions & scoring

### 9.1 Single player

- **0 AI:** sandbox. No win, no loss; player drives forever. Pause+menu
  exits.
- **1+ AI:** last car standing wins. The player still loses if their car
  hits 0 HP, but the round continues until exactly one car remains so the
  AI can be observed (and the eliminated player can hear the rest).

### 9.2 Score

```
+1   per HP of damage dealt to opponents
+50  per opponent eliminated
+100 last-car-standing bonus
-25  for being eliminated (capped at 0)
```

Score is announced at game-over and persisted as a personal best in
`app.storage`.

### 9.3 Multiplayer (future)

Each car has a `controller` field. Replacing the AI controller with a
network controller is a one-line swap: the game manager doesn't care
where input bits come from. Watch-after-elimination is already implied
by "round continues after player KO" — for multiplayer we just keep
the listener attached to the eliminated car and announce living players
on Q.

---

## 10. Settings

| Key                | Default | Notes                                  |
| ------------------ | ------- | -------------------------------------- |
| masterVolume       | 0.8     |                                        |
| announcerVolume    | 0.9     | Independent so SR + audio can balance  |
| hapticsSensitivity | 1.0     | 0 disables vibrations                  |
| useTts             | false   | Read announcer text via SpeechSynth    |

---

## 11. Multiplayer hooks (forward-looking)

- `Car` knows nothing about its controller; it just consumes
  `{throttle, steering, qPressed}` per frame.
- `Game` exposes `addCar({controller, ...})`; AI and Player are two
  built-in controllers, `'remote'` is reserved.
- All game events (`hit`, `eliminate`, `roundStart`, `roundEnd`) flow
  through `content.events` (a syngen pubsub). The eventual netcode will
  serialise these and the periodic car snapshots; nothing else needs
  to change.
