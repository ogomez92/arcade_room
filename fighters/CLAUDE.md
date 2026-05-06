# CLAUDE.md — BRAWL!

Project-specific notes. The shared template guidance lives at
`/home/games/_fg/../syngen-template/CLAUDE.md` (or any sibling game's
copy of it); this file only documents what's BRAWL-specific. When in
doubt, read the parent doc first — it covers screens, storage, settings,
controls, audio patterns, and the syngen coordinate-frame gotchas that
this game relies on.

## What it is

Audio-first 2D melee fighter built on the syngen-template. Top-down arena,
keyboard movement, four melee attacks (high/low punches and kicks),
named combos with damage bonus, knockdown mechanics, AI opponents in
arcade-ladder mode. Every fighter has a gendered voice (effort grunts,
pain cries, victory/defeat vocalizations) on top of breath that tracks
fatigue.

## Foundational answers (do not re-ask)

1. **Perspective / movement**: top-down 2D continuous. WASD walks the
   player around a square arena (`STAGE_HALF = 4` units on each axis).
   No facing direction — attacks are omnidirectional Euclidean range
   checks.
2. **Audio listener**: SCREEN-LOCKED. Listener yaw is constant
   (`Math.PI / 2`, audio-front = screen-north) and applied once via
   `applyYawOnce()` in `content/audio.js`. The standard screen→audio
   y-flip is in `setListener()` and `relativeAudio()`. Reference
   implementation pattern from CLAUDE.md gotcha section + `../pacman`.
3. **Audio's role**: audio-first / blind-accessible. No visual stage,
   only the HUD bars. Spatial audio + announcer is the entire playable
   surface.
4. **Input**: keyboard primary; gamepad mappings are present but
   secondary; mouse is a no-op for game state.
5. **Persistence**: minimal — `brawl.character` (last-picked fighter)
   and `brawl.lang` (locale) in `localStorage`; nothing in
   `engine.state` yet. `app.autosave` is left running but no module
   exports anything to it. High scores intentionally not implemented in
   v0.1; see "future work" below.
6. **Progression**: arcade ladder. Single match goes round 1 → 2 → 3 →
   ... against `content.characters.opponentFor(playerId, round)`.
   Player wins round → fighters reset, foe rotates, AI difficulty bumps.
   Player loses → gameover screen → rematch from round 1 or main menu.
7. **Synth aesthetic**: punchy / percussive. Sub-thump + bandpassed
   click + body-noise tail per impact; bandpass-swept whooshes for kick
   tells; gendered formant-bank voice for effort/pain (sawtooth carrier
   + 3 bandpass formants + breath-noise grit).

## Module map (`src/js/content/`)

- `combat.js` — attack defs, combo table, hit/dodge/stomp rules.
  Constants: `ATTACKS`, `COMBOS`, `COMBO_WINDOW`, `STOMP_BONUS`. Knock-
  down chance lives on each attack def + per-combo `knock` flag.
- `characters.js` — fighter roster (3 male, 3 female). Each entry has
  `gender`, per-fighter voice tuning (`basePitch`, `formant`, `grit`),
  AI defaults (`style`, `aggression`, `preferredDist`), and a `nameKey`
  i18n key.
- `audio.js` — spatial audio + non-vocal SFX (tells, hits, footsteps,
  bell, KO, crowd roar, breath). Exposes `playSpatial(sx, sy, build)`
  and `relativeAudio(sx, sy)` so `content.voice` can route through the
  same listener model.
- `voice.js` — gendered effort/pain/groan/victory/defeat. Pure synth
  (sawtooth + 3 formant bandpasses + filtered noise) — no samples.
  Always called *via* `content.audio.playSpatial` so spatial routing,
  distance, and the screen-locked listener stay consistent with the
  rest of the SFX.
- `fighter.js` — shared state machine (player + AI). Posture
  `stand | down | getup` drives knockdown logic. `move()` normalizes
  diagonals and emits sparse footsteps. `startAttack()` plays the tell
  + effort grunt; `updateAttack()` advances windup → active → recovery.
- `ai.js` — per-frame priority list: dodge if observed windup is going
  to land (reaction-delay buffer), attack if in range and aggression
  rolls, stomp if target is down, otherwise orbit at preferred
  distance.
