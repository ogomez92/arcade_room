/**
 * Spatial audio for BRAWL!
 *
 * Top-down 2D arena with a SCREEN-LOCKED binaural listener. Per CLAUDE.md
 * recipe: listener yaw is constant (Math.PI / 2 → audio-front = screen-
 * north), so a foe to the north of the player always sounds in front no
 * matter where the player has been walking. The screen→audio coordinate
 * flip negates y when crossing into the audio frame (engine.ear.binaural
 * uses +y = LEFT, +x = forward).
 *
 * Each spatial source mixes:
 *   - a binaural ear (HRTF colour, primary front/back cue),
 *   - a stereo panner whose pan is dx_screen / RANGE (loud, dominant L/R),
 *   - a distance-attenuation gain.
 *
 * The voice module (content.voice) reuses `playSpatial` to emit gendered
 * effort grunts and pain cries — keeping this module focused on the
 * non-vocal SFX (impacts, tells, footsteps, bell, KO sting).
 */
content.audio = (() => {
  const STAGE_PAN_HALF = 4         // screen units mapped to ±1 stereo pan
  const BINAURAL_GAIN  = 0.55
  const STEREO_GAIN    = 1.0
  const M_PER_UNIT     = 1
  const LISTENER_YAW   = Math.PI / 2  // audio-front = screen-north

  function ctx() { return engine.context() }
  function now() { return engine.time() }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }

  let listener = {x: 0, y: 0}
  let yawApplied = false

  // Looping voices keyed by id ('player', 'foe').
  const breath = new Map()

  function applyYawOnce() {
    if (yawApplied) return
    yawApplied = true
    engine.position.setQuaternion(
      engine.tool.quaternion.fromEuler({yaw: LISTENER_YAW})
    )
  }

  /**
   * Park the listener at the player's screen position. We negate y when
   * crossing into the audio frame (CLAUDE.md gotcha: engine.ear.binaural
   * has +y = LEFT, screen +y = south).
   */
  function setListener(sx, sy) {
    applyYawOnce()
    listener.x = sx
    listener.y = sy
    engine.position.setVector({x: sx, y: -sy, z: 0})
  }

  /**
   * Translate a screen-frame (x, y) into the listener's local audio frame
   * — the vector that engine.ear.binaural#update expects. Returns a
   * vector3d.
   */
  function relativeAudio(sx, sy) {
    const lp = engine.position.getVector()
    const lq = engine.position.getQuaternion().conjugate()
    return engine.tool.vector3d.create({
      x:  sx * M_PER_UNIT - lp.x,
      y: -sy * M_PER_UNIT - lp.y,
      z: 0,
    }).rotateQuaternion(lq)
  }

  function envelope(gain, t0, attack, hold, release, peak) {
    gain.cancelScheduledValues(t0)
    gain.setValueAtTime(0, t0)
    gain.linearRampToValueAtTime(peak, t0 + attack)
    gain.setValueAtTime(peak, t0 + attack + hold)
    gain.linearRampToValueAtTime(0, t0 + attack + hold + release)
  }

  function noiseBuf(dur) {
    return engine.buffer.whiteNoise({channels: 1, duration: dur})
  }

  /**
   * Play a one-shot at world (sx, sy). `build()` returns the head
   * AudioNode of the synth voice; this routes it through stereo + binaural
   * + distance attenuation. Returns a `dispose(when)` callback for
   * cleanup.
   */
  function playSpatial(sx, sy, build, gainOpts) {
    const c = ctx()
    const dx = sx - listener.x
    const dy = sy - listener.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const node = build()
    if (!node) return () => {}

    const dGain = c.createGain()
    dGain.gain.value = clamp(1.4 / (1 + 0.32 * dist), 0.18, 1.4)

    const pan = c.createStereoPanner()
    pan.pan.value = clamp(dx / STAGE_PAN_HALF, -1, 1)

    const stereoGain = c.createGain()
    stereoGain.gain.value = STEREO_GAIN * (gainOpts && gainOpts.stereo != null ? gainOpts.stereo : 1)

    node.connect(dGain).connect(pan).connect(stereoGain).connect(engine.mixer.output())

    const ear = engine.ear.binaural.create()
    ear.update(relativeAudio(sx, sy))
    ear.to(engine.mixer.output())
    const earGain = c.createGain()
    earGain.gain.value = BINAURAL_GAIN * (gainOpts && gainOpts.binaural != null ? gainOpts.binaural : 1)
    node.connect(earGain)
    ear.from(earGain)

    return (when) => {
      const ms = Math.max(80, (when - now()) * 1000 + 220)
      setTimeout(() => {
        try { node.disconnect() } catch (e) {}
        try { stereoGain.disconnect() } catch (e) {}
        try { earGain.disconnect() } catch (e) {}
        try { ear.destroy() } catch (e) {}
      }, ms)
    }
  }

  // -------------------------------------------------------- attack tells
  // Each windup gets a short timbre fingerprint so blind players can ID
  // the incoming attack from the first ~80 ms and step / counter.

  function tellHighPunch(sx, sy) {
    const t0 = now(), dur = 0.14
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const src = c.createBufferSource()
      src.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(2200, t0)
      bp.frequency.exponentialRampToValueAtTime(3400, t0 + dur)
      bp.Q.value = 6
      src.connect(bp).connect(out)
      src.start(t0); src.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.005, 0.015, dur - 0.025, 0.55)
      return out
    })
    dispose(t0 + dur)
  }

  function tellLowPunch(sx, sy) {
    const t0 = now(), dur = 0.18
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(180, t0)
      o.frequency.exponentialRampToValueAtTime(95, t0 + dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      o.connect(lp).connect(out)
      o.start(t0); o.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.01, 0.04, dur - 0.05, 0.5)
      return out
    })
    dispose(t0 + dur)
  }

  function tellHighKick(sx, sy) {
    const t0 = now(), dur = 0.30
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      // Rising whoosh — the leg comes up.
      const src = c.createBufferSource()
      src.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(700, t0)
      bp.frequency.exponentialRampToValueAtTime(2400, t0 + dur)
      bp.Q.value = 4
      src.connect(bp).connect(out)
      src.start(t0); src.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.04, 0.04, dur - 0.08, 0.6)
      return out
    })
    dispose(t0 + dur)
  }

  function tellLowKick(sx, sy) {
    const t0 = now(), dur = 0.28
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      // Falling whoosh + scrape — sweep coming down.
      const src = c.createBufferSource()
      src.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(2100, t0)
      bp.frequency.exponentialRampToValueAtTime(380, t0 + dur)
      bp.Q.value = 4
      src.connect(bp).connect(out)
      src.start(t0); src.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.03, 0.04, dur - 0.07, 0.6)
      return out
    })
    dispose(t0 + dur)
  }

  function tell(kind, sx, sy) {
    if (kind === 'highPunch') tellHighPunch(sx, sy)
    else if (kind === 'lowPunch') tellLowPunch(sx, sy)
    else if (kind === 'highKick') tellHighKick(sx, sy)
    else if (kind === 'lowKick') tellLowKick(sx, sy)
  }

  // ------------------------------------------------------ impacts
  function hit(kind, sx, sy, severity) {
    severity = severity == null ? 0.6 : clamp(severity, 0.1, 1.5)
    const t0 = now()
    const isPunch = (kind === 'highPunch' || kind === 'lowPunch')
    const dur = isPunch ? 0.22 + 0.10 * severity : 0.40 + 0.12 * severity
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      // Sub-thump: chest / body cavity.
      const sub = c.createOscillator()
      sub.type = 'sine'
      const subStart = (kind === 'highPunch' || kind === 'highKick') ? 200 : 120
      sub.frequency.setValueAtTime(subStart + 50 * severity, t0)
      sub.frequency.exponentialRampToValueAtTime(40, t0 + dur)
      const subGain = c.createGain()
      subGain.gain.value = 0.85
      sub.connect(subGain).connect(out)
      sub.start(t0); sub.stop(t0 + dur + 0.05)

      // Sharp click: knuckle / shoe contact.
      const click = c.createBufferSource()
      click.buffer = noiseBuf(0.06)
      const cf = c.createBiquadFilter()
      cf.type = 'bandpass'
      cf.frequency.value = (kind === 'highPunch' || kind === 'highKick') ? 3000 : 1500
      cf.Q.value = 8
      const cg = c.createGain()
      cg.gain.value = 0
      envelope(cg.gain, t0, 0.002, 0.012, 0.05, 0.7)
      click.connect(cf).connect(cg).connect(out)
      click.start(t0)

      // Body / fabric noise tail.
      const body = c.createBufferSource()
      body.buffer = noiseBuf(dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1700, t0)
      lp.frequency.exponentialRampToValueAtTime(180, t0 + dur)
      const bg = c.createGain()
      bg.gain.value = 0
      envelope(bg.gain, t0, 0.005, 0.04, dur - 0.05, 0.55 * severity + 0.25)
      body.connect(lp).connect(bg).connect(out)
      body.start(t0)

      envelope(out.gain, t0, 0.003, 0.05, dur - 0.055,
        clamp(0.6 + severity * 0.5, 0.4, 1.4))
      return out
    })
    dispose(t0 + dur)
  }

  function whiff(sx, sy) {
    const t0 = now(), dur = 0.20
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const src = c.createBufferSource()
      src.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(1100, t0)
      bp.frequency.exponentialRampToValueAtTime(380, t0 + dur)
      bp.Q.value = 3
      src.connect(bp).connect(out)
      src.start(t0); src.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.01, 0.02, dur - 0.04, 0.4)
      return out
    })
    dispose(t0 + dur)
  }

  function knockdownThud(sx, sy) {
    const t0 = now(), dur = 0.55
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(110, t0)
      sub.frequency.exponentialRampToValueAtTime(38, t0 + dur)
      sub.connect(out)
      sub.start(t0); sub.stop(t0 + dur + 0.05)
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(1100, t0)
      lp.frequency.exponentialRampToValueAtTime(160, t0 + dur)
      const ng = c.createGain()
      ng.gain.value = 0
      envelope(ng.gain, t0, 0.01, 0.06, dur - 0.07, 0.7)
      noise.connect(lp).connect(ng).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.005, 0.07, dur - 0.075, 1.0)
      return out
    })
    dispose(t0 + dur)
  }

  function getupRustle(sx, sy) {
    const t0 = now(), dur = 0.45
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(900, t0)
      bp.frequency.exponentialRampToValueAtTime(1800, t0 + dur)
      bp.Q.value = 2
      noise.connect(bp).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.05, 0.10, dur - 0.15, 0.32)
      return out
    })
    dispose(t0 + dur)
  }

  // -------------------------------------------------------- defensive SFX
  // Block: a sharp wood-on-wood clack so the player hears their guard go up.
  function blockUp(sx, sy) {
    const t0 = now(), dur = 0.18
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const click = c.createBufferSource()
      click.buffer = noiseBuf(0.05)
      const cf = c.createBiquadFilter()
      cf.type = 'bandpass'
      cf.frequency.value = 1600
      cf.Q.value = 6
      click.connect(cf).connect(out)
      click.start(t0)
      const ring = c.createOscillator()
      ring.type = 'square'
      ring.frequency.setValueAtTime(420, t0)
      ring.frequency.exponentialRampToValueAtTime(280, t0 + dur)
      const rg = c.createGain()
      rg.gain.value = 0
      envelope(rg.gain, t0, 0.003, 0.02, dur - 0.025, 0.35)
      ring.connect(rg).connect(out)
      ring.start(t0); ring.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.002, 0.04, dur - 0.045, 0.7)
      return out
    })
    dispose(t0 + dur)
  }

  // Duck: a low descending whoosh as the body crouches.
  function duckRustle(sx, sy) {
    const t0 = now(), dur = 0.32
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(900, t0)
      bp.frequency.exponentialRampToValueAtTime(280, t0 + dur)
      bp.Q.value = 1.6
      noise.connect(bp).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.02, 0.04, dur - 0.06, 0.45)
      return out
    })
    dispose(t0 + dur)
  }

  // Jump: ascending whoosh on takeoff.
  function jumpWhoosh(sx, sy) {
    const t0 = now(), dur = 0.30
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(360, t0)
      bp.frequency.exponentialRampToValueAtTime(1900, t0 + dur)
      bp.Q.value = 2.2
      noise.connect(bp).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.02, 0.06, dur - 0.08, 0.6)
      return out
    })
    dispose(t0 + dur)
  }

  // Land: short thud at the end of a jump.
  function landThud(sx, sy) {
    const t0 = now(), dur = 0.22
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(140, t0)
      sub.frequency.exponentialRampToValueAtTime(50, t0 + dur)
      sub.connect(out)
      sub.start(t0); sub.stop(t0 + dur + 0.05)
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 800
      const ng = c.createGain()
      ng.gain.value = 0
      envelope(ng.gain, t0, 0.005, 0.04, dur - 0.05, 0.5)
      noise.connect(lp).connect(ng).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.005, 0.05, dur - 0.06, 0.8)
      return out
    })
    dispose(t0 + dur)
  }

  // Mount: heavier than landThud — body-on-body landing.
  function mountThud(sx, sy) {
    const t0 = now(), dur = 0.40
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(95, t0)
      sub.frequency.exponentialRampToValueAtTime(38, t0 + dur)
      sub.connect(out)
      sub.start(t0); sub.stop(t0 + dur + 0.05)
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(900, t0)
      lp.frequency.exponentialRampToValueAtTime(180, t0 + dur)
      const ng = c.createGain()
      ng.gain.value = 0
      envelope(ng.gain, t0, 0.005, 0.05, dur - 0.06, 0.7)
      noise.connect(lp).connect(ng).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.005, 0.06, dur - 0.07, 0.95)
      return out
    })
    dispose(t0 + dur)
  }

  // Struggle: rustling cloth + low body movement noise when a downed
  // fighter is bucking the rider off.
  function struggleRustle(sx, sy, intensity) {
    intensity = intensity == null ? 0.6 : clamp(intensity, 0.2, 1.2)
    const t0 = now(), dur = 0.22
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1200
      bp.Q.value = 1.4
      noise.connect(bp).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.008, 0.04, dur - 0.05, 0.35 * intensity)
      return out
    })
    dispose(t0 + dur)
  }

  function footstep(sx, sy) {
    const t0 = now(), dur = 0.10
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const noise = c.createBufferSource()
      noise.buffer = noiseBuf(dur)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 700
      noise.connect(lp).connect(out)
      noise.start(t0)
      envelope(out.gain, t0, 0.003, 0.01, dur - 0.02, 0.18)
      return out
    }, {stereo: 0.85, binaural: 0.55})
    dispose(t0 + dur)
  }

  // -------------------------------------------------------- combos / round
  function comboFx(sx, sy, tier) {
    const t0 = now(), dur = 0.55
    const dispose = playSpatial(sx, sy, () => {
      const c = ctx()
      const out = c.createGain()
      out.gain.value = 0
      const ratios = tier >= 2 ? [1, 1.25, 1.5, 2] : [1, 1.5, 2]
      const base = 440 + tier * 120
      ratios.forEach((r, i) => {
        const o = c.createOscillator()
        o.type = i === 0 ? 'triangle' : 'sine'
        o.frequency.value = base * r
        const g = c.createGain()
        g.gain.value = 0
        o.connect(g).connect(out)
        const start = t0 + i * 0.045
        envelope(g.gain, start, 0.005, 0.05, 0.4, 0.45)
        o.start(start); o.stop(start + 0.5)
      })
      out.gain.value = 1
      return out
    })
    dispose(t0 + dur)
  }

  function roundBell() {
    const c = ctx(), t0 = now()
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())
    ;[660, 880, 1320, 1760].forEach((f, i) => {
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(out)
      const start = t0 + i * 0.10
      envelope(g.gain, start, 0.01, 0.10, 0.4, 0.55)
      o.start(start); o.stop(start + 0.55)
    })
    out.gain.value = 1
    setTimeout(() => { try { out.disconnect() } catch(e){} }, 1500)
  }

  function ko(sx, sy, win) {
    const c = ctx(), t0 = now(), dur = 1.6
    const dispose = playSpatial(sx, sy, () => {
      const out = c.createGain()
      out.gain.value = 0
      const o = c.createOscillator()
      o.type = win ? 'triangle' : 'sawtooth'
      o.frequency.setValueAtTime(win ? 880 : 220, t0)
      o.frequency.exponentialRampToValueAtTime(win ? 1760 : 55, t0 + dur)
      o.connect(out)
      o.start(t0); o.stop(t0 + dur + 0.05)
      const sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.setValueAtTime(win ? 220 : 90, t0)
      sub.frequency.exponentialRampToValueAtTime(win ? 440 : 30, t0 + dur)
      const sg = c.createGain()
      sg.gain.value = 0.6
      sub.connect(sg).connect(out)
      sub.start(t0); sub.stop(t0 + dur + 0.05)
      envelope(out.gain, t0, 0.02, 0.22, dur - 0.24, 0.95)
      return out
    })
    dispose(t0 + dur)
  }

  function crowdRoar(intensity) {
    intensity = intensity == null ? 0.5 : clamp(intensity, 0.1, 1.0)
    const c = ctx(), t0 = now(), dur = 0.85 + intensity * 0.6
    const out = c.createGain()
    out.gain.value = 0
    out.connect(engine.mixer.output())
    const noise = c.createBufferSource()
    noise.buffer = noiseBuf(dur)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(900, t0)
    bp.frequency.exponentialRampToValueAtTime(1500, t0 + dur * 0.4)
    bp.frequency.exponentialRampToValueAtTime(700, t0 + dur)
    bp.Q.value = 1.4
    const ng = c.createGain()
    ng.gain.value = 0
    envelope(ng.gain, t0, 0.08, dur * 0.4, dur - 0.08 - dur * 0.4, 0.55 * intensity + 0.15)
    noise.connect(bp).connect(ng).connect(out)
    noise.start(t0)
    out.gain.value = 1
    setTimeout(() => { try { out.disconnect() } catch (e) {} }, (dur + 0.4) * 1000)
  }

  // -------------------------------------------------------- breathing voice
  // Each fighter has a soft continuous breath at their world position. The
  // LFO rate ticks up with fatigue so blind listeners hear opponents
  // gassing out at low HP. The breath also re-pitches per gender so the
  // player can tell who's where without seeing them.

  function startBreath(id, sx, sy, voiceParams) {
    if (breath.has(id)) return
    const c = ctx()
    const node = c.createGain()
    node.gain.value = 0

    const src = c.createBufferSource()
    src.buffer = engine.buffer.whiteNoise({channels: 1, duration: 4})
    src.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    // Higher centre freq for female voices, lower for male.
    bp.frequency.value = (voiceParams && voiceParams.formant) || 700
    bp.Q.value = 1.6
    src.connect(bp).connect(node)
    src.start()

    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1.7
    const lfoGain = c.createGain()
    lfoGain.gain.value = 0.08
    lfo.connect(lfoGain).connect(node.gain)
    lfo.start()

    // Spatial routing
    const dx = sx - listener.x
    const dy = sy - listener.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const dGain = c.createGain()
    dGain.gain.value = clamp(0.85 / (1 + 0.4 * dist), 0.12, 0.85)
    const pan = c.createStereoPanner()
    pan.pan.value = clamp(dx / STAGE_PAN_HALF, -1, 1)
    node.connect(dGain).connect(pan).connect(engine.mixer.output())

    const ear = engine.ear.binaural.create()
    ear.update(relativeAudio(sx, sy))
    ear.to(engine.mixer.output())
    const earGain = c.createGain()
    earGain.gain.value = 0.28
    node.connect(earGain)
    ear.from(earGain)

    breath.set(id, {node, dGain, pan, ear, earGain, src, lfo, lfoGain, bp,
      formantBase: bp.frequency.value})
  }

  function updateBreath(id, sx, sy, opts) {
    const v = breath.get(id)
    if (!v) return
    const dx = sx - listener.x
    const dy = sy - listener.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    v.dGain.gain.setTargetAtTime(clamp(0.85 / (1 + 0.4 * dist), 0.12, 0.85), ctx().currentTime, 0.05)
    v.pan.pan.setTargetAtTime(clamp(dx / STAGE_PAN_HALF, -1, 1), ctx().currentTime, 0.05)
    v.ear.update(relativeAudio(sx, sy))
    if (opts) {
      if (opts.down != null) {
        // Lower formant when down — muffled, on the ground.
        v.bp.frequency.setTargetAtTime(opts.down ? v.formantBase * 0.55 : v.formantBase, ctx().currentTime, 0.1)
      }
      if (opts.fatigue != null) {
        const f = clamp(opts.fatigue, 0, 1)
        v.lfo.frequency.setTargetAtTime(1.6 + f * 2.0, ctx().currentTime, 0.2)
        v.lfoGain.gain.setTargetAtTime(0.08 + f * 0.07, ctx().currentTime, 0.2)
      }
    }
  }

  function stopBreath(id) {
    const v = breath.get(id)
    if (!v) return
    breath.delete(id)
    const c = ctx()
    const t = c.currentTime
    v.node.gain.cancelScheduledValues(t)
    v.node.gain.setValueAtTime(v.node.gain.value, t)
    v.node.gain.linearRampToValueAtTime(0, t + 0.08)
    setTimeout(() => {
      try { v.src.stop() } catch (e) {}
      try { v.lfo.stop() } catch (e) {}
      try { v.node.disconnect() } catch (e) {}
      try { v.ear.destroy() } catch (e) {}
    }, 200)
  }

  function silenceAll() {
    for (const id of [...breath.keys()]) stopBreath(id)
  }

  return {
    setListener,
    relativeAudio,
    playSpatial,
    envelope,
    noiseBuf,
    tell,
    hit,
    whiff,
    knockdownThud,
    getupRustle,
    footstep,
    blockUp,
    duckRustle,
    jumpWhoosh,
    landThud,
    mountThud,
    struggleRustle,
    comboFx,
    roundBell,
    ko,
    crowdRoar,
    startBreath,
    updateBreath,
    stopBreath,
    silenceAll,
    // Constants exposed for diagnostic/test screens.
    STAGE_PAN_HALF,
    LISTENER_YAW,
  }
})()
