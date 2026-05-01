# FIRE! — game-specific notes

This file documents the game implemented on top of the syngen template.
Read it together with `CLAUDE.md` (template-level guidance).

## Concept

A stationary firefighter aims a hose left/right to extinguish fires
spreading across a row of buildings. Audio-only. Fires localize via
parallel stereo pan + binaural HRTF. Lose three buildings to game over.

## Foundational answers (per CLAUDE.md "Required questions")

1. **Perspective / movement.** Static. The player does not translate;
   they only rotate a hose nozzle. Coordinates are authored directly in
   audio space — no screen→audio flip.

2. **Audio listener.** **Screen-locked / fixed yaw at 0.** Listener
   sits at the origin facing audio +x. Listener orientation does NOT
   track the nozzle — the firefighter's head doesn't turn with the
   hose. A fire on the right always sounds on the right, regardless
   of where the nozzle is pointing. Set once on game start; the game
   never updates it.

3. **Audio's role.** Audio-first / blind-accessible. Visual HUD is
   present but every gameplay decision can be made by ear alone.

4. **Input.** Keyboard primary (← / → aim, Space spray, F1–F4 status,
   Esc back). Gamepad supported (axis 0 to aim, A/RT to spray).

5. **Persistence.** Single high score in `localStorage["fire.highscore"]`
   (score + level reached). `engine.state` is not used because the
   game has no in-run save state worth resuming.

6. **Progression.** Levels with quotas. Extinguish N fires (N grows
   per level) to clear; fires spawn faster and grow faster each level.
   Game over after MAX_LOST = 3 buildings collapse.

7. **Synth aesthetic.** Dark, aggressive, melodic. D-minor progression
   (i–VI–III–VII), sub-bass triangle drone, sawtooth/square arp, lead
   triangle with feedback delay, noise hat + sine kick. Layers fade in
   at intensity thresholds (drone 0.0, arp 0.20, lead 0.45, pulse 0.65).

## Geometry

- Buildings: `BUILDING_COUNT = 7` arranged on a forward arc from
  `-75°` (right) to `+75°` (left) at distance 9 m.