- `game.js` — match orchestrator. `startMatch(charId)` → `setupRound`
  → `update()` drives both fighters, resolves hits, handles round
  win/lose. Hit resolution applies combo bonuses, stomp bonuses,
  knockdown rolls, announcer text, and audio severity.
- `announcer.js` — polite + assertive ARIA live regions, two-buffer
  ping-pong so identical strings re-fire.

## Coordinate frame

Screen frame: `+x = east`, `+y = south`, origin at arena centre. Bounds
`-4..+4` on each axis (`STAGE_HALF` in `fighter.js`).

Audio frame: y is negated when crossing the boundary (engine.ear.binaural
uses `+y = LEFT`). The single recipe lives in `content.audio`:
- `setListener(sx, sy)` → `engine.position.setVector({x: sx, y: -sy})`.
- `applyYawOnce()` → `engine.position.setQuaternion({yaw: Math.PI/2})`.
- `relativeAudio(sx, sy)` returns the listener-local audio vector for
  `engine.ear.binaural#update`.

Stereo pan is `clamp(dx_screen / 4, -1, 1)` directly — east → right ear,
which already matches the listener yaw.

## Controls

- WASD — move. Arrows mirror.
- T — high punch (code `p`).  G — low punch (code `q`).
- U — high kick  (code `k`).  J — low kick  (code `l`).
- F1 — your HP.   F2 — foe HP.
- F3 — distance + bearing (8-way compass, screen-frame).
- F4 — current combo chain.
- F5 — your posture and the foe's.
- Esc — pause / back to menu.

## Combat tuning quick-ref

| Attack       | range | windup | dmg | knockdown |
|--------------|-------|--------|-----|-----------|
| highPunch    | 1.55  | 0.08   |  6  | 0%        |
| lowPunch     | 1.35  | 0.10   |  9  | 8%        |
| highKick     | 1.95  | 0.34   | 16  | 18%       |
| lowKick      | 1.80  | 0.30   | 12  | 55%       |

Punches are MK-style snappy; kicks are heavy commitments. Stamina (in
`fighter.js`) is what gates spam — when low, the windows stretch ~1.8×.

Stomp bonus on a downed target: `× 1.75`. High attacks miss a downed
target entirely.

## Gotchas

- **Voice + audio cross-module ref**: `content.voice` calls
  `content.audio.playSpatial` and `content.audio.envelope`. Both are
  resolved lazily (`const A = () => content.audio`). Don't capture
  `content.audio` at module top in any file — Gulp concats
  alphabetically and `audio.js` is loaded before everything else, but
  `voice.js` (alphabetical 'v') comes after. The lazy getter pattern
  is what keeps this safe; don't break it.
- **Listener orientation drift**: `content.game.update()` calls
  `setListener(player.x, player.y)` every frame. If you add a
  diagnostic / soundtest screen later, that screen must NOT call
  `content.game.update()`, and must apply its own static listener pose
  (CLAUDE.md gotcha "Listener orientation and per-frame state").
- **Top-down has no `behindness()`**: south sources don't get a low-
  pass treatment because the listener is screen-locked and the player
  doesn't face anyone. If you add a player-locked listener mode for a
  variant, port the pacman recipe.
- **Knockdown gating**: `combat.lands(defender, atk)` is the single
  source of truth for "does this attack connect at all?" — it filters
  high attacks against downed defenders and gives the rising defender
  invuln frames. Don't duplicate this rule elsewhere.
- **Listener yaw is sticky**: `applyYawOnce()` runs on first
  `setListener` call and never re-applies. If you ever add a screen
  that explicitly sets yaw to something else (e.g. an intro cinematic),
  reset the `yawApplied` flag or restore yaw on game-screen entry.

## Future work

- High-scores screen (most rounds cleared per locale; both Electron
  JSON file + localStorage backends per the standard pattern).
- Multiplayer: 1v1 over PeerJS using the parent CLAUDE.md's net.js
  pattern. Keep the host authoritative — both fighters' HP, posture,
  and pending audio events ride in 30 Hz snapshots.
- Diagnostic `#test` route that pings front/right/behind/left around a
  static screen-locked listener, per CLAUDE.md "Wire diagnostic routes
  via none → activate". This is the standard sanity check whenever
  audio.js gets touched.
- Hidden soundtest for character voices so screen-reader users can
  audition + pick a fighter whose timbre doesn't conflict with their
  TTS.
