# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Pizza!** — an audio-first, blind-accessible pizza-delivery arcade game built on the syngen Web Audio engine and the syngen-template scaffolding. Ships as HTML5 (served from `public/`) and Electron (`electron/main.js`). Localised English + Spanish.

The player is a pizza courier. Each **job** generates N pizzas, each with random ingredients and a delivery address on a 6×6 grid of named streets. The player hears the briefing at the shop (memorising which pizza goes where), then drives a bike with continuous physics through traffic, GPS turn-by-turn, traffic lights, pedestrians, and police. Tip per delivery decays with time-overshoot and infraction penalty; a $0 delivery, getting caught by police, or running out of bike ends the run.

The template's general guidance still lives below this section — refer to it for the audio engine conventions, screen FSM, settings, controls, etc. The sections below cover what's specific to Pizza! and override the template's defaults where noted.

There is no test suite, no linter, and no `npm` scripts beyond gulp passthroughs. All tasks run through Gulp (`npx gulp <task>`).

## Pizza! gameplay & architecture

### Two-stage run loop

A run is a sequence of **jobs**; each job runs the screen FSM through `briefing → game → briefing → … → gameover`.

1. **Briefing** (`app/screen/briefing.js`) — `content.game.beginBriefing()` generates the next job's pizzas and the screen reads them aloud (ingredients + address). Player can re-read pizza N with the digit key N. Space starts driving.
2. **Driving** (`app/screen/game.js`) — `content.game.startDriving()` enters the run-FSM `driving` phase. The player picks up the bike at the shop, the GPS routes to the first held pizza's address, and the player throws by selecting a pizza number then Space. After all pizzas are delivered, GPS auto-routes back to the shop. On arrival at the shop, the job settles, runTips is updated, and we transition `nextJob → briefing`.

The top-level run state machine lives entirely inside `content/game.js` (`_state.phase: 'idle' | 'briefing' | 'driving' | 'settling' | 'gameOver'`). The screen FSM only sees coarse `briefing/game/gameover` transitions; the per-frame orchestration of bike + traffic lights + peds + police + GPS + audio happens in `content.game.frame()`, called from the game screen's `onFrame`.

### `content/` module layout (Pizza-specific)

- **`world.js`** — 6×6 street grid built at run start. Streets at x/y = 0, 100, …, 500m. `ROAD_HALF_WIDTH = 8` so each road is 16 m wide; `isOffRoad(x, y)` is just `nearestSegment(x, y).dist > ROAD_HALF_WIDTH`. `Pizza` (vertical, x=200) and `Avocado` (horizontal, y=300) are reserved every run; the other 8 names are drawn from the active locale's `pools.streetNames`. Restaurant is fixed at the (Pizza, Avocado) intersection. Exposes `intersections()`, `segments()`, `bfs()`, `nearestSegment()`, `addressToPoint(name, n)` and its inverse `pointToAddress(x, y)`. Both return address components (`addrN`, `addrStreet`) plus a getter `.address` that defers to `app.i18n.formatAddress` at read time — never store the rendered address string.
- **`bike.js`** — Continuous (x, y, heading, speed) physics. `MAX_SPEED = 14` m/s, `ACCEL = 9`, `BRAKE_DECEL = 32` (down arrow stops in <0.5s), `TURN_RATE = 2.4` rad/s at low speed scaled by `1/(1 + speed/SPEED_TURN_DAMP)` where `SPEED_TURN_DAMP = 5` — at top speed the effective turn rate is ~0.63 rad/s, deliberately low so a small steering input can't fling the bike off the road. Bikes do **not** reverse — down-arrow brakes to 0 and holds; `state.speed` is non-negative by construction, so steering has no sign-flip path. `STOP_SNAP = 0.4` snaps sub-threshold drift to zero. `state.placedAt` is set on every `reset/placeAtRestaurant` and is read by `pedestrians.js` for spawn suppression. Off-road behavior depends on `app.settings.computed.offroadProtection`: when **off** (default), the move is taken full-step and an off-road landing rolls back, kills speed, stuns for `STUN_TIME`, names the building (random per-locale `crashBuildings` pool) and street, emits `crash`, and opens the road-seek bell window. When **on** (player-toggled in the settings screen), the move is attempted axis by axis — try the full step, if off-road try x-only, then y-only — so the bike slides along the curb instead of crashing; speed is scrubbed to 0.85 on a successful slide and 0.4 on a fully blocked move (no event, no announce, no stun). Polite "edge of road" announce throttled to `EDGE_WARN_COOLDOWN`.
- **`gps.js`** — BFS once on `setTarget`, full intersection path cached in `_state.path`. Each frame `refreshPlan()` finds the next path node the bike has **not yet passed in the leg's travel direction** (along-direction dot product), and computes the action at that node from the bike's **current** heading toward the after-node — so F1 reflects the live facing rather than a stale snapshot. Leg advance is detected by `pathIdx` change, which resets announcement bands. Off-route is detected by **perpendicular distance from the bike to the current leg** (`PERP_OFF_ROUTE = 14m`) with a 1.0s debounce, then triggers "Recalculating route" + a fresh BFS. Threshold announcements fire at 200/100/50/now using the band that matches the **actual** remaining distance (no more "in 200m" when the next intersection is 100m away). STRAIGHT legs collapse to a single `gps.continue` line — bands are pre-marked so the player isn't bombarded with "in Xm continue straight". `decideActionFromHeading` classifies LEFT / RIGHT / STRAIGHT / **U-TURN** (`|diff| > 3π/4`); the U-turn pool is `gpsTurnAround`. `currentInstruction()` (F1) calls `refreshPlan()` first, and forces a silent recalc if off-route at the moment of the press. `maybeAnnounceCrossing()` per-frame fires polite "Crossing ahead. Light is X." when the bike approaches any intersection while moving (per-intersection 8s cooldown).
- **`pizzas.js`** — Per-job inventory. `firstActivePizza()` returns the next non-delivered pizza in held order — this is what the GPS routes to, **not** `selectedPizza()`. `selectRandomActive()` is called at `startDriving` so even on a 2-pizza job the initial selection isn't trivially correct.
- **`game.js`** — The top-level run controller (described above). Owns the tip math (`30 + 6*km` budget, `0.10` per red, `0.20` per ped, `0.05` per pursuit-second, `tip = baseTip * timeFactor * max(0, 1 - violationPenalty)`), the FSM, the shop-arrival check (`<22m` of restaurant), and event bindings (ranRed → arm cops, hitPed → arm cops + announce, caught → game over).
- **`police.js`** — `arm()` flips a flag; the next `frame()` spawns one cop on the nearest road segment ~70m behind the bike. `COP_MAX_SPEED = 17` (faster than bike) so pursuit actually closes. BFS-routed: recomputes path every 1s; within `FINAL_LOCK = 25m` switches to direct steer. Catches the bike when within `CATCH_DIST = 4.5m` and emits `caught`. "Shake them" rule: 5s no LOS or >220m gap → despawn.
- **`trafficLights.js`** — One state machine per intersection (12s green / 2s yellow / 12s red), staggered by deterministic offset. Detects the bike crossing an intersection box during red on its travel axis and emits `ranRed`.
- **`pedestrians.js`** — Spawn at intersections during the cross-traffic walk phase. **3-second post-spawn grace** during which peds can't spawn within 14m of the bike (otherwise the corner spawn gets walked into). `hitPed` only fires when bike `|speed| ≥ 0.6` m/s — a parked bike is the ped's fault, not the player's. Swept-circle collision (last → current bike position) prevents tunneling.
- **`audio.js`** — Player-locked binaural listener (yaw = `-bike.heading`). All persistent voices go through `makeSpatialProp(buildVoice, options)` which adds: per-source binaural ear, behind-listener lowpass (22 kHz → 700 Hz), and a `ConstantSourceNode` detune signal (0 → −120 cents) that voice builders connect to their oscillators' `detune`. The bike engine has an idle gate (4.5 Hz LFO when speed and throttle are both ~0) and a high-shelf brightening as you approach an intersection.
- **`events.js`** — Tiny pub-sub used for `crash`, `hitPed`, `ranRed`, `pursuitStart/End`, `caught`. Cross-module fan-out without circular imports.

### Audio scene composition

