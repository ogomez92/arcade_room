# RIVET — Game Design Document

## Pitch

An audio-first, blind-accessible **Donkey Kong** (Nintendo, 1981). You climb a
scaffold of girders linked by ladders, from the bottom to the top. Barrels tumble
down the girders toward you — JUMP and they pass under. After a moment a FIREBALL
appears below and hunts you up the ladders; a jump won't save you from it, only
climbing away will. Reach the top girder to clear the level; a faster scaffold
follows. The collection had runner / bounce / wall-climb platformers but no
structured **vertical ascent with hazard-timing** — RIVET fills that gap.

## The audio model (the whole game)

SIDE-VIEW stereo field that never rotates — the cleanest fit for a platformer:

- **Horizontal = stereo PAN.** A barrel to your right is in your right ear,
  always; left is left. (`StereoPannerNode`, not binaural — no rotation, no
  front/back ambiguity.)
- **Height = PITCH.** A faint continuous tone sings YOUR current girder; barrels
  and the fireball ring higher when above you, lower when below. Same pitch = same
  girder = the real danger.
- **Ladder beacon** ticks toward the one up-ladder on your girder (pan toward it),
  with a brighter overtone when you are standing on it.
- A barrel on **your** girder is loud and urgent; ones on other girders are
  fainter. The **fireball** crackles, panned + pitched by where it is.

## Controls

- **Left / Right** — run along the girder.
- **Up / Down** — climb a ladder (only where one is; tap to climb a rung).
- **Space** — jump. A barrel passing under you while airborne is dodged (and
  scores a hop). You cannot climb mid-jump, and a jump does NOT clear the fireball.
- `F1` status · `F2` nearest threat · `F3` the ladder up (direction + distance) ·
  `F4` your height · `Esc` pause.

## Rules & scoring

- **3 lives.** A barrel hit or the fireball costs a life; you respawn at the
  bottom with brief invulnerability and the fireball delayed again (a death costs
  you the climb — classic DK).
- Each new girder reached pays `ROW_POINTS × level`; a clean hop over a barrel
  pays `HOP_POINTS × level`; reaching the summit pays `summitBonus(level)` plus a
  **time bonus** that bleeds away, so a fast climb scores far more.
- **Reach the top** → next level: barrels faster + denser, fireball a touch
  quicker, ladders re-zigzagged. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

`levelConfig(level)` speeds barrels (`barrelStep` 0.21 → 0.09 s/col), tightens
their spawn (1.9 → 0.55 s) and raises the cap (3 → 10). The **bound** is your jump
cadence: a jump + landing is ~0.58 s, so you can clear at most ~1.7 barrels/sec —
once a girder's barrels arrive faster than that, no amount of skill dodges them
all. The **fireball** is deliberately a gentle pacer (`fireballStep` floored at
0.34, slower than your run), so a steady climber out-runs it; it punishes dawdling
and the chaos after a death rather than being the main killer — which keeps
*barrel-dodging skill* the thing that decides how deep you get. Headless validation
(`/tmp/rivet-sim.js`, an AI that climbs optimally and jumps barrels with
skill-scaled reliability): runs are **bounded** (0/24 reach the cap — the barrel
wall always ends it), clearly **winnable** (clears ~6 levels, up to ~14), with a
monotonic **skill→score gradient** (~18k / level 4.5 at low skill → ~37k / level
6.7 at high skill, ~2×, with the high-skill ceiling reaching level 14). Human jump
*timing* (not just reliability) will spread scores further than the sim models.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — side-view 2D on a **discrete grid** of girders +
   ladders; run (column step), climb (ladder), jump (timed hop). Continuous loop
   via the game screen's `onFrame` → `content.game.update(delta)`.
2. **Audio listener — STEREO + PITCH (no rotation).** Horizontal position is a
   `StereoPannerNode` pan; height is pitch; a faint tone tracks your own girder.
   The field never rotates — left is always left.
3. **Audio role — audio-first / blind-accessible.** Playable by ear via the
   height tone, ladder beacon, barrel/fireball cues, and two `aria-live` regions.
   The side-view grid viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse is unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless levels / score chase.** FSM screens: menu → game ↔
   pause, game → gameover → menu; plus help, highscores, language, and the hidden
   `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (a tumbling filtered-noise barrel
   roll with a low thump, a crackling fireball, a pneumatic jump, rung ticks, a
   bright hop chime, a girder-pitched ladder beacon, a construction-hum bed). No
   retro waves.

## Possible future work

- **Rivets / bonus pickups** on the girders, and a hammer power-up that smashes
  barrels for a few seconds.
- **Barrels that take ladders** (roll down a ladder occasionally) for extra
  threat variety.
- **A boss at the top** that flings the barrels, with a final-girder set-piece.
