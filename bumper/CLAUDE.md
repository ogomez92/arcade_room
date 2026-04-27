# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A blind-accessible, audio-first bumper-cars arena built on
[syngen](https://github.com/nicross/syngen) (real-time Web Audio synthesis).
Every game-state change is conveyed through synthesized 3D audio plus an
ARIA live region — no visual information is required to play.

Two game modes ship from the same engine:

- **Chill** — classic bumper cars. Damage on contact, last car wins.
- **Arcade** — adds pickups (health, shield, bullets, mine, speed
  burst, teleport) that loop a spatialised sound at their position,
  plus bullets fired at forward targets, mines that detonate on
  contact, a 3-second speed burst (G key) that doubles top speed and
  acceleration, and a teleport (H key) that snaps the car to a random
  open spot in the arena. Mode is chosen from the main menu and
  threaded through `content.game.start` (which accepts either
  `{aiOpponents, mode}` for single-player or `{controllers, selfId,
  mode}` for multiplayer; see "Multiplayer" below).

Design rationale, physics constants, AI rules, and scoring formulas
all live in [docs/GDD.md](docs/GDD.md). Read it before tuning gameplay.

## Commands

```sh
npm install                  # one-time
npx gulp build               # one-shot build (writes public/scripts.min.js, public/styles.min.css)
npx gulp build --debug       # same, but skip minification (readable output, source-mappable)
npx gulp watch               # rebuild on src changes
npx gulp serve               # static server for ./public on :3000
npx gulp dev                 # serve + watch in parallel
npx gulp electron            # launch the built app in Electron
npx gulp electron-rebuild    # build then launch Electron
npx gulp dist                # produce HTML5 + Electron distributables under dist/
```

`dist` and `dist-electron` only package the **current** OS — the
Gulpfile hardcodes `[process.platform]`. Ship multi-platform builds by
running `dist` on each target OS.

Note the project has no test runner and no linter wired up. The fastest
correctness check after a JS edit is `npx gulp build && node --check
public/scripts.min.js`.

## Build pipeline (important — there is no ES-module system)

`Gulpfile.js` concatenates **all** matching files into one IIFE-wrapped
`public/scripts.min.js`. Every file shares one global scope. There are no
imports/exports — modules attach themselves to one of three globals:

| Namespace | Owner                                  | Purpose                                      |
| --------- | -------------------------------------- | -------------------------------------------- |
| `engine`  | `src/js/engine.js` → alias for syngen  | Audio, math, input, FSM, pubsub primitives   |
| `app`     | `src/js/app.js`                        | UI scaffolding (screens, controls, settings) |
| `content` | `src/js/content.js`                    | Game-specific code (physics, cars, AI, etc.) |

**Concat order matters** (see `getJs()` in Gulpfile.js):
`syngen → engine.js → content.js → content/**/*.js → app.js → app/screen/base.js → app/utility/*.js → app/*.js → app/**/*.js → main.js`.

Two consequences:

1. `content/*.js` runs **before** `app/*.js`. Content modules cannot reference
   `app.*` at IIFE-execution time, but they may inside callbacks invoked at
   runtime (everything has loaded by then).
2. Within `content/`, files load **alphabetically**. If a content module
   needs another content module *at IIFE-execution time*, name it so that
   the dependency loads first (e.g. `events.js` < `game.js`). Anything
   referenced inside a function body is fine regardless.

CSS is concatenated in a similar fixed order; `src/css/**/*.css` is the
catch-all and includes `src/css/app/*.css` and `src/css/component/*.css`.

The Gulpfile appends `;app.version=()=>'<pkg.version>[-debug]';` as a
footer to the bundle, so `app.version()` is a function (used by
`app/screen/menu.js` for the version label) and `-debug` is appended
when built with `--debug`.

## Architecture

### Screen FSM (UI layer)

`app.screenManager` wraps `engine.tool.fsm`. Each screen is "invented" by
calling `app.screenManager.invent({id, parentSelector, rootSelector,
transitions, onReady, onEnter, onExit, onFrame})` and inherits from
`app.screen.base`. Every screen registers DOM nodes, traps focus, and
exposes one `onFrame` hook called every render frame.

Transitions are **dispatched** (`app.screenManager.dispatch('foo', payload)`)
and the active screen's `transitions[name]` handler runs in FSM context
(`this.change('other')`). Cross-screen payloads ride along as the second
arg to `onEnter(_e, payload)`.

Current screen graph: `splash → menu → (setup | learnSounds | help |
multiplayer) → game → gameOver → (menu | setup | multiplayer)`. The
`gameOver` rematch transition routes back to `setup` for single-player
rounds and `multiplayer` for multiplayer rounds, keyed off
`lastPayload.multiplayer`.

### Frame loop

`engine.loop` is the single render-clock. It emits `frame` events that
drive **everything time-dependent**:

- `app.controls.update()` — polls keyboard/gamepad/mouse and produces a
  `{x, y, rotate}` per-frame "game" snapshot and a `{up, down, enter,
  back, …}` "ui delta" (only newly-pressed keys, used for menu nav).
- `app.screenManager.update()` — calls the active screen's `onFrame()`.
- The active **game** screen calls `content.game.update(delta)`, which
  drives physics, collision resolution, sound updates, and round-end checks.

The loop starts paused (`engine.loop.start().pause()` in main.js); the
splash screen resumes both the loop and the `AudioContext` on first user
gesture (browser autoplay policy).

### Audio model

Each `content.car` owns a `content.carEngine` voice — a per-car FM+sub+
noise synth piped through its own `engine.ear.binaural` instance. Every
frame `content.game.update()` recomputes the listener-local position of
each car and calls `engine.update({x, y, z})` on its ear. Result: cars
sound where they are, distinct per timbre.

`content.carEngine.create(profileIndex, {isSelf})` selects one of six
fixed timbres (`red, blue, green, yellow, purple, orange`) by index
and applies an `isSelf` treatment if requested: lower master gain,
less sub, default (not cubic) distance falloff. `isSelf` is set per
peer based on `controller === 'player'`. `profileIndex` is *also*
resolved per-listener inside `content.game.start` — slots 0 and
`selfSlot` are swapped so every peer's own car always uses profile 0
(red, the gentlest timbre). Profile 0 was tuned to be calm enough to
listen to for a full round; without the per-listener swap, only the
slot-0 driver got that comfort and other peers had a harsher
self-engine. As a consequence, the same player can sound like a
different timbre on different peers — but each listener still hears
six distinct voices, and `realLabel` (chosen name) is what carries
identity in announcements, not color.

One-shot SFX (`content.sounds.collision`, `wallScrape`, `eliminate`) build
disposable graphs the same way: spawn a binaural ear, wire a transient
audio graph, schedule envelope, `setTimeout`-disconnect after the tail.
UI ticks (`uiFocus`, `uiBack`, `roundStart`, etc.) skip the binaural
stage and connect straight to `engine.mixer.output()` so they sound
identical with or without headphones.

`content.targeting` is the parking-sensor cue: it owns one beep cadence
per opponent, scales rate by proximity, and flips pitch high/low based on
whether the opponent is in front of or behind the listener.

### Game / physics flow

`content.game` is the orchestrator. The host (or single-player) per
frame, in `update(delta)`:

1. Writes `{throttle, steering}` into each AI car's `car.input` via
   `car.ai.update(delta)`. The local player's input was already written
   by the game screen's `onFrame` from `app.controls.game()`. In
   multiplayer the host *also* applies cached remote-peer inputs into
   the matching `car.input` here.
2. Calls `content.physics.integrate(car, delta)` for each car.
3. Runs O(n²) `resolveCarCar` and per-car `resolveCarWall`. Damage is
   applied via `content.car.applyDamage`, then `carHit` / `carWallHit`
   / `carScrape` are *emitted on the bus*. Reactions (sounds, haptics,
   announcements, score) are pubsub subscribers — not inline — so the
   same handlers fire on host (from physics) and on client (from
   replayed snapshot events). In arcade mode, each side of a car-car
   bump independently consumes one shield from `car.inventory.shields`
   (if any) — shielded sides take no damage, the aggressor still
   scores, and `shieldBlock` SFX replaces the buzzer.
4. Updates the listener position (`engine.position.setVector` + `setEuler`)
   and each car's spatial sound voice (host & client share
   `updateAudioStage`).
