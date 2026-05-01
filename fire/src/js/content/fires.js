/**
 * FIRE! — fires module.
 *
 * The world is a horizon of `BUILDING_COUNT` buildings arranged on a
 * forward arc in front of the firefighter. Each building has:
 *   - a fixed angle in audio space (radians, +y = left, -y = right)
 *   - a fixed distance
 *   - HP that drains while the fire's intensity is above 1.0
 *   - a current fire intensity in [0, MAX_INTENSITY] — 0 means no fire
 *   - a continuous looping crackle voice that opens/closes with intensity
 *
 * Each building has a distinct "voice fundamental" (a stepped pitch family
 * across the row) so simultaneous fires stay decipherable — leftmost
 * building has the lowest crackle root, rightmost the highest. Same
 * mnemonic as the hose: lower pitch = left, higher = right.
 *
 * Fire growth and HP drain run in tick(dt). Spray hit-test against the
 * hose cone runs in receiveSpray(angle, sprayPower, dt) and returns the
 * intensity reduction so the hose can pace its own audio reaction.
 */
content.fires = (() => {
  const A = () => content.audio

  const BUILDING_COUNT = 7
  // Front-arc spacing: -75° to +75° in equal steps.
  const ARC_HALF = 75 * Math.PI / 180
  const DISTANCE = 9
  const MAX_INTENSITY = 2.0
  const SPREAD_THRESHOLD = 1.5
  const HP_DRAIN_RATE = 28      // HP/sec when intensity at 2.0
  const BUILDING_HP = 100

  // Angular full-width of the spray cone (rad).
  const CONE_HALF_WIDTH = 0.30  // ≈ ±17°

  function buildingAngle(i) {
    if (BUILDING_COUNT === 1) return 0
    return ARC_HALF - (i * 2 * ARC_HALF) / (BUILDING_COUNT - 1)
  }

  // Crackle voice. White noise → bandpass → tremolo, with a slow LFO on the
  // bandpass center so it shimmers. Higher intensity opens the bandpass and
  // adds an aggressive saw layer.
  function buildCrackle(out, fundamental) {
    const c = engine.context()
    const noise = c.createBufferSource()
    noise.buffer = A().makeNoiseBuffer(2)
    noise.loop = true

    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = fundamental * 4
    bp.Q.value = 1.4

    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 7 + Math.random() * 4
    const lfoDepth = c.createGain()
    lfoDepth.gain.value = fundamental * 1.2
    lfo.connect(lfoDepth).connect(bp.frequency)

    const trem = c.createGain()
    trem.gain.value = 0.6
    const tremLfo = c.createOscillator()
    tremLfo.type = 'sine'
    tremLfo.frequency.value = 11 + Math.random() * 6
    const tremDepth = c.createGain()
    tremDepth.gain.value = 0.4
    tremLfo.connect(tremDepth).connect(trem.gain)

    // Aggressive saw layer (mainly heard at high intensity)
    const saw = c.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = fundamental
    const sawLp = c.createBiquadFilter()
    sawLp.type = 'lowpass'
    sawLp.frequency.value = fundamental * 3
    sawLp.Q.value = 1
    const sawGain = c.createGain()
    sawGain.gain.value = 0
    saw.connect(sawLp).connect(sawGain)

    const mix = c.createGain()
    mix.gain.value = 1
    noise.connect(bp).connect(trem).connect(mix)
    sawGain.connect(mix)
    mix.connect(out)

    noise.start(); lfo.start(); tremLfo.start(); saw.start()

    return {
      stop: () => {
        try { noise.stop() } catch (_) {}
        try { lfo.stop() } catch (_) {}
        try { tremLfo.stop() } catch (_) {}
        try { saw.stop() } catch (_) {}
      },
      // intensity ∈ [0, 2.0]
      setIntensity: (k) => {
        const t = c.currentTime
        // bandpass center: 4·f at idle, 8·f when raging
        bp.frequency.setTargetAtTime(fundamental * (4 + 4 * k), t, 0.08)
        // bandpass Q: tighter when small, wider when raging
        bp.Q.setTargetAtTime(1.4 - 0.6 * Math.min(1, k), t, 0.08)
        // tremolo gets faster as fire grows
        tremLfo.frequency.setTargetAtTime(11 + k * 8, t, 0.15)
        // saw layer fades in with intensity
        sawGain.gain.setTargetAtTime(Math.max(0, (k - 0.4)) * 0.25, t, 0.1)
      },
    }
  }

  // ---- Building model ----
  function makeBuilding(i) {
    const angle = buildingAngle(i)
    const x = DISTANCE * Math.cos(angle)
    const y = DISTANCE * Math.sin(angle)
    // Pitch family: 110 Hz on the left (i=0), climbs by ~3 semitones per slot.
    const fundamental = 110 * Math.pow(2, i / 4)

    let crackle = null
    const prop = A().makeSpatialProp({
      build: (out) => {
        crackle = buildCrackle(out, fundamental)
        return crackle.stop
      },
      x, y, gain: 0,
      stereoMix: 0.85,
      binauralMix: 0.4,
    })

    return {
      i,
      angle,
      x, y,
      fundamental,
      hp: BUILDING_HP,
      intensity: 0,
      lostFlag: false,
      prop,
      crackle: () => crackle,
    }
  }

  let buildings = []
  let spreadCb = null
  let lostCb = null
  let extinguishCb = null

  function start() {
    if (buildings.length) return
    A().setupListener()
    for (let i = 0; i < BUILDING_COUNT; i++) {
      buildings.push(makeBuilding(i))
    }
  }

  function stop() {
    for (const b of buildings) {
      try { b.prop.destroy() } catch (_) {}
    }
    buildings = []
  }

  function reset() {
    for (const b of buildings) {
      b.hp = BUILDING_HP
      b.intensity = 0
      b.lostFlag = false
      b.prop.setGainImmediate(0)
      if (b.crackle()) b.crackle().setIntensity(0)
    }
  }

  function spawnRandom(intensity = 0.4) {
    // Prefer buildings with no fire and not lost; fall back to lowest intensity.
    const candidates = buildings.filter((b) => !b.lostFlag && b.intensity < 0.05)
    if (!candidates.length) return null
    const b = candidates[Math.floor(Math.random() * candidates.length)]
    b.intensity = Math.max(b.intensity, intensity)
    return b
  }

  function getActive() {
    return buildings.filter((b) => !b.lostFlag && b.intensity > 0.05)
  }

  function getAll() {
    return buildings.slice()
  }

  function totalIntensity() {
    let s = 0
    for (const b of buildings) s += b.intensity
    return s
  }

  function totalThreat() {
    // Threat = (sum of intensity over MAX_INTENSITY) + (HP loss) — bounded [0..1].
    const intSum = buildings.reduce((s, b) => s + b.intensity, 0)
    const intMax = BUILDING_COUNT * MAX_INTENSITY
    const hpLost = buildings.reduce((s, b) => s + (BUILDING_HP - b.hp), 0)
    const hpMax = BUILDING_COUNT * BUILDING_HP
    return Math.min(1, 0.6 * (intSum / intMax) + 0.4 * (hpLost / hpMax))
  }

  function lostCount() {
    return buildings.reduce((n, b) => n + (b.lostFlag ? 1 : 0), 0)
  }

  function aliveCount() {
    return buildings.reduce((n, b) => n + (b.lostFlag ? 0 : 1), 0)
  }

  function nearestActive(aim) {
    const active = getActive()
    if (!active.length) return null
    // Nearest in angle to the current aim — that's what "closest" means
    // for an aiming game.
    let best = active[0]
    let bestD = Math.abs(active[0].angle - aim)
    for (const b of active) {
      const d = Math.abs(b.angle - aim)
      if (d < bestD) { best = b; bestD = d }
    }
    return best
  }

  // Apply spray. aim is the nozzle angle, sprayPower is intensity-per-second
  // delivered at the cone center, dt the frame delta. Returns total intensity
  // reduction this frame so the hose can pulse audio feedback.
  function receiveSpray(aim, sprayPower, dt) {
    if (!sprayPower || sprayPower <= 0) return 0
    let totalReduced = 0
    for (const b of buildings) {
      if (b.lostFlag) continue
      if (b.intensity <= 0) continue
      const delta = b.angle - aim
      const within = Math.abs(delta) <= CONE_HALF_WIDTH
      if (!within) continue
      // Triangular falloff inside the cone.
      const falloff = 1 - Math.abs(delta) / CONE_HALF_WIDTH
      const reduction = sprayPower * falloff * dt
      const before = b.intensity
      b.intensity = Math.max(0, b.intensity - reduction)
      const reduced = before - b.intensity
      totalReduced += reduced
      if (reduced > 0 && Math.random() < 0.25 + falloff * 0.3) {
        // Sizzle on hit, rate roughly matches the cone strength.
        A().emitSizzle(b.x, b.y, Math.min(1, b.intensity + 0.4))
      }
      if (before > 0 && b.intensity <= 0) {
        // Extinguished
        const points = 100 + Math.round((1 - Math.min(1, before / SPREAD_THRESHOLD)) * 80)
        A().emitExtinguish(b.x, b.y, points)
        if (extinguishCb) extinguishCb(b, points)
      }
    }
    return totalReduced
  }

  // Per-frame growth, HP drain, spread events.
  function tick(dt, growthRate) {
    for (const b of buildings) {
      if (b.lostFlag) continue
      if (b.intensity > 0) {
        // Growth scales: small fires grow slowly, raging fires grow fast.
        const k = Math.min(1.2, b.intensity)
        b.intensity = Math.min(MAX_INTENSITY, b.intensity + growthRate * (0.4 + 0.8 * k) * dt)
        // HP drain when intensity > 1.0
        if (b.intensity > 1.0) {
          const over = b.intensity - 1.0
          b.hp -= over * HP_DRAIN_RATE * dt
        }
        // Spread event when intensity peaks at threshold (one-shot per frame).
        if (b.intensity >= SPREAD_THRESHOLD && !b._spreadFlag) {
          b._spreadFlag = true
          A().emitSpread(b.x, b.y)
          if (spreadCb) spreadCb(b)
        } else if (b.intensity < SPREAD_THRESHOLD - 0.15) {
          b._spreadFlag = false
        }
        // Building lost
        if (b.hp <= 0) {
          b.lostFlag = true
          b.intensity = 0
          b.hp = 0
          A().emitBuildingLost(b.x, b.y)
          if (lostCb) lostCb(b)
        }
      }
    }
  }

  function updateAudio() {
    for (const b of buildings) {
      // Distance gain attenuation (here all buildings sit at one distance,
      // but we still apply it so the formula is uniform across game state).
      const dG = A().distanceGain(Math.sqrt(b.x * b.x + b.y * b.y))
      // Map intensity → voice gain. Below 0.05 silent, climbs to 1 at peak.
      let g = 0
      if (!b.lostFlag && b.intensity > 0.05) {
        g = Math.min(1, 0.18 + b.intensity * 0.55) * dG
      }
      b.prop.setGain(g)
      if (b.crackle()) b.crackle().setIntensity(b.intensity)
      b.prop._update()
    }
  }

  function silenceAll() {
    for (const b of buildings) b.prop.setGainImmediate(0)
  }

  return {
    BUILDING_COUNT,
    SPREAD_THRESHOLD,
    MAX_INTENSITY,
    CONE_HALF_WIDTH,
    BUILDING_HP,
    start, stop, reset,
    spawnRandom, getActive, getAll,
    totalIntensity, totalThreat,
    lostCount, aliveCount,
    nearestActive,
    receiveSpray, tick, updateAudio,
    silenceAll,
    onSpread: (fn) => { spreadCb = fn },
    onLost: (fn) => { lostCb = fn },
    onExtinguish: (fn) => { extinguishCb = fn },
  }
})()