The driving soundscape layers, all binaural except where noted:
- **Bike engine** (non-spatial, player-locked) — FM carrier 90 → ~140 Hz with speed; idle chug at low speed; high-shelf bright when an intersection is within 30m.
- **Sustained traffic-light tone** at every intersection within 45m, gain falling off with distance. Patterned on real-world accessible pedestrian-crossing audio (the cue is for blind people approaching the crossing): GREEN is the rapid "walk" beep — 1000 Hz square, 50 ms on / 150 ms off (5 Hz tick) — bike GO and perpendicular peds walking. YELLOW is medium 660 Hz pulses (0.25 s on / 0.25 s off) — warning. RED is a slow "don't walk" tick — 480 Hz, 40 ms click each ~1 s — bike STOP, perpendicular vehicles crossing. Voice rebuilt on state change. Note: this is intentionally counter-intuitive from a *driver's* point of view (red beeps slowly, green beeps fast) but matches the convention blind players hear at real intersections, so the cue maps to existing real-world muscle memory.
- **Per-crossing tick beacons** — each intersection within 75m emits a short binaural tick every ~1.7s (staggered), pitch encoding the bike-axis light state (320 Hz red / 700 Hz yellow / 1320 Hz green). This gives a blind player both spatial localisation of crossings and state info.
- **Restaurant beacon** (warm sine + overtone, 0.7 Hz tremolo) — only audible when delivering all pizzas is done and you're heading back.
- **Active-delivery beacon** (bright triangle + overtone, 1.5 Hz tremolo) — at the current GPS target's address point.
- **Next-turn bell** (`emitBell` at 1100 Hz, ~1.4 s cadence) — periodic struck-bell ring positioned **8 m past the next-decision intersection along the post-turn leg**, not at the intersection itself. The offset is computed inside `gps.currentTurnPoint()` from `(next - node)` of the chosen path leg. The point: a player who turns into the correct corner hears the bell directly ahead of them as confirmation; a wrong turn pushes the bell off to one side or behind. `currentTurnPoint()` still walks past STRAIGHT legs so the bell sits on the next *decision*, and exposes `vIdx, hIdx` if a caller needs the raw intersection. Routes through `gainModel.exponential` with `maxDistance: 480`, so it carries across the whole 6×6 grid. Each ring re-bakes the binaural relative vector at emit time. When the turn shifts to a new intersection the bell rings immediately rather than waiting out the cadence.
- **Road-seek bell** (`emitBell` at 540 Hz, ~0.45 s cadence) — sustained directional cue while `bike.state.roadSeekUntil > now` (set on crash to `STUN_TIME + 1.8 s`). Position recomputed each ring: nearest road segment + 14 m ahead along the bike's last travel direction. Distinct from the next-turn bell by pitch (lower) and faster cadence so the two cues never read as the same beacon.
- **Road-edge rumble** (`buildEdgeRumbleVoice`, looping brown noise → highpass 70 Hz → lowpass 180 → 480 Hz → stereo pan → out) — continuous "you're on a road with edges" cue created in `audio.start()`, modulated each frame from `bike.state.curbDistLeft / curbDistRight`. The cue plays *whenever at least one curb is within probe range* (i.e., the bike is on a normal road segment): gain ramps from `BASELINE_GAIN = 0.06` at centerline up to `PEAK_GAIN = 0.42` at the curb (with `urgency = max(0, 1 - dMin/RANGE)`, `RANGE = 11`). Lowpass cutoff opens with urgency but stays in the rumble band (180 → 480 Hz) so the cue can never read as "hiss" — it's a low tire-on-pavement texture that grows louder + slightly brighter as you near off-road, never a high-frequency wash. Stereo pan tracks the side bias `(lFin - rFin) / (lFin + rFin) * 2.5`. The crossing cue is the *absence*: when both probes return Infinity (intersection center), gain → 0 and the road feels open. The baseline-not-zero design is load-bearing for crossing detection; the keep-it-LOW baseline is load-bearing for not-fatiguing-the-listener — earlier iterations used `0.22` and the user reported it as "huge hissing at the centerline." Lives between `audio.start()` and `audio.stop()`; silenced from `silenceAll()` on screen exit.
- **Turn-confirm bell** (`oneShot('turnConfirm')`, 880 → 1109 Hz two-tone struck-bell, ~0.5 s) — non-spatial. Fires from `gps.frame()` when `pathIdx` advances and the leg the bike just left had a turn action. STRAIGHT crossings don't get a bell. Bell partials (1x / 2.04x / 2.97x) match the spatial bells' timbre so the player connects "the bell I was chasing is now confirmed."
- **Wrong-turn buzzer** (`oneShot('wrongTurn')`, 180 → 120 Hz square pair, 0.45 s) — fires alongside the assertive "Recalculating route" announce when off-route is debounced past 1.0 s.
- **BFS-routed delivery tick** — short directional ping every 1.5s from the next planned BFS waypoint, pitch dropping as path-distance shrinks.
- **Pedestrians** — scheduled footstep noise-tap envelopes, ~0.55s spacing, lowpassed at 1.4 kHz.
- **Police siren** — 700–1100 Hz LFO sweep + 1400–2200 Hz harmonic, attached to the cop position.
- **GPS chime** — non-spatial sine glissando 880 → 1320 Hz before each turn announcement.

### Localisation: address & street formatters (CRITICAL)

EN and ES street names follow different conventions:
- EN names sometimes already include their type (`Pepperoni Plaza`, `Anchovy Avenue`, `Mushroom Mews`) and sometimes don't (`Pizza`, `Avocado`).
- ES names sometimes have a Spanish street-type prefix (`Plaza Albóndiga`, `Calle del Pimentón`, `Pasaje del Mojo`) and sometimes don't (`Pizza`, `Aguacate`).

Two helpers in `app/i18n.js` make this work:
- **`app.i18n.formatAddress(n, street)`** → renders a full address (`66 Plaza Albóndiga` in EN, `el número 66 de la Plaza Albóndiga` in ES, with `del` for masculine ES types like Pasaje/Camino/Paseo).
- **`app.i18n.formatStreet(name)`** → renders a street reference for "turn onto X" / "por X" sentences (`Pizza Street`, `la calle Pizza`, `la Plaza Albóndiga`, `el Pasaje del Mojo`).

**Never concatenate `street + ' Street'` or `'la calle ' + street` directly** — both are wrong in either locale half the time. ES gps templates have already had `por la calle` removed; they take a pre-formatted `{street}` slot. EN templates take a similarly-formatted slot.

Pizza objects, restaurant points, and GPS targets all store address **components** (`addrN`, `addrStreet`) plus a `get address()` getter that calls `formatAddress` at access time — so a locale switch mid-run renders correctly.

### Memorization mechanic (most surprising design choice)

The point of the game is to **memorise which pizza belongs at which address** during the briefing, then deliver them. To support that:

1. **GPS routes to addresses in held order**, independent of which pizza is selected. Selection only chooses what leaves the bag on Space.
2. **Selecting a pizza never announces its address** — only `Selected pizza N.` This was a deliberate move; the previous behavior re-targeted the GPS on selection, which leaked the address.
3. **After a successful delivery, selection is NOT auto-advanced.** The player has to press a number for the next throw (or get a polite *"Press a pizza number from 1 to N…"* prompt). This forces the memorisation step every delivery.
4. **At `startDriving`, the initial selection is uniformly random across active pizzas** (not always slot 0). On a 2-pizza job that means a random pizza is in your hand and you must verify it before throwing. The polite `ann.startSelected` announces this.
5. The `tryThrow()` check is purely positional: is the bike near the **selected** pizza's address? If yes, deliver; if no, the pizza is lost and the run ends at job-settle (deferred via `_state.pendingGameOver`).

### Game-over reasons

