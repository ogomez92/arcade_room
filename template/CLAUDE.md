# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`syngen-template` — a template for accessible audio experiences built on top of the [syngen](https://github.com/nicross/syngen) Web Audio engine. Ships as both an HTML5 app (served from `public/`) and an Electron desktop app (`electron/main.js`).

There is no test suite, no linter, and no `npm` scripts. All tasks run through Gulp.

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

`app.settings.load()` merges defaults with persisted raw values from storage key `settings` and runs each `update` once. Call `app.settings.save()` to persist after changes. See `src/js/app/settings/example.js` for the shape (commented out — uncomment or copy to define real settings).

### Controls

`app.controls.update()` runs every frame (`engine.loop.on('frame', ...)`). It merges output from three adapters — `app.controls.gamepad`, `app.controls.keyboard`, `app.controls.mouse` — each with `game(mappings)` and `ui(mappings)` methods. Mappings live in `src/js/app/controls/mappings.js` and are tagged by `type: 'gamepad' | 'keyboard' | 'mouse'`.

- `app.controls.game()` returns the current frame's continuous game inputs (e.g. `{x, y, rotate}`).
- `app.controls.ui()` returns *deltas* — only the UI inputs that just became active this frame, used for menu navigation (so a held key fires once).

The mouse adapter takes pointer lock when entering the `game` screen (and re-acquires it after Escape in Electron). Gamepad axes are inverted in `game` to match keyboard semantics.

### Haptics

`app.haptics.enqueue({duration, startDelay, strongMagnitude, weakMagnitude})` queues a dual-rumble effect; magnitudes are summed across active events each frame, attenuated by `setSensitivity`, and dispatched to all dual-rumble gamepad actuators. `update(delta)` must be driven by the caller (typically by a screen's `onFrame`).

### Electron specifics

`electron/main.js` creates a frameless fullscreen window with `contextIsolation: true` and `devTools: false`, removes the menu (so Ctrl+R/Ctrl+W can't reload/close), auto-grants `midi` and `pointerLock` permissions, and applies platform-specific GPU/composition flags. `electron/preload.js` exposes `window.ElectronApi = {quit}`. Renderer code uses `app.isElectron()` (presence of `ElectronApi`) to branch — e.g. `app.quit()` calls `ElectronApi.quit()` only in Electron, and the HTML5 build adds a `beforeunload` confirmation that Electron skips.

The `dist-electron` Gulp task packages only the current platform — to ship Windows + Linux + macOS, run `gulp dist` separately on each.

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
