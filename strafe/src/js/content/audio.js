// STRAFE audio: modern, realistic synth voices in a SIDE-VIEW stereo field. The
// front is to your right and never rotates: a foe far ahead sits in your right
// ear and slides to centre as it reaches you (PAN = distance). Lane is PITCH —
// ground foes growl low, air foes whine high — and a lobbed shell has its own
// wobbling whistle so you know to DUCK, not shoot.
content.audio = (() => {
  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  function later(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts = pendingTimeouts.filter((x) => x !== id)
      try { fn() } catch (e) {}
    }, ms)
    pendingTimeouts.push(id)
    return id
  }

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

  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }
  function voice({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.5, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    env(g.gain, t0, {a, hold, r, peak})
    o.connect(g).connect(dest || out())
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.05)
    return {o, g}
  }
  function clickNoise(t0, {peak = 0.3, dur = 0.05, cutoff = 3000, hp = 0, dest} = {}) {
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'; lp.frequency.value = cutoff
    let head = lp
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; s.connect(h).connect(lp) } else s.connect(lp)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  // stereo place by distance x (1 = far ahead -> right; 0 = on you -> centre)
  function panAt(x, build) {
    const c = ctx()
    const t0 = c.currentTime
    const panner = c.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, x))
    const g = c.createGain()
    g.gain.value = 0.35 + (1 - Math.max(0, Math.min(1, x))) * 0.65
    g.connect(panner).connect(out())
    const dur = build(g, t0) || 0.3
    later(() => { try { g.disconnect(); panner.disconnect() } catch (e) {} }, (dur + 0.3) * 1000)
  }

  // ---- enemy approach blip: pan by distance, pitch by lane ----
  function enemyBlip(lane, x) {
    panAt(x, (dest, t0) => {
      if (lane === 'air') {
        voice({type: 'square', freq: 560, t0, a: 0.002, hold: 0.02, r: 0.05, peak: 0.34, dest})
        voice({type: 'sine', freq: 1120, t0, a: 0.002, hold: 0.01, r: 0.04, peak: 0.12, dest})
      } else {
        voice({type: 'sawtooth', freq: 170, t0, a: 0.003, hold: 0.03, r: 0.07, peak: 0.4, dest})
        voice({type: 'sine', freq: 90, t0, a: 0.003, hold: 0.02, r: 0.06, peak: 0.2, dest})
      }
      return 0.12
    })
  }

  // ---- shell: a wobbling lobbed whistle — DUCK, don't shoot ----
  function shellBlip(x) {
    panAt(x, (dest, t0) => {
      const c = ctx()
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.setValueAtTime(700, t0)
      const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 9
      const lg = c.createGain(); lg.gain.value = 90
      lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + 0.18)
      const g = c.createGain(); env(g.gain, t0, {a: 0.004, hold: 0.04, r: 0.1, peak: 0.3})
      o.connect(g).connect(dest); o.start(t0); o.stop(t0 + 0.22)
      return 0.2
    })
  }

  // ---- your gun ----
  function fire(lane) {
    const t0 = ctx().currentTime
    const c = ctx()
    const s = noiseSource()
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = lane === 'air' ? 1400 : 700
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(lane === 'air' ? 6000 : 3500, t0); lp.frequency.exponentialRampToValueAtTime(800, t0 + 0.08)
    const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0.005, r: 0.07, peak: 0.42})
    s.connect(hp).connect(lp).connect(g).connect(out())
    s.start(t0); s.stop(t0 + 0.12)
    voice({type: 'square', freq: lane === 'air' ? 420 : 200, glideTo: lane === 'air' ? 260 : 120, t0, a: 0.001, hold: 0.01, r: 0.06, peak: 0.18})
    later(() => { try { g.disconnect() } catch (e) {} }, 220)
  }
  function fireMiss() { clickNoise(ctx().currentTime, {peak: 0.12, dur: 0.04, cutoff: 1200, hp: 400}) }

  function kill(lane, x) {
    panAt(x, (dest, t0) => {
      const c = ctx()
      voice({type: 'sine', freq: lane === 'air' ? 360 : 150, glideTo: lane === 'air' ? 120 : 50, t0, a: 0.001, hold: 0.02, r: 0.2, peak: 0.5, dest})
      const s = noiseSource(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t0); lp.frequency.exponentialRampToValueAtTime(300, t0 + 0.18)
      const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0.02, r: 0.18, peak: 0.4})
      s.connect(lp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.26)
      later(() => { try { g.disconnect() } catch (e) {} }, 380)
      return 0.26
    })
  }

  function duck() {
    const t0 = ctx().currentTime
    const c = ctx()
    const s = noiseSource(); const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.5; bp.frequency.setValueAtTime(1400, t0); bp.frequency.exponentialRampToValueAtTime(400, t0 + 0.3)
    const g = c.createGain(); env(g.gain, t0, {a: 0.006, hold: 0.04, r: 0.26, peak: 0.26})
    s.connect(bp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.4)
    later(() => { try { g.disconnect() } catch (e) {} }, 520)
  }
  function shellDodged() {
    const t0 = ctx().currentTime
    voice({type: 'triangle', freq: 700, glideTo: 1600, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.2}) // it whistles over
  }
  function hit(cause) {
    const t0 = ctx().currentTime
    voice({type: 'sine', freq: cause === 'shell' ? 120 : 160, glideTo: 45, t0, a: 0.002, hold: 0.05, r: 0.5, peak: 0.8})
    voice({type: 'sawtooth', freq: 200, t0, a: 0.004, hold: 0.05, r: 0.3, peak: 0.3})
    const s = noiseSource(); const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2000, t0); lp.frequency.exponentialRampToValueAtTime(200, t0 + 0.4)
    const g = ctx().createGain(); env(g.gain, t0, {a: 0.002, hold: 0.05, r: 0.4, peak: 0.4})
    s.connect(lp).connect(g).connect(out()); s.start(t0); s.stop(t0 + 0.6)
    later(() => { try { g.disconnect() } catch (e) {} }, 800)
  }

  function comboTone() { const t0 = ctx().currentTime; voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.24}); voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.12}) }
  function waveClear() { const t0 = ctx().currentTime; const notes = [392, 523, 659, 784]; notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.01, hold: 0.06, r: 0.3, peak: 0.3}); voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.1, a: 0.01, hold: 0.03, r: 0.18, peak: 0.1}) }) }
  function waveStart() { const t0 = ctx().currentTime; voice({type: 'sawtooth', freq: 200, glideTo: 280, t0, a: 0.01, hold: 0.06, r: 0.16, peak: 0.2}); voice({type: 'sine', freq: 560, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.16, peak: 0.16}) }
  function runStart() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 330, glideTo: 494, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28}); voice({type: 'sine', freq: 494, t0: t0 + 0.12, a: 0.01, hold: 0.05, r: 0.2, peak: 0.22}) }
  function gameOver() { const t0 = ctx().currentTime; const notes = [294, 247, 196, 147]; notes.forEach((f, i) => { voice({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3}); voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16}) }) }
  function menuMove() { clickNoise(ctx().currentTime, {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { const t0 = ctx().currentTime; voice({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- battlefield ambient bed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320
    const ng = c.createGain(); ng.gain.value = 0.035
    s.connect(lp).connect(ng).connect(out()); s.start()
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.11
    const lg = c.createGain(); lg.gain.value = 0.018
    lfo.connect(lg).connect(ng.gain); lfo.start()
    ambient = {s, ng, lp, lfo, lg}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime; const a = ambient
    try { a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(0.035, t0); a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3); later(() => { try { a.s.stop(); a.lfo.stop(); a.ng.disconnect() } catch (e) {} }, 400) } catch (e) {}
    ambient = null
  }
  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  function sample(which) {
    switch (which) {
      case 'ground': enemyBlip('ground', 0.5); break
      case 'air': enemyBlip('air', 0.5); break
      case 'shell': shellBlip(0.4); break
      case 'fireGround': fire('ground'); break
      case 'fireAir': fire('air'); break
      case 'kill': kill('ground', 0.3); break
      case 'duck': duck(); break
      case 'dodge': shellDodged(); break
      case 'hit': hit('leak'); break
      case 'wave': waveClear(); break
      case 'over': gameOver(); break
    }
  }
  function testDirection(which) {
    // far / mid / near demonstrate the pan-by-distance mapping
    const m = {n: 0.1, e: 1.0, s: 0.5, w: 0.0}
    if (which === 'ring') { [1.0, 0.66, 0.33, 0.0].forEach((x, i) => later(() => enemyBlip('ground', x), i * 420)) }
    else if (m[which] != null) enemyBlip(which === 'air' ? 'air' : 'ground', m[which])
  }

  return {
    enemyBlip, shellBlip, fire, fireMiss, kill, duck, shellDodged, hit,
    comboTone, waveClear, waveStart, runStart, gameOver,
    menuMove, menuSelect, menuBack,
    startAmbient, stopAmbient, silenceAll,
    sample, testDirection,
    setStaticListener: () => {},
  }
})()
