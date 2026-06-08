# ALOFT — Game Design Document

## One line

An audio-first, blind-accessible **vertical bounce platformer**: you bounce
upward forever and steer only left/right to land on the next platform — heard as
a panned beacon you null onto centre — climbing as high as you can while shooting
the floating sentinels.

## Fantasy

A weightless ascent through a tower of floating platforms. You can't stop
bouncing; all you can do is lean left or right to catch the next pad. The higher
you go, the farther the pads sit and the meaner the air gets.

## Core loop

1. You bounce automatically: launch up, decelerate, apex, fall.
2. As you fall, the platform you're aiming for is a **beacon** — panned to its
   horizontal offset, rising in volume and tick-rate as you near its level.
3. **Steer left/right** to bring the beacon to centre (under you) before you drop
   to its height → you land → **boing**, launch higher, repeat.
4. Miss it and you fall toward lower pads (recover) or, failing that, past the
   rising void below → you plummet, run over.
5. A **void floor rises** from below, forcing a minimum climb pace; it quickens
   with height. Score = height climbed + sentinels shot × combo.

## The platform roster

| Pad | Beacon timbre | Behaviour |
|-----|---------------|-----------|
| **Normal** | clean sine | plain bounce |
| **Spring** | bright/high | launches you ~1.7× higher — skip several rungs |
| **Moving** | wavering vibrato | drifts sideways, so its beacon keeps shifting |
| **Breakable** | brittle/short | bounces you once, then it's gone |

**Sentinels** — floating hazards that snarl in the air above some pads. Touch one
and the climb ends. **Shoot** straight up (Space) to drop one before you bounce
into it, or steer wide. Killing one pays `ENEMY_SCORE × combo`.

## Controls

- `Left` / `Right` (or `A` / `D`, numpad `4`/`6`, d-pad, stick) — **held**
  steering; release to coast to a stop.
- `Space` (or `Up`, `W`, numpad `0`/`8`, gamepad face) — fire straight up.
- `Escape` — pause. `F1` status · `F2` beacon + sentinel scan · `F3` best combo.

## Audio model (answers to the template's design questions)

1. **Perspective / movement** — side-on vertical platformer; gravity + bounce;
   one steering axis (horizontal). The camera follows your height.
2. **Audio listener** — **screen-locked, faces up the climb, never rotates.** The
   target platform is a beacon: **pan = its horizontal offset** (the steering
   cue — null it to centre), loudness + tick-rate climb toward touchdown
   (`tickInterval(ttl)`), timbre = pad type. The vertical gap is the "ahead" axis
   fed to `place()` (compressed). A pad you've fallen below sounds behind.
3. **Audio's role** — audio-first / blind-accessible. The sky viz is aria-hidden
   decoration; audio + screen-reader announcements are the truth.
4. **Input** — keyboard + gamepad (no mouse-look; mouse adapter is a no-op).
5. **Persistence** — high scores only (local dual-backend + online leaderboard);
   no run-state autosave.
6. **Progression** — endless score chase, single life. `level` rises with height
   and drives rung spacing, sideways offset, pad-width, pad-type mix, sentinel
   rate, and the void's rise rate. FSM: menu → game → pause / gameover → menu.
7. **Synth aesthetic** — modern (filtered sines/triangles/saws, springy boings,
   a buoyant generative music bed). No chiptune.

## Why it's fair by ear

- One control axis (steer) → low cognitive load; you only ever decide "left,
  right, or hold."
- The beacon is a continuous panned tone you **null to centre** — like tuning;
  centred = aligned = you'll land.
- Bounce cadence is regular, and the beacon tick tightens to a flutter right
  before touchdown, so landing timing is audible.
- `FALL_MARGIN` keeps the pad you just left catchable, so one miss is usually
  recoverable rather than instant death.

## Difficulty (from `constants.js`)

`rungGap` 1.9→2.8 (apex ≈ 3.25, always reachable), `maxOffset` 0.7→2.6 (more
steering), `padHalf` 1.05→0.5 (tighter landings), spring chance falls while
moving/breakable/sentinel chances rise, `floorRate` 0.5→2.6 u/s (less dwell
slack). In sim: a steering player climbs to height ~190 (level 5) in ~58 s; a
passive (no-steer) player is eaten by the void in ~11 s; random steering falls in
~3 s — steering is the skill.

## Online leaderboard

Game id `aloft`, `meta: {level}`. **Registration pending** — `SECRET` placeholder
in `app/onlineScores.js`; falls back to the local high-score table until
registered (see `/home/scores/INTEGRATION.md`).

## Diagnostics

- `#test` — beacon ahead / right / behind / left + a left-centre-right sweep, to
  confirm the screen→audio flip by ear.
- `#learn` — every cue (beacon left/centre/right/near, the four pad timbres,
  bounce, spring launch, shatter, sentinel, shot, crash, fall, level, over).
