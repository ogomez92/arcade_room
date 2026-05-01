/**
 * FIRE! — fire-hose nozzle.
 *
 * The nozzle aim is an angle in audio frame: 0 = forward, +π/2 = full
 * left, -π/2 = full right. It's clamped to the building arc so the
 * spray always lands somewhere meaningful.
 *
 * The hose has a continuous synthesized voice that runs the entire game.
 * Two layers:
 *   - body: filtered noise that morphs with aim. Lower bandpass center
 *     and lowpass cutoff when aimed left → "lower tones = left"; higher
 *     when aimed right.
 *   - tone: a soft sine that pitches L↔R the same way, providing a
 *     pitched cue layered on top of the noise hiss so the aim direction
 *     reads even if the noise hiss is masked.
 * Spray on/off is a smooth gain ramp; spray running adds an audible "wet"
 * burst and unlocks `receiveSpray()` against the fires.
 */
content.hose = (() => {
  const A = () => content.audio
  const F = () => content.fires

  const ARC_HALF = 75 * Math.PI / 180
  const AIM_RATE = 1.4 // rad/sec — slightly slower than max so aiming stays deliberate
  const SPRAY_POWER = 1.6 // intensity-per-second at cone center
  let aim = 0
  let isSpraying = false
  let voice = null

  function buildHoseVoice() {
    const c = engine.context()

    // Always-on hose body — quiet hiss when not spraying, opens when spraying.
    const out = c.createGain()
    out.gain.value = 0

    // Body: noise → bandpass (sweepable) → lowpass (sweepable) → out
    const noise = c.createBufferSource()
    noise.buffer = A().makeNoiseBuffer(2)
    noise.loop = true

    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1500
    bp.Q.value = 0.6

    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 3500
    lp.Q.value = 0.7

    const noiseGain = c.createGain()
    noiseGain.gain.value = 0.4
    noise.connect(bp).connect(lp).connect(noiseGain).connect(out)

    // Tone: sine at angle-dependent pitch, low gain — pitched cue layered on
    // top of the noise hiss so aim direction reads even when the hiss is masked.
    const tone = c.createOscillator()
    tone.type = 'sine'
    tone.frequency.value = 600

    const toneEnv = c.createGain()
    toneEnv.gain.value = 0.04
    tone.connect(toneEnv).connect(out)

    // Subtle stereo bias toward aim direction. Capped at ±0.5 so it doesn't
    // collide with a fire's full-pan position.
    const panner = c.createStereoPanner()
    panner.pan.value = 0
    out.connect(panner).connect(engine.mixer.input())

    noise.start(); tone.start()

    return {
      out, bp, lp, tone, toneEnv, panner, noise,
      destroy: () => {
        try { noise.stop() } catch (_) {}
        try { tone.stop() } catch (_) {}
        try { out.disconnect() } catch (_) {}
        try { panner.disconnect() } catch (_) {}
      },
    }
  }

  function start() {
    if (voice) return
    voice = buildHoseVoice()
  }

  function stop() {
    if (!voice) return
    try { voice.destroy() } catch (_) {}
    voice = null
    isSpraying = false
  }

  function reset() {
    aim = 0
    isSpraying = false
    if (voice) voice.out.gain.cancelScheduledValues(engine.context().currentTime)
  }

  function getAim() { return aim }

  function setAim(a) {
    aim = Math.max(-ARC_HALF, Math.min(ARC_HALF, a))
  }

  function setSpraying(on) {
    isSpraying = !!on
  }

  // Read inputs and integrate aim. Called from game's onFrame.
  // dt is seconds.
  function frame(dt) {
    // Aim from app.controls.game().rotate (1 = left, -1 = right)
    let g = app.controls.game()
    let drot = g.rotate || 0
    // Add gamepad axis if no keyboard pressed — axis convention in the
    // game adapter is sign-flipped so left stick → state.y = +1; we use
    // turnAxis (not strafeAxis), but if neither is set we read raw.
    if (drot === 0) {
      const ax = engine.input.gamepad.getAxis(0)
      if (Math.abs(ax) > 0.18) drot = -ax  // right stick right (+ax) → aim right (-rotate)
    }
    if (drot) setAim(aim + drot * AIM_RATE * dt)

    // Spray: Space / Enter / KeyJ on keyboard, or gamepad button 0 (A) / 7 (RT).
    const keys = engine.input.keyboard.get()
    const padDown = (n) => engine.input.gamepad.getAnalog(n) > 0.4
    const spraying = !!(
      keys.Space || keys.Enter || keys.KeyJ ||
      padDown(0) || padDown(7)
    )
    setSpraying(spraying)

    // Apply spray to fires
    if (spraying) {
      F().receiveSpray(aim, SPRAY_POWER, dt)
    }

    // Update voice audio
    updateAudio()
  }

  function updateAudio() {
    if (!voice) return
    const c = engine.context()
    const t = c.currentTime
    // Aim-mapped pitch — left = low, right = high.
    // aim ∈ [-ARC_HALF, +ARC_HALF]; mapping: -1 (right) → high, +1 (left) → low.
    const norm = aim / ARC_HALF // +1 left, -1 right
    const bpCenter = 2200 - norm * 1100   // 1100..3300
    const lpCutoff = 5000 - norm * 2500   // 2500..7500
    voice.bp.frequency.setTargetAtTime(bpCenter, t, 0.06)
    voice.lp.frequency.setTargetAtTime(lpCutoff, t, 0.06)
    const tonePitch = 700 - norm * 320 // 380..1020
    voice.tone.frequency.setTargetAtTime(tonePitch, t, 0.05)

    // Spraying gates volume up; idle hose is a faint "ready" hiss.
    const target = isSpraying ? 0.42 : 0.06
    voice.out.gain.setTargetAtTime(target, t, isSpraying ? 0.02 : 0.12)

    // Subtle stereo bias toward aim direction (capped at ±0.5).
    voice.panner.pan.setTargetAtTime(-norm * 0.5, t, 0.08)
  }

  function silence() {
    if (!voice) return
    voice.out.gain.setTargetAtTime(0, engine.context().currentTime, 0.05)
  }

  return {
    ARC_HALF,
    SPRAY_POWER,
    start, stop, reset,
    getAim, setAim,
    isSpraying: () => isSpraying,
    setSpraying,
    frame,
    silence,
  }
})()
