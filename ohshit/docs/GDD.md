# GDD — Oh Shit!

An audio-first, blind-accessible survival arcade. **Stereo, NON-spatial audio**:
position is carried purely by stereo pan (relative x ÷ `PAN_RADIUS`, ±10
squares to full pan), identity by timbre. One life. Score = items collected.

## Main mode

A 1-D strip of 40 concrete squares between two walls. Walk left/right
(7 sq/s — one footstep per square, ~143 ms cadence, a brisk pace), jump
(0.65 s airborne, 0.1 s grounded recovery before re-jumping). Movement is
allowed mid-air (air control), and stopping is instant.

- **Rocks** whistle down (2.4 s fall, panned at their column, louder/lower as
  they near). Land on your head (±0.6) = death. Where they land they deposit an
  item — unless the square is an open pit (swallowed) or a **cannon** (the
  cannon is DESTROYED — the hidden counterplay the help text only hints at).
- **Items.** Score item (bling-bling chime, 10 s TTL, +1 score) or, 12 % of the
  time, a power-up (bell ring, only 6 s TTL). Power-up identity rolls on pickup:
  super speed ×1.8 (15 s), invincibility (15 s — immune to rocks, pits, balls;
  walks over open pits), pit cover (+1, the only stacking item), or — only
  after 3 minutes of play — a **rock storm**: strips speed/invincibility, then
  10 s of rocks every 0.35 s within ±8 squares *following you*; survive it for
  +4 covers and 25 s of invincibility + super speed. Storm rocks drop only
  score items.
- **Cannons**: the first appears immediately (another every ~35 s, cap 1→3 by
  elapsed) so the opening seconds already have teeth. They creak where they
  sit and fire balls (7→10 sq/s) at the player's side every ~5 s. Balls must
  be JUMPED (counts toward the runner unlock); they die at walls and fall into
  open pits (a pit between you and a cannon shields you).
- **Pits** (width 2) open from 35 s: 2 s of crumble warning (assertive
  announcement if underfoot), then a wind-loop hole; stepping in = death.
  Edge squares sound crumbly underfoot. Stand on an edge and press F to seal
  permanently with a cover.

Difficulty: tier = 1 + elapsed/30; rock interval 3.6→1.25 s over ~5 min, pit
interval 18→10 s, cannon cap and ball speed rise. Sim-validated (cannon from
t=2 s): bounded (0/150 runs hit the 30-min cap), mean score 5 (skill .3) → 27
(skill .95), mean survival 28 s → 108 s, monotonic.

## Runner minigame (unlock: jump 100 cannonballs, persistent)

After 100 total jumped balls (`app.progress`, localStorage), each main game
older than 60 s has a once-per-game random chance (~1/40 per sec) to suspend
itself and offer a TRIAL. Clear level 1 → unlocked on the menu forever. Trial
always returns you to your suspended game (2 s grace).

Endless level-based chase: board = 100 × level squares. A floating cannonball
(4.2 sq/s, never faster, floats over pits) chases from the left; you sprint
(5 sq/s) right to the end. Jump pits and oncoming balls (every 4–7 s from the
right, all fly over pits, never collide). Course cannons (1 at level 2, +1
every 4 levels) fire at you within 40 squares and vanish when passed. Rocks
fall ahead from level 3. **THE RULE: jump over the chaser and you are
DISQUALIFIED — no score, trial burnt.** Score = total steps (distance
traversed). Online posting requires >99 steps. Sim: bounded, no false DQs,
level-1 clear rate 33 % (skill .3) → 77 % (skill .95), steps ~86→214.

## Keys

Left/Right or A/D walk · Space/Up/W jump · C covers count · F use cover ·
S score/steps · T time survived · F1 full status · Escape pause. All but C/F
work identically in the runner.

## Audio vocabulary (all stereo-panned at source position)

Aesthetic: **foley-realistic, not retro/synthy** — world sounds (steps, balls,
rocks, impacts, booms) are built from shaped NOISE, not tones; tonal synth is
reserved for abstract signals (item chimes, buff pads, jingles), which stay
filtered/soft with snappy spacing (≤0.15 s). MOVING objects get ONE continuous
voice retuned per frame via the loop registry, never repeated blips:
- falling rock = continuous air-rush (noise-dominant) tinted by a descending
  whistle, swelling over the whole 2.4 s fall (`rockStart`);
- every cannonball = a continuous ROLLING voice — gravelly lowpassed noise
  wobbled by two slow LFOs over a low thrum, opening/louder as it nears
  (`ballStart`/`ballSet`); the runner's chaser is the same voice, deeper;
- pit wind, invincibility pad (660 Hz lowpassed, deliberately not piercing),
  speed pulse, and storm rumble are the other loops.
One-shots: concrete heel-thump + scuff steps (~200 ms cadence) / gritty
double-crunch on pit edges · push-off scuff + air whoosh jump, thump land ·
rock ground-slam + debris (pit-plop / cannon-clank variants) · score plucks
×2 (rate doubles in last 3 s) / warm hand-bell · cannon ratchet-creak +
concussive noise boom · stone cover slide · falling glide · 3-2-1 expiry
ticks · storm alarm + victory fanfare · level-clear jingle · DQ buzzer ·
death sting + 4-note dirge.

## Boards

Local top-10 ×2 (`ohshit-highscores-v1`, `ohshit-runner-highscores-v1`),
updated when you save. Online posting is **opt-in**: after saving, an eligible
score gets a yes/no menu and only "Post online" submits — main is eligible when
it makes the local top 10 **and** survived ≥ 60 s (`MAIN_POST_MIN_TIME`); runner
when steps **> 99** (`RUNNER_MIN_POST = 99`, gate `score > RUNNER_MIN_POST`). The
game-over screen reports your local-top-10 position both on screen and via the
announcer. DQ = no save, no post. Online ids `oh_shit` (meta: time) and
`oh_shit_runner` (meta: level) — both REGISTRATION PENDING at
scores.gomsen.com/admin; secrets in `src/js/app/onlineScores.js`.

Input note: the game screen reads horizontal walk from the **strafe axis**
(`app.controls.game().y` + explicit Arrow/A/D) — never `game().x`, which the
keyboard adapter wires to Up/W/Down/S (jump and status keys). Reading `.x` would
drag the player sideways whenever they jump or check their score.

## Balance/validation harness

`tools/ohshit-sim.js` (node) loads the real content modules headless and plays
both modes with pressure-scaled mistake-rate bots. Hard-won bot lessons: roll
skill ONCE per threat, scale failure by simultaneous-threat pressure, and give
bots the two human counterplays — stop-at-the-lip before pit jumps (a refused
jump during ground recovery must not walk you in) and mid-air landing-spot
control. Without those the gradient reads flat and pit deaths dominate at all
skills.
