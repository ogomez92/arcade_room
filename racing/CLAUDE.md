# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Wheels of Claudo — anti-gravity F-Zero-style racer. Pure static web app. No build step, no package manager, no tests. Everything under `public/` is served as-is.

## Running

Serve `public/` over any static HTTP server and open `index.html`. Browser needs Web Audio and a user gesture to unlock audio (handled by the menu buttons).

Examples (not required — anything that serves static files works):
- `npx serve public`
- `python -m http.server -d public`

No lint, no build, no tests. Changes are verified by loading the page and playing.

## Architecture

All game modules are IIFEs that expose a capital-letter global (`Audio`, `Car`, `Track`, etc.). Script load order in `index.html` is significant — each module assumes those before it exist:

```
syngen.js → input → track → audio → car → ai → pickups → bullets → render → hud → main
```

### Core modules (`public/js/`)

- **`track.js`** — procedurally builds a looping track via `addRoad(enter, hold, leave, curve, y)`. Exposes `segments[]`, `length`, `SEGMENT_LENGTH`, `ROAD_WIDTH`, `findSegment(z)`, `wrap(z)`, `checkpointIndex(z)`. Track `z` is wrapped; player stores `lap` separately.
- **`car.js`** — player physics. `x ∈ [-1, +1]` is lateral lane offset (normalized to road half-width), beyond ±1 is off-road. Exposes `MAX_SPEED`, `BOOST_SPEED`, `HEALTH_MAX`, `GEAR_COUNT`.
- **`ai.js`** — opponents. Unlike player, AI `z` is absolute monotonic (never wraps) — used directly for ranking via `totalDistance(ai)`.
- **`pickups.js`** / **`bullets.js`** — work in **absolute z space** (`(car.lap - 1) * Track.length + car.z`), not wrapped z. Both track an internal list and expose `reset / update / getList`. Each pickup owns a persistent audio beacon handle from `Audio.createPickupBeacon`; each bullet owns a travel handle from `Audio.createBulletTravel`. Handles must be `.stop()`'d when items die or the race resets.
- **`render.js`** — pseudo-3D road projection. Reads only `car`, `ais`, and optional `pickups`/`bullets` lists. No state of its own beyond canvas size.
- **`input.js`** — keyboard only. Arrows for steer/brake (A/S/D are reserved for shooting). `wasPressed(code)` consumes the press flag; `clear()` drops all held/pressed state.
- **`hud.js`** — DOM-only. `announce(msg, assertive)` writes to ARIA live regions — primary blind-accessibility channel. Screens: splash (menu), finish, gameover. Each has `show*` / `hide*`.
- **`main.js`** — phase state machine: `splash | countdown | race | finish | gameover`. Also owns the accessible menu controller (`setupMenu`) which manages `#splash` / `#help` / `#learn` overlays entirely through DOM events (not via the tick).

### Audio (`audio.js`) — the heart of the game

Accessibility-first. Blind players navigate by sound, not sight.