- `gameover.reasonZeroTip` — a delivery yielded $0 tip (overshoot ≥ 2× budget OR violationPenalty ≥ 1.0).
- `gameover.reasonCaught` — the cop physically reached the bike (within 4.5m).
- `gameover.reasonCrash` — defined in i18n but not currently triggered (crashes only stun the bike, they don't end the run). Reserved for future "n crashes per job" rule.

### F-key hotkeys (driving screen)

Bound directly via `window.addEventListener('keydown', …, true)` so browser F1/F3/F5 defaults are cancelled in capture phase. F2/F4 don't have browser actions but use the same path for consistency.

| Key | Action |
|---|---|
| F1 | `gps.currentInstruction()` — actively-computed next turn (NOT the last-spoken line) |
| F2 | Held pizza details (number, ingredients, address) |
| F3 | Distance to the pizza shop |
| F4 | Time elapsed in current job + run-total tips |
| F5 | Current street address (`world.pointToAddress(bike.x, bike.y)`) |

### Persistence

- `app.autosave` is **disabled** in `main.js` — Pizza doesn't autosave game state.
- High scores (top 10 by run-total tips) live in `app.highscores` with key `pizza-highscores-v1`. Electron writes a JSON file via the preload bridge; web falls back to `localStorage`.
- Locale lives in `localStorage[pizza.lang]` (resolved before `app.storage.ready()` so first-boot announcer text uses the right language).

## Pizza-specific gotchas

- **Don't store rendered addresses anywhere.** Always store `(addrN, addrStreet)` and use the getter or `app.i18n.formatAddress(n, street)`. Same for street references in turn announcements: pass the raw name through `app.i18n.formatStreet(name)` — the i18n templates do NOT prepend `por la calle` / `Street` themselves.
- **`gps.lastSpoken` is unreliable for F1.** Every ambient announce (`maybeAnnounceCrossing`, `recalculating`, etc.) overwrites it. Use `gps.currentInstruction()` for any "what should I do now?" read-out.
- **GPS target ≠ selected pizza.** `setNextTargetFromInventory()` reads `firstActivePizza()` (held order). Don't call it from `selectPizza` — that would defeat the memorization mechanic.
- **Pedestrian-spawn grace.** `bike.state.placedAt` must be set on every reset (not just at restaurant placement) — `pedestrians.js` reads it to suppress spawns for 3s within 14m of the bike. Without this, you spawn at the corner and a ped instantly walks into you before you can press Space.
- **Crash sound vs. crash event.** A crash plays the SFX, names the building (per-locale `crashBuildings` pool), and announces — but does NOT end the run. Only `caught`, $0-tip, or end-of-run-with-pending-game-over does. Don't add `triggerGameOver` to the crash handler unless the design changes.
- **Cop must be faster than the bike.** `COP_MAX_SPEED > MAX_SPEED`. If you ever lower it back to the bike's speed, pursuit becomes unwinnable (cop never closes).
- **Pizza-per-job schedule** lives in `content.game.pizzasForJob(n)` — the formula is `1×4, 2×3, 3×2, then +1 every 2 jobs capped at 9`. Don't duplicate this in pizzas.js.
- **Sustained light tone vs. crossing tick.** Both are wired and intentional — the sustained tone gives state ambience for nearby intersections (≤45m), the periodic tick gives spatial localisation (≤75m) and reinforces state via pitch. Don't remove one thinking the other is redundant.
- **Next-turn bell ≠ crossing tick.** The next-turn bell rings every ~1.4 s at the *single* upcoming decision-point intersection from `gps.currentTurnPoint()`. The crossing tick fires at *every* intersection within 75 m and encodes light state by pitch. Both can play at the same intersection (when the next decision is at a nearby crossing) — they're complementary, not duplicate. Distinct timbres (struck bell vs. short tonal tick) and cadences keep them separable.
- **Bell beacons use a wide-range gain model.** `emitBell` sets `maxDistance: 480` and `power: 1.2` because the grid spans up to ~700 m corner to corner. Don't fall back to the default 60 m or even the 110 m we tried originally — at those values the next-turn bell is silent from across the map, which was the whole reason the user couldn't hear it. The HRTF panning still does the localisation; gain just stays in the audible band.
- **Edge cue must be continuous-while-driving, not on-hit.** Earlier iterations played edge sounds only on the impact frame (crash one-shot) or as discrete beeps that gated themselves off in the safe zone. Both failed: the player needs the cue to *prevent* the crash, not to *announce* it. The current `buildEdgeRumbleVoice` is a persistent voice modulated each frame; gain naturally goes to 0 in the safe zone (curbs > 8 m away) and rises smoothly as the bike approaches a curb. Don't replace this with discrete one-shots.
- **Edge rumble uses stereo, not binaural.** `buildEdgeRumbleVoice` routes through `StereoPannerNode` with `pan ∈ [-0.95, 0.95]` because the cue must read unambiguously L/R when the bike is parallel to a wall — binaural's HRTF nulls and head-shadow attenuation make near-perpendicular sources ambiguous. Don't "upgrade" this to a binaural source.
- **Curb probe is perpendicular to bike heading, not to the road.** The two differ when the bike is turning or has just turned. Bike-frame probes give "I'm drifting toward my right" (matches body intuition) — road-frame probes would give "I'm on the south side of this road" which is much harder to act on without a map. The probes use `right = (-sin h, cos h)` and `left = -right`, with `curbDistance` stepping outward in 0.5 m increments up to `CURB_PROBE_MAX = 16 m` and returning Infinity past that. The Infinity sentinel is load-bearing: when the perpendicular ray runs down a cross street at an intersection, the cue naturally fades to 0.
- **`bike.state.roadSeekUntil` is the only road-seek control.** Bike sets it on crash (now + STUN_TIME + 1.8). Audio's `syncRoadSeekBell` rings while `now < roadSeekUntil`, recomputing the bell position each ring from `nearestSegment + 14 m along bike heading`. Don't add a separate fire-and-forget helper — the deadline is the contract.
- **Idle gate timing.** Engine `update(speed, throttle, lightProx)` is called from `audio.frame()` every frame. The idle LFO depth ramps via `setTargetAtTime(…, 0.18)` so transitions are smooth. If you ever read throttle from a stale source (e.g. a snapshot), the idle gate will lag — always read live `app.controls.game()`.
- **Bikes don't reverse.** Down-arrow brakes to 0 and holds. If you ever re-add reverse, you'd also need to re-add the `sign = speed < 0 ? -1 : 1` steering flip and the negative-speed branch in coast. The current code assumes `state.speed >= 0` everywhere downstream (audio engine pitch maps from `speed`, not `|speed|`; the bike-axis crossing detection uses `speed >= 0.6` not `|speed|`).
- **GPS off-route uses perpendicular distance, not intersection snap.** `refreshPlan()` measures the bike's perpendicular distance to the current leg's line; >14m → off-route. Don't replace this with `Math.round`-based `nearestIntersection` checks — those jitter at 0.5-cell boundaries (the snap flips between two adjacent nodes as the bike crosses x.5/y.5 grid lines, producing spurious "Recalculating route" calls mid-leg). The along-leg dot product handles leg progression independently and is what advances `pathIdx`.
- **GPS path is prepended with the bike's "back endpoint".** `recalculate()` starts BFS from the FORWARD endpoint of the bike's current segment (the intersection the bike is heading toward) and then prepends the back endpoint, so `_state.path[0]` is behind the bike and `path[0]→path[1]` is the road the bike is actually on. This is load-bearing: without it, a fresh recalc rounds the bike's mid-segment position to a 100 m grid corner via `nearestIntersection`, and BFS picks a first leg that may go perpendicular to the bike's road. `perpOnLeg` then rejects the plan immediately and F1 reads "No active route" until the bike happens to drive far enough straight to land back on a leg. The visible bug was that any disturbance (crash, off-road, wrong turn) lost the route. Don't refactor `recalculate` to drop the prepend — segment-aware start is the whole point.
- **`pickCurrentSegmentEndpoints` prefers the heading-aligned axis.** A bike sitting at an intersection is equidistant from up to four segments. Picking by raw distance is iteration-order dependent and can pick a perpendicular segment, putting the wrong "back" endpoint into the path. Prefer the segment whose axis matches the bike's dominant heading axis (so a north-facing bike at a corner picks the vertical segment ahead); fall back to nearest of any axis only if no heading-aligned segment is on the road.
- **`refreshPlan`'s "passed" check uses BOTH incoming and outgoing leg directions.** A node is passed if `outAlong > 0.5` OR `inAlong > 0.5`. Outgoing alone misses the overshoot case (bike continued straight past a turn intersection — outgoing dot is zero on the perpendicular leg, so `pathIdx` would never advance and F1 would read a stale "turn left in X m" forever). Incoming alone misses the "turned correctly into a perpendicular leg" case. The OR keeps it honest both ways.
- **`targetIntersection` is re-picked on every recalc.** As the bike's position changes, the closer endpoint of the destination segment can flip. Freezing the choice at `setTarget` time bakes a U-turn at the destination into the recalc'd route. `pickTargetIntersection` reads the bike's live position and is called from both `setTarget` and `recalculate` — make sure target objects passed in carry the segment metadata (`axis`, `vIdx`/`hIdx`, `segHIdxA/B` or `segVIdxA/B`); otherwise `pickTargetIntersection` falls through to `nearestIntersection(point.x, point.y)` and the smart endpoint logic is bypassed.

## Starting a new game from this template

**This is a BLOCKING requirement.** Whenever the user describes a brand-new game to build on top of this template — i.e. `src/js/content/` is empty or contains only stub/example code, and the project does not yet have a game-specific `CLAUDE.md` of its own — you MUST ask the foundational design questions below before writing any `content/` code or making any architectural commitments. Picking wrong and refactoring later is expensive (especially #2 — audio listener mode is hard to retrofit). Skip questions the user has already answered explicitly in their first prompt; batch the remaining questions into a single message so the user answers them all at once.

Once you have an existing game-specific `CLAUDE.md` in the project root, ongoing work is no longer "starting a new game" and these questions do not need to be re-asked.

### Required questions

1. **Perspective and movement model.** Top-down 2D tile-based (Pac-Man, Zelda 1)? Top-down 2D continuous? Side-scrolling 2D? First-person 3D? Third-person 3D? Static / turn-based / menu-driven? This determines the coordinate system, collision model, and how `app.controls.game()` is consumed.

2. **Audio listener behavior** — *the single most important question, ask it explicitly even if the user gave hints.*
   - **Screen-locked (Pac-Man style)** — listener yaw is **fixed**; sounds always come from their actual screen position. A ghost south of the player always sounds behind, no matter which way the player last moved. Best for fixed-camera 2D games where the player views the world from above and the camera never turns.
   - **Player-locked (FPS-style)** — listener yaw tracks the player's facing direction; "front" is whatever the player is facing. Best for first-person 3D and games where the avatar's heading IS the camera.
   - **Camera-locked (third-person)** — listener yaw tracks the camera, not the avatar. Useful when camera and avatar can rotate independently.
   - **Stereo / non-spatial** — skip 3D positioning entirely; use `StereoPannerNode` per source, or mono cues. Best for menu-driven, turn-based, or purely musical games.

3. **Audio's role.** Audio-first / blind-accessible (sighted UI minimal, must be playable purely by ear)? Equal (visuals and audio both first-class)? Audio supportive (visuals primary, audio feedback only)? This affects how much effort goes into spatial cues, screen-reader announcements, and visual UI.

4. **Input devices.** Keyboard only? Keyboard + gamepad? Keyboard + mouse? All three? The template ships with all three adapters wired; the answer determines which mappings to define and which adapters to disable.

5. **Persistence.** Continuous autosave of full game state? Discrete saves (manual / per level)? High scores only? No persistence? This determines whether `app.autosave` stays enabled and what `engine.state.export()` should serialize.

6. **Progression structure.** Endless / score chase? Levels with discrete progression? Branching / non-linear? Single fixed scenario? Drives the screen FSM (need a level-clear screen? a game-over screen? a high-scores screen?).

7. **Synth aesthetic.** Chiptune / retro (raw squares and saws)? Modern synth (filtered triangles, soft pads, sub-bass)? Procedural / generative? The template is synth-only — sampled audio needs additional wiring.

### Implementation pointers per answer

**Audio listener — screen-locked.** Set yaw to a constant in `content.audio.updateListener()` and don't update it from player direction. Anchor audio-front to whichever screen direction feels like "up" to the player (typically screen-north). With the screen→audio y-flip in place, `LISTENER_YAW = Math.PI / 2` puts audio-front at screen-north:

```js
const LISTENER_YAW = Math.PI / 2 // screen-north = audio-front
function updateListener() {
  const p = content.player.getPosition()
  engine.position.setVector(tileToM(p))
  engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}))
}
```

`behindness()` reads the same constant via `_lastYaw`, so a "behind" muffle still triggers for sources opposite the anchored front. Build a diagnostic screen that emits ticks at front/right/behind/left around a static listener with the same yaw, and verify by ear after any change. The `audio-pacman` repo (`../pacman/src/js/content/audio.js`) is the reference implementation.

**Audio listener — player-locked.** Update yaw from the player's facing every frame:

```js
const d = content.player.state.dir
const yaw = Math.atan2(-d.y, d.x) // negate y to match the screen→audio flip
engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))
```

`behindness()` then naturally means "behind the player's heading" — the FPS interpretation.

**Audio listener — camera-locked.** Track the camera's yaw, not the avatar's. If the camera lags behind the avatar (smoothed follow), low-pass the yaw before applying so listener orientation doesn't snap.

**Audio — stereo only.** Skip the binaural pipeline entirely. Per source: a `StereoPannerNode` whose `pan` is the source's screen-x relative to the player, clamped to `[-1, 1]`. No `engine.position`, no listener yaw.

**Movement — tile-based grid.** Use queued-direction movement (store current `dir` and a queued `dir`; on each tile center, swap if the new tile is passable). Add a small "cornering" window near tile centers where motion happens on both axes for smoothness. The pacman repo's `content/pacman.js` is the reference.

**Movement — continuous free.** Read `app.controls.game()` each frame for `{x, y}` and integrate position. Collision is geometric (AABB or circle-vs-tile), no grid snap needed.

**Persistence — autosave.** Leave `app.autosave` running. Each `content.*` module exposes import/export hooks via `engine.state`. Keep saved state small — most gameplay state should rebuild on level start.

**Persistence — high scores only.** Disable `app.autosave` in `main.js`. Add a dedicated `app.highscores` module reading/writing its own storage key. The pacman repo's `src/js/app/highscores.js` is a reference.

**Progression — levels.** Add `levelClear` and `gameOver` screens to the FSM. The game's top-level FSM (in `content/game.js` or similar) typically transitions `intro → ready → play → death/levelClear → play (next level) | gameOver`.

## Common commands

```sh
npm install                # install deps (must run first; Gulpfile expects node_modules/syngen)
npx gulp build             # one-shot build of public/scripts.min.js + public/styles.min.css
npx gulp watch             # rebuild on src/** changes
npx gulp serve             # static server for public/
npx gulp dev               # serve + watch in parallel
npx gulp electron          # launch Electron against current public/ build
npx gulp electron-rebuild  # build then launch Electron
npx gulp dist              # build + package electron-packager + zip HTML5 build into dist/
```

`--debug` (e.g. `npx gulp build --debug`) skips minification and IIFE wrapping, and appends `-debug` to the version injected at the bottom of `scripts.min.js`. `app.storage` strips `-debug` when keying versions, so debug and release share saved state.

The build artifacts `public/scripts.min.js` and `public/styles.min.css` are gitignored — never edit them.

## Architecture

### Three globals, concatenated in order

`Gulpfile.js` concatenates all source files into a single `public/scripts.min.js`. There is no module system; everything lives on three namespaces attached to `window`:

- **`engine`** — alias for `syngen` (`src/js/engine.js` is just `const engine = syngen`). Use the [syngen API](https://syngen.shiftbacktick.io/) for audio, FSMs, pubsub, vectors, input polling, the frame loop, state import/export, etc.
- **`app`** — the UI scaffolding (screens, controls, settings, storage, updates, haptics, utilities). Defined incrementally across `src/js/app/**`.
- **`content`** — empty by default; this is where game-specific logic lives. Plug in via `src/js/content/`.

The Gulpfile's `getJs()` order matters: `node_modules/syngen/dist/syngen.js` → `src/js/engine.js` → `src/js/content.js` → `src/js/content/**` → `src/js/app.js` → `src/js/app/screen/base.js` → `src/js/app/utility/*.js` → `src/js/app/*.js` → `src/js/app/**/*.js` → `src/js/main.js`. New files placed in those directories are picked up automatically; nothing needs registering. **The base screen and utilities load before other app modules** because screens and other modules reference them at definition time.

`src/js/main.js` is the bootstrap: awaits `engine.ready()`, calls `app.storage.ready()`, `app.updates.apply()`, `app.settings.load()`, `app.screenManager.ready()`, configures the syngen mixer (reverb impulse + limiter params), starts `engine.loop` (paused), then dispatches `activate` to the screen FSM and calls `app.activate()`. HTML5 builds also wire a `beforeunload` confirmation when the loop is running.

### Screens (FSM-driven)

`app.screenManager` wraps `engine.tool.fsm`. Each screen is created with:

```js
app.screen.foo = app.screenManager.invent({
  id: 'foo',
  parentSelector: '.a-app--foo',  // outer wrapper that gets aria-hidden / hidden / animation classes
  rootSelector: '.a-foo',          // inner element where focus is trapped and placed
  transitions: { someEvent: function () { this.change('bar') } },
  state: { ... },
  onReady, onEnter, onExit, onFrame, onImport, onReset,
})
```

`invent` extends `app.screen.base` (in `src/js/app/screen/base.js`), which handles aria-hidden toggling, animation classes, focus trapping (`app.utility.focus.trap`), and dispatches the `on*` hooks. `engine.loop.on('frame', ...)` calls `onFrame` on the current screen each frame; `engine.state.on('import' | 'reset')` fans out to all screens so they can hydrate from a save.

The starting state is `none`; dispatching `activate` transitions to `splash`, which dispatches `interact` to enter `game`. To add a screen, drop a file in `src/js/app/screen/` and add the matching `.a-app--screen .a-app--<id>` markup in `public/index.html`.

### Storage, versioning, and updates

Storage is *per app version* and backed by IndexedDB through `app.storage.api` (with an in-memory proxy and debounced writes). Keys are `[version, key]` pairs, so each release version has its own namespace.

On boot, `app.updates.apply()` (in `src/js/app/updates.js`):
1. If no saved versions exist, sets the current version and exits.
2. If a save for the current version exists, uses it as-is.
3. Otherwise, finds the closest *earlier* saved version, clones its data into the current version's namespace, then runs every `app.updates.register(semver, fn)` migration whose semver is later than that earlier version, in order.

Version comparisons use `app.utility.semver` (parses `MAJOR.MINOR.PATCH-LABEL`). The injected `app.version()` value is replaced by `Gulpfile.js` from `package.json`'s `version` field.

`app.autosave` debounces saves of `engine.state.export()` to storage key `state` on a 30-second loop while enabled.

### Settings

`app.settings.register('fooBar', {default, compute, update})` auto-creates:
- `app.settings.setFooBar(rawValue)` — setter that recomputes and fires `update`.
- `app.settings.computed.fooBar`, `app.settings.raw.fooBar`, `app.settings.defaults.fooBar`.

`app.settings.load()` merges defaults with persisted raw values from storage key `settings` and runs each `update` once. Call `app.settings.save()` to persist after changes. `src/js/app/settings/example.js` documents the shape (commented out); `src/js/app/settings/offroadProtection.js` is a live one-line example. The `src/js/app/screen/settings.js` screen iterates a local `state.toggles` array to render one button per setting with `aria-pressed`; add a new toggle by registering its setting file and appending an entry to that array (plus i18n keys `settings.<key>` and `settings.<key>Desc`).

### Controls

`app.controls.update()` runs every frame (`engine.loop.on('frame', ...)`). It merges output from three adapters — `app.controls.gamepad`, `app.controls.keyboard`, `app.controls.mouse` — each with `game(mappings)` and `ui(mappings)` methods. Mappings live in `src/js/app/controls/mappings.js` and are tagged by `type: 'gamepad' | 'keyboard' | 'mouse'`.

- `app.controls.game()` returns the current frame's continuous game inputs (e.g. `{x, y, rotate}`).
- `app.controls.ui()` returns *deltas* — only the UI inputs that just became active this frame, used for menu navigation (so a held key fires once).

The mouse adapter takes pointer lock when entering the `game` screen (and re-acquires it after Escape in Electron). Gamepad axes are inverted in `game` to match keyboard semantics.

### Haptics

`app.haptics.enqueue({duration, startDelay, strongMagnitude, weakMagnitude})` queues a dual-rumble effect; magnitudes are summed across active events each frame, attenuated by `setSensitivity`, and dispatched to all dual-rumble gamepad actuators. `update(delta)` must be driven by the caller (typically by a screen's `onFrame`).

### Unified accessible UI shell

Every game in this collection shares the same accessible UI scaffolding so players (and screen-reader users) get the same shape across games. When you add a new game, follow this shape rather than inventing a new one:

- **`.c-screen`** wraps each screen's content with focus-trap-friendly layout.
- **`.c-menu` + `.c-menu--title` + `.c-menu--subtitle` + `.c-menu--list` + `.c-menu--button`** are the building blocks for menus, language pickers, gameover, help, etc. The CSS lives in `src/css/component/menu.css`. Press states are denoted with `aria-pressed="true"` (the language picker uses this for the active locale).
- Sections have `tabindex="-1"` and a translated `aria-label` via `data-i18n-attr="aria-label:..."`.
- An always-present `aria-live="polite"` region (and usually a separate `assertive` one) sits directly under `<main>` for announcer output. The exact element / class varies by game (`.a-app--announce`, `.js-announcer`, `.a-live`) — pick one and route every runtime announcement through it.
- The main menu always exposes a `Language` button that transitions to the `language` screen. If the game has no main menu (`roadsplat`, `template`), the splash carries the button instead.
- Help / How-to-play screens are linear prose using `data-i18n-html` for items containing `<kbd>` / `<strong>` so the markup stays inline-translatable.

### Localization (English / Spanish, extensible)

Every game in this collection ships with the same lightweight i18n module so menus, HUD labels, help text, and announcer strings can be served in the player's language. The system is identical across `bumper`, `combat`, `neverStop`, `pacman`, `pinball`, `pong`, `roadsplat`, `vfb`, and this template — copy the pattern verbatim when adding a new game.

**Files (per game):**

- `src/js/app/i18n.js` — the i18n module itself. Exposes `app.i18n` with `t(key, params?)`, `applyDom(scope?)`, `setLocale(id)`, `locale()`, `available()`, `localeName(id)`, and `onChange(fn)`. The module body is identical across games; only the `STORAGE_KEY` constant (e.g. `'pacman.lang'`) and the `dictionaries` object change. Resolution order on boot: `localStorage[STORAGE_KEY]` → `navigator.language` 2-letter prefix → `'en'`.
- `src/js/app/screen/language.js` — the language picker screen. Same logic in every game; only the `back` transition target differs (it should return to whichever screen reaches it — usually `menu`, or `splash` for menu-less games like `roadsplat` and `template`).
- `src/css/component/menu.css` — provides `.c-menu`, `.c-menu--list`, `.c-menu--button`, `.c-menu--button[aria-pressed="true"]`. The language screen relies on these.
- `public/index.html` — the language section uses class `a-language` inside `a-app--language`, with an empty `ul.c-menu--list.a-language--list` that the screen's `renderList()` populates from `app.i18n.available()`.
- `src/js/main.js` — calls `app.i18n.applyDom()` between `app.settings.load()` and `app.screenManager.ready()` so static DOM is translated before any screen's `onReady` reads it.

**Annotating static text:**

```html
<button data-i18n="menu.start">Start Game</button>             <!-- textContent -->
<li data-i18n-html="help.controlUp"><kbd>Up</kbd> — accelerate</li>  <!-- innerHTML, preserves inline tags -->
<section data-i18n-attr="aria-label:menu.aria;placeholder:foo.bar"></section>  <!-- attributes -->
<title data-i18n="doc.title">…</title>  <!-- the document title is special-cased by applyDom() -->
```

The English text in the markup is a **fallback for the moment between page load and `applyDom()`**, not the source of truth — the dictionary is. When you update a string, change the dictionary and let `applyDom()` re-render.

**Runtime strings:**

```js
app.announce.polite(app.i18n.t('ann.score', {score: 1234, level: 5}))
hud.statusEl.textContent = app.i18n.t('game.statusBoost', {seconds: 2.4})
```

Templates use `{name}` placeholders. Missing keys return the key itself (`'menu.unknown'`), which makes typos visible in the UI rather than silently empty.

**Adding the language screen to a new game:**

1. Add a `language` button to the main menu (or splash, for menu-less games) and wire its `data-action="language"` to a transition that runs `this.change('language')`.
2. Make sure the language screen's `back` transition returns to the originating screen.
3. Add the HTML language section: `<div class="a-app--screen a-app--language"><section class="c-screen c-menu a-language" tabindex="-1" data-i18n-attr="aria-label:language.aria">…</section></div>`.
4. Add an entry like `'menu.language': 'Language'` (and the matching `'language.*'` keys) to both the `en` and `es` dictionaries.

**Adding a new locale:**

1. Add the language to `localeNames` at the top of `i18n.js`.
2. Add a parallel block to `dictionaries` keyed by the same id. Missing keys fall back through `FALLBACK = 'en'` so partial translations are safe to ship.
3. The language screen will pick the new locale up automatically.

**Persistence rules:**

- Each game has its own `STORAGE_KEY` (`bumper.lang`, `pong.lang`, etc.) so locale choices don't leak between games when they're hosted under the same origin.
- `localStorage` is used directly, not `app.storage`, because the locale must resolve **before** `app.storage.ready()` finishes (some games run audio probes and announcer strings on boot, before the IndexedDB store is open).

**State that should be locale-stable:**

If a value is shown to the player twice in different ways — e.g. neverStop's stop reason is set in `content/car.js` and rendered later in `app/screen/gameover.js` — store the **i18n key**, not the rendered string, and translate at render time. neverStop does this with `car.stopReasonKey = 'stop.fuel'`. Rendering `app.i18n.t(car.stopReasonKey)` at the gameover screen means a player who switches language between dying and seeing the gameover screen still gets a coherent message.

For the same reason, the pinball table stores a `labelKey` alongside each bumper / target / rollover — runtime announcements look up the translated label fresh from the table rather than copying the English string into the event payload.

### Electron specifics

`electron/main.js` creates a frameless fullscreen window with `contextIsolation: true` and `devTools: false`, removes the menu (so Ctrl+R/Ctrl+W can't reload/close), auto-grants `midi` and `pointerLock` permissions, and applies platform-specific GPU/composition flags. `electron/preload.js` exposes `window.ElectronApi = {quit}`. Renderer code uses `app.isElectron()` (presence of `ElectronApi`) to branch — e.g. `app.quit()` calls `ElectronApi.quit()` only in Electron, and the HTML5 build adds a `beforeunload` confirmation that Electron skips.

The `dist-electron` Gulp task packages only the current platform — to ship Windows + Linux + macOS, run `gulp dist` separately on each.

## Audio patterns beyond binaural

The template wires up `engine.ear.binaural` via `setVector` / `setQuaternion`, but binaural alone is a thin cue — every shipped game in this collection layers extra shaping on top. When you build a new game, reach for these patterns rather than treating raw binaural as the whole story.

- **Behind-listener muffle.** Looping voices route through a shared lowpass + slight detune that opens as the source moves in front of the listener and closes behind it (`behindness()` returning 0 = ahead, 1 = directly behind). Sweep cutoff e.g. 22 kHz → 700 Hz with a `~0.05s` time constant; drop pitch by a few percent at maximum behindness. Stacks a strong front/back cue on top of binaural's weak HRTF nulls. Reference: `../pacman/src/js/content/audio.js`, `../bumper/src/js/content/pickups.js`.
- **Per-source gain model.** Don't apply the same distance falloff everywhere. Use `gainModel.exponential` with a steep `power` for short-range FX (bullets, footsteps); `gainModel.normalize` for sensors that should stay audible at any range (proximity walls, off-screen indicators); cubic falloff for the local player's own car so it's loud locally but dies fast at distance for other peers. Reference: `../bumper/src/js/content/{bullets,carEngine,targeting}.js`.
- **Continuous looping voice with parameter coupling.** For balls, engines, ball-rolls, danger drones, fan whooshes: open one oscillator/noise chain on screen-enter and shape it every frame from world state — gain ∝ speed, lowpass cutoff sweeps with speed, fundamental tracks position. Cheap, much easier to audition than discrete impacts, and gives constant ambient presence. Reference: `../pinball/src/js/content/audio.js` (rolling sound), `../pong/src/js/content/audio.js` (ball tone), `../racing/public/js/audio.js` (engine harmonics + turbo whine).
- **Stereo + binaural dual path for one-shot SFX in 2D.** Sum a `StereoPannerNode` (dominant L/R, no head-shadow nulls) with a quieter binaural ear at the same position. Stereo carries position; binaural adds HRTF colour. Stereo dominates at distance because binaural drops off harder. Reference: `../pinball/src/js/content/audio.js:49`.
- **Solenoid-style kick on collision.** Fixed energy added on top of restitution (e.g. `BUMPER_KICK = 22 u/s`) gives pop-bumpers, kickers, fan-blades, slings their snap. Pure restitution alone feels dead even at e = 1.0. Reference: `../pinball/src/js/content/physics.js:20`.
- **Pitch families for disambiguation.** When the same entity type spawns in multiples (bumpers, drop targets, rollovers, ghosts, AI cars), give each instance a distinct base pitch (or a head/body two-tone pair) so rapid sequential hits stay decipherable. Same logic applies to enemy classes in shooters: tie a fundamental frequency to type so the player identifies an off-screen threat by timbre. Reference: `../pinball/src/js/content/audio.js:98`, `../vfb/src/js/content/entities.js:47`.
- **Audio-clock scheduled lookahead.** For repeated cues (bleeps, pulses, beacons), schedule the next event with `engine.synth.simple({when: t})` ~50 ms ahead of `audioContext.currentTime` so `setTimeout` jitter never causes audible gaps. The outer JS loop only refills the queue. Reference: `../neverStop/src/js/content/audio.js:378`.
- **Disposable per-frame ear for one-shots.** Spawn a fresh binaural ear per impact, schedule the graph, `setTimeout`-disconnect after the tail decays. Cheap and avoids voice-stealing logic. Don't reuse for high-rate streams (allocation cost dominates) — use a pooled or persistent voice instead. Reference: `../bumper/src/js/content/sounds.js:13`.
- **Reusable ADSR helper.** Most games end up writing an `envelope(gain, t0, attack, hold, release, peak)` helper that cancels prior schedules and applies clean `setValueAtTime` + `linearRampToValueAtTime` curves. Write it once per game and route every synth voice through it. Reference: `../bumper/src/js/content/sounds.js:53`.
- **Silence-all on screen exit.** When leaving the game screen for pause/menu/gameover, stop every looping spatial voice. Otherwise an enemy drone keeps playing under the menu, which is both distracting and confusing for screen-reader users. Reference: `../pacman/src/js/app/screen/game.js:85` calls `content.audio.silenceAll()`.
- **BFS-routed radar beacon for navigation games.** When the listener is screen-locked and players need to *reach* a target (not just hear where it is), pathfind from the player to the target every ~1.5s and emit a directional tick at the next BFS step — "go this way to actually get there", not just "the target is over there." Reference: `../pacman/src/js/content/audio.js`.

## Announcer and screen-reader patterns

The accessible UI shell section above covers basic `aria-live`. The shipped games converge on a richer announcer than the bare minimum:

- **Two regions, polite and assertive.** Polite carries routine events (score, pickup, rollover); assertive carries state changes (drain, rank-up, pause, game-over, boss spawn). Don't overload polite — assistive tech queues polite messages and a flood swallows everything. Reference: `../pinball/src/js/app/announce.js`, `../pacman/src/js/app/announce.js`, `../vfb/src/js/content/world.js`.
- **Re-read identical strings.** Screen readers swallow back-to-back identical text. Either (a) clear the region to `''`, yield via `requestAnimationFrame` or `setTimeout(…, 50)`, then re-set, or (b) keep two parallel buffers per key and ping-pong between them. Reference: `../pacman/src/js/app/announce.js`, `../bumper/src/js/content/announcer.js`.
- **Optional TTS fallback.** A `setUseTts(true)` toggle that adds a SpeechSynthesis path so users without a screen reader still get spoken cues. Off by default; expose in settings. Reference: `../bumper/src/js/content/announcer.js:34`.
- **Function-key status hotkeys (F1–F7).** Every game in the collection wires F1–F4 (sometimes through F7) to read out a stat — score, lives, position, fuel, gear, nearest target, time. Bind at `window` keydown so they work regardless of focus. Without these, blind players have no way to query state mid-action. Reference: every game's `src/js/app/screen/game.js`.
- **`preventDefault` on F1, F3, F5.** The browser maps F1 to Help, F3 to Find, F5 to Reload, F11 to Fullscreen. Capture-phase preventDefault on the game screen to keep them — but **don't** bind F11 (let users fullscreen). F1/F3/F5 are the dangerous ones in browsers; in Electron only F11 matters and is already removed by the menu strip.
- **Opponent label switches by mode.** "Computer" vs "opponent" reads differently. Branch on `isMultiplayer()` at i18n lookup time, not in the message constant. Reference: `../pong/src/js/content/scoring.js:12`.

## AI patterns

- **Per-AI personality randomization.** Construct each AI with random `aggression`, `cooldown`, `reactionDelay`, etc. so they feel distinct and don't dogpile in unison. Tune the *ranges* not the values. Reference: `../bumper/src/js/content/ai.js:20`.
- **Anti-gang targeting tax.** When picking a target, subtract a penalty per other AI already chasing the same victim — spreads attention instead of all five chasing the player. Reference: `../bumper/src/js/content/ai.js:71`.
- **Reaction-delay buffer.** For human-feeling AI (paddle, follower, AI car), keep a circular buffer of recent observed positions and read it `N` frames in the past instead of the current frame. Easier to tune than predictive AI, naturally beatable, and reads as "human reflexes" rather than "perfect tracking." Reference: `../pong/src/js/content/ai.js:10`.
- **Hysteresis on toggle decisions.** AI throttle direction, target switching, and similar binary choices need a hysteresis flag so the value doesn't flap when the underlying signal sits on the threshold. Reference: `../bumper/src/js/content/ai.js:36`.
- **Post-action cooldown / breather.** After a big action (ram, swing, fire), force the AI to disengage for a randomized interval scaled by personality. Without it, AIs pin-and-spam. Reference: `../bumper/src/js/content/ai.js:495`.
- **Schedule tables for arcade-fidelity behavior.** Pac-Man ghosts use per-level scatter/chase tables, dot-counter release thresholds, and Cruise Elroy speedups straight from the Pac-Man Dossier. If a port needs feel parity, port the tables verbatim — feel-tuning by hand never converges. Reference: `../pacman/src/js/content/ghosts.js`.

## Physics patterns

- **Sub-stepped integration to prevent tunneling.** Adapt sub-step count from `MAX_SPEED / (collisionRadius * dt)` so per-substep travel stays below ~70% of the smallest collider. 8–48 substeps/frame is normal for fast 2D games. Reference: `../pinball/src/js/content/physics.js:46`.
- **Multi-pass collision resolution.** A single resolve against segment A can push the body into segment B at corners. Loop up to ~4 passes per substep — first pass reflects velocity, subsequent passes are pure position correction. Reference: `../pinball/src/js/content/physics.js:54`.
- **Velocity-aware normal fallback.** When a circle's centre lands exactly on a line (`dist < 1e-6`), the perpendicular has two valid signs. Pick the one opposite to velocity so fast bodies don't get punched through the wall. Reference: `../pinball/src/js/content/physics.js:82`.
- **Velocity-dependent restitution.** Rubber-on-flipper compression: `e = base / (1 + falloff * impactSpeed)`. Hard hits absorb energy, allowing cradling and drop-catch. Without it a held flipper acts as a perfect catapult. Reference: `../pinball/src/js/content/physics.js:36`.
- **Asymmetric kinematics for actuators.** Real solenoids snap fast, springs return slow. Pinball flippers use 30 rad/s up vs 9 rad/s down. Symmetric speed prevents ball settling and breaks every advanced technique. Reference: `../pinball/src/js/content/physics.js:25`.
- **Stuck-body force-drain.** Track frames where speed < ε; after ~90 frames force-drain or teleport. Numerical equilibrium in geometric wedges is otherwise unreachable. Reference: `../pinball/src/js/content/physics.js:126`.
- **Asymmetric damage on collision.** The aggressor (body driving harder into the contact normal) eats less damage; the victim eats more. Encourages attacking and rewards positioning. Reference: `../bumper/src/js/content/physics.js:24`.
- **Steering scales with speed and direction.** `steerMul = clamp(speed/v0, 0, 1) * sign(forwardSpeed)` so reversing inverts steering naturally — like a real car. Without the speed gate, parked cars spin in place. Reference: `../bumper/src/js/content/physics.js:82`.
- **One-way gates.** Mark a segment as `oneway` with a `normal`; only resolve collisions where `dot(velocity, normal) > 0`. Useful for ramps, gutter return lanes, no-back-tracking corridors. Reference: `../pinball/src/js/content/physics.js:316`.
- **Soft speed cap.** Instead of hard-clamping `|v| ≤ vmax`, scale by `k = vmax / |v|` when over the cap. Smoother and avoids step discontinuities in derived audio (engine pitch). Reference: `../bumper/src/js/content/physics.js:76`.

## Progression, state, and persistence patterns

- **Persistent vs session state.** Distinguish run-state (lives, score, fuel, current level) from cross-run state (cash, permanent upgrades, high scores, unlocked locales). Persistent state survives `engine.state.reset()`; session is rebuilt every run. The store screen mutates persistent values, then session re-baselines from persistent on the next run. Reference: `../vfb/src/js/content/state.js`.
- **i18n keys for locale-stable values.** The template's i18n section mentions `stopReasonKey` — generalize it: any value computed in module A and rendered in module B (stop reasons, label keys, rank names, mission descriptions, achievement titles, gameover messages) must store the **key**, not the rendered string. Translates fresh at render time even if locale changed mid-flight. Reference: `../neverStop/src/js/content/car.js`, `../pinball/src/js/content/table.js`.
- **High scores dual backend.** Electron writes to a JSON file via the preload bridge (`window.ElectronApi.readHighScores/writeHighScores`); web falls back to `localStorage[<game>-highscores-v1]`. Up to 10 entries, sorted descending. Don't put high scores in `engine.state` if they should survive a `state.reset()`. Reference: `../pacman/src/js/app/highscores.js`.
- **Combo with decay timer.** Track `comboValue` and a `comboTimer` that resets on each kill/hit. Timer expiring drops the combo; chained hits scale the reward. Bind the combo trigger to *impact*, not death, so the visual/audio frame is right. Reference: `../vfb/src/js/content/world.js:115`.
- **Score-threshold extends.** Award an extra life at thresholds that **increase with each extend** (20k, 60k, 120k, 200k, …) rather than a fixed period. Avoids late-game infinite extends. Reference: `../vfb/src/js/content/state.js:162`.
- **Rank tiers driven by score.** Score → rank lookup with i18n-keyed names announces "promoted to X" on cross-thresholds. Cheap progression hook for endless games. Reference: `../pinball/src/js/content/game.js:24`.
- **Mission queue with per-mission `kind`.** Each mission has a `kind` (`targets`, `bumpers`, `rollovers`, `survive`, …) that selects the progress predicate. Completing all advances to a final state. Easier to add new missions than to write a custom state machine. Reference: `../pinball/src/js/content/game.js:41`.
- **Inventory as map of stacks.** `inventory = {shields, bullets, mines, boosts, teleports}`. Stack on pickup with optional caps. Auto-consume items have a per-frame `autoCheck(state)` (e.g. fuel pack triggers when `fuel < 0.15`); manual items consume on player action. A "random box" pickup runs a weighted roll on the registry. Reference: `../bumper/src/js/content/car.js:46`, `../neverStop/src/js/content/items.js`.
- **Checkpoint on intermediate landmark.** When the player dies but has lives left, restart from the last passed checkpoint (tower destroyed, boss flag, midpoint), not the level start. Removes the "lost 5 minutes of progress" friction. Reference: `../vfb/src/js/content/entities.js:152`.
- **Game-over delay so audio finishes.** A crash/death often has a satisfying audio sting (700–1500 ms). Set a `pendingGameOver` flag, keep audio ticking, and only transition the screen after the cue completes. Reference: `../neverStop/src/js/content/game.js:159`.

## Diagnostic, learn, and soundtest screens

Hidden screens are essential for an audio-first game — without them you can't validate spatial audio orientation, audition new sounds, or let players learn the cue vocabulary. The collection converges on three:

- **`#test` route** — plays ticks at front / right / behind / left around a static listener at the canonical orientation. Verifies the screen→audio coordinate flip is correct *by ear*. Run this first whenever you touch listener code. Reference: `../pacman/src/js/app/screen/test.js`.
- **`#learn` (or "learn sounds") route** — plays each spatial prop (enemy types, pickup types, hazards) and one-shot SFX individually with labeled buttons. Calls `content.audio.setStaticListener(0)` once on enter so the listener doesn't drift, and re-applies it on re-entry from screens that may have moved it. Reference: `../pacman/src/js/app/screen/learn.js`, `../pinball/src/js/app/screen/learn.js`.
- **Soundtest / variant preview** — for games with synth variant tables (bleeps, drones), expose a hidden screen reachable by a key press from the menu (T in neverStop) that auditions each variant and lets the player select one for the session. Useful for tuning and for letting screen-reader users pick a timbre that doesn't conflict with their TTS. Reference: `../neverStop/src/js/app/screen/soundtest.js`.
- **Wire diagnostic routes via `none → activate`.** Honor `window.location.hash` in the FSM's `activate` transition (see existing gotcha). Don't try to dispatch from `main.js` after `app.screenManager.dispatch('activate')` — at that point the FSM is already at the destination.

## Multiplayer (when adding network play)

The template ships single-player. If a game needs online multiplayer,
the rest of `oriolgomez.com`'s games (`../bumper`, `../racing`) follow
a fixed pattern — copy it instead of inventing something new, so the
shared coturn server keeps working uniformly.

### Infrastructure (already running, don't redeploy)

- **Signalling**: free public **PeerJS broker** (`0.peerjs.com`). No
  backend to host, no ports to open. Each peer gets a string id; the
  host picks a deterministic id like `<gameslug>-<roomcode>` and
  clients connect to it. Public PeerJS ids are global, so always
  prefix with the game's name to avoid collisions.
- **Data plane**: direct **WebRTC data channels** between peers. JSON
  over `DataConnection.send()`.
- **STUN / TURN / TURNS**: self-hosted **coturn** on the VPS that
  serves oriolgomez.com.
  - `turn.oriolgomez.com:3478` UDP+TCP — STUN + TURN.
  - `turn.oriolgomez.com:5349` TCP — TURNS (TLS, last-resort path
    through restrictive firewalls).
  - Hostname rides the wildcard `*.oriolgomez.com` A record. If the
    VPS IP ever changes, only the wildcard updates — no game rebuild.
  - Server config: `/etc/turnserver.conf`. Long-term creds, single
    user `gamesturn` (the password lives in the games' source — it's
    public-by-design because WebRTC requires the browser to know it).
  - TLS cert is provisioned by Caddy (Caddyfile entry for
    `turn.oriolgomez.com`) and copied into `/etc/coturn/{turn.crt,
    turn.key}` by `/usr/local/bin/coturn-cert-deploy`. The systemd
    path unit `coturn-cert-watch.path` re-runs the deploy on Let's
    Encrypt renewal.
  - UFW: `3478/udp+tcp`, `5349/tcp+udp`, `49160-49200/udp` (relay
    range, kept narrow on purpose).

### The constants block (copy this verbatim)

In whichever module owns networking (call it `net.js` or
`src/js/app/net.js`), put these five constants at the top — never
inline the host/port/creds further down. Future ops changes (server
move, cred rotation, port shift) should be one diff in five lines.

```js
const TURN_HOST = 'turn.oriolgomez.com'
const TURN_PORT = 3478
const TURNS_PORT = 5349
const TURN_USER = 'gamesturn'
const TURN_PASS = 'sin6V0gFokHz78gM0GDfXmat'
```

The `iceServers` array fed to `new Peer({config: {iceServers}})` (or
to a raw `RTCPeerConnection`) follows a fixed order — STUN first
because most connections never need a relay, then TURN/UDP, then
TURN/TCP for firewalls that drop UDP, then TURNS/TLS as the last
resort:

```js
config: {
  iceServers: [
    {urls: `stun:${TURN_HOST}:${TURN_PORT}`},
    {urls: 'stun:stun.l.google.com:19302'},  // Google STUN as backup
    {
      urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=udp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: `turn:${TURN_HOST}:${TURN_PORT}?transport=tcp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
    {
      urls: `turns:${TURN_HOST}:${TURNS_PORT}?transport=tcp`,
      username: TURN_USER,
      credential: TURN_PASS,
    },
  ],
  iceCandidatePoolSize: 2,
}
```

ICE candidate types in the browser console (when debugging connection
failures, this is the most useful signal):
- `host` — local LAN address (always present).
- `srflx` — public address discovered via STUN (means STUN works).
- `relay` — TURN-allocated address (means TURN works).
- No `relay` candidates + symmetric NAT = no path = silent timeout.

### Topology: star with host-authoritative sim

Both reference games use the same shape, and you should too unless
there's a strong reason not to:

- **One host, N clients.** Host runs the full simulation (physics,
  AI, scoring, item state) and broadcasts authoritative snapshots.
  Clients send inputs only.
- **Wire protocol** is plain JSON, no schema. Tag every message with
  a `type` field. Typical types: `hello`, `lobby`, `start`, `input`,
  `snap`, `event`, `end`, `kick`, `bye`. Validate `type` on receive,
  trust the rest (same code on both sides).
- **Tick / snap rate** is decoupled. Bumper runs the sim at 60 Hz on
  the host but only emits snapshots at 30 Hz. Clients lerp between
  snapshots and dead-reckon between them where it matters (e.g. car
  position uses lerp; listener yaw uses an immediate steering
  prediction so spatial audio doesn't lag a tick).
- **Events** that fire from the sim (collisions, pickups, weapon
  fires, eliminations) ride along inside the next snapshot in a
  `pendingEvents` array. The client re-emits them through its own
  pubsub so audio / haptics / announcer subscribers fire from the
  *local* player's perspective. Don't fire events out-of-band — they
  can arrive before the snapshot that establishes the state they
  describe.
- **Round-end ordering**: on the host, push the `roundEnd` event into
  the next snapshot **before** locally emitting any "stop the round"
  signal that would clear the cars/state. Otherwise clients never see
  the final state.
- **Disconnect handling**: mid-round client leave → host treats them
  as eliminated (forfeit). Mid-round host disconnect → client catches
  the `close` event and exits to the menu.

### Reference implementations

- **`../bumper/src/js/app/net.js`** — full implementation: PeerJS
  wrapper, lobby flow, snapshot replication, arcade items, heartbeat
  + peer timeout. Source-tree game with a Gulp build step, so changes
  to `net.js` need `gulp build` to land in `public/scripts.min.js`.
  Has the most complete docstring at the top of the file — read that
  for the wire-protocol schema and message-flow examples.
- **`../racing/public/js/net.js`** — leaner version of the same idea
  for a no-build static game. Plain `<script>` tag in
  `public/index.html` loads PeerJS from CDN, then `net.js` is served
  as-is. Edit and reload.

### Things to remember

- **PeerJS data channels don't throw on send when closed.** They
  silently drop. If you need delivery guarantees, ack at the app
  layer.
- **Loading PeerJS from CDN can fail offline.** `net.js` should
  expose `libAvailable()` and the menu should hide multiplayer when
  it returns false, instead of erroring inside `host()` / `join()`.
- **Don't put gameplay logic in `net.js`.** Keep it a thin transport
  with `on(event, cb)` / `send(msg)` / `broadcast(msg)` /
  `host(opts)` / `join(opts)` / `disconnect()`. Game modules
  subscribe and translate.
- **Document this game's wire protocol in its own CLAUDE.md.** A
  `Multiplayer` section listing every `type` and its payload shape is
  essential — clients and hosts share validation by trust, so the
  CLAUDE.md *is* the schema.

### Additional patterns (drawn from the shipped games)

- **Room codes use an unambiguous charset.** `'BCDFGHJKLMNPQRSTVWXZ23456789'` — no `0/O`, `1/I/L`, no vowels (avoids accidental words). Players read codes aloud over voice chat, so this matters more than it looks. Reference: `../bumper/src/js/app/net.js:44`.
- **Networked vs local events allow-list.** Define an explicit `NETWORKED_EVENTS` array. Only events in the list ride in `pendingEvents`; everything else stays local. Side-channel events that aren't in the list silently won't replicate, so making the allow-list explicit prevents "works locally, missing for remote players" bugs. Reference: `../bumper/src/js/content/game.js:61`.
- **Don't put `type` in event payloads.** The capture spreads `{type: eventName, ...payload}` into the wire message — a payload field named `type` clobbers the event name. Use `kind` / `category` / `action` instead. Reference: `../bumper/src/js/content/game.js:415`.
- **Role-guarded mutations.** Subscribers that mutate authoritative state (score, health, inventory) must `if (role !== 'client') return` — clients receive the result via the next snapshot, not by re-running the logic. Otherwise scores double. Reference: `../bumper/src/js/content/game.js:138`.
- **Predict only what audio cares about.** Position can lag a tick (lerp between snapshots). Listener orientation can't — predict it locally from steering input so spatial audio doesn't lag the controls. Position drift corrects naturally over the next snapshot. Reference: `../bumper/src/js/content/game.js:1168`.
- **Shortest-arc lerp for angles.** `dh = atan2(sin(target - current), cos(target - current))` to wrap the difference into `[-π, π]` before lerping. Raw subtraction snaps 359° → 0° and the avatar flips. Reference: `../bumper/src/js/content/game.js:1163`.
- **Items reconcile from snapshots, not local logic.** Clients don't simulate pickups / bullets / mines. Each snapshot carries the authoritative item list; the client diffs it: create voices for new ids, destroy voices for missing ids, hard-set positions. Optionally dead-reckon between snapshots using `vx, vy`. Reference: `../bumper/src/js/content/game.js:355`, `../racing/public/js/main.js:415`.
- **Bot fill on host.** If the lobby has fewer than the target player count, fill with AI bots so the round always has a full roster. Bots ride the same snapshot fields as remote players. Clients auto-discover bots from the first snapshot. Reference: `../racing/public/js/main.js:83`.
- **Per-team listener flip.** In symmetric arena games (pong, head-to-head), the listener for team 2 sits at the opposite end. Helper functions `calcPan(ev)` and `calcDepthT(ev)` take the local team into account so audio events broadcast in world coords play with the right perspective on each peer. Reference: `../pong/src/js/content/audio.js`, `teamManager.js`.
- **Audio-event relay queue.** Wrap `content.audio.*` with a relay that queues events to `pendingAudioEvents`; ride them in the next snapshot so clients replay locally with their own listener pose. Don't fire audio out-of-band — it can race the snapshot that establishes the source's position. Reference: `../pong/src/js/content/audio.js:8`.
- **Per-peer profile swap for self-comfort.** If cars / players have audio profiles (timbre, color), swap profiles 0 and `selfSlot` per-peer so each listener hears their own car as the gentlest profile (the loud aggressive timbre is fine on someone else's screen). Side effect: the same player has different perceived audio per peer. Reference: `../bumper/src/js/content/carEngine.js:14`.
- **Optimistic local action with host reconciliation.** Decrement bullet count, play fire SFX, queue the input — all locally and immediately. Host runs the authoritative shot a tick later. The shared SFX masks the latency; the eventual host-broadcast result corrects state. Reference: `../racing/public/js/main.js:243`.
- **Per-player pickup spawn timers.** A leader-only spawn schedule means trailing players never see pickups. Track spawn timing per-player on the host so everyone gets the same item rate regardless of position. Reference: `../racing/public/js/pickups.js:34`.
- **Use absolute (monotonic) coordinates for spawn math.** Never compute spawn positions in wrapping coordinates. Promote to a monotonic absolute (e.g. `zAbs = lap * trackLen + z`) so "spawn 200 m ahead of player" works across lap / loop boundaries. Reference: `../racing/public/js/pickups.js:44`.
- **Two-paddle manual mode.** In multiplayer the host drives both paddles via `setManualKeys()` rather than each peer reading its own keyboard for its paddle. Avoids double-reading the host's keys when both adapters are on the same machine. Reference: `../pong/src/js/content/game.js:93`.
- **Heartbeat + peer timeout.** Send a tiny `ping` every ~2s; treat a peer as gone after ~6s without traffic. PeerJS connections can sit "open" for minutes after a real disconnect. Reference: `../bumper/src/js/app/net.js`.
- **Static games still need `gulp build`.** Source-tree games like `bumper` require rebuilding `public/scripts.min.js` after editing `net.js`. Static games like `racing` are edit-and-reload. Don't burn time debugging stale builds — check which kind you're in.

## Conventions

- No build-time module system. All app code is written as IIFEs or assignments to the `app` / `content` namespaces. New files are picked up via the glob in `Gulpfile.js`'s `getJs()`/`getCss()` — no manual registration needed.
- Screens always extend `app.screen.base` via `app.screenManager.invent()`. Don't subclass it manually.
- CSS class prefixes are `.a-` (app-level layout/instances) and `.c-` (reusable components). The order in `getCss()` is `reset → main → utility/* → component/* → */*` — utilities and components must not depend on later files.
- Game state that should persist goes through `engine.state` (so `app.autosave` and screen `onImport`/`onReset` hooks pick it up), not directly through `app.storage`.

## Gotchas worth remembering

### Syngen spatial audio coordinate frame

Syngen's `engine.ear.binaural` uses a non-obvious convention. From `node_modules/syngen/src/syngen/ear/binaural.js`, the listener-local axes are:

- **+x = forward** (the direction the listener is facing)
- **+y = LEFT** (because the LEFT monaural processor receives `relative + (0, -headWidth/2, 0)`, which means the left ear sits at +y/2)
- **-y = right**
- **+z = up**

This is the opposite of the y axis in most 2D screen-coordinate setups, where `+y` points down (south) and the player's right when facing east is `+y`. If you feed screen-y straight into the binaural without compensating, **left and right will be swapped** in the audio.

The fix is a screen → audio coordinate translation that negates y everywhere it crosses the boundary:

```js
function tileToM(v) {
  return {x: v.x * TILE_TO_M, y: -v.y * TILE_TO_M, z: 0}
}

function relativeVector(x, y) {
  const listener = engine.position.getVector()
  const lq = engine.position.getQuaternion().conjugate()
  return engine.tool.vector3d.create({
    x:  x * TILE_TO_M - listener.x,
    y: -y * TILE_TO_M - listener.y,
    z: 0,
  }).rotateQuaternion(lq)
}

// Yaw: screen east-facing dir = (1, 0) → audio yaw 0; screen south-facer
// = (0, 1) → audio yaw -π/2.
const yaw = Math.atan2(-d.y, d.x)
engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw}))