- Audio +x = forward, +y = LEFT (per syngen's binaural), -y = right.
- Nozzle aim ∈ `[-ARC_HALF, +ARC_HALF]` rad (`±75°`). Aim is in audio
  space — positive = pointed left.
- Spray cone half-width: `CONE_HALF_WIDTH = 0.30` rad (`≈±17°`).
  Spray power falls off triangularly inside the cone, zero outside.

## Spatial pipeline

Each spatial voice (`content.audio.makeSpatialProp`) runs both:

```
source → output → stereoTap → StereoPanner → mixer
              ↓
              binTap → binaural ear → mixer
```

Stereo carries dominant L/R cue (no head-shadow nulls — even cheap
earbuds get clear positioning); binaural adds HRTF coloration. Each
voice tunes the blend via `stereoMix` (default 0.7) and `binauralMix`
(default 0.45).

One-shots (`emitSizzle`, `emitExtinguish`, `emitSpread`,
`emitBuildingLost`) follow the same dual-path shape, allocating fresh
nodes per emit and tearing down on tail completion.

## Building voices and pitch family

Each building has a distinct crackle fundamental: building i (left to
right) is `110 * 2^(i/4)` Hz (~minor third per slot). Leftmost is
~110 Hz, rightmost ~261 Hz. Layered hose tone follows the same
"low = left, high = right" mnemonic: nozzle tone is `700 - norm * 320 Hz`.
Together this gives the player a consistent pitch-to-position vocabulary.

Crackle intensity drives bandpass center (4f → 8f), Q (1.4 → 0.8),
tremolo rate (11 → 19 Hz), and a saw layer that fades in past 0.4
intensity. So a building with a small fire purrs; a raging one bites.

## Fire model

Per building, per frame:

```
intensity ← intensity + growthRate * (0.4 + 0.8 * min(1, k)) * dt
                                       ^^^ scales: small fires grow slow, raging ones fast
```

When `intensity > 1.0`, HP drains at `(intensity - 1) * HP_DRAIN_RATE`
HP/s. When `intensity ≥ SPREAD_THRESHOLD (= 1.5)`, a one-shot spread
event fires (whoosh + announcer urgent). When `hp <= 0`, building lost
(thud + lost flag set, lostCount++).

Spray reduces intensity inside the cone (triangular falloff).
Reduction triggers a probabilistic sizzle one-shot. Going from
`intensity > 0` to `0` triggers an extinguish chime + scoring callback.

## Scoring

- Base: 100 points per extinguish, plus a freshness bonus
  `+ round((1 - min(1, intensityAtKill / SPREAD_THRESHOLD)) * 80)`.
  Killing a tiny fire is worth ~180; killing a near-spread one ~100.
- Combo: extinguish within `COMBO_WINDOW = 2.0 s` of the previous
  multiplies by `1, 2, 3, …` capped at 8x. Window resets on each kill.
- Level clear bonus: `max(0, round((30 - elapsed) * 8) + level * 50)`.
  Fast clears reward more.
- Game over: highscore saved to `localStorage["fire.highscore"]` if
  beaten.

## i18n keys worth knowing

- Per-state announcer keys: `ann.start`, `ann.levelClear`, `ann.spread`,
  `ann.lost`, `ann.gameOver`, `ann.extinguish`, `ann.extinguishCombo`,
  `ann.threatLow / Mid / High`.
- F-key spoken status: `ann.score`, `ann.fireLeft / Right / Front`,
  `ann.allClear`. Uses `{dist}` as a percent of arc-half (e.g. "60%"
  ≈ 60% of the way from center to the edge).
- Game-over: `gameover.scoreLine`, `gameover.highScoreNew`,
  `gameover.highScoreLine`.

Storage key for locale: `fire.lang` (set in `src/js/app/i18n.js`).

## Files added on top of the template

```
src/js/content/audio.js   spatial pipeline, one-shots, helpers
src/js/content/fires.js   building model, crackle voices, growth/drain/spread
src/js/content/hose.js    nozzle aim, spray voice, spray cone
src/js/content/game.js    FSM (running/levelClear/gameOver), scoring, level loop
src/js/content/music.js   four-layer dark synth with intensity bus
src/js/app/announce.js    polite/urgent aria-live
src/js/app/highscores.js  localStorage record
src/js/app/screen/gameover.js  retry / menu / language buttons
src/css/app/game.css      HUD + game-over palette
```

Modified template files: `src/js/app/i18n.js` (full FIRE dictionary),
`src/js/app/controls/mappings.js` (turnLeft/Right + minimal UI),
`src/js/app/screen/{splash,game,language}.js`, `public/index.html`,
`src/js/main.js` (added explicit `ctx.resume()` on first user gesture).

## Things to remember when iterating

- **Listener yaw stays at 0.** Don't make the listener track the
  nozzle. We tested and it confuses the spatial picture — fires move
  with the hose instead of staying anchored.
- **Hose aim sign convention.** `aim > 0` points left (audio +y).
  `app.controls.game().rotate` returns +1 for "turnLeft", -1 for
  "turnRight" — that matches: pressing left raises aim.
- **Spray cone is angular only.** Don't add distance into the cone
  test — buildings sit at one distance, and even if that changes, the
  cone is a beam angle, not a beam volume.
- **Per-building pitch family is sacred.** If you ever shuffle the
  building order or change the fundamental formula, the player loses
  their learned mapping. Keep `110 * 2^(i/4)` Hz for slot i.
- **Combo resets on miss-window, not on miss.** A long extinguish that
  itself exceeds the window restarts the combo at x1. That's intended
  — players who can chain keep their multiplier; players who linger
  on one fire reset.
- **Music intensity follows `fires.totalThreat()`**, which is a blend
  of (sum intensity / max possible) at 0.6 weight + (HP lost / max
  HP lost) at 0.4. So a single raging fire is loud-music territory,
  but the soundtrack also stays dark when many half-burned buildings
  are sitting around.