- Built on **syngen** (local, vendored as `public/syngen.js` — don't modify). Access the raw `AudioContext` via `syngen.context()`, master mixer input via `syngen.mixer.input()`, the audio clock via `syngen.time()`. Buffers via `syngen.buffer.whiteNoise` / `pinkNoise`. Oscillators via `syngen.synth.simple({ type, frequency, gain, when })` which returns `{ output, param: { frequency, gain }, stop(t) }`.
- **Critical gotcha**: `syngen.synth.simple`'s `gain` option is an internal multiplier that stays constant. If you shape envelope via an external `GainNode`, set syngen's `gain: 1.0` — otherwise output becomes `1.0 × 0.001 = silent`. Only set syngen's `gain` to a small value when you **don't** chain an external envelope (or when you ramp `s.param.gain` directly).
- **Persistent car audio** (engine, exhaust, wind, offroad grind, edge ticks, center cue, left/right rail hums, AI engines) is wired once in `init()` and driven each frame by `update(car, dt, ais)`. These route through `carPanner` (lane-based stereo) into `carBus`. Volume/pitch params are ramped via `paramRamp` (wraps `setTargetAtTime`).
- **Silence / unsilence**: `silenceCar()` zeroes every persistent car/AI gain param. `update()` early-returns while `carSilenced === true`. Used by the game-over flow so doom music plays cleanly. Always pair with `unsilenceCar()` on race reset.
- **Spatial beacons** for discrete entities: `createPickupBeacon(type)` and `createBulletTravel()` each return `{ update(vol, pan), stop() }`. Pickups pan = `pickup.x - car.x` (so steering toward the beacon centers it); volume falls with z-distance. Bullets similar.
- **Doom music** (`playDoom` / `stopDoom`): E-minor descending lament + sustained Em chord, looped via `setInterval(BAR * 1000)`. Two bars pre-scheduled to cover the first interval. The setInterval callback must early-return if `doom === null` — else it races with `stopDoom`.
- **Learn Sounds** (`playDemo(kind)`): fade-in 0.25s → hold 1s → fade-out 0.35s wrapper around a holder `GainNode`. One handle at a time; the menu controller stops the previous before starting the next.

### Game loop (`main.js`)

Single `requestAnimationFrame(tick)`. Branches by `phase`. Key flow:
- `race` → `Car.update` → AI loop → collision detection → `Pickups.update` → `Bullets.update` → shoot-key check (A/S/D) → `Render.render` → `HUD.update` → `Audio.update`. Health ≤ 0 triggers `triggerGameOver()` (silences car, plays doom, shows stats overlay).
- `finish` → reached when lap wrap makes `car.lap > TOTAL_LAPS`. Engine keeps running on coast.
- Enter/Space on `finish` or `gameover` → `resetRace()` (which also resets pickups, bullets, stops doom, unsilences car) then `startCountdown()`.

### Accessible menu

DOM-driven, not tick-driven. Arrow Up/Down cycles focus within `#menu` / `#learn-list`, Enter/Space activates, Escape backs out. Focus on a Learn Sounds item auto-plays its sample. The global keydown handler in `setupMenu` picks the active panel by visibility and only intervenes there — game-phase input is unaffected.

### Coordinate conventions (easy to get wrong)

- Player `car.z` is **wrapped** (0 to `Track.length`). AI `ai.z` is **monotonic absolute**. To compare them, use `(car.lap - 1) * Track.length + car.z` as the player's absolute z.
- Lateral `x`: player and AI in `[-1, +1]` of road half-width; pickups and bullets use the same convention. `|x| > 1` means off-road / off-track.
- Audio pan range `[-1, +1]`: clamp before applying.

## Multiplayer

`public/js/net.js` wraps PeerJS into a small star-topology netcode. The
free PeerJS broker (`0.peerjs.com`) handles signalling; data flows
direct over WebRTC data channels.

- **STUN / TURN / TURNS.** Self-hosted **coturn** on the VPS that
  serves oriolgomez.com. STUN+TURN on `turn.oriolgomez.com:3478`
  (UDP+TCP), TURNS on `:5349` (TLS over TCP). The hostname rides the
  wildcard `*.oriolgomez.com` A record, so if the VPS ever moves, only
  the wildcard needs updating. ICE order in the client is: STUN first,
  TURN/UDP, TURN/TCP, then TURNS as last-resort for networks that
  block everything except TLS. Connection details live in five
  constants at the top of `public/js/net.js` — `TURN_HOST`,
  `TURN_PORT`, `TURNS_PORT`, `TURN_USER`, `TURN_PASS`. No build step,
  so edits to `net.js` are live on next page load. Server-side config
  lives in `/etc/turnserver.conf` on the VPS; the TLS cert is
  provisioned by Caddy (Caddyfile entry for `turn.oriolgomez.com`)
  and copied to `/etc/coturn/{turn.crt,turn.key}` by
  `/usr/local/bin/coturn-cert-deploy`, re-triggered on renewal by the
  systemd path unit `coturn-cert-watch.path`. UFW allows
  `3478/udp+tcp`, `5349/tcp+udp`, and `49160-49200/udp` (relay range).

## Conventions

- No emojis in user-facing UI unless explicitly asked.
- Keep modules as IIFEs exposing a single global; don't introduce ES modules or a bundler (would break the no-build workflow).
- When adding audio, match the pattern: persistent nodes wired once in `init()` and controlled via `paramRamp`; discrete hits created on demand and stopped at their decay tail.
- Screen-reader accessibility is a hard requirement — any new gameplay element needs a sound cue and, where useful, an `HUD.announce` string.
