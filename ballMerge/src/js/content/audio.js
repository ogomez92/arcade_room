// Basket audio: STEREO + PITCH, player-centred (no binaural, no listener yaw).
//   - POSITION → pan. A ball's pan is its x relative to the player; dead centre
//     means it is straight above you (the catch / throw line).
//   - SIZE → pitch + weight. Small = high, light, fast flutter. Big = low,
//     round, slow wobble, with a sub layer and wind rumble.
//   - DESCENT → the proximity ticks. Every airborne ball ticks at a rate that
//     is a function of the seconds left before it reaches the basket, so a
//     heavy ball's ticks pile up much faster than a light one's: you hear how
//     fast it lands, not just where it is. Altitude also opens a lowpass and
//     raises the level as the ball comes down (far = muffled, near = bright).
//   - ALIGNMENT → a lock overtone that fades in as a ball centres over you.
//   - IN RANGE → the held-ball hum gains a fifth and brightens when a throw
//     right now would hit; a soft chime marks the moment it becomes true.
// All voices are hand-shaped WebAudio (filtered triangles/sines, soft noise,
// clean ADSR). One continuous evolving voice per moving ball; one-shots are
// short and carry a broadband transient so the ear can place them.
content.audio = (() => {
  const cfg = () => content.config

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function now() { return ctx().currentTime }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }
  function pitch(mass) { return cfg().ballPitch(mass) }

  // ---- shared noise buffer ----
  let _noise = null
  function noiseBuffer() {
    if (_noise) return _noise
    const c = ctx()
    const len = Math.floor(c.sampleRate * 2)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    _noise = buf
    return _noise
  }
  function noiseSource() {
    const s = ctx().createBufferSource()
    s.buffer = noiseBuffer()
    s.loop = true
    return s
  }

  // ---- helpers ----
  function panNode(pan) {
    const c = ctx()
    if (!c.createStereoPanner) return out()
    const p = c.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    p.connect(out())
    return p
  }
  function disconnectLater(node, ms) {
    if (node && node !== out()) setTimeout(() => { try { node.disconnect() } catch (e) {} }, ms)
  }
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.exponentialRampToValueAtTime(0.0001, t0 + a + hold + r)
  }
  function blip({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.02, r = 0.1, peak = 0.4, dest, lp}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(Math.max(20, freq), t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    if (lp) {
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.7
      o.connect(f).connect(g).connect(dest || out())
    } else {
      o.connect(g).connect(dest || out())
    }
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.06)
    return o
  }
  function noiseBurst(t0, {peak = 0.3, a = 0.001, r = 0.08, type = 'lowpass', cutoff = 3000, q = 0.7, dest, sweepTo} = {}) {
    const c = ctx()
    const s = noiseSource()
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(cutoff, t0)
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t0 + a + r)
    f.Q.value = q
    const g = c.createGain()
    env(g.gain, t0, {a, hold: 0, r, peak})
    s.connect(f).connect(g).connect(dest || out())
    s.start(t0)
    s.stop(t0 + a + r + 0.08)
    setTimeout(() => { try { g.disconnect(); f.disconnect() } catch (e) {} }, (a + r + 0.3) * 1000)
    return {s, f, g}
  }
  // broadband HF transient for placement (a tiny "tk")
  function click(t0, dest, peak = 0.08) {
    noiseBurst(t0, {peak, a: 0.0005, r: 0.018, type: 'highpass', cutoff: 5200, q: 0.5, dest})
  }

  // Mass → timbre helpers. Small balls are bright and flutter; big balls are
  // dark, slow-wobbling and carry sub + rumble.
  function wobbleRate(mass) { return 2.6 + 6.4 / Math.sqrt(mass) }
  function subShare(mass) { return clamp((mass - 2) / 10, 0, 0.5) }

  // ========================================================================
  //  BALL VOICES — one continuous voice per airborne ball
  // ========================================================================
  const voices = new Map()

  function makeVoice(item) {
    const c = ctx()
    const f = pitch(item.mass)

    const mix = c.createGain()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.8
    const amp = c.createGain(); amp.gain.value = 0.0001
    const pan = c.createStereoPanner ? c.createStereoPanner() : null

    const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f
    const o1g = c.createGain(); o1g.gain.value = 0.55
    o1.connect(o1g).connect(mix)

    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 1.002
    const o2g = c.createGain(); o2g.gain.value = 0.35
    o2.connect(o2g).connect(mix)

    // sub octave: only meaningful for heavier balls
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2
    const subg = c.createGain(); subg.gain.value = subShare(item.mass)
    sub.connect(subg).connect(mix)

    // lock overtone (opens when centred above you)
    const ot = c.createOscillator(); ot.type = 'sine'; ot.frequency.value = f < 200 ? f * 4 : f * 3
    const otg = c.createGain(); otg.gain.value = 0.0001
    ot.connect(otg).connect(mix)

    // wind rumble: lowpassed noise, level follows speed × mass
    const rum = noiseSource()
    const rumf = c.createBiquadFilter(); rumf.type = 'lowpass'; rumf.frequency.value = 260 + 40 * item.mass; rumf.Q.value = 0.5
    const rumg = c.createGain(); rumg.gain.value = 0.0001
    rum.connect(rumf).connect(rumg).connect(mix)

    // wobble tremolo (rate by mass)
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = wobbleRate(item.mass)
    const lfod = c.createGain(); lfod.gain.value = 0.0001
    lfo.connect(lfod).connect(amp.gain)

    mix.connect(lp)
    if (pan) { lp.connect(amp).connect(pan); pan.connect(out()); pan.pan.value = clamp(item.pan, -1, 1) }
    else lp.connect(amp).connect(out())

    const t0 = now()
    o1.start(t0); o2.start(t0); sub.start(t0); ot.start(t0); rum.start(t0); lfo.start(t0)

    return {
      id: item.id, mass: item.mass, f,
      o1, o2, sub, ot, otg, rum, rumg, rumf, lfo, lfod, mix, lp, amp, pan,
      aligned: false, nextTick: t0 + 0.12, level: 0,
    }
  }

  function destroyVoice(v) {
    const t0 = now()
    try {
      v.amp.gain.cancelScheduledValues(t0)
      v.amp.gain.setValueAtTime(Math.max(0.0001, v.amp.gain.value), t0)
      v.amp.gain.linearRampToValueAtTime(0.0001, t0 + 0.08)
    } catch (e) {}
    setTimeout(() => {
      try { v.o1.stop(); v.o2.stop(); v.sub.stop(); v.ot.stop(); v.rum.stop(); v.lfo.stop() } catch (e) {}
      try { v.mix.disconnect(); v.lp.disconnect(); v.amp.disconnect(); v.lfod.disconnect(); v.otg.disconnect(); v.rumg.disconnect() } catch (e) {}
      try { if (v.pan) v.pan.disconnect() } catch (e) {}
    }, 160)
  }

  // proximity tick: pitched to the ball, panned with it, louder as it nears
  function tick(v, when, urgency) {
    const dest = v.pan || out()
    const f = Math.max(300, v.f * 2)
    const peak = 0.07 + 0.16 * urgency
    blip({type: 'sine', freq: f, t0: when, a: 0.002, hold: 0.008, r: 0.05 + 0.04 * (1 - urgency), peak, dest})
    click(when, dest, 0.03 + 0.05 * urgency)
  }

  function lockTick(v) {
    const t0 = now()
    const dest = v.pan || out()
    blip({type: 'sine', freq: Math.max(400, v.f * 3), t0, a: 0.003, hold: 0.01, r: 0.09, peak: 0.14, dest})
    blip({type: 'sine', freq: Math.max(600, v.f * 4.5), t0: t0, a: 0.002, hold: 0.005, r: 0.05, peak: 0.06, dest})
  }

  // Called every frame with content.world.snapshot(). Creates/updates/destroys
  // voices smoothly and refills each ball's tick queue on the audio clock.
  function updateBalls(list) {
    const c = ctx()
    const t0 = c.currentTime
    const seen = new Set()
    const C = cfg()

    for (const item of list) {
      seen.add(item.id)
      let v = voices.get(item.id)
      if (!v) { v = makeVoice(item); voices.set(item.id, v) }

      if (v.pan) v.pan.pan.setTargetAtTime(clamp(item.pan, -1, 1), t0, 0.02)

      // altitude → brightness + level (far/high = muffled & quiet)
      const near = 1 - item.alt
      const far = clamp(Math.abs(item.dx) / 10, 0, 1)
      const level = (0.05 + 0.14 * Math.pow(near, 1.2)) * (1 - 0.3 * far)
      v.level = level
      v.amp.gain.setTargetAtTime(level, t0, 0.04)
      v.lfod.gain.setTargetAtTime(level * 0.28, t0, 0.08)
      v.lp.frequency.setTargetAtTime(420 + 4400 * Math.pow(near, 1.4), t0, 0.05)

      // speed → doppler bend + wind rumble
      const speed = clamp(Math.abs(item.vy) / 9, 0, 1)
      const bend = 1 + 0.03 * clamp(-item.vy / 9, -1, 1)
      v.o1.frequency.setTargetAtTime(v.f * bend, t0, 0.03)
      v.o2.frequency.setTargetAtTime(v.f * 1.002 * bend, t0, 0.03)
      v.sub.frequency.setTargetAtTime(v.f / 2 * bend, t0, 0.03)
      const rumble = (0.05 + 0.03 * Math.min(item.mass, 12)) * speed
      v.rumg.gain.setTargetAtTime(Math.min(0.5, rumble), t0, 0.06)

      // alignment → lock overtone
      if (item.aligned && !v.aligned) lockTick(v)
      v.aligned = item.aligned
      const cen = item.aligned ? item.centred * item.centred : 0
      v.otg.gain.setTargetAtTime(0.0001 + 0.16 * cen, t0, 0.04)

      // proximity ticks (falling only; a rising ball is silent between ticks)
      if (item.vy < 0) {
        const tb = item.tBand
        while (v.nextTick < t0 + 0.09) {
          const when = Math.max(t0, v.nextTick)
          const remaining = Math.max(0, tb - (when - t0))
          const urgency = 1 - clamp(remaining / 3, 0, 1)
          tick(v, when, urgency)
          const interval = clamp(0.19 * remaining, 0.045, 0.55)
          v.nextTick = when + interval
        }
      } else {
        v.nextTick = t0 + 0.12
      }
    }

    for (const [id, v] of voices) {
      if (!seen.has(id)) { destroyVoice(v); voices.delete(id) }
    }
  }

  function clearVoices() {
    for (const [id, v] of voices) { destroyVoice(v); voices.delete(id) }
  }

  // ========================================================================
  //  HELD BALL HUM — centred, steady, pitched by mass; brightens in range
  // ========================================================================
  let hum = null

  function startHum(mass) {
    const c = ctx()
    const f = pitch(mass)
    const bus = c.createGain(); bus.gain.value = 0.0001
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = f
    const o1g = c.createGain(); o1g.gain.value = 0.6
    const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f
    const o2g = c.createGain(); o2g.gain.value = 0.3
    const fifth = c.createOscillator(); fifth.type = 'sine'; fifth.frequency.value = f * 1.5
    const fifthg = c.createGain(); fifthg.gain.value = 0.0001
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2
    const subg = c.createGain(); subg.gain.value = subShare(mass) * 0.8
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 2.1
    const lfod = c.createGain(); lfod.gain.value = 0.012
    o1.connect(o1g).connect(lp); o2.connect(o2g).connect(lp); fifth.connect(fifthg).connect(lp); sub.connect(subg).connect(lp)
    lp.connect(bus).connect(out())
    lfo.connect(lfod).connect(bus.gain)
    const t0 = c.currentTime
    o1.start(t0); o2.start(t0); fifth.start(t0); sub.start(t0); lfo.start(t0)
    bus.gain.setTargetAtTime(0.05, t0, 0.08)
    hum = {mass, f, bus, lp, o1, o2, fifth, fifthg, sub, subg, lfo, lfod, inRange: false, puRange: false}
  }

  function stopHum() {
    if (!hum) return
    const h = hum
    hum = null
    const t0 = now()
    try { h.bus.gain.cancelScheduledValues(t0); h.bus.gain.setValueAtTime(h.bus.gain.value, t0); h.bus.gain.linearRampToValueAtTime(0.0001, t0 + 0.06) } catch (e) {}
    setTimeout(() => {
      try { h.o1.stop(); h.o2.stop(); h.fifth.stop(); h.sub.stop(); h.lfo.stop() } catch (e) {}
      try { h.bus.disconnect(); h.lfod.disconnect() } catch (e) {}
    }, 140)
  }

  function rangeChime(f) {
    const t0 = now()
    blip({type: 'sine', freq: Math.max(500, f * 3), t0, a: 0.004, hold: 0.02, r: 0.14, peak: 0.16})
    blip({type: 'sine', freq: Math.max(750, f * 4.5), t0: t0 + 0.05, a: 0.004, hold: 0.02, r: 0.16, peak: 0.1})
  }
  // power-up in reach: a quick bell-like triplet, distinct from the ball chime
  function powerupRangeChime() {
    const t0 = now()
    ;[784, 988, 1175].forEach((f, i) => blip({type: 'triangle', freq: f, t0: t0 + i * 0.05, a: 0.003, hold: 0.01, r: 0.12, peak: 0.1, lp: 2800}))
  }

  // Every frame: mass held (0 = nothing) and whether a throw now would hit a
  // ball (`inRange`) and/or the hanging power-up (`puRange`).
  function updateHeld(mass, inRange, puRange) {
    if (!mass) { if (hum) stopHum(); return }
    if (!hum) startHum(mass)
    else if (hum.mass !== mass) {
      // re-pitch in place (a catch after a throw) — smooth glide
      const t0 = now()
      const f = pitch(mass)
      hum.mass = mass; hum.f = f
      hum.o1.frequency.setTargetAtTime(f, t0, 0.04)
      hum.o2.frequency.setTargetAtTime(f, t0, 0.04)
      hum.fifth.frequency.setTargetAtTime(f * 1.5, t0, 0.04)
      hum.sub.frequency.setTargetAtTime(f / 2, t0, 0.04)
      hum.subg.gain.setTargetAtTime(subShare(mass) * 0.8, t0, 0.05)
    }
    const t0 = now()
    const on = !!inRange
    const pu = !!puRange
    if (on && !hum.inRange) rangeChime(hum.f)
    if (pu && !hum.puRange) powerupRangeChime()
    hum.inRange = on
    hum.puRange = pu
    hum.fifthg.gain.setTargetAtTime(on ? 0.5 : 0.0001, t0, 0.05)
    hum.lp.frequency.setTargetAtTime(on || pu ? 3200 : 900, t0, 0.06)
    hum.bus.gain.setTargetAtTime(on || pu ? 0.075 : 0.05, t0, 0.06)
    // ball in range: faster pulse; power-up in range: a bright, quick flutter
    hum.lfo.frequency.setTargetAtTime(on ? 5.5 : pu ? 9 : 2.1, t0, 0.1)
    hum.lfod.gain.setTargetAtTime(pu && !on ? 0.03 : 0.012, t0, 0.1)
  }

  // ========================================================================
  //  ONE-SHOTS
  // ========================================================================

  // A new ball appears: a small bell at its pitch, panned where it is.
  function spawn(mass, pan, seed) {
    const t0 = now()
    const p = panNode(pan)
    const f = pitch(mass)
    blip({type: 'sine', freq: f * 2, t0, a: 0.003, hold: 0.02, r: 0.55, peak: 0.2, dest: p})
    blip({type: 'sine', freq: f * 3.01, t0, a: 0.003, hold: 0.01, r: 0.3, peak: 0.08, dest: p})
    blip({type: 'triangle', freq: f, t0: t0 + 0.02, a: 0.01, hold: 0.04, r: 0.25, peak: 0.1, dest: p, lp: 2400})
    click(t0, p, 0.06)
    if (seed) blip({type: 'sine', freq: f * 4, t0: t0 + 0.12, a: 0.003, hold: 0.01, r: 0.3, peak: 0.07, dest: p})
    disconnectLater(p, 1000)
  }

  // Into the basket: a soft rubbery plop + a little wicker rattle.
  function catchBall(mass, centred) {
    const t0 = now()
    const p = panNode(0)
    const f = pitch(mass)
    const big = clamp((mass - 1) / 10, 0, 1)
    blip({type: 'sine', freq: f * 1.25, glideTo: f * 0.55, t0, a: 0.003, hold: 0.02, r: 0.14 + big * 0.12, peak: 0.34, dest: p})
    blip({type: 'sine', freq: f * 0.5, glideTo: f * 0.3, t0, a: 0.004, hold: 0.02, r: 0.16 + big * 0.2, peak: 0.12 + big * 0.2, dest: p})
    noiseBurst(t0, {peak: 0.14 + big * 0.1, a: 0.001, r: 0.06 + big * 0.06, type: 'lowpass', cutoff: 900, dest: p})
    noiseBurst(t0 + 0.02, {peak: 0.05, a: 0.002, r: 0.07, type: 'bandpass', cutoff: 2600, q: 1.4, dest: p})
    if (centred > 0.85) blip({type: 'sine', freq: f * 4, t0: t0 + 0.05, a: 0.003, hold: 0.01, r: 0.12, peak: 0.06, dest: p})
    disconnectLater(p, 700)
  }

  // Throwing: an airy upward whoosh with a rising tonal tail.
  function throwBall(mass) {
    const t0 = now()
    const p = panNode(0)
    const f = pitch(mass)
    noiseBurst(t0, {peak: 0.16, a: 0.01, r: 0.22, type: 'bandpass', cutoff: 320, sweepTo: 2600, q: 1.2, dest: p})
    blip({type: 'sine', freq: f, glideTo: f * 1.7, t0, a: 0.006, hold: 0.03, r: 0.16, peak: 0.14, dest: p})
    blip({type: 'sine', freq: f * 0.5, glideTo: f * 0.35, t0, a: 0.002, hold: 0.01, r: 0.08, peak: 0.1, dest: p})
    disconnectLater(p, 600)
  }

  // The hero cue: two pitches slide into one, then the new ball blooms. Air
  // merges sparkle upward; a bump on the basket lands with a thud first.
  function merge({mass, from, air, pan}) {
    const t0 = now()
    const p = panNode(pan)
    const fN = pitch(mass)
    const fa = pitch(from[0]), fb = pitch(from[1])
    const big = clamp((mass - 2) / 12, 0, 1)
    if (!air) {
      // impact on the basket
      blip({type: 'sine', freq: 110, glideTo: 55, t0, a: 0.002, hold: 0.02, r: 0.14, peak: 0.3, dest: p})
      noiseBurst(t0, {peak: 0.2, a: 0.001, r: 0.1, type: 'lowpass', cutoff: 520, dest: p})
    }
    const t1 = air ? t0 : t0 + 0.05
    // converge
    blip({type: 'sine', freq: fa, glideTo: fN, t0: t1, a: 0.004, hold: 0.06, r: 0.1, peak: 0.16, dest: p})
    blip({type: 'sine', freq: fb, glideTo: fN, t0: t1, a: 0.004, hold: 0.06, r: 0.1, peak: 0.16, dest: p})
    // squelch: bandpassed noise sweeping down into the new pitch
    noiseBurst(t1, {peak: 0.12, a: 0.004, r: 0.16, type: 'bandpass', cutoff: 1800, sweepTo: Math.max(120, fN), q: 2, dest: p})
    // bloom of the merged ball
    const t2 = t1 + 0.12
    blip({type: 'triangle', freq: fN, t0: t2, a: 0.015, hold: 0.08, r: 0.4 + big * 0.3, peak: 0.28, dest: p, lp: 1800 + 1200 * (1 - big)})
    blip({type: 'sine', freq: fN / 2, t0: t2, a: 0.01, hold: 0.06, r: 0.35 + big * 0.35, peak: 0.12 + big * 0.22, dest: p})
    click(t2, p, 0.05)
    if (air) {
      const notes = [fN * 2, fN * 2.5, fN * 3]
      notes.forEach((f, i) => blip({type: 'sine', freq: Math.max(300, f), t0: t2 + 0.03 + i * 0.05, a: 0.003, hold: 0.01, r: 0.16, peak: 0.1, dest: p}))
    }
    disconnectLater(p, 1400)
  }

  // Wall bounce: rubbery boing hard on that side.
  function wall(mass, side) {
    const t0 = now()
    const p = panNode(side === 'left' ? -0.95 : 0.95)
    const f = pitch(mass)
    blip({type: 'sine', freq: f * 1.3, glideTo: f * 0.85, t0, a: 0.003, hold: 0.02, r: 0.13, peak: 0.2, dest: p})
    noiseBurst(t0, {peak: 0.06, a: 0.001, r: 0.04, type: 'lowpass', cutoff: 1400, dest: p})
    click(t0, p, 0.04)
    disconnectLater(p, 400)
  }

  // You ran into the edge of the lane.
  function edge(side) {
    const t0 = now()
    const p = panNode(side === 'left' ? -0.7 : 0.7)
    blip({type: 'sine', freq: 130, glideTo: 60, t0, a: 0.002, hold: 0.02, r: 0.12, peak: 0.22, dest: p})
    noiseBurst(t0, {peak: 0.12, a: 0.001, r: 0.06, type: 'lowpass', cutoff: 380, dest: p})
    disconnectLater(p, 300)
  }

  // Footsteps while running: two alternating soft pads.
  let stepIdx = 0
  function step() {
    const t0 = now()
    stepIdx ^= 1
    noiseBurst(t0, {peak: 0.05, a: 0.002, r: 0.05, type: 'lowpass', cutoff: stepIdx ? 1100 : 850, dest: out()})
    blip({type: 'sine', freq: stepIdx ? 150 : 128, glideTo: 70, t0, a: 0.002, hold: 0.005, r: 0.05, peak: 0.05})
  }

  // A ball hit the ground: heavy splat, then a short descending dirge.
  function drop(mass, pan) {
    const t0 = now()
    const p = panNode(pan)
    const f = pitch(mass)
    blip({type: 'sine', freq: f * 0.8, glideTo: f * 0.2, t0, a: 0.003, hold: 0.04, r: 0.5, peak: 0.42, dest: p})
    blip({type: 'sine', freq: 70, glideTo: 28, t0, a: 0.003, hold: 0.05, r: 0.5, peak: 0.36, dest: p})
    noiseBurst(t0, {peak: 0.3, a: 0.001, r: 0.32, type: 'lowpass', cutoff: 700, sweepTo: 120, dest: p})
    disconnectLater(p, 1200)
    const notes = [329.63, 261.63, 196]
    notes.forEach((n, i) => {
      const t = t0 + 0.4 + i * 0.28
      blip({type: 'triangle', freq: n, t0: t, a: 0.01, hold: 0.06, r: 0.42, peak: 0.24, lp: 2200})
      blip({type: 'sine', freq: n / 2, t0: t, a: 0.01, hold: 0.06, r: 0.42, peak: 0.12})
    })
  }

  // Round intro chime.
  function roundStart(round) {
    const t0 = now()
    const base = 440 * Math.pow(2, Math.min(round - 1, 6) / 12)
    blip({type: 'sine', freq: base, glideTo: base * 1.5, t0, a: 0.008, hold: 0.03, r: 0.22, peak: 0.22})
    blip({type: 'triangle', freq: base * 1.5, t0: t0 + 0.14, a: 0.008, hold: 0.04, r: 0.28, peak: 0.18, lp: 3000})
  }

  // Round clear: the held ball is banked (its pitch whooshes skyward) and a
  // snappy rising arpeggio plays.
  function roundClear(mass, last) {
    const t0 = now()
    const f = pitch(mass || 1)
    blip({type: 'sine', freq: f, glideTo: f * 6, t0, a: 0.01, hold: 0.1, r: 0.3, peak: 0.18})
    noiseBurst(t0, {peak: 0.1, a: 0.02, r: 0.35, type: 'bandpass', cutoff: 500, sweepTo: 4000, q: 1.2})
    const notes = last ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] : [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((n, i) => {
      const t = t0 + 0.12 + i * 0.09
      const lastNote = i === notes.length - 1
      blip({type: 'triangle', freq: n, t0: t, a: 0.005, hold: lastNote ? 0.2 : 0.02, r: lastNote ? 0.6 : 0.2, peak: 0.22, lp: 3600})
      blip({type: 'sine', freq: n * 2, t0: t, a: 0.005, hold: 0.01, r: 0.12, peak: 0.06})
    })
  }

  // Beat the game: a fuller fanfare.
  function win() {
    const t0 = now()
    const chords = [[392, 493.88, 587.33], [440, 554.37, 659.25], [493.88, 622.25, 739.99], [523.25, 659.25, 783.99, 1046.5]]
    chords.forEach((ch, i) => {
      const t = t0 + i * 0.22
      const last = i === chords.length - 1
      ch.forEach((n) => {
        blip({type: 'triangle', freq: n, t0: t, a: 0.01, hold: last ? 0.4 : 0.08, r: last ? 0.9 : 0.25, peak: 0.16, lp: 3200})
        blip({type: 'sine', freq: n / 2, t0: t, a: 0.01, hold: last ? 0.4 : 0.08, r: last ? 0.9 : 0.25, peak: 0.07})
      })
    })
  }

  function throwEmpty() {
    const t0 = now()
    noiseBurst(t0, {peak: 0.05, a: 0.004, r: 0.08, type: 'bandpass', cutoff: 1200, q: 0.8})
  }

  // ========================================================================
  //  AMBIENCE — a soft breeze plus a very quiet, dark pad well below the ball
  //  register. Nothing high or sustained-pure (that reads as piercing); it only
  //  fills the silence between spawns.
  // ========================================================================
  let amb = null
  function startAmbience() {
    if (amb) return
    const c = ctx()
    const bus = c.createGain(); bus.gain.value = 0.0001
    bus.connect(out())
    const t0 = c.currentTime
    // dark pad: two slow-beating triangles an octave apart under a 240 Hz lowpass
    const padLp = c.createBiquadFilter(); padLp.type = 'lowpass'; padLp.frequency.value = 240; padLp.Q.value = 0.5
    padLp.connect(bus)
    const tones = [[55, 0.02], [55.15, 0.016], [110, 0.008]].map(([f, level], i) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f
      const g = c.createGain(); g.gain.value = level
      const l = c.createOscillator(); l.type = 'sine'; l.frequency.value = 0.03 + i * 0.02
      const ld = c.createGain(); ld.gain.value = 0.15
      l.connect(ld).connect(o.frequency)
      const al = c.createOscillator(); al.type = 'sine'; al.frequency.value = 0.05 + i * 0.03
      const ald = c.createGain(); ald.gain.value = level * 0.4
      al.connect(ald).connect(g.gain)
      o.connect(g).connect(padLp)
      o.start(t0); l.start(t0); al.start(t0)
      return {o, g, l, ld, al, ald}
    })
    const breeze = noiseSource()
    const bf = c.createBiquadFilter(); bf.type = 'lowpass'; bf.frequency.value = 420; bf.Q.value = 0.3
    const bg = c.createGain(); bg.gain.value = 0.012
    const bl = c.createOscillator(); bl.type = 'sine'; bl.frequency.value = 0.045
    const bld = c.createGain(); bld.gain.value = 0.007
    bl.connect(bld).connect(bg.gain)
    breeze.connect(bf).connect(bg).connect(bus)
    breeze.start(t0); bl.start(t0)
    bus.gain.setTargetAtTime(1, t0, 0.8)
    amb = {bus, tones, breeze, bf, bg, bl, bld, padLp}
  }
  function setAmbienceIntensity(k) {
    if (!amb) return
    const t0 = now()
    amb.bg.gain.setTargetAtTime(0.012 + 0.01 * clamp(k, 0, 1), t0, 0.5)
    amb.bf.frequency.setTargetAtTime(420 + 260 * clamp(k, 0, 1), t0, 0.5)
  }
  function stopAmbience() {
    if (!amb) return
    const a = amb
    amb = null
    const t0 = now()
    try { a.bus.gain.cancelScheduledValues(t0); a.bus.gain.setValueAtTime(a.bus.gain.value, t0); a.bus.gain.linearRampToValueAtTime(0.0001, t0 + 0.4) } catch (e) {}
    setTimeout(() => {
      try { a.tones.forEach((t) => { t.o.stop(); t.l.stop(); t.al.stop() }); a.breeze.stop(); a.bl.stop() } catch (e) {}
      try { a.bus.disconnect() } catch (e) {}
    }, 500)
  }

  // ========================================================================
  //  ARCADE: POWER-UPS, LIVES, EFFECTS
  //  A power-up hangs from the ceiling and repeats a short motif (one per
  //  type) panned where it is. It gets louder and brighter as it lowers, and
  //  the motif speeds up in its last seconds before it is pulled back up.
  //  Motifs live in the 260–1200 Hz range — bright enough to read as a
  //  reward, never sustained or piercing.
  // ========================================================================
  const PU = {
    life:  {interval: 0.75, base: 523.25, play: (t, d, lvl) => {              // rising major triad
      ;[523.25, 659.25, 783.99].forEach((f, i) => blip({type: 'triangle', freq: f, t0: t + i * 0.07, a: 0.004, hold: 0.02, r: 0.18, peak: lvl, dest: d, lp: 3200}))
    }},
    bonus: {interval: 0.6, base: 987.77, play: (t, d, lvl) => {               // coin ding-ding
      blip({type: 'sine', freq: 987.77, t0: t, a: 0.002, hold: 0.02, r: 0.12, peak: lvl, dest: d})
      blip({type: 'sine', freq: 1318.5, t0: t + 0.08, a: 0.002, hold: 0.03, r: 0.22, peak: lvl * 0.9, dest: d})
    }},
    slow:  {interval: 0.85, base: 329.63, play: (t, d, lvl) => {              // woody tick-tock
      blip({type: 'sine', freq: 329.63, glideTo: 300, t0: t, a: 0.002, hold: 0.01, r: 0.09, peak: lvl * 1.2, dest: d})
      noiseBurst(t, {peak: lvl * 0.5, a: 0.001, r: 0.03, type: 'bandpass', cutoff: 1800, q: 2, dest: d})
      blip({type: 'sine', freq: 261.63, glideTo: 240, t0: t + 0.3, a: 0.002, hold: 0.01, r: 0.09, peak: lvl * 1.1, dest: d})
      noiseBurst(t + 0.3, {peak: lvl * 0.45, a: 0.001, r: 0.03, type: 'bandpass', cutoff: 1400, q: 2, dest: d})
    }},
    wide:  {interval: 0.95, base: 392, play: (t, d, lvl) => {                 // wide interval swell
      blip({type: 'triangle', freq: 392, t0: t, a: 0.06, hold: 0.08, r: 0.25, peak: lvl * 0.9, dest: d, lp: 2200})
      blip({type: 'triangle', freq: 587.33, t0: t + 0.03, a: 0.06, hold: 0.08, r: 0.25, peak: lvl * 0.8, dest: d, lp: 2200})
      blip({type: 'sine', freq: 784, t0: t + 0.12, a: 0.01, hold: 0.02, r: 0.2, peak: lvl * 0.4, dest: d})
    }},
  }

  let puVoice = null // {id, type, pan, hover, hoverG, lp, nextMotif}

  function startPowerupVoice(item) {
    const c = ctx()
    const spec = PU[item.type] || PU.bonus
    const pan = c.createStereoPanner ? c.createStereoPanner() : null
    const dest = pan || out()
    if (pan) { pan.pan.value = clamp(item.pan, -1, 1); pan.connect(out()) }
    // faint hover shimmer so it can be located between motifs
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.7
    const hover = c.createOscillator(); hover.type = 'triangle'; hover.frequency.value = spec.base
    const hover2 = c.createOscillator(); hover2.type = 'triangle'; hover2.frequency.value = spec.base * 1.003
    const hoverG = c.createGain(); hoverG.gain.value = 0.0001
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 6
    const lfod = c.createGain(); lfod.gain.value = 0.006
    lfo.connect(lfod).connect(hoverG.gain)
    hover.connect(lp); hover2.connect(lp); lp.connect(hoverG).connect(dest)
    const t0 = c.currentTime
    hover.start(t0); hover2.start(t0); lfo.start(t0)
    hoverG.gain.setTargetAtTime(0.018, t0, 0.1)
    puVoice = {id: item.id, type: item.type, pan, dest, hover, hover2, hoverG, lfo, lfod, lp, nextMotif: t0 + 0.05, spec}
  }

  function stopPowerupVoice() {
    if (!puVoice) return
    const v = puVoice
    puVoice = null
    const t0 = now()
    try { v.hoverG.gain.cancelScheduledValues(t0); v.hoverG.gain.setValueAtTime(v.hoverG.gain.value, t0); v.hoverG.gain.linearRampToValueAtTime(0.0001, t0 + 0.08) } catch (e) {}
    setTimeout(() => {
      try { v.hover.stop(); v.hover2.stop(); v.lfo.stop() } catch (e) {}
      try { v.hoverG.disconnect(); v.lfod.disconnect(); v.lp.disconnect(); if (v.pan) v.pan.disconnect() } catch (e) {}
    }, 700)
  }

  // Every frame with content.game.powerupSnapshot() (or null).
  function updatePowerup(item) {
    if (!item) { if (puVoice) stopPowerupVoice(); return }
    if (!puVoice || puVoice.id !== item.id) { stopPowerupVoice(); startPowerupVoice(item) }
    const v = puVoice
    const t0 = now()
    if (v.pan) v.pan.pan.setTargetAtTime(clamp(item.pan, -1, 1), t0, 0.03)
    const low = 1 - item.alt // 0 at the ceiling, 1 fully lowered
    v.lp.frequency.setTargetAtTime(1000 + 2400 * low, t0, 0.1)
    const level = 0.11 + 0.12 * low
    const interval = v.spec.interval * (item.urgency > 0 ? 1 - 0.5 * item.urgency : 1)
    while (v.nextMotif < t0 + 0.09) {
      const when = Math.max(t0, v.nextMotif)
      v.spec.play(when, v.dest, level)
      v.nextMotif = when + interval
    }
  }

  // Collected: the type's motif resolves upward, plus a sparkle. Then the
  // effect (if any) starts its own presence.
  function powerupCollect(type) {
    const t0 = now()
    const p = panNode(0)
    click(t0, p, 0.06)
    if (type === 'life') {
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip({type: 'triangle', freq: f, t0: t0 + i * 0.07, a: 0.004, hold: 0.04, r: 0.3, peak: 0.22, dest: p, lp: 3400}))
      blip({type: 'sine', freq: 130.8, t0: t0 + 0.2, a: 0.01, hold: 0.15, r: 0.4, peak: 0.16, dest: p}) // warm low "heart"
    } else if (type === 'bonus') {
      ;[987.77, 1318.5, 1567.98, 1318.5, 1975.5].forEach((f, i) => blip({type: 'sine', freq: f, t0: t0 + i * 0.05, a: 0.002, hold: 0.02, r: 0.16, peak: 0.16, dest: p}))
      noiseBurst(t0, {peak: 0.06, a: 0.002, r: 0.12, type: 'bandpass', cutoff: 3000, q: 1.5, dest: p})
    } else if (type === 'slow') {
      // time stretches: a glide down and the tock slowing
      blip({type: 'sine', freq: 520, glideTo: 180, t0, a: 0.01, hold: 0.1, r: 0.5, peak: 0.2, dest: p})
      ;[0, 0.18, 0.42, 0.75].forEach((dt, i) => blip({type: 'sine', freq: 329.63 - i * 20, glideTo: 280 - i * 20, t0: t0 + dt, a: 0.002, hold: 0.01, r: 0.1, peak: 0.14, dest: p}))
    } else if (type === 'wide') {
      // two voices spread apart: the basket widening
      blip({type: 'triangle', freq: 440, glideTo: 330, t0, a: 0.02, hold: 0.15, r: 0.35, peak: 0.16, dest: p, lp: 2400})
      blip({type: 'triangle', freq: 440, glideTo: 587.33, t0, a: 0.02, hold: 0.15, r: 0.35, peak: 0.16, dest: p, lp: 2400})
      blip({type: 'sine', freq: 880, t0: t0 + 0.25, a: 0.01, hold: 0.03, r: 0.25, peak: 0.08, dest: p})
    }
    disconnectLater(p, 1500)
  }

  // Pulled back up into the ceiling: a quick zip upward, quiet.
  function powerupGone(pan) {
    const t0 = now()
    const p = panNode(pan || 0)
    blip({type: 'sine', freq: 500, glideTo: 1900, t0, a: 0.005, hold: 0.02, r: 0.16, peak: 0.1, dest: p})
    noiseBurst(t0, {peak: 0.07, a: 0.01, r: 0.14, type: 'bandpass', cutoff: 800, sweepTo: 3200, q: 1.2, dest: p})
    disconnectLater(p, 500)
  }

  // Arcade: a ball hit the ground but you had a life. Splat + a short "uh-oh"
  // (not the full dirge), and the lives count is announced by the screen.
  function lifeLost(mass, pan) {
    const t0 = now()
    const p = panNode(pan)
    const f = pitch(mass)
    blip({type: 'sine', freq: f * 0.8, glideTo: f * 0.25, t0, a: 0.003, hold: 0.03, r: 0.3, peak: 0.34, dest: p})
    noiseBurst(t0, {peak: 0.22, a: 0.001, r: 0.2, type: 'lowpass', cutoff: 700, sweepTo: 150, dest: p})
    blip({type: 'triangle', freq: 392, t0: t0 + 0.3, a: 0.01, hold: 0.05, r: 0.2, peak: 0.16, lp: 2200})
    blip({type: 'triangle', freq: 311.13, t0: t0 + 0.5, a: 0.01, hold: 0.08, r: 0.3, peak: 0.16, lp: 2200})
    disconnectLater(p, 900)
  }

  // Active effects keep a soft presence so you know they are still on, and
  // each ends with a small cue.
  let fx = {slow: null, wide: null}
  function startEffectLoop(type) {
    const c = ctx()
    const t0 = c.currentTime
    if (type === 'slow') {
      // a slow, deep tock every second
      fx.slow = {next: t0 + 0.6, bus: null}
    } else if (type === 'wide') {
      const bus = c.createGain(); bus.gain.value = 0.0001; bus.connect(out())
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200
      const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = 392
      const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 587.33 * 1.002
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.8
      const lfod = c.createGain(); lfod.gain.value = 0.008
      lfo.connect(lfod).connect(bus.gain)
      o1.connect(lp); o2.connect(lp); lp.connect(bus)
      o1.start(t0); o2.start(t0); lfo.start(t0)
      bus.gain.setTargetAtTime(0.014, t0, 0.2)
      fx.wide = {bus, o1, o2, lfo, lfod, lp}
    }
  }
  function stopEffectLoop(type) {
    const e = fx[type]
    if (!e) return
    fx[type] = null
    if (type === 'wide') {
      const t0 = now()
      try { e.bus.gain.cancelScheduledValues(t0); e.bus.gain.setValueAtTime(e.bus.gain.value, t0); e.bus.gain.linearRampToValueAtTime(0.0001, t0 + 0.2) } catch (err) {}
      setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.lfo.stop(); e.bus.disconnect(); e.lfod.disconnect() } catch (err) {} }, 400)
    }
  }
  // Every frame with content.game.effects(): {slow, wide}.
  function updateEffects(active) {
    const t0 = now()
    for (const type of ['slow', 'wide']) {
      const on = !!(active && active[type])
      if (on && !fx[type]) startEffectLoop(type)
      else if (!on && fx[type]) stopEffectLoop(type)
    }
    if (fx.slow) {
      while (fx.slow.next < t0 + 0.09) {
        const when = Math.max(t0, fx.slow.next)
        blip({type: 'sine', freq: 160, glideTo: 120, t0: when, a: 0.003, hold: 0.02, r: 0.16, peak: 0.07})
        fx.slow.next = when + 1.0
      }
    }
  }
  function effectEnd(type) {
    const t0 = now()
    if (type === 'slow') {
      blip({type: 'sine', freq: 180, glideTo: 520, t0, a: 0.01, hold: 0.06, r: 0.3, peak: 0.16})
    } else if (type === 'wide') {
      blip({type: 'triangle', freq: 330, glideTo: 440, t0, a: 0.02, hold: 0.08, r: 0.25, peak: 0.12, lp: 2400})
      blip({type: 'triangle', freq: 587.33, glideTo: 440, t0, a: 0.02, hold: 0.08, r: 0.25, peak: 0.12, lp: 2400})
    }
  }

  // ========================================================================
  //  MENU / UI CUES
  // ========================================================================
  function menuMove() { noiseBurst(now(), {peak: 0.12, a: 0.001, r: 0.03, type: 'lowpass', cutoff: 2600}) }
  function menuSelect() { blip({type: 'sine', freq: 520, glideTo: 780, t0: now(), a: 0.004, hold: 0.02, r: 0.12, peak: 0.24}) }
  function menuBack() { blip({type: 'sine', freq: 480, glideTo: 300, t0: now(), a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ========================================================================
  //  LIFECYCLE
  // ========================================================================
  function silenceAll() {
    clearVoices()
    stopHum()
    stopAmbience()
    stopDemo()
    stopPowerupVoice()
    stopEffectLoop('slow')
    stopEffectLoop('wide')
  }
  function setStaticListener() {} // no-op: stereo model, no listener to park

  // ========================================================================
  //  DIAGNOSTICS + LEARN SAMPLES
  // ========================================================================
  function testDirection(which) {
    function tone(pan, freq) {
      const p = panNode(pan)
      blip({type: 'triangle', freq, t0: now(), a: 0.005, hold: 0.14, r: 0.2, peak: 0.4, dest: p, lp: 3000})
      blip({type: 'sine', freq: freq * 2, t0: now(), a: 0.005, hold: 0.05, r: 0.14, peak: 0.12, dest: p})
      click(now(), p, 0.06)
      disconnectLater(p, 600)
    }
    switch (which) {
      case 'left': tone(-1, 440); break
      case 'center': tone(0, 440); break
      case 'right': tone(1, 440); break
      case 'small': tone(0, pitch(1)); break
      case 'big': tone(0, pitch(10)); break
      case 'sweep': [-1, -0.5, 0, 0.5, 1].forEach((pn, i) => setTimeout(() => tone(pn, 440), i * 320)); break
    }
  }

  // A self-contained falling-ball demo: drives the real voice path with a
  // synthetic descent so the learn screen teaches the exact in-game sound.
  let demo = null
  function stopDemo() {
    if (!demo) return
    clearInterval(demo.timer)
    demo = null
    clearVoices()
    stopPowerupVoice()
  }
  function demoFall({mass = 1, pan = 0, aligned = false, seconds = 2.6}) {
    stopDemo()
    const C = cfg()
    const g = C.ballGravity(mass)
    const r = C.ballRadius(mass)
    const y0 = C.SPAWN_Y
    const id = -1000 - mass
    let t = 0
    const dt = 1 / 30
    spawn(mass, pan, false)
    demo = {timer: setInterval(() => {
      t += dt
      const y = y0 - 0.5 * g * t * t
      const vy = -g * t
      const h = (y - r) - C.CATCH_Y
      const tb = h <= 0 ? 0 : (vy + Math.sqrt(vy * vy + 2 * g * h)) / g
      if (y - r <= C.CATCH_Y || t > seconds) {
        stopDemo()
        if (aligned) catchBall(mass, 1)
        return
      }
      updateBalls([{
        id, mass, r, x: 0, y, vx: 0, vy, kind: 'falling', dx: aligned ? 0 : pan * 4,
        aligned, centred: aligned ? 1 : 0, pan, alt: clamp((y - r) / C.SPAWN_Y, 0, 1), tBand: tb,
      }])
    }, dt * 1000)}
  }
  function demoHeld(mass, inRange) {
    stopDemo()
    updateHeld(mass, false)
    if (inRange) setTimeout(() => { if (hum) updateHeld(mass, true) }, 500)
    setTimeout(() => { stopHum() }, 2200)
  }
  // A power-up hanging for ~2.5 s (lowering, then hurried), then collected.
  function demoPowerup(type) {
    stopDemo()
    const id = -2000
    let t = 0
    const dt = 1 / 30
    const life = 2.6
    demo = {timer: setInterval(() => {
      t += dt
      if (t >= life) {
        stopDemo()
        powerupCollect(type)
        if (type === 'slow' || type === 'wide') {
          updateEffects({[type]: true})
          setTimeout(() => { updateEffects({}); effectEnd(type) }, 2600)
        }
        return
      }
      updatePowerup({id, type, pan: 0.4, alt: 1 - t / life, ttl: life - t, urgency: clamp(1 - (life - t) / 1.2, 0, 1)})
    }, dt * 1000)}
  }

  return {
    // frame-driven
    updateBalls, updateHeld, updatePowerup, updateEffects, setAmbienceIntensity,
    // one-shots
    spawn, catchBall, throwBall, throwEmpty, merge, wall, edge, step, drop,
    roundStart, roundClear, win,
    powerupCollect, powerupGone, lifeLost, effectEnd,
    // lifecycle
    startAmbience, stopAmbience, silenceAll, setStaticListener, clearVoices, stopHum,
    // ui
    menuMove, menuSelect, menuBack,
    // diagnostics / learn
    testDirection, demoFall, demoHeld, demoPowerup, stopDemo,
  }
})()