5. Updates targeting beeps, the low-health heartbeat, and (arcade only)
   the `pickups`, `bullets`, and `mines` managers.
6. Round-end check fires when `cars.length > 1 && livingCount() <= 1`
   (so pure single-player sandbox doesn't end). Awards bonuses
   (+100 surviving, -25 each eliminated), emits `roundEnd`. The
   `roundEnd` subscriber announces and calls `api.onRoundOver`, which
   the game screen wires into a transition to `gameOver`.

`content.events` (a syngen pubsub) is the single bus. Combat events
(`roundStart`, `roundEnd`, `carHit`, `carWallHit`, `carEliminated`) and
arcade events (`pickupApplied`, `bullet*`, `mine*`, `mineDetonated`)
are the multiplayer-replicated set (`NETWORKED_EVENTS` in
`content/game.js`). Subscribers in `content.game` produce all per-event
audio/announcement/scoring side effects, so replaying an event on a
client peer reproduces the same surface response. `pickupGrabbed` is
host-local: the host runs the apply logic (heal / `inventory.X++` /
roll random `granted` for bullets) and emits the networked
`pickupApplied` with the resolved `{dealt, granted}` so every peer
announces identical numbers.

### Arcade systems

Arcade managers (`content.pickups`, `content.bullets`, `content.mines`)
are constructed in `content.game.start()` only when `mode === 'arcade'`,
and torn down in `end()`. Each follows the same pattern:

- `createManager(game)` returns `{update, updateSpatial, applyRemoteItems,
  toSnapshot, destroy, ...}` plus a type-specific verb (`fire`, `place`).
- Every long-lived entity (pickup, bullet-in-flight, placed mine) owns
  its **own** binaural ear and voice graph. `update()` recomputes the
  listener-local position each frame and calls `ear.update({x,y,z})` —
  same pattern as `content.carEngine` and `content.targeting` walls.
- Hits/expiries emit through `content.events`; `content.game`'s
  subscriptions handle scoring, haptics, and announcements so the
  managers stay agnostic of UI.

In multiplayer, the manager runs in three roles:
- **host / single-player:** `update()` runs the full simulation (spawn,
  hit detection, lifetime). `toSnapshot()` produces the wire payload
  (`{id, x, y, ...}` per item) included in each 30 Hz host snapshot.
- **client:** `update()` is **not** called. Each snapshot is fed into
  `applyRemoteItems(list)`, which reconciles local item lists + voice
  graphs (creates voices for new ids, tears down voices for ids no
  longer present, hard-sets positions). `updateSpatial(delta?)` runs
  every render frame to keep the binaural ear at the listener-local
  position; bullets dead-reckon between snapshots using the velocity
  carried in the snapshot (their position is reset on each snap).

Arcade-specific car state lives in `car.inventory = {shields, bullets,
mines, boosts, teleports}` (null in chill mode), plus `car.boostUntil`
(engine.time domain — physics reads it to apply higher max-speed +
engineForward while active). `content.car.heal(car, amount)` adds
health with no upper bound — stacking enough pickups effectively makes
a car a tank. `content.car.consumeShield(car)` is the shield-decrement
primitive used by the car-car collision path. Boost activation happens
via `content.game.useBoost()` → host runs `activateBoost(car)` →
emits the networked `boostActivated` event so every peer plays the
launch SFX, mirrors `boostUntil`, and schedules the wind-down SFX
locally. Teleport follows the same shape: `useTeleport()` →
`activateTeleport(car)` picks a destination ≥8 m off any wall and
≥3.5 m from any other car, snaps `car.position`, zeros velocity, and
emits the networked `teleportUsed {fromX, fromY, toX, toY}`. The
subscriber on every peer plays a spatialised whoosh at the **old**
position so other drivers hear where the car vanished from, then
hard-snaps the car position (and resets the client's interpolation
target) so the listener pivot doesn't lerp across the arena.

### Accessibility surface

- `content.announcer.say(text, 'polite' | 'assertive')` writes to one of
  two ARIA live regions (`#a-announcer-polite` / `#a-announcer-assertive`)
  with a 250 ms dedup. Optional SpeechSynthesis fallback gated by
  `setUseTts(true)`.
- The game screen registers window-level `keydown` for HUD readout keys:
  `F1` = score, `F2` = cars remaining, `F3` = inventory (arcade),
  `F4` = health, `Q` = opponent sweep. All call into
  `content.game.announce*()` / `content.game.sweep()` and are gated on
  `app.screenManager.is('game')`.
- Arcade-only hotkeys (also window-level keydown, edge-triggered via
  `e.repeat`, gated on `content.game.isArcade()`): `W` = pickup sweep
  (`announcePickups()`), `A`/`S`/`D` = fire bullet with left/center/right
  nudge (`fireBullet(nudge)`), `F` = drop mine (`placeMine()`),
  `G` = use speed burst (`useBoost()`), `H` = teleport
  (`useTeleport()`).
- All menus rely on `app.utility.menuNav.handle(rootElement)` for
  arrow-key navigation in addition to the inherited Tab focus trap from
  `app.screen.base`.

### Persistence

`app.storage` is an IndexedDB-backed key/value store keyed by app
version, with an `app.updates` migration registry. The game persists a
single `bumper` record: `{bestScore, lastName}`. `bestScore` is the
single-player personal best (multiplayer rounds intentionally skip
this update); `lastName` is the last display name typed into the
multiplayer screen.

## Multiplayer

Multiplayer (2–6 players) supports both **chill** and **arcade**. The
host picks the mode in the lobby (toggle buttons next to peers list)
and broadcasts `{type:'mode', mode}`; the choice rides along in the
`start` message and is what `content.game.start` runs.

- **Transport.** [PeerJS](https://peerjs.com/) loaded via CDN
  (`public/index.html`). Free public broker
  (`0.peerjs.com`) handles signalling; data flows direct over WebRTC
  data channels. No port forwarding, no backend hosting.
- **STUN / TURN / TURNS.** Self-hosted **coturn** on the VPS that
  serves oriolgomez.com. STUN+TURN on `turn.oriolgomez.com:3478`
  (UDP+TCP), TURNS on `:5349` (TLS over TCP). The hostname rides the
  wildcard `*.oriolgomez.com` A record, so if the VPS ever moves, only
  the wildcard needs updating. ICE order in the client is: STUN first,
  TURN/UDP, TURN/TCP, then TURNS as last-resort for networks that
  block everything except TLS. Connection details live in five
  constants at the top of `src/js/app/net.js` — `TURN_HOST`,
  `TURN_PORT`, `TURNS_PORT`, `TURN_USER`, `TURN_PASS`. Change them
  there if the server moves or creds rotate, then `gulp build` to
  refresh `public/scripts.min.js`. Server-side config lives in
  `/etc/turnserver.conf` on the VPS; the TLS cert is provisioned by
  Caddy (Caddyfile entry for `turn.oriolgomez.com`) and copied to
  `/etc/coturn/{turn.crt,turn.key}` by `/usr/local/bin/coturn-cert-deploy`,
  which is re-triggered on renewal by the systemd path unit
  `coturn-cert-watch.path`. UFW allows `3478/udp+tcp`, `5349/tcp+udp`,
  and `49160-49200/udp` (relay range).
- **Topology.** Star — one host, up to 5 clients. Host's PeerJS id is
  derived from a 4-char room code: `bumper-<code>`. Clients connect to
  that id.
- **Authority.** Host runs the full simulation (physics, AI, collisions,
  and the arcade managers when in arcade mode). Clients send
  `{type: 'input', throttle, steering}` every frame plus `{type:
  'action', action: 'fireBullet'|'placeMine', nudge?}` for arcade
  weapon use, and receive `{type: 'snap', cars, events, pickups,
  bullets, mines}` back at 30 Hz. The host also broadcasts `{type:
  'mode', mode}` lobby-only and `{type: 'start', ...}` to kick off the
  round.
- **`app.net`** (`src/js/app/net.js`) wraps PeerJS into the simpler API
  used by the rest of the app: `host({name, code?})`, `join({name,
  code})`, `disconnect()`, `send(peerId, msg)`, `broadcast(msg)`,
  `sendToHost(msg)`, `on(event, cb)` / `off`. Events: `lobby`,
  `peerJoin`, `peerLeave`, `message`, `role`, `error`, `close`.
- **Round construction.** `content.game.start` accepts either the
  legacy `{aiOpponents, mode}` *or* `{controllers, selfId, mode}`,
  where each controller is `{id, type: 'player'|'ai'|'remote', label,
  peerId?}`. The `'player'`-typed entry (or the entry whose `id`
  matches `selfId`) becomes the local player on this peer; everyone
  else is `'ai'` (this peer simulates them) or `'remote'` (input
  written from the network). The screen flow is:
  `multiplayer → game (with controllers payload)`.
- **Roles.** `content.game.setRole('host'|'client'|null)` toggles
  network mode. Set by `app/screen/game.js` on enter and reset on
  exit. The role mainly changes `update()`: client mode skips
  physics/AI/collisions and instead lerps cars toward `remoteTargets`
  populated by `applyHostSnapshot`. The local player's heading gets
  an additional steering-input prediction step on top of the lerp so
  listener orientation tracks the steering wheel without waiting for
  the next snapshot — see `updateClient` in `content/game.js`.
  Position can lag a tick or two without feeling bad, but listener
  yaw can't, since the entire spatial soundscape pivots on it.
- **Event replay.** All combat events (`carHit`, `carWallHit`,
  `carEliminated`, `roundStart`, `roundEnd`) and arcade events
  (`pickupApplied`, `bulletFired`, `bulletHit`, `bulletDodged`,
  `minePlaced`, `mineDetonated`, `mineHit`, `boostActivated`,
  `teleportUsed`) are pushed into `pendingEvents` on the host, ride
  along in the next snapshot, and are re-emitted through
  `content.events` on each client. The
  subscribers (sounds, announcer, haptics) are written to be
  perspective-aware — they fire from the *local* `playerCar`'s point
  of view on whichever peer is processing them. This is why score and
  inventory mutations are guarded by `if (role !== 'client')` — the
  host's authoritative state arrives in the snapshot.
- **Arcade-state replication.** Each car snapshot carries
  `inv: {sh, bu, mi, bo, te}` (shields/bullets/mines/boosts/teleports)
  alongside a sibling `bu` field at the car level — careful, that one
  is `boostUntil` (engine.time domain, mirrored on clients so physics
  + HUD see the same boost window). Top-level snapshot fields
  `pickups`, `bullets`, `mines` are arrays of host-authoritative items
  keyed by `id`; client managers reconcile via `applyRemoteItems()`
  (create new voices, destroy missing ones, hard-set positions).
  Bullets carry `vx, vy` so clients can dead-reckon between snapshots.
- **Per-car score.** `car.score` replaces the old global `score`
  scalar. `getScore()` returns the local player's car score.
- **Round-end ordering (host).** The local subscriber chain triggers
  the screen transition (→ gameOver) and `end()`, which clears `cars`.
  So the host must `pendingEvents.push({type: 'roundEnd', winnerId})`
  + `flushSnapshot()` *before* `emit('roundEnd', ...)`, otherwise
  clients never see the final snapshot.
- **Disconnect handling.** Mid-round client leave → host eliminates
  their car (forfeit). Mid-round host disconnect → client's game
  screen catches `app.net 'close'` and dispatches `'quit'`.
- **Lobby mode propagation.** The host's mode toggle broadcasts
  `{type: 'mode', mode}`. The host also re-broadcasts on `peerJoin` so
  late-joining clients catch up.

## Things that will bite you

- **`engine.fn.normalizeAngleSigned()` is broken.** Despite the name, it
  doesn't wrap an angle to `[-π, π]` — it just subtracts π from
  `normalizeAngle(angle)`. Calling it on a heading every frame
  alternates the heading by π each frame. Use
  `Math.atan2(Math.sin(a), Math.cos(a))` for shortest-signed-angle
  instead, or just leave headings unwrapped (cos/sin handle drift).
- **Syngen FSM transition handlers are `function (data)`, not
  `function (e, ...args)`.** `dispatch('foo', data)` calls
  `action.call(machine, data)` — single arg. And `change(state, data)`
  merges the data *into* the enter event payload, so the screen's
  `onEnter(e)` receives `{currentState, event, previousState, ...data}`
  as its only argument. Reading dispatched data from a second arg
  silently gives `undefined`.
- **Don't reference `app.*` at content-module load time** — content/
  loads first (see "Build pipeline").
- **`engine.loop.delta()` keeps ticking even while `engine.loop.isPaused()`
  is true** — `pause()` only sets a flag and is fired in the frame event;
  loop callers must check `isPaused` if they want to freeze time.
- **`app.controls.ui()` returns *deltas* (newly pressed keys), not state.**
  `app.controls.game()` returns sustained `{x, y, rotate}` for driving.
  Don't poll one expecting the other.
- **WASD is reserved for arcade actions; driving is arrow-keys-only**
  on the keyboard side (gamepad uses its own axes). `KeyW` triggers
  the pickup sweep, `KeyA`/`KeyS`/`KeyD` fire bullets (left/center/right
  nudge), `KeyF` drops a mine — all gated on arcade mode and edge-
  triggered via window keydown in `app/screen/game.js`. Re-adding any of
  WASD to `moveForward`/`moveBackward`/`turnLeft`/`turnRight`/`strafe*`
  will silently fire the arcade action *and* drive the car at the same
  time. WASD remains in `uiUp`/`uiDown`/`uiLeft`/`uiRight` for menus.
- **Browser autoplay policy.** The splash screen explicitly calls
  `engine.context().resume()` and `engine.loop.resume()` on first user
  gesture. Skipping the splash will leave the AudioContext suspended.
- **Networked event payloads must be JSON-serializable.** No Car refs,
  no functions, no Map/Set. The `carEliminated` event carries
  `byCarId` (an id) rather than a Car ref for exactly this reason — a
  Car ref would `JSON.stringify` to `{}` on the wire and clients
  couldn't resolve the killer for elimination credit. When adding a
  new networked event, payload IDs everywhere (`aId`/`bId`/
  `aggressorId`/`victimId`/...), and add the event name to
  `NETWORKED_EVENTS` in `content/game.js` so it gets captured into
  `pendingEvents`.
- **Score mutations belong on the host only.** Subscribers that bump
  `car.score` must guard with `if (role !== 'client')` — the
  authoritative score arrives in each snapshot, and a client mutation
  would just be flickered over by the next snapshot anyway. Any other
  car-state mutation in a subscriber needs the same guard.
- **Don't use `aiCount` to detect "is this a multi-car round?".** It
  is the count of AI controllers and excludes remote players, so it
  reads zero in a 4-human multiplayer round. The round-end check
  uses `cars.length > 1` instead, which is right for both modes.
- **Engine timbre is per-listener, not global.** `content.game.start`
  swaps `profileIndex` 0 ↔ `selfSlot` so every peer's own car uses
  profile 0 (red, the gentlest timbre). A side effect: the same
  player can sound like *different* timbres on different peers
  (e.g. a slot-2 driver sounds "green" to slot 0 and "red" to
  themselves). Don't compare audio across peers by color, and don't
  assume `playerCar.profileIndex` is the slot index — on a non-host
  peer it's been remapped. Identity in announcements comes from
  `realLabel` (chosen name), not `profileIndex`.

## Documentation

- [docs/GDD.md](docs/GDD.md) — game design, tuning constants, formulas
- [docs/ROADMAP.md](docs/ROADMAP.md) — milestone plan
- [docs/TODO.md](docs/TODO.md) — current to-do list
- [public/manual.html](public/manual.html) — user-facing manual (bundled
  in Electron `dist/` builds)
- syngen API: <https://syngen.shiftbacktick.io/>