// Anywhere else that compares a source angle to facing yaw (e.g. a "behind"
// check) must use the same flipped y so it stays consistent:
const dx = srcX - p.x, dy = -(srcY - p.y)
const angleVsFacing = Math.atan2(dy, dx) - yaw
```

When in doubt, build a route that plays a tick at front (+x), right (-y in audio = +y in screen flipped), behind (-x), and left (+y in audio = -y in screen flipped) and verify by ear before assuming any other audio bug is real.

### Listener orientation and per-frame state

`engine.position.setVector(...)` and `setQuaternion(...)` are sticky — set them once and they persist across frames until you set them again. So a screen that calls `content.audio.setStaticListener(...)` once on enter doesn't need to keep refreshing it. But the moment the game screen runs, its `content.audio.frame()` will overwrite both based on Pac-Man's pose. Diagnostic screens that need a fixed listener pose must (a) not call `content.audio.frame()` and (b) re-apply their static listener if they ever return from a screen that did.

### `app.controls.ui()` is a delta, but it can fire on the same tick as a click

Pressing Enter on a focused button fires both:
1. The browser's synthetic `click` event (handled by your `addEventListener` in `onReady`).
2. The next frame's `app.controls.ui()` returning `enter: true` to your `onFrame`.

If both paths call the same action, you'll dispatch twice. Usually the second dispatch is silently dropped because the source state changed, but for screens that have an Enter-to-go-back, the entering keypress can immediately bounce you back. Either:
- Add a small `entryFrames` countdown in the destination screen's state and ignore inputs for ~6 frames after `onEnter`, or
- Only listen for the click event and ignore the keyboard delta in `onFrame`.

### Audio context is suspended until first user gesture

Browser autoplay policy means the WebAudio context starts in `suspended` state. `main.js` registers `pointerdown`/`keydown`/`touchstart` listeners that call `ctx.resume()`. If you skip the splash screen and route straight to a screen that announces or plays SFX on `onEnter`, those calls happen before any user gesture and will be silent. The `aria-live` announce still works (it's not WebAudio), but synthesized SFX will start at the first interaction. Don't chase silent SFX as a bug if no user gesture has happened yet.

### Hash routing in screenManager

The `none → activate` transition is the place to honor `window.location.hash` for diagnostic routes (e.g. `#test`, `#music`). Don't try to dispatch from `main.js` after `app.screenManager.dispatch('activate')` — at that point the FSM is already in the destination state and the hash is too late.

