/**
 * Library of one-shot synthesized SFX. Each function spawns an audio
 * graph at the given world position, schedules its envelope, and
 * disconnects itself. UI-class sounds are non-spatial (passed straight
 * to the master bus).
 */
content.sounds = (() => {
  function ctx() { return engine.context() }
  function now() { return engine.time() }

  // --- helpers -------------------------------------------------------

  function spatialNode() {
    // A binaural ear, updated once for the lifetime of a one-shot.
    return engine.ear.binaural.create()
  }

  function playSpatial({x, y}, attachInput) {
    const ear = spatialNode()
    ear.to(engine.mixer.output())

    const listener = engine.position.getVector()
    const relative = {
      x: x - listener.x,
      y: y - listener.y,
      z: 0,
    }
    // Rotate into listener-local frame using yaw
    const lq = engine.position.getQuaternion()
    // For 2D, derive yaw from quaternion: yaw = 2 * atan2(z, w) when only yaw is set.
    const yaw = 2 * Math.atan2(lq.z, lq.w)
    const cos = Math.cos(-yaw), sin = Math.sin(-yaw)
    const local = {
      x: relative.x * cos - relative.y * sin,
      y: relative.x * sin + relative.y * cos,
      z: 0,
    }
    ear.update(local)

    const node = attachInput()
    ear.from(node)

    return ear
  }

  function disconnectAfter(node, when, ear) {
    setTimeout(() => {
      try { node.disconnect() } catch (e) {}
      try { ear.destroy() } catch (e) {}
    }, Math.max(50, (when - now()) * 1000 + 200))
  }

  function envelope(gain, t0, attack, hold, release, peak) {
    gain.cancelScheduledValues(t0)
    gain.setValueAtTime(0, t0)
    gain.linearRampToValueAtTime(peak, t0 + attack)
    gain.setValueAtTime(peak, t0 + attack + hold)
    gain.linearRampToValueAtTime(0, t0 + attack + hold + release)
  }

  // --- one-shots -----------------------------------------------------

  function collision(position, severity = 0.5) {
    // Severity 0..1
    const t0 = now()
    const dur = 0.35

    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      // Sine thump
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(120 + 40 * severity, t0)
      osc.frequency.exponentialRampToValueAtTime(40, t0 + dur)
      osc.connect(out)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)

      // Noise burst
      const buf = engine.buffer.whiteNoise({channels: 1, duration: dur})
      const src = c.createBufferSource()
      src.buffer = buf
      const nf = c.createBiquadFilter()
      nf.type = 'lowpass'
      nf.frequency.setValueAtTime(1500 + 1500 * severity, t0)
      nf.frequency.exponentialRampToValueAtTime(200, t0 + dur)
      const ng = c.createGain()
      ng.gain.value = 0
      envelope(ng.gain, t0, 0.005, 0.02, dur - 0.025, 0.6 * severity + 0.3)
      src.connect(nf).connect(ng).connect(out)
      src.start(t0)

      envelope(out.gain, t0, 0.005, 0.05, dur - 0.055, engine.fn.clamp(0.4 + severity, 0.4, 1.2))
      return out
    })

    disconnectAfter(ear.left, t0 + dur + 0.2, ear)
  }

  function wallScrape(position, speed) {
    // Short tick on demand — a continuous version is built in content.car.
    const t0 = now()
    const dur = 0.15
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const buf = engine.buffer.pinkNoise({channels: 1, duration: dur})
      const src = c.createBufferSource()
      src.buffer = buf
      const f = c.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = 1800
      f.Q.value = 4
      src.connect(f).connect(out)
      src.start(t0)

      envelope(out.gain, t0, 0.01, 0.05, dur - 0.06, engine.fn.clamp(speed * 0.15, 0.05, 0.5))
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.1, ear)
  }

  /**
   * Played when the player deals damage. Four ascending notes;
   * `magnitude` (0..1) raises the base pitch and shortens the
   * gap between notes so big hits feel snappier.
   */
  function scoring(magnitude = 0.4) {
    const m = engine.fn.clamp(magnitude, 0, 1)
    const baseFreq = engine.fn.lerp(440, 900, m)
    const interval = engine.fn.lerp(0.085, 0.040, m)
    const dur = 0.08
    const c = ctx()
    const t0 = now()

    const out = c.createGain()
    out.gain.value = 0.55
    out.connect(engine.mixer.output())

    // Major-arpeggio up to the octave: 1 - 5/4 - 3/2 - 2
    const ratios = [1, 1.25, 1.5, 2]
    let t = t0
    for (const r of ratios) {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = baseFreq * r
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(out)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.45, t + 0.005)
      g.gain.linearRampToValueAtTime(0, t + dur)
      o.start(t)
      o.stop(t + dur + 0.02)
      t += interval
    }
    setTimeout(() => { try { out.disconnect() } catch (e) {} }, (interval * 4 + dur + 0.5) * 1000)
  }

  /**
   * Played when the player *takes* damage (hit by another car). A short
   * descending square-wave buzzer, spatialised at the impact point.
   */
  function buzzer(position, severity = 0.6) {
    const t0 = now()
    const dur = 0.30 + severity * 0.18

    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(220, t0)
      o.frequency.linearRampToValueAtTime(140, t0 + dur)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      // Slight beat: square + detuned saw on top for a bit of grit.
      const o2 = c.createOscillator()
      o2.type = 'sawtooth'
      o2.frequency.setValueAtTime(225, t0)
      o2.frequency.linearRampToValueAtTime(143, t0 + dur)
      const g2 = c.createGain()
      g2.gain.value = 0.35
      o2.connect(g2).connect(out)
      o2.start(t0)
      o2.stop(t0 + dur + 0.05)

      const peak = engine.fn.clamp(0.5 + severity * 0.4, 0.4, 0.95)
      out.gain.setValueAtTime(0, t0)
      out.gain.linearRampToValueAtTime(peak, t0 + 0.01)
      out.gain.linearRampToValueAtTime(0, t0 + dur)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.2, ear)
  }

  function eliminate(position) {
    const t0 = now()
    const dur = 1.4
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const osc = c.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(440, t0)
      osc.frequency.exponentialRampToValueAtTime(60, t0 + dur)
      osc.connect(out)
      osc.start(t0)
      osc.stop(t0 + dur + 0.05)

      const sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(80, t0)
      sub.frequency.exponentialRampToValueAtTime(35, t0 + dur)
      sub.connect(out)
      sub.start(t0)
      sub.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.02, 0.2, dur - 0.22, 0.9)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.2, ear)
  }

  // --- non-spatial UI / global cues ----------------------------------

  function uiTick(freq = 800, gain = 0.3, dur = 0.06) {
    const c = ctx()
    const t0 = now()
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())

    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    osc.connect(out)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
    envelope(out.gain, t0, 0.005, 0.01, dur - 0.015, gain)

    osc.onended = () => out.disconnect()
  }

  function uiFocus()    { uiTick(800, 0.18, 0.05) }
  function uiBack()     { uiTick(500, 0.22, 0.07) }

  function roundStart() {
    const t0 = now()
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())

    ;[660, 880, 1320].forEach((f, i) => {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(out)
      const start = t0 + i * 0.18
      envelope(g.gain, start, 0.01, 0.06, 0.1, 0.5)
      o.start(start)
      o.stop(start + 0.2)
    })
    out.gain.value = 1
    setTimeout(() => out.disconnect(), 1200)
  }

  function roundEnd(win) {
    const t0 = now()
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())

    const notes = win ? [523, 659, 784, 1046] : [220, 175, 147, 110]
    notes.forEach((f, i) => {
      const o = c.createOscillator()
      o.type = win ? 'triangle' : 'sawtooth'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(out)
      const start = t0 + i * 0.22
      envelope(g.gain, start, 0.02, 0.15, 0.25, 0.45)
      o.start(start)
      o.stop(start + 0.45)
    })
    out.gain.value = 1
    setTimeout(() => out.disconnect(), 2500)
  }

  function heartbeat() {
    // One pulse. Caller schedules the next based on health.
    const t0 = now()
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())

    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t0)
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.18)
    o.connect(out)
    o.start(t0)
    o.stop(t0 + 0.22)
    envelope(out.gain, t0, 0.005, 0.04, 0.16, 0.45)
    o.onended = () => out.disconnect()
  }

  // --- Arcade-mode sounds --------------------------------------------

  /**
   * One-shot pickup chime — health pack acquired (player or AI).
   * Bright bell-like ping at the pickup location.
   */
  function pickupHealth(position) {
    const t0 = now()
    const dur = 0.6
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      ;[1318, 1760, 2637].forEach((f, i) => {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const g = c.createGain()
        g.gain.value = 0
        o.connect(g).connect(out)
        const start = t0 + i * 0.04
        envelope(g.gain, start, 0.005, 0.04, 0.4, 0.45)
        o.start(start)
        o.stop(start + 0.5)
      })
      out.gain.value = 1
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  function pickupShield(position) {
    const t0 = now()
    const dur = 0.55
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(220, t0)
      o.frequency.exponentialRampToValueAtTime(660, t0 + dur)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      // Tremolo for the elastic feel
      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 14
      const lfoGain = c.createGain()
      lfoGain.gain.value = 0.25
      const carrier = c.createGain()
      carrier.gain.value = 0.7
      lfo.connect(lfoGain).connect(carrier.gain)
      o.disconnect(); o.connect(carrier).connect(out)
      lfo.start(t0)
      lfo.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.01, 0.05, dur - 0.06, 0.55)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  function pickupBullets(position) {
    const t0 = now()
    const dur = 0.5
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(180, t0)
      o.frequency.exponentialRampToValueAtTime(900, t0 + 0.18)
      o.frequency.exponentialRampToValueAtTime(220, t0 + dur)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.005, 0.06, dur - 0.07, 0.55)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  function pickupMine(position) {
    const t0 = now()
    const dur = 0.45
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.setValueAtTime(420, t0)
      o.frequency.linearRampToValueAtTime(280, t0 + dur)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.005, 0.04, dur - 0.05, 0.4)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * One-shot when a speed-burst pickup is grabbed: rising whoosh.
   */
  function pickupSpeed(position) {
    const t0 = now()
    const dur = 0.55
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(180, t0)
      o.frequency.exponentialRampToValueAtTime(900, t0 + dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1600
      lp.Q.value = 4
      o.connect(lp).connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.01, 0.06, dur - 0.07, 0.45)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * One-shot when a teleport pickup is grabbed: bright shimmering chime.
   */
  function pickupTeleport(position) {
    const t0 = now()
    const dur = 0.55
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      ;[1320, 1980, 2640, 3300].forEach((f, i) => {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = f
        const g = c.createGain()
        g.gain.value = 0
        o.connect(g).connect(out)
        const start = t0 + i * 0.045
        envelope(g.gain, start, 0.005, 0.04, 0.4, 0.32)
        o.start(start)
        o.stop(start + 0.5)
      })
      out.gain.value = 1
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * Spatial cue played at the *old* position when a car teleports away.
   * Whoosh-and-sparkle: filtered noise sweeping up plus a rising sine
   * pair, so any peer hearing it knows "someone vanished from there".
   */
  function teleport(position) {
    const t0 = now()
    const dur = 0.7
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      // Rising sweep (a sine "whoosh" that climbs out of audibility).
      const sweep = c.createOscillator()
      sweep.type = 'sine'
      sweep.frequency.setValueAtTime(220, t0)
      sweep.frequency.exponentialRampToValueAtTime(2200, t0 + dur)
      const sweepGain = c.createGain()
      sweepGain.gain.value = 0
      envelope(sweepGain.gain, t0, 0.005, 0.05, dur - 0.06, 0.45)
      sweep.connect(sweepGain).connect(out)
      sweep.start(t0)
      sweep.stop(t0 + dur + 0.05)

      // Detuned partial for the "phasing" sci-fi feel.
      const partial = c.createOscillator()
      partial.type = 'triangle'
      partial.frequency.setValueAtTime(330, t0)
      partial.frequency.exponentialRampToValueAtTime(3300, t0 + dur)
      const partialGain = c.createGain()
      partialGain.gain.value = 0
      envelope(partialGain.gain, t0, 0.005, 0.05, dur - 0.06, 0.25)
      partial.connect(partialGain).connect(out)
      partial.start(t0)
      partial.stop(t0 + dur + 0.05)

      // Bandpassed noise sparkle.
      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: dur + 0.1})
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(900, t0)
      bp.frequency.exponentialRampToValueAtTime(4500, t0 + dur)
      bp.Q.value = 6
      const noiseGain = c.createGain()
      noiseGain.gain.value = 0
      envelope(noiseGain.gain, t0, 0.005, 0.05, dur - 0.06, 0.5)
      noise.connect(bp).connect(noiseGain).connect(out)
      noise.start(t0)
      noise.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.005, 0.06, dur - 0.07, 0.85)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * Activation cue when a car uses a speed burst: short noisy whoosh
   * with a bright pitch sweep so it's distinctive at any spatial range.
   */
  function boostActivated(position) {
    const t0 = now()
    const dur = 0.6
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.whiteNoise({channels: 1, duration: dur + 0.2})
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(800, t0)
      bp.frequency.exponentialRampToValueAtTime(2400, t0 + dur)
      bp.Q.value = 6
      noise.connect(bp).connect(out)
      noise.start(t0)
      noise.stop(t0 + dur + 0.05)

      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(220, t0)
      o.frequency.exponentialRampToValueAtTime(1200, t0 + dur)
      const oGain = c.createGain()
      oGain.gain.value = 0.4
      o.connect(oGain).connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.005, 0.05, dur - 0.06, 0.6)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * "Can't fire yet" denial buzz — short low square-wave bleat used
   * when the player tries to shoot during the bullet cooldown. Quick
   * and unobtrusive; not networked (it's purely local UX feedback).
   */
  function bulletDenied() {
    const t0 = now()
    const dur = 0.18
    const c = ctx()
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())

    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.setValueAtTime(280, t0)
    o.frequency.linearRampToValueAtTime(180, t0 + dur)
    o.connect(out)
    o.start(t0)
    o.stop(t0 + dur + 0.05)

    out.gain.setValueAtTime(0, t0)
    out.gain.linearRampToValueAtTime(0.10, t0 + 0.005)
    out.gain.linearRampToValueAtTime(0, t0 + dur - 0.01)

    o.onended = () => { try { out.disconnect() } catch (e) {} }
  }

  /**
   * Subtle wind-down when a boost expires.
   */
  function boostExpired(position) {
    const t0 = now()
    const dur = 0.35
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(900, t0)
      o.frequency.exponentialRampToValueAtTime(220, t0 + dur)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.005, 0.04, dur - 0.05, 0.3)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * Shield-blocked impact: short elastic boing instead of damage buzz.
   */
  function shieldBlock(position) {
    const t0 = now()
    const dur = 0.45
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(660, t0)
      o.frequency.exponentialRampToValueAtTime(220, t0 + dur)
      o.connect(out)
      o.start(t0)
      o.stop(t0 + dur + 0.05)

      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 22
      const lfoGain = c.createGain()
      lfoGain.gain.value = 30
      lfo.connect(lfoGain).connect(o.frequency)
      lfo.start(t0)
      lfo.stop(t0 + dur + 0.05)

      envelope(out.gain, t0, 0.005, 0.05, dur - 0.06, 0.65)
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  /**
   * Explosion (bullet hit or mine detonation).
   */
  function explosion(position, severity = 0.7) {
    const t0 = now()
    const dur = 0.55 + severity * 0.3
    const ear = playSpatial(position, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0

      // Sub thump
      const sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(110, t0)
      sub.frequency.exponentialRampToValueAtTime(35, t0 + dur)
      const subGain = c.createGain()
      subGain.gain.value = 0.85
      sub.connect(subGain).connect(out)
      sub.start(t0)
      sub.stop(t0 + dur + 0.05)

      // Noise burst
      const buf = engine.buffer.whiteNoise({channels: 1, duration: dur})
      const src = c.createBufferSource()
      src.buffer = buf
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.setValueAtTime(3000, t0)
      f.frequency.exponentialRampToValueAtTime(160, t0 + dur)
      const ng = c.createGain()
      ng.gain.value = 0
      envelope(ng.gain, t0, 0.005, 0.04, dur - 0.05, 0.7)
      src.connect(f).connect(ng).connect(out)
      src.start(t0)

      envelope(out.gain, t0, 0.005, 0.06, dur - 0.07, engine.fn.clamp(0.7 + severity * 0.4, 0.5, 1.2))
      return out
    })
    disconnectAfter(ear.left, t0 + dur + 0.3, ear)
  }

  return {
    collision,
    scoring,
    buzzer,
    wallScrape,
    eliminate,
    uiFocus,
    uiBack,
    roundStart,
    roundEnd,
    heartbeat,
    pickupHealth,
    pickupShield,
    pickupBullets,
    pickupMine,
    pickupSpeed,
    pickupTeleport,
    teleport,
    boostActivated,
    boostExpired,
    bulletDenied,
    shieldBlock,
    explosion,
  }
})()
