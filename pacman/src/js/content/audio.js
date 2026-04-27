// Spatial audio: drive engine.position from Pac-Man's pose, build looping sound props
// for ghosts, fruit, and the radar tick. Each looping prop runs a small synth that's
// positioned in space — the engine's binaural ear handles direction, and we apply our
// own distance attenuation on top so far-away sources are clearly quieter.
//
// Coordinate convention: screen tile coords use +y = south (down), but syngen's
// binaural ear places the LEFT ear at +y and the RIGHT ear at -y in its own
// listener-local frame. Without compensation, screen-south would play from the
// player's left when facing east — i.e., left/right reversed. We fix this by
// negating y in every translation from screen → audio: in tileToM(), in the
// source half of relativeVector(), and in behindness(). After those flips,
// +x in audio = front, +y = left, -y = right.
//
// Listener orientation is FIXED to screen-north. Pac-Man is a top-down game —
// the player views the maze from above and never turns the camera, so the
// listener should not turn with movement. We anchor audio-front to screen-up,
// which means: north = front, south = behind, east = right, west = left,
// regardless of which way Pac-Man last moved.
content.audio = (() => {
  // Tile units → meters for spatial audio
  const TILE_TO_M = 2

  // Fixed listener yaw: rotates audio-front (audio +x) onto screen-north
  // (audio +y after the screen→audio y-flip). This is the value pushed to
  // engine.position.setQuaternion every frame and read by behindness().
  const LISTENER_YAW = Math.PI / 2

  // Distance attenuation: returns a multiplier in [0, 1] given distance in tiles.
  // gain ≈ 1 within `near`, and falls off with `pow` exponent beyond it.
  function distanceGain(distTiles, near = 2.5, pow = 1.8) {
    if (distTiles <= near) return 1
    return Math.min(1, Math.pow(near / distTiles, pow))
  }

  function tileToM(v) {
    // Negate y to convert from screen coords (y down) to audio coords (y up).
    return {x: v.x * TILE_TO_M, y: -v.y * TILE_TO_M, z: 0}
  }

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y
    return Math.sqrt(dx*dx + dy*dy)
  }

  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI
    while (a < -Math.PI) a += 2 * Math.PI
    return a
  }

  // Player position drives engine.position (the listener), but the listener's
  // orientation is FIXED — it does not rotate with Pac-Man's movement. This
  // matches the top-down viewpoint: a ghost south of Pac-Man should always
  // sound like it's behind, no matter which way Pac-Man last moved.
  function updateListener() {
    const p = content.pacman.getPosition()
    engine.position.setVector(tileToM(p))
    content.audio._lastYaw = LISTENER_YAW
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW}),
    )
  }

  // Build the relative vector from a world-space (tile) position to the listener.
  // Source y is negated to match the screen→audio flip applied in tileToM().
  function relativeVector(x, y) {
    const listener = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x:  x * TILE_TO_M - listener.x,
      y: -y * TILE_TO_M - listener.y,
      z: 0,
    }).rotateQuaternion(lq)
  }

  // 0 (ahead) → 1 (directly behind), based on angle relative to facing.
  // Both the source delta and the stored yaw are in audio space (screen y
  // negated), so they're directly comparable.
  function behindness(srcX, srcY) {
    const p = content.pacman.getPosition()
    const dx = srcX - p.x, dy = -(srcY - p.y)
    if (dx === 0 && dy === 0) return 0
    const yaw = content.audio._lastYaw || 0
    const rel = Math.abs(normAngle(Math.atan2(dy, dx) - yaw))
    if (rel <= Math.PI / 2) return 0
    return Math.min(1, (rel - Math.PI / 2) / (Math.PI / 2))
  }

  // ---------------- generic looping prop ----------------
  // Each prop chains: build() → output → muffle (lowpass) → binaural → mixer.
  // The muffle lowpass is dynamically driven by `behindness` so any source behind
  // the player is consistently dulled — a global "behind" cue.
  function makeProp({build, x = 0, y = 0, gain = 1}) {
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
      x: x * TILE_TO_M,
      y: y * TILE_TO_M,
      z: 0,
    }).from(muffle).to(engine.mixer.input())

    const stop = build(output)
    let vector = {x, y, z: 0}

    return {
      vector,
      output,
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
        // 22 kHz ahead → 700 Hz directly behind. Smooth, not abrupt.
        const cutoff = 22000 - b * 21300
        muffle.frequency.setTargetAtTime(Math.max(700, cutoff), ctx.currentTime, 0.05)
      },
    }
  }

  // ---------------- one-shot ticks (radar / beacon) ----------------
  // A "tick" is a percussive click at a world position, like a wood-block hit.
  // Each tick allocates fresh nodes, plays once, and tears down on completion.
  // If the source is behind the player, the tick is pitched down and muffled.
  function emitTick(x, y, {freq = 1500, dur = 0.07, gain = 0.55} = {}) {
    const ctx = engine.context()
    const t0 = ctx.currentTime

    const b = behindness(x, y)
    const pitchMul = 1 - 0.55 * b // up to ~45% lower when directly behind
    const f0 = freq * pitchMul

    // Two short sine bursts an octave apart → reads as a "tick" rather than a tone.
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(f0, t0)
    osc1.frequency.exponentialRampToValueAtTime(Math.max(80, f0 * 0.35), t0 + dur)

    const osc2 = ctx.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.setValueAtTime(f0 * 2, t0)
    osc2.frequency.exponentialRampToValueAtTime(Math.max(160, f0 * 0.7), t0 + dur)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(gain, t0 + 0.002)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    // Behind sources get a low-pass to muffle them.
    const muffle = ctx.createBiquadFilter()
    muffle.type = 'lowpass'
    muffle.Q.value = 0.7
    muffle.frequency.value = 22000 - b * 20500 // ~1500 Hz when directly behind

    // Distance attenuation as an extra static gain.
    const p = content.pacman.getPosition()
    const distTiles = distance(p, {x, y})
    const distGain = distanceGain(distTiles, 2.5, 1.5)
    const post = ctx.createGain()
    post.gain.value = distGain

    const binaural = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate(),
      filterModel: engine.ear.filterModel.head.instantiate(),
    }).from(post).to(engine.mixer.input())

    osc1.connect(env)
    osc2.connect(env)
    env.connect(muffle).connect(post)
    binaural.update(relativeVector(x, y))

    osc1.start(t0); osc2.start(t0)
    osc1.stop(t0 + dur + 0.05); osc2.stop(t0 + dur + 0.05)

    setTimeout(() => {
      try { osc1.disconnect() } catch (_) {}
      try { osc2.disconnect() } catch (_) {}
      try { env.disconnect() } catch (_) {}
      try { muffle.disconnect() } catch (_) {}
      try { post.disconnect() } catch (_) {}
      try { binaural.destroy() } catch (_) {}
    }, (dur + 0.2) * 1000)
  }

  // ---------------- dot beacon ----------------
  // Every 1.5 s, BFS-pathfind to the nearest dot from Pac-Man's tile and emit a
  // single tick at the next step on that path. Pointing at the next-step (not the
  // dot itself) means a dot behind a wall doesn't trick the player into walking
  // into the wall — they hear the actual direction they should turn.
  // Pitch lowers with path distance, so close dots tick brighter than far ones.
  const BEACON_PERIOD = 1.5
  let nextBeaconAt = 0

  function emitDotBeacon() {
    if (!content.game.isPlaying()) return
    const p = content.pacman.getPosition()
    const result = content.maze.nearestDotByPath(p.x, p.y)
    if (!result) return
    const freq = 1700 - Math.min(1100, result.distance * 55)
    emitTick(result.nextStep.x, result.nextStep.y, {freq, dur: 0.07, gain: 0.6})
  }

  function resetSweep() {
    nextBeaconAt = 0
  }

  // ---------------- ghost / fruit / wall sound builders ----------------
  function buildGhostBlinky(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 220
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 8
    lfo.connect(lfoGain).connect(osc.frequency)
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600
    const g = ctx.createGain(); g.gain.value = 0.16
    osc.connect(lp).connect(g).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }
  function buildGhostPinky(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 440
    const lfo = ctx.createOscillator(); lfo.frequency.value = 3
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 30
    lfo.connect(lfoGain).connect(osc.frequency)
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 4
    const g = ctx.createGain(); g.gain.value = 0.10
    osc.connect(bp).connect(g).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }
  function buildGhostInky(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 330
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 333
    const g = ctx.createGain(); g.gain.value = 0.13
    osc.connect(g); osc2.connect(g); g.connect(out)
    osc.start(); osc2.start()
    return () => { try { osc.stop() } catch (_) {} try { osc2.stop() } catch (_) {} }
  }
  function buildGhostClyde(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 110
    const lfo = ctx.createOscillator(); lfo.frequency.value = 1.2
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.08
    const amp = ctx.createGain(); amp.gain.value = 0.13
    lfo.connect(lfoGain).connect(amp.gain)
    osc.connect(amp).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }
  function buildFrightened(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 600
    const lfo = ctx.createOscillator(); lfo.frequency.value = 12
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 200
    lfo.connect(lfoGain).connect(osc.frequency)
    const g = ctx.createGain(); g.gain.value = 0.12
    osc.connect(g).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }
  function buildEaten(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 1500
    const lfo = ctx.createOscillator(); lfo.frequency.value = 10
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 400
    lfo.connect(lfoGain).connect(osc.frequency)
    const g = ctx.createGain(); g.gain.value = 0.10
    osc.connect(g).connect(out)
    osc.start(); lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }
  function buildFruit(out) {
    const ctx = engine.context()
    const carrier = ctx.createOscillator(); carrier.type = 'sine'; carrier.frequency.value = 660
    const modulator = ctx.createOscillator(); modulator.type = 'sine'; modulator.frequency.value = 440
    const modGain = ctx.createGain(); modGain.gain.value = 220
    modulator.connect(modGain).connect(carrier.frequency)
    const env = ctx.createOscillator(); env.frequency.value = 1.5
    const envGain = ctx.createGain(); envGain.gain.value = 0.08
    const out1 = ctx.createGain(); out1.gain.value = 0
    env.connect(envGain).connect(out1.gain)
    carrier.connect(out1).connect(out)
    carrier.start(); modulator.start(); env.start()
    return () => {
      try { carrier.stop() } catch (_) {}
      try { modulator.stop() } catch (_) {}
      try { env.stop() } catch (_) {}
    }
  }
  // Wall: a deep "warning" rumble that's distinct from any ghost. Two
  // moderate-Q bandpasses on noise give it a tonal, woody character; a 6 Hz
  // tremolo makes it pulse so the player can pick it out even when ghost
  // sounds are also playing. Q is kept low enough that the filters pass
  // useful energy — narrower Qs choke the signal almost to silence.
  function buildWallProximity(out) {
    const ctx = engine.context()
    const noise = ctx.createBufferSource()
    const sr = ctx.sampleRate
    const buf = ctx.createBuffer(1, sr * 1, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noise.buffer = buf; noise.loop = true

    const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 160; bp1.Q.value = 3
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 320; bp2.Q.value = 3
    const sum = ctx.createGain(); sum.gain.value = 2.0

    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 6
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.4
    const trem = ctx.createGain(); trem.gain.value = 0.6
    lfo.connect(lfoDepth).connect(trem.gain)

    const g = ctx.createGain(); g.gain.value = 0
    noise.connect(bp1).connect(sum)
    noise.connect(bp2).connect(sum)
    sum.connect(trem).connect(g).connect(out)

    noise.start(); lfo.start()
    return () => { try { noise.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }
  // Used by the Sound Learning menu so the player can preview the radar tick.
  function buildBeaconSample(out) {
    const ctx = engine.context()
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 1500
    const amp = ctx.createGain(); amp.gain.value = 0
    osc.connect(amp).connect(out)
    osc.start()
    const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 6
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.1
    lfo.connect(lfoGain).connect(amp.gain)
    lfo.start()
    return () => { try { osc.stop() } catch (_) {} try { lfo.stop() } catch (_) {} }
  }

  // ---------------- prop instances ----------------
  const props = {}
  let started = false

  function start() {
    if (started) return
    started = true
    props.blinky     = makeProp({build: buildGhostBlinky, gain: 0})
    props.pinky      = makeProp({build: buildGhostPinky, gain: 0})
    props.inky       = makeProp({build: buildGhostInky, gain: 0})
    props.clyde      = makeProp({build: buildGhostClyde, gain: 0})
    props.frightened = makeProp({build: buildFrightened, gain: 0})
    props.eaten      = makeProp({build: buildEaten, gain: 0})
    props.fruit      = makeProp({build: buildFruit, gain: 0})
    props.wall       = makeProp({build: buildWallProximity, gain: 0})
    props.beacon     = makeProp({build: buildBeaconSample, gain: 0})
  }

  function stop() {
    if (!started) return
    started = false
    for (const k in props) {
      try { props[k].destroy() } catch (_) {}
      delete props[k]
    }
    resetSweep()
  }

  function setStaticListener(forwardYaw = 0) {
    engine.position.setVector({x: 0, y: 0, z: 0})
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: forwardYaw}),
    )
    content.audio._lastYaw = forwardYaw
  }

  function silenceAll() {
    for (const k in props) {
      if (props[k] && props[k].setGain) props[k].setGain(0)
    }
    resetSweep()
  }

  function tickProp(key) {
    if (!started || !props[key]) return
    props[key]._update()
  }

  function frame() {
    if (!started) return
    updateListener()

    const playing = content.game.isPlaying()
    const p = content.pacman.getPosition()

    // ---- Ghosts ----
    const ghosts = content.ghosts.getAll()
    let frightenedActive = false
    let eatenActive = false
    let frightenedPos = null
    let eatenPos = null

    for (const g of ghosts) {
      const prop = props[g.name]
      if (!prop) continue
      prop.setPosition(g.x, g.y)

      let baseGain = 0
      if (playing && !g.inHouse) {
        if (g.mode === 'frightened') {
          frightenedActive = true
          frightenedPos = {x: g.x, y: g.y}
        } else if (g.mode === 'eaten') {
          eatenActive = true
          eatenPos = {x: g.x, y: g.y}
        } else {
          baseGain = 1
        }
      }

      const distTiles = Math.sqrt((g.x-p.x)*(g.x-p.x) + (g.y-p.y)*(g.y-p.y))
      prop.setGain(baseGain * distanceGain(distTiles))
      prop._update()
    }

    if (frightenedPos) props.frightened.setPosition(frightenedPos.x, frightenedPos.y)
    {
      const fp = props.frightened.getPosition()
      const dist = Math.sqrt((fp.x-p.x)*(fp.x-p.x) + (fp.y-p.y)*(fp.y-p.y))
      props.frightened.setGain(frightenedActive && playing ? distanceGain(dist) : 0)
      props.frightened._update()
    }

    if (eatenPos) props.eaten.setPosition(eatenPos.x, eatenPos.y)
    {
      const fp = props.eaten.getPosition()
      const dist = Math.sqrt((fp.x-p.x)*(fp.x-p.x) + (fp.y-p.y)*(fp.y-p.y))
      props.eaten.setGain(eatenActive && playing ? distanceGain(dist) : 0)
      props.eaten._update()
    }

    // ---- Fruit ----
    const fp = content.fruit.getPosition()
    if (fp && playing) {
      props.fruit.setPosition(fp.x, fp.y)
      const dist = Math.sqrt((fp.x-p.x)*(fp.x-p.x) + (fp.y-p.y)*(fp.y-p.y))
      props.fruit.setGain(distanceGain(dist))
    } else {
      props.fruit.setGain(0)
    }
    props.fruit._update()

    // ---- Wall proximity ----
    // Probe up to ~3 tiles ahead in 0.5-tile steps. Quadratic ramp keeps the
    // sound subtle until you're close, then climbs fast — easy to ignore while
    // cruising, hard to miss when you're about to bump.
    const dir = content.pacman.state.dir
    if (playing && (dir.x !== 0 || dir.y !== 0)) {
      const RANGE = 2.5
      let dist = RANGE
      let probeX = p.x, probeY = p.y
      let hit = false
      for (let step = 0; step < 6; step++) {
        probeX += dir.x * 0.5
        probeY += dir.y * 0.5
        const stepDist = (step + 1) * 0.5
        const tx = Math.floor(probeX), ty = Math.floor(probeY)
        if (content.maze.isWall(tx, ty, false)) {
          dist = stepDist
          hit = true
          break
        }
      }
      props.wall.setPosition(probeX, probeY)
      if (hit) {
        const lin = Math.max(0, (RANGE - dist) / RANGE)
        props.wall.setGain(Math.pow(lin, 1.6) * 3)
      } else {
        props.wall.setGain(0)
      }
    } else {
      props.wall.setGain(0)
    }
    props.wall._update()

    // Beacon sample is silent during play (only used in the learn menu)
    if (props.beacon) props.beacon._update()

    // ---- Dot beacon ----
    const now = engine.time()
    if (playing) {
      if (now >= nextBeaconAt) {
        emitDotBeacon()
        nextBeaconAt = now + BEACON_PERIOD
      }
    } else {
      resetSweep()
    }
  }

  return {
    start,
    stop,
    frame,
    setStaticListener,
    silenceAll,
    tickProp,
    emitTick,
    isStarted: () => started,
    _props: props,
  }
})()
