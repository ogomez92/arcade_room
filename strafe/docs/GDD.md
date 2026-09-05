# STRAFE — Game Design Document

## Pitch

An audio-first, blind-accessible **run-and-gun** (Contra / Metal Slug lineage).
You hold a front line and gun down a relentless stream of foes charging in from
ahead — low on the GROUND, high in the AIR — while DUCKING the shells they lob.
Clear each sector's quota to push into a faster one. Endless, escalating; three
lives; score chase. The collection had fixed shooters (salvo/skeet/skitter) and a
flying shmup (vfb) but no offence-forward, two-lane gun-down-the-horde shooter —
STRAFE fills that gap.

## The audio model (the whole game)

SIDE-VIEW stereo field that never rotates — you face right (the front):

- **Pan = distance.** A foe far ahead sits in your right ear and slides to centre
  as it closes; loudness and blip rate rise with nearness (a foe nearly on you
  blips fast and centred — fire NOW). (`StereoPannerNode`, no rotation.)
- **Pitch = lane.** Ground foes growl low; air foes whine high — so you hear which
  way to aim.
- **A shell** has its own wobbling whistle, distinct from the foes, so you know to
  DUCK it, not shoot it.

## Controls

- **Space / J** — fire the GROUND lane (the low growl). Hold to keep firing.
- **Up / K** — fire the AIR lane (the high whine).
- **Down / S** — duck a lobbed shell (a deliberate tap; you can't shoot shells).
- `F1` status · `F2`/`F4` threats by lane · `F3` best combo · `Esc` pause.

**One shared gun.** Firing either lane spends a single shared cooldown, so you
cannot clear ground and air at once — a ground+air pair forces you to pick the
more urgent and trust the second a beat later. That prioritisation under pressure
is the core skill.

## Rules & scoring

- **3 lives.** A foe that reaches you (un-shot) costs a life; a shell that lands
  while you're standing costs a life. Either resets your combo.
- A kill pays `KILL_POINTS × combo multiplier` (combo +1 per kill, +1 to the
  multiplier every 5); a ducked shell pays a small bonus. Clearing a sector pays
  `120 × sector`.
- **Clear the sector's quota** → a faster sector: foes close quicker, spawn
  tighter, lean more to the air, lob more shells, and arrive more often as
  ground+air pairs. Endless.

## Difficulty curve (the balance knob — `content/constants.js`)

`waveConfig(sector)` quickens the approach (`approachTime` 2.3 → 0.85 s), tightens
spawns (`spawnInterval` 1.2 → 0.16 s), and raises the air / shell / pair odds. The
**bound** is throughput: the single gun clears ~`1 / FIRE_CD` ≈ 3.8 foes/sec, and
spawn density climbs past that in the late teens, so the front eventually overruns
you no matter how cleanly you shoot. Headless validation (`/tmp/strafe-sim.js`, an
AI that fires the more-urgent lane — but misreads the lane at a rate set by skill,
wasting the shared shot — and ducks shells): runs are **bounded** (0/24 reach the
cap — overrun ~sector 16–17, ~4.5 min), clearly **winnable** (~390 kills, sectors
cleared), with a monotonic **skill→score gradient** (~584k at low skill → ~745k at
high skill via lane-read accuracy + combo upkeep). The wall caps *depth* for all,
so score comes from clean, unbroken shooting; a real player's lane-ID, reaction
and duck timing (which the perfect-info sim plays near-flawlessly) spread human
scores far wider than the sim's range — the sim confirms the loop is sound,
bounded and winnable.

## Design decisions (the template's required questions, answered)

1. **Perspective / movement** — side-view 2D, fixed stance; foes approach along
   two height lanes. Continuous loop via the game screen's `onFrame` →
   `content.game.update(delta)`.
2. **Audio listener — STEREO + PITCH (no rotation).** Distance is a
   `StereoPannerNode` pan (far ahead = right → centre); lane is pitch. The view
   never rotates. (Stereo, not binaural — the right model for a 2-lane side view.)
3. **Audio role — audio-first / blind-accessible.** Playable by ear via approach
   blips (pan + lane pitch), the distinct shell whistle, gun/kill/duck cues, and
   two `aria-live` regions. The two-lane segment viz is `aria-hidden`.
4. **Input — keyboard + gamepad.** Mouse is unused (neutered in `controls/mouse.js`).
5. **Persistence — high scores only** (local `app.highscores` + online board).
6. **Progression — endless sectors / score chase.** FSM screens: menu → game ↔
   pause, game → gameover → menu; plus help, highscores, language, and the hidden
   `#learn` / `#test` diagnostic routes.
7. **Synth aesthetic — modern / realistic** (a low growl vs high whine for the
   lanes, a wobbling shell whistle, highpassed gun cracks pitched per lane,
   sub-bass kill bursts, a battlefield-rumble bed). No retro waves.

## Possible future work

- **Power-ups** (spread shot that clears both lanes for a few seconds; a brief
  shield) dropped by the odd foe.
- **Heavies** that take two hits, and **strafing runs** that demand a held duck.
- **A third (mid) lane** once two are mastered, for a harder mode.
