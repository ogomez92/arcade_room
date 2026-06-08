# CADENCE — CLAUDE.md

Audio-first, blind-accessible **rhythm-action spy side-scroller** built on the
syngen-template (cloned from `whack`). Everything is played on the beat across a
**15-sector story campaign** in two acts: **Act I (1–10)** infiltrates and
silences the rogue conductor-AI **MAESTRO** at the Core (the original climax,
unchanged); **Act II (11–15)** is the reprise — a backup conductor, **RONDO**,
reboots the broadcast now SYNCOPATED, and Act II's signature is **offbeat
threats** (struck on the "and"). Online leaderboard id `cadence`.

This is the game-specific guide. The generic engine/template guide it was cloned
from lives in `/home/gst/template/CLAUDE.md` (three globals `engine`/`app`/
`content`, Gulp concat order, lazy cross-module refs, `pnpx gulp build`, etc.) —
read that for anything not covered here.

## Foundational design answers (already decided — do not re-ask)
1. **Perspective/movement:** side-scroller, but mechanically a fixed beat-grid
   rhythm game — the avatar advances one step per beat; there is no free
   movement.
2. **Audio listener:** **STEREO / non-spatial.** Player-relative — a foe on the
   left is hard-left, on the right hard-right, hazards dead-centre. No binaural,
   no `engine.position`, no listener yaw. `content.audio` uses `StereoPannerNode`
   + pitch + timbre only. (`setStaticListener` is intentionally absent.)
3. **Audio role:** audio-first / blind-accessible. The music's **kick drum is
   the metronome** and threats are telegraphed by ear; the HUD is aria-hidden.
4. **Input:** keyboard (precise) + optional gamepad (polled fallback).
5. **Persistence:** high scores (`app.highscores`, key `cadence-highscores-v1`)
   + unlocked-sector progress (`app.progress`, key `cadence-progress-v1`) + online
   leaderboard. No autosave of run state (a run is a single sitting); progress only
   records the highest sector reached, for the level-select screen.
6. **Progression:** fixed 15-sector campaign (Act I 1–10 + Act II 11–15) with a
   briefing before each sector, a victory ending, and a game-over. A level-select
   screen replays any unlocked sector. Score = accuracy/combo/perfect/clear/health
   bonuses; the leaderboard meta `level` = sectors cleared (15 on a win).
7. **Synth aesthetic:** modern (filtered saws, sub-bass, FM-ish leads, noise
   hats, soft pads). Generative, per-level. Not retro.

## The core: one clock for music + gameplay
`content/game.js` and `content/music.js` are both driven by the audio clock
(`engine.context().currentTime`). On `startLevel`, `t0` is set to
`now + 0.4 + 4*beatDur`; four count-in ticks play on beats −4..−1 and **beat 0
lands at t0**, where the music's first kick also lands (`music.start(t0, level)`).
So `beatTime(n) = t0 + n*beatDur`, and the kick you hear IS the beat you move to.

- **Input** is captured via raw `keydown` (in `screen/game.js`), timestamped with
  `engine.context().currentTime` for accuracy, and routed to
  `content.game.press(action, time)`. Auto-repeat is filtered with a held-set.
- **Resolution** is the audio clock vs the per-beat timing window
  (`hitWindow`/`perfectWindow`, per level). The chart is a unified time-ordered
  `cells` list (each cell = the one input owed), measured in beats via `tBeat`
  (a float: integer = on the beat, **.5 = OFF the beat**). `press()` answers the
  cell CLOSEST in time within `hitWindow` — a correct action resolves it live
  (the action sound fires under your finger); the window closing on an
  unresolved cell is a miss; a press near no cell is "off the beat". In offbeat
  sectors `hitWindow < 0.25*beatDur` so a step and an adjacent offbeat can never
  both fall in window (the nearest-cell hit stays unambiguous — the sim asserts
  this).
- **Offbeats (Act II):** sectors with `mech.off` place threats at `i+0.5` — the
  "and" between two plain steps — at rate `offShare` (relative to onbeat
  threats). Their telegraphs warn on the matching offbeats (audibly syncopated).
- **Telegraphs** are scheduled ahead jitter-free: `game.update()` emits
  `telegraph` events with an absolute `when` (`AUDIO_LOOKAHEAD` ahead) and the
  screen calls `content.audio.enemyWarn/hurdleWarn/beamWarn(..., when)`.

