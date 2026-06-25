# ROADMAP

Implementation plan for Air Hockey. Design contract lives in `/CLAUDE.md`
(grill session 2026-06-13). This file is the build order.

## Verification method

Collection-standard (per Troopanum):
- **Pure-logic node sim** — stubs `content.audio` + `app.settings`; checks correctness
  and balance (no tunneling, energy bounded, goals fire, difficulty monotonic,
  matches winnable AND beatable).
- **Headless bundle-boot harness** — Web Audio + DOM stub, `(0,eval)` the built
  `scripts.min.js`; drive `screenManager.ready()` + `dispatch(...)` manually to
  exercise screens (`engine.ready()` waits on a `window 'load'` event).
- **By-ear browser pass = the user's loop.** This checkout is served independently,
  so the agent stops at build + static + sim. Phases marked **[ear]** need the user.

Tracer bullet: a minimal puck voice + listener is pulled into Phase 1's tail so
orientation is auditionable as soon as the puck moves.

## Phases

### Phase 0 — Scaffold & boot
Files: `content/constants.js`, `content/events.js`, `content.js`, `src/js/main.js`
- `pnpm install`; confirm `pnpx gulp build`.
- `main.js`: `engine.mixer.reverb.setActive(false)`; disable `app.autosave`.
- Stub constants: table dims, goal width, puck/mallet radii, friction≈0, restitution,
  soft speed cap, difficulty table (mallet speed / reaction frames / telegraph / shot
  power for Easy/Med/Hard), match target (default 7).
- **Verify:** builds clean; boots to menu (boot harness).

### Phase 1 — Physics core (silent) + orientation tracer
Files: `content/table.js`, `content/puck.js`, `content/physics.js`,
`content/audio.js` (minimal), `src/js/app/screen/test.js`, `public/index.html`
- Geometry (walls, two goal mouths, center line; `inBounds`/`whichWall`/goal detect).
- Frictionless puck; sub-stepped integration (adapt sub-steps to speed vs radius);
  multi-pass collision vs rails; soft speed cap (scale over cap, no hard clamp);
  velocity-aware normal fallback; stuck-puck force-drain.
- Tracer: `updateListener()` (pos = mallet-stub, fixed yaw `Math.PI/2`) + always-on
  puck voice; `#test` screen (front/right/behind/left tick).
- **Verify:** sim (no tunneling, energy bounded, goals fire). **[ear]** front/back/L/R.

### Phase 2 — Your mallet & controls
Files: `content/mallet.js`, `content/physics.js`, `src/js/app/controls/mappings.js`,
new touch adapter, `src/js/app/screen/game.js`
- Velocity control from `app.controls.game()`, confined to your half + rails.
- Momentum-transfer mallet→puck on contact; min-distance clamp on the puck's binaural
  feed (listener rides the mallet → ~0 distance at contact).
- Arrows + gamepad stick; **new touch thumb-stick adapter** (template ships only
  mouse/pointer-lock — net-new): drag from touch-down = direction + speed, release =
  stop, no on-screen target.
- **Verify:** scripted-input sim intercepts puck and adds pace.

### Phase 3 — Full audio  **[ear]**
Files: `content/audio.js`, `content/events.js`, `src/js/app/screen/learn.js`
- Blower bed (mono ambient, ducks in rallies); home hum (continuous, behind);
  opp-goal aim ping (~1/s, ducks near puck); threat alarm (trajectory-gated,
  escalating); source-coded impacts (your/opp clack, positioned rail thunk,
  bright/dark goal drops); serve/countdown cues; menu/goal/win jingles.
- `env()` ADSR helper; `silenceAll()` on game-screen exit; `sample()`/`testDirection()`.
- `#learn` screen auditions every cue.
- **Verify:** user, by ear — make-or-break pass.

### Phase 4 — AI opponent
Files: `content/ai.js`, `content/physics.js`, `content/audio.js`
- Reaction-delay ring buffer (reads puck N frames in the past); defend/intercept vs
  attack states; telegraphed strike (windup → drive); per-difficulty params; symmetric
  in own half; opp-hit clack (source B).
- **Verify:** sim — difficulty monotonic; winnable by skilled AI proxy AND beatable.

### Phase 5 — Match flow & screens
Files: `content/scoring.js`, `content/game.js`,
`src/js/app/screen/{menu,gameover,help}.js`, `src/js/app/announce.js`,
`public/index.html`, i18n keys (EN/ES)
- Goal → serve(conceding half) → ready/countdown → play; first-to-target win/lose.
- Menu: difficulty picker, target (7/11/15), records, help, language, start.
- Announcer: polite (score) + assertive (goals, match point, danger); re-read handling.
- F1–F4 hotkeys (score / puck bearing+dist / your position / serve+difficulty);
  rising-edge wall-bump probe.
- **Verify:** full match start→finish (sim + boot harness).

### Phase 6 — Persistence & leaderboard
Files: `src/js/app/records.js`, `src/js/app/onlineScores.js`,
`src/js/app/onlineSubmit.js`
- Dual-backend records (W-L + best streak per difficulty), outside `engine.state`
  (Electron file / web localStorage).
- Submit best Hard-mode streak per `/home/scores/INTEGRATION.md`; register id
  `air_hockey` with the admin endpoint (external dep — local-only fallback until done).
- **Verify:** records survive reload.

### Phase 7 — Balance & polish  **[ear]**
- Tune difficulty numbers, soft cap, threat thresholds, beacon mix, blower duck.
- Browser playtest + `#test`/`#learn` sign-off; Electron check (`pnpx gulp electron`).

## Open risks
- Touch thumb-stick adapter is net-new (no template adapter to copy).
- Puck-on-mallet binaural blowup at contact → min-distance clamp (Phase 2).
- `air_hockey` leaderboard id registration is external/pending → local-only until then.
- Phases 1-tail, 3, 7 need the user's by-ear sign-off — not closeable from this checkout.