### `engine.fn.normalizeAngleSigned` is broken

Despite the name, it subtracts π instead of wrapping into `[-π, π]`. Don't use it. Either `Math.atan2(Math.sin(a), Math.cos(a))` for an explicit wrap, or leave angles unwrapped — `cos`/`sin` tolerate drift. Reference: `../bumper/src/js/content/{physics,ai}.js`.

### Cross-module references must be lazy

Gulp's alphabetical concat means an IIFE in `audio.js` runs *before* `table.js` defines `content.table`. Capture sibling references inside *functions*, not at module top:

```js
// Wrong — content.table is undefined at this point:
const T = content.table

// Right — resolves on each call, after all modules have loaded:
const T = () => content.table
```

`pinball/src/js/content/game.js` uses arrow-function getters for this; `audio.js` and `physics.js` capture their references inside their own functions. The Gulpfile's `getJs()` order isn't a viable workaround — relying on alphabetical accident breaks as soon as someone adds a file.

### Wrap `onFrame` in try/catch

A throw inside `onFrame` halts the syngen loop until reload — every screen render dies, including menus. Wrap the body in `try { … } catch (e) { console.error(e) }` and log; one bad frame is recoverable, a dead loop is not. Especially important for game screens that touch network state, audio scheduling, or anything that can throw on bad input. Reference: `../vfb/src/js/app/screen/game.js:107`.

### Browser auto-repeat for held keys

Edge-triggered keydown fires on hold-repeat ≈ every 30 ms. For "press to start, press again to stop" actions (horn, charge, plunger pull), gate with a local `isActive` flag so the auto-repeat doesn't toggle off on the second autorepeat tick. The `app.controls.ui()` delta protects menu input but not raw `window.addEventListener('keydown')`. Reference: `../bumper/src/js/app/screen/game.js:75`.

### Rising-edge probing for "why didn't I move?"

When an arrow key transitions up→down, run the same passability check the movement code uses and announce / buzz immediately if blocked. Without it, blind players think input was lost when actually they walked into a wall. Reference: `../pacman/src/js/app/screen/game.js:99`.

### Audio context resume vs. early SFX

Already covered in "Audio context is suspended until first user gesture" above. Add: synth probes that run on boot for diagnostics (e.g. measure context sample rate) must happen *after* the first user gesture too. Don't put audible test tones in `main.js` — they'll be silent on first load and audible on every reload after, which makes them look broken.