## Actions / slots (one input owed per beat)
`step` → Step (Space) · `enemy L/R` → Shoot Left/Right (←/A, →/D) ·
`hurdle` → Jump (↑/W) · `beam` → Duck (↓/S). Threat kinds: `grunt`
(2-beat warning), `drone` (1-beat warning, late sectors), `hurdle`, `beam` —
each can also arrive ON or OFF the beat (Act II). Damage table, scoring, combo
and timing are in `content/constants.js`. **Weapon choice:** one shot per beat
(the gun recharges every beat), so back-to-back foes from alternating sides are
the pressure, not a long cooldown.

## Files (game-specific)
- `content/constants.js` — run rules, damage table, scoring, combo, `WARN_BEATS`,
  `LEVEL_COUNT` (15).
- `content/levels.js` — the 15 sectors: bpm, length, density, mix, droneShare,
  `offShare` + `mech.off` (Act II offbeats), timing windows, **and the per-level
  music config** (key/scale/progression/style/timbre). The difficulty curve lives
  here. Act II music adds `arp16`/`leadBusy`/`offStab`/`bassOff` style flags.
- `content/sequence.js` — chart generator: turns a level into the unified `cells`
  list (steps + on/off-beat threats, each with a float `tBeat`) + a time-ordered
  telegraph list. Fairness: ease-in steps, full warnings, `minGap`, no threat on
  first/last beat, offbeats only between two plain steps. Pure/Node-requirable.
- `content/music.js` — clock-locked generative bed; kick on every quarter. Style
  flags layer 16th arps / busier leads / offbeat stabs+bass for Act II.
- `content/audio.js` — stereo cues (telegraphs accept a `when`), action sounds,
  miss stings, count-in, stingers, menu cues, `sample()` (incl. `synco`
  offbeat demo) / `testStereo()`.
- `content/game.js` — the rhythm engine: press handling (nearest-cell), cell
  resolution, health/lives, scoring, sector progression, telegraph scheduling.
- `app/progress.js` — unlocked-sector persistence (`cadence-progress-v1`);
  clearing sector N unlocks N+1.
- `app/screen/game.js` — input capture, event→audio/announce wiring, HUD, F-keys;
  unlocks the next sector on clear.
- `app/screen/briefing.js` — per-sector story + tutorial (audition this sector's
  cues) + Begin. Shown before every sector; **speaks the story on load** via the
  assertive live region.
- `app/screen/levels.js` — level select: lists every sector, unlocked ones
  playable, choosing one starts a fresh run from that sector.
- `app/screen/victory.js` — the ending + final score submit (meta level = 15).
- `app/screen/{menu,help,learn,test,pause,gameover,highscores,language}.js`.

## Screen FSM
`menu → briefing(1) → game → (level-clear) → briefing(next) | victory`, and
`menu → levels → briefing(chosen)`. `game → (0 lives) → gameover`. Clearing
sector 10 continues into Act II briefing(11); `victory` only after sector 15.
`briefing.abort`/`pause.menu` → `menu`. Pause: Esc → pause; **resume restarts
the current sector** (the clock can't be re-anchored mid-air cleanly), restart →
from sector 1, quit → menu.

## F-keys (game screen)
F1 status · F2 what's coming · F3 vitals (health/lives) · F4 progress.
F1/F2/F3/F5 are `preventDefault`-ed; Space/arrows too (stop page scroll).

## Validation
`node sim/validate.js` loads the pure logic (constants/levels/sequence) and checks
(1) chart fairness (0 violations, incl. offbeat-between-steps + window<¼-beat in
offbeat sectors), (2) difficulty monotonicity (bpm 88→172 in steep steps,
threats/sec 0.42→2.00, drone 0→35%, window 0.20→0.083s; in Act II onbeat density
is deliberately LOWERED so offbeats dominate — their share climbs 37%→61%, so Act
II's difficulty axis is syncopation + precision, not raw density, and step-frac
rises there by design), and (3) a skill→score gradient (expert clears-all ~98%;
good ~69% — the fast, tight, syncopated finale bites; flailing dies ~sector 5). Re-run after touching `constants.js`/`levels.js`/
`sequence.js`. There is no browser test in this checkout — verification stops at
`pnpx gulp build` + the sim.

## Online scores — REGISTRATION PENDING
`app/onlineScores.js` has `GAME_ID = 'cadence'` and the placeholder
`SECRET = 'REPLACE_WITH_CADENCE_SECRET'`. Register at
`https://scores.oriolgomez.com/admin`: display_order **desc**, max_score
**9999999**, meta_schema `[{"key":"level","type":"int","min":0,"max":99}]`
(`level` = sectors cleared, 0–15; a win is 15). Paste the returned secret over the
placeholder. Until then submissions fall back to the local high-score table.
