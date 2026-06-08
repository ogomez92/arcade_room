// Spatial audio for Marble.
//
// Listener is SCREEN-LOCKED: yaw is FIXED, so a source keeps the same bearing
// no matter which way the marble is rolling — "ahead" is always screen-north
// (up), which is also where ArrowUp tilts the board. The fixed yaw is
// LISTENER_YAW. Screen->audio uses the standard y-flip (see CLAUDE.md): screen
// +y is south, audio +y is left, so y is negated at the boundary; with that
// flip, yaw = +pi/2 puts audio-front at screen-north.
//
// Voices:
//   - rolling   : non-spatial self-voice, pitch/gain/brightness track speed
//   - goal      : continuous beacon at the exit (always faintly audible)
//   - pit       : warning loop pinned to the NEAREST pit, fades in within range
//   - wall      : proximity loop probing ahead along the heading
//   - radar tick: periodic directional "go this way" one-shot toward the exit
//   - one-shots : clack (wall hit), fell (death), goal (clear), levelStart
content.audio = (() => {
  // Fixed listener orientation: audio-front = screen-north (up). See header.
  const LISTENER_YAW = Math.PI / 2

  let started = false
  let _yaw = LISTENER_YAW
  let props = {}
  let rolling = null
  let nextBeaconAt = 0

  const C = () => content.constants

  // --- coordinate helpers --------------------------------------------------

  function tileToM(v) {
    const k = C().TILE_TO_M
    return {x: v.x * k, y: -v.y * k, z: 0}
  }

  function relativeVector(x, y) {
    const k = C().TILE_TO_M
    const listener = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x: x * k - listener.x,
      y: -y * k - listener.y,
      z: 0,
    }).rotateQuaternion(lq)
  }

  // 0 = ahead of the listener, 1 = directly behind. Uses the same flipped y as
  // the listener so it stays consistent with what the player hears.
  function behindness(srcX, srcY) {
    const p = content.player.getPosition()
    const dx = srcX - p.x, dy = -(srcY - p.y)
    if (dx === 0 && dy === 0) return 0
    const rel = Math.abs(C().angleDelta(Math.atan2(dy, dx), _yaw))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  function updateListener() {
    // Position tracks the marble; orientation is fixed (screen-locked).
    const p = content.player.getPosition()
    _yaw = LISTENER_YAW
    engine.position.setVector(tileToM(p))
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: _yaw}))
  }

  // Pin a fixed listener pose for diagnostic / learn screens. Defaults to the
  // gameplay orientation so cues audition with the same bearings as in-game.
  function setStaticListener(forwardYaw = LISTENER_YAW) {
    _yaw = forwardYaw
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(engine.tool.quaternion.fromEuler({yaw: forwardYaw}))
  }

  // Gentle falloff that never reaches zero — keeps the exit audible board-wide.
  function distGainNorm(d, ref) { return ref / (ref + d) }
  // Sharp fade-in used for hazards that should only register up close.
  function rangeGain(d, range) {
    if (d >= range) return 0
    return Math.pow((range - d) / range, 1.5)
  }

  // --- looping spatial voice (binaural + behind-muffle) --------------------

  function makeProp(build, gain = 1) {
    const ctx = engine.context()
    const output = ctx.createGain()
    output.gain.value = gain

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000
    muffle.Q.value = 0.7
    output.connect(muffle)

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
      x: 0, y: 0, z: 0,
    }).from(muffle).to(engine.mixer.input())

    const stop = build(output)
    let vector = {x: 0, y: 0, z: 0}

    return {
      setPosition(nx, ny) { vector = {x: nx, y: ny, z: 0} },
      setGain(v) { output.gain.value = v },
      getPosition: () => ({x: vector.x, y: vector.y}),
      destroy() {
        try { stop && stop() } catch (_) {}
        try { output.disconnect() } catch (_) {}
        try { muffle.disconnect() } catch (_) {}
        try { binaural.destroy() } catch (_) {}
      },
      _update() {
        binaural.update(relativeVector(vector.x, vector.y))
        const b = behindness(vector.x, vector.y)
        const cutoff = 22000 - b * 21300 // 22 kHz ahead -> ~700 Hz behind
        muffle.frequency.setTargetAtTime(Math.max(700, cutoff), ctx.currentTime, 0.05)
      },
    }
  }

  function buildGoal(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 392
    const lfo = ctx.createOscillator(); lfo.frequency.value = 2.6 // gentle pulse
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5
    const amp = ctx.createGain(); amp.gain.value = 0.5
    lfo.connect(lfoGain).connect(amp.gain)
    osc.connect(amp).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }

  function buildPit(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 6
    lfo.connect(lfoGain).connect(osc.frequency)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320
    osc.connect(lp).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }

  function buildWall(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 150
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500
    osc.connect(lp).connect(out)
    osc.start()
    return () => { try { osc.stop() } catch (_) {} }
  }

  // --- non-spatial self-voice (the rolling marble) -------------------------

  function makeRolling() {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 90
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300
    const g = ctx.createGain(); g.gain.value = 0
    osc.connect(lp).connect(g).connect(engine.mixer.input())
    osc.start()
    return {
      update(speed) {
        const t = Math.min(1, speed / C().MAX_SPEED)
        g.gain.setTargetAtTime(0.05 + t * 0.16, ctx.currentTime, 0.05)
        osc.frequency.setTargetAtTime(80 + t * 150, ctx.currentTime, 0.04)
        lp.frequency.setTargetAtTime(250 + t * 1600, ctx.currentTime, 0.05)
      },
      mute() { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05) },
      destroy() { try { osc.stop() } catch (_) {} try { g.disconnect() } catch (_) {} },
    }
  }

  // --- one-shots -----------------------------------------------------------

  // Spatial transient — used by the radar beacon and the #test / learn screens.
  function emitTick(x, y, {freq = 1400, dur = 0.08, gain = 0.5} = {}) {
    const ctx = engine.context()
    const t0 = ctx.currentTime
    const b = behindness(x, y)
    const f0 = freq * (1 - 0.5 * b)

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(f0, t0)
    osc.frequency.exponentialRampToValueAtTime(Math.max(120, f0 * 0.6), t0 + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.003)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.frequency.value = 22000 - b * 20000

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(muffle).to(engine.mixer.input())

    osc.connect(env).connect(muffle)
    binaural.update(relativeVector(x, y))
    osc.start(t0); osc.stop(t0 + dur + 0.05)
    setTimeout(() => {
      try { osc.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { muffle.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.2) * 1000)
  }

  // Non-spatial cue straight to the mixer (player-centric feedback).
  function blip({freq = 440, to = null, dur = 0.18, type = 'triangle', gain = 0.3, delay = 0}) {
    const ctx = engine.context()
    const t0 = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(env).connect(engine.mixer.input())
    osc.start(t0); osc.stop(t0 + dur + 0.05)
    setTimeout(() => {
      try { osc.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
    }, (delay + dur + 0.2) * 1000)
  }

  function clack(speed) {
    const g = Math.min(0.4, 0.08 + speed * 0.06)
    blip({freq: 220, to: 90, dur: 0.09, type: 'square', gain: g})
  }
  function fell() {
    blip({freq: 600, to: 70, dur: 0.8, type: 'sine', gain: 0.35})
    blip({freq: 300, to: 50, dur: 0.9, type: 'triangle', gain: 0.25, delay: 0.04})
  }
  function goal() {
    blip({freq: 523, dur: 0.16, gain: 0.3})
    blip({freq: 659, dur: 0.16, gain: 0.3, delay: 0.12})
    blip({freq: 784, dur: 0.28, gain: 0.32, delay: 0.24})
  }
  function levelStart() {
    blip({freq: 330, dur: 0.12, gain: 0.22})
    blip({freq: 494, dur: 0.16, gain: 0.24, delay: 0.1})
  }

  // --- lifecycle -----------------------------------------------------------

  function start() {
    if (started) return
    started = true
    props.goal = makeProp(buildGoal, 0)
    props.pit = makeProp(buildPit, 0)
    props.wall = makeProp(buildWall, 0)
    rolling = makeRolling()
    nextBeaconAt = 0
  }

  function stop() {
    if (!started) return
    for (const k in props) { props[k].destroy(); delete props[k] }
    if (rolling) { rolling.destroy(); rolling = null }
    started = false
  }

  function silenceAll() {
    for (const k in props) props[k].setGain(0)
    if (rolling) rolling.mute()
    nextBeaconAt = 0
  }

  function tickProp(key) { if (props[key]) props[key]._update() }

  function frame() {
    if (!started) return
    updateListener()

    const p = content.player.getPosition()
    const speed = content.player.getSpeed()

    if (rolling) rolling.update(speed)

    // Goal beacon — always faintly present, grows as you near it.
    const gp = content.maze.goalPos()
    const gd = Math.hypot(gp.x - p.x, gp.y - p.y)
    props.goal.setPosition(gp.x, gp.y)
    props.goal.setGain(distGainNorm(gd, 4) * 0.5)
    props.goal._update()

    // Nearest-pit warning.
    const near = content.maze.nearestPit(p.x, p.y)
    if (near) {
      props.pit.setPosition(near.pos.x, near.pos.y)
      props.pit.setGain(rangeGain(near.dist, C().PIT_WARN_RANGE) * 0.6)
    } else {
      props.pit.setGain(0)
    }
    props.pit._update()

    // Wall-ahead probe along the current heading.
    const v = content.player.getVelocity()
    const vmag = Math.hypot(v.x, v.y)
    if (vmag > 0.25) {
      const dx = v.x / vmag, dy = v.y / vmag
      const RANGE = C().WALL_AHEAD_RANGE
      let dist = RANGE, hit = false, probeX = p.x, probeY = p.y
      for (let step = 1; step <= 6; step++) {
        probeX = p.x + dx * step * 0.4
        probeY = p.y + dy * step * 0.4
        if (content.maze.isWall(Math.floor(probeX), Math.floor(probeY))) {
          dist = step * 0.4; hit = true; break
        }
      }
      props.wall.setPosition(probeX, probeY)
      props.wall.setGain(hit ? rangeGain(dist, RANGE) * 0.5 : 0)
    } else {
      props.wall.setGain(0)
    }
    props.wall._update()

    // Directional radar tick toward the exit.
    const now = engine.time()
    if (now >= nextBeaconAt) {
      const stepDir = content.maze.nextStepToGoal(p.x, p.y)
      if (stepDir && (stepDir.x !== 0 || stepDir.y !== 0)) {
        emitTick(p.x + stepDir.x, p.y + stepDir.y, {freq: 1500, dur: 0.07, gain: 0.4})
      }
      nextBeaconAt = now + C().BEACON_PERIOD
    }
  }

  return {
    start, stop, frame, silenceAll, setStaticListener, tickProp, emitTick,
    clack, fell, goal, levelStart,
    isStarted: () => started,
    _props: props,
    get _lastYaw() { return _yaw },
  }
})()
