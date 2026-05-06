// Crosshair: continuous X+Y position integrated from app.controls.game(),
// plus a Y-aim cue (ping pitch ∝ y) and a lock tone (gain ∝ proximity).
//
// This module owns its persistent ping and lock voices. They are created
// on attach() (game-screen onEnter) and destroyed on detach().
content.crosshair = (() => {
  const SPEED = 1.4    // world units per second at full deflection
  const LOCK_RADIUS = 0.18    // gain rises from 0 at this distance, to max at 0
  const LOCK_TREM_START = 0.10 // tremolo begins ramping in below this
  const PING_RATE = 4   // pings per second while crosshair is moving

  const state = {
    x: 0,
    y: 0.5,
    pingVoice: null,
    lockVoice: null,
    lastMoveAt: 0,
    nextPingAt: 0,
  }

  function attach() {
    detach()
    // Persistent ping voice: stereo-only, panned with crosshair x.
    state.pingVoice = content.audio.makeProp({
      build: (out) => {
        const v = content.audio.buildCrosshairPing(out)
        state._pingCtl = v
        return v.stop
      },
      x: state.x,
      y: 0.5,
      gain: 1.0,
    })
    state.lockVoice = content.audio.makeProp({
      build: (out) => {
        const v = content.audio.buildLockTone(out)
        state._lockCtl = v
        return v.stop
      },
      x: state.x,
      y: state.y,
      gain: 1.0,
    })
  }

  function detach() {
    if (state.pingVoice) { try { state.pingVoice.destroy() } catch (_) {} state.pingVoice = null }
    if (state.lockVoice) { try { state.lockVoice.destroy() } catch (_) {} state.lockVoice = null }
    state._pingCtl = null
    state._lockCtl = null
  }

  function reset() {
    state.x = 0
    state.y = 0.5
    state.lastMoveAt = 0
    state.nextPingAt = 0
  }

  // Read app.controls.game() for x/y deflection and integrate.
  function tick(dt) {
    const c = app.controls.game()
    // Game screen interprets the controls module's axes:
    //   moveForward/moveBackward → x (forward/back). Map that to crosshair.y.
    //   strafeLeft/strafeRight   → y. Map that to crosshair.x (with sign flip
    //                                so left = -x).
    // Mappings:
    //   ArrowUp    → moveForward    → c.x = +1 → crosshair y up
    //   ArrowDown  → moveBackward   → c.x = -1 → crosshair y down
    //   ArrowLeft  → strafeLeft     → c.y = +1 → crosshair x LEFT (need to negate)
    //   ArrowRight → strafeRight    → c.y = -1 → crosshair x RIGHT
    const dx = -(c.y || 0) * SPEED * dt
    const dy =  (c.x || 0) * SPEED * dt

    let moved = false
    if (dx) { state.x = content.world.clamp(state.x + dx, -1, 1); moved = true }
    if (dy) { state.y = content.world.clamp(state.y + dy, 0, 1); moved = true }
    if (moved) state.lastMoveAt = engine.time()

    // Update voice positions (the prop-level binaural and pan tracking).
    if (state.pingVoice) {
      state.pingVoice.setPosition(state.x, state.y)
      state.pingVoice._update()
    }
    if (state.lockVoice) {
      state.lockVoice.setPosition(state.x, state.y)
      state.lockVoice._update()
    }

    // Set the ping pitch from y. 660 → 1980 Hz across [0, 1].
    if (state._pingCtl && state._pingCtl.setFreq) {
      state._pingCtl.setFreq(660 + 1320 * state.y)
    }

    // Schedule pings at PING_RATE while crosshair is moving or for 800 ms
    // after last movement. Silent thereafter so it doesn't compete.
    const now = engine.time()
    const audible = (now - state.lastMoveAt) < 0.8
    if (audible && state._pingCtl && state._pingCtl.pulse) {
      if (now >= state.nextPingAt) {
        state._pingCtl.pulse(0.10, 1 / PING_RATE * 0.7)
        state.nextPingAt = now + 1 / PING_RATE
      }
    }

    // Lock tone: gain rises as 2D distance to nearest threat shrinks.
    // Tremolo ramps in gradually over the last LOCK_TREM_START — full
    // wobble at d=0, none at d≥LOCK_TREM_START. The depth curve is squared
    // so the wobble onsets late but lands hard, matching the "I'm right
    // on it" feel.
    const d = content.threats.nearestDistanceTo(state.x, state.y)
    let gain = 0
    let tremDepth = 0
    if (d < Infinity) {
      const norm = content.world.clamp(d / LOCK_RADIUS, 0, 1)
      gain = (1 - norm) * 0.28
      if (d < LOCK_TREM_START) {
        const k = 1 - (d / LOCK_TREM_START)
        tremDepth = k * k
      }
    }
    if (state._lockCtl) {
      state._lockCtl.setGain(gain)
      state._lockCtl.setTremolo(tremDepth)
    }
  }

  function silenceAll() {
    if (state._lockCtl) { state._lockCtl.setGain(0); state._lockCtl.setTremolo(0) }
    if (state.pingVoice) state.pingVoice.setGainImmediate(0)
  }

  function getPosition() { return {x: state.x, y: state.y} }

  return {attach, detach, reset, tick, silenceAll, getPosition, state}
})()
