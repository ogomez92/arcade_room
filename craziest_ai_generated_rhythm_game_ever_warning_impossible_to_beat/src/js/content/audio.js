// CADENCE audio — modern, punchy synth voices in a STEREO (non-spatial) field.
// This is a player-relative side-scroller: a foe on your left is hard-left in
// the headphones, a foe on your right is hard-right, hazards are dead-centre.
// No binaural / no listener pose — just StereoPannerNode + pitch + timbre.
//
// Telegraph cues accept a `when` (an absolute audio-clock time) so the game loop
// can schedule them a beat or two ahead, jitter-free. Action cues fire live on
// the player's keypress for tight response. Everything is layered UNDER the
// music bed so the threat vocabulary always reads on top.
content.audio = (() => {
  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function now() { return ctx().currentTime }

  function later(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts = pendingTimeouts.filter((x) => x !== id)
      try { fn() } catch (e) {}
    }, ms)
    pendingTimeouts.push(id)
    return id
  }

  // ---- shared noise ----
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

  // ---- envelope + voice helpers ----
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
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff
    let head = lp
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; s.connect(h).connect(lp) } else s.connect(lp)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    head.connect(g).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    const delay = Math.max(0, (t0 - now())) * 1000 + (dur + 0.2) * 1000
    later(() => { try { g.disconnect() } catch (e) {} }, delay)
  }

  // Stereo placement. pan -1 = hard left, +1 = hard right, 0 = centre. `when`
  // optional absolute start time (defaults to now).
  function panAt(pan, build, when) {
    const c = ctx()
    const t0 = when || c.currentTime
    const panner = c.createStereoPanner()
    panner.pan.value = Math.max(-1, Math.min(1, pan))
    const g = c.createGain()
    g.gain.value = 1
    g.connect(panner).connect(out())
    const dur = build(g, t0) || 0.3
    const delay = Math.max(0, (t0 - c.currentTime)) * 1000 + (dur + 0.3) * 1000
    later(() => { try { g.disconnect(); panner.disconnect() } catch (e) {} }, delay)
  }

  function sidePan(side) { return side === 'L' ? -0.92 : side === 'R' ? 0.92 : 0 }

  // ===========================================================================
  // TELEGRAPHS — scheduled ahead of the strike beat. `lead` = beats to strike
  // (2 = first warning/further, 1 = imminent/closer). Closer = louder + higher.
  // ===========================================================================
  function enemyWarn(side, type, lead, when) {
    const close = lead <= 1
    panAt(sidePan(side), (dest, t0) => {
      if (type === 'drone') {
        // bright pulsing whine — only ever one warning, so make it unmistakable
        voice({type: 'square', freq: close ? 760 : 600, glideTo: close ? 880 : 700, t0, a: 0.01, hold: 0.06, r: 0.12, peak: 0.26, dest})
        voice({type: 'sine', freq: 1520, t0, a: 0.01, hold: 0.03, r: 0.08, peak: 0.08, dest})
        return 0.22
      }
      // grunt — a low approaching growl, rising as it nears
      const f = close ? 250 : 185
      voice({type: 'sawtooth', freq: f, glideTo: f * 1.12, t0, a: 0.012, hold: 0.05, r: 0.12, peak: close ? 0.32 : 0.22, dest})
      voice({type: 'sine', freq: f / 2, t0, a: 0.012, hold: 0.03, r: 0.1, peak: 0.12, dest})
      return 0.22
    }, when)
  }

  function hurdleWarn(lead, when) {
    const close = lead <= 1
    panAt(0, (dest, t0) => {
      // A crisp bright transient marks the EXACT beat of the warning — a pure
      // low rumble is hard to time against the kick, so this gives a sharp
      // temporal handle (louder on the imminent, one-beat-out warning).
      clickNoise(t0, {peak: close ? 0.28 : 0.16, dur: 0.035, cutoff: 6500, hp: 2400, dest})
      // A low rolling rumble dead ahead — "something to vault". The imminent
      // one rises in pitch, pulling you to jump on the next beat.
      const s = noiseSource()
      const lp = ctx().createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = close ? 380 : 240
      const g = ctx().createGain()
      env(g.gain, t0, {a: 0.004, hold: 0.05, r: 0.14, peak: close ? 0.34 : 0.22})
      s.connect(lp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.24)
      voice({type: 'sine', freq: close ? 124 : 96, glideTo: close ? 168 : 104, t0, a: 0.004, hold: 0.04, r: 0.12, peak: 0.26, dest})
      return 0.24
    }, when)
  }

  function beamWarn(lead, when) {
    const close = lead <= 1
    panAt(0, (dest, t0) => {
      // A crisp transient marks the exact beat (same timing-handle idea as the
      // hurdle), then an airy overhead whir dead ahead — "something to duck".
      clickNoise(t0, {peak: close ? 0.18 : 0.11, dur: 0.03, cutoff: 9000, hp: 4200, dest})
      voice({type: 'triangle', freq: close ? 1450 : 1180, glideTo: close ? 1950 : 1380, t0, a: 0.004, hold: 0.05, r: 0.12, peak: close ? 0.24 : 0.16, dest})
      voice({type: 'sine', freq: close ? 2400 : 2000, t0, a: 0.004, hold: 0.02, r: 0.08, peak: 0.07, dest})
      return 0.2
    }, when)
  }

  // ===========================================================================
  // PLAYER ACTIONS — fire live on the keypress.
  // ===========================================================================
  function shoot(side, perfect) {
    panAt(sidePan(side), (dest, t0) => {
      const c = ctx()
      // muzzle crack
      const s = noiseSource()
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5200, t0); lp.frequency.exponentialRampToValueAtTime(800, t0 + 0.08)
      const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0.004, r: 0.07, peak: 0.42})
      s.connect(hp).connect(lp).connect(g).connect(dest)
      s.start(t0); s.stop(t0 + 0.12)
      // zap + a downward enemy-pop
      voice({type: 'square', freq: 520, glideTo: 180, t0, a: 0.001, hold: 0.01, r: 0.08, peak: 0.22, dest})
      voice({type: 'sine', freq: 220, glideTo: 70, t0: t0 + 0.02, a: 0.001, hold: 0.02, r: 0.14, peak: 0.3, dest})
      if (perfect) voice({type: 'triangle', freq: 1320, t0: t0 + 0.01, a: 0.002, hold: 0.01, r: 0.08, peak: 0.12, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 220)
      return 0.18
    })
  }

  function jump(perfect) {
    panAt(0, (dest, t0) => {
      // upward whoosh
      const s = noiseSource()
      const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2
      bp.frequency.setValueAtTime(500, t0); bp.frequency.exponentialRampToValueAtTime(2600, t0 + 0.18)
      const g = ctx().createGain(); env(g.gain, t0, {a: 0.004, hold: 0.02, r: 0.14, peak: 0.3})
      s.connect(bp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.22)
      voice({type: 'sine', freq: 300, glideTo: 720, t0, a: 0.003, hold: 0.02, r: 0.12, peak: 0.22, dest})
      if (perfect) voice({type: 'triangle', freq: 1500, t0: t0 + 0.02, a: 0.002, hold: 0.01, r: 0.07, peak: 0.1, dest})
      return 0.22
    })
  }

  function duck(perfect) {
    panAt(0, (dest, t0) => {
      // downward swoop / cloth
      const s = noiseSource()
      const bp = ctx().createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.0
      bp.frequency.setValueAtTime(2200, t0); bp.frequency.exponentialRampToValueAtTime(420, t0 + 0.18)
      const g = ctx().createGain(); env(g.gain, t0, {a: 0.004, hold: 0.02, r: 0.14, peak: 0.28})
      s.connect(bp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.22)
      voice({type: 'sine', freq: 520, glideTo: 180, t0, a: 0.003, hold: 0.02, r: 0.12, peak: 0.2, dest})
      if (perfect) voice({type: 'triangle', freq: 1320, t0: t0 + 0.02, a: 0.002, hold: 0.01, r: 0.07, peak: 0.1, dest})
      return 0.22
    })
  }

  function step(perfect) {
    panAt(0, (dest, t0) => {
      clickNoise(t0, {peak: perfect ? 0.16 : 0.11, dur: 0.05, cutoff: 700, hp: 120, dest})
      voice({type: 'sine', freq: 150, glideTo: 90, t0, a: 0.001, hold: 0.008, r: 0.06, peak: perfect ? 0.2 : 0.14, dest})
      return 0.1
    })
  }

  // ===========================================================================
  // MISSES — the threat lands on you / you fumble.
  // ===========================================================================
  function strikeEnemy(side) {
    panAt(sidePan(side), (dest, t0) => {
      const c = ctx()
      voice({type: 'sawtooth', freq: 160, glideTo: 60, t0, a: 0.002, hold: 0.04, r: 0.22, peak: 0.5, dest})
      const s = noiseSource(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'
      lp.frequency.setValueAtTime(2400, t0); lp.frequency.exponentialRampToValueAtTime(260, t0 + 0.22)
      const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0.03, r: 0.22, peak: 0.45})
      s.connect(lp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.3)
      later(() => { try { g.disconnect() } catch (e) {} }, 420)
      return 0.3
    })
  }

  function trip() {
    panAt(0, (dest, t0) => {
      const c = ctx()
      const s = noiseSource(); const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500
      const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0.04, r: 0.2, peak: 0.5})
      s.connect(lp).connect(g).connect(dest); s.start(t0); s.stop(t0 + 0.28)
      voice({type: 'sine', freq: 130, glideTo: 50, t0, a: 0.001, hold: 0.03, r: 0.2, peak: 0.42, dest})
      later(() => { try { g.disconnect() } catch (e) {} }, 360)
      return 0.26
    })
  }

  function bonk() {
    panAt(0, (dest, t0) => {
      voice({type: 'square', freq: 300, glideTo: 120, t0, a: 0.001, hold: 0.03, r: 0.18, peak: 0.4, dest})
      voice({type: 'sine', freq: 90, t0, a: 0.001, hold: 0.03, r: 0.16, peak: 0.3, dest})
      return 0.22
    })
  }

  function stumble() {
    panAt(0, (dest, t0) => {
      clickNoise(t0, {peak: 0.22, dur: 0.07, cutoff: 380, dest})
      voice({type: 'sine', freq: 110, glideTo: 60, t0, a: 0.001, hold: 0.01, r: 0.08, peak: 0.22, dest})
      return 0.12
    })
  }

  function offbeat() {
    const t0 = now()
    // a short dissonant buzz — "that was off the beat"
    voice({type: 'sawtooth', freq: 140, t0, a: 0.002, hold: 0.05, r: 0.08, peak: 0.22})
    voice({type: 'sawtooth', freq: 149, t0, a: 0.002, hold: 0.05, r: 0.08, peak: 0.2})
  }

  function misfire() {
    const t0 = now()
    clickNoise(t0, {peak: 0.12, dur: 0.04, cutoff: 1400, hp: 500})
  }

  // ===========================================================================
  // STINGS
  // ===========================================================================
  function countTick(n, downbeat, when) {
    const t0 = when || now()
    const f = downbeat ? 880 : 440 + (4 - n) * 60
    voice({type: 'triangle', freq: f, t0, a: 0.003, hold: 0.03, r: downbeat ? 0.2 : 0.1, peak: downbeat ? 0.34 : 0.24})
    if (downbeat) voice({type: 'sine', freq: f * 2, t0, a: 0.003, hold: 0.02, r: 0.12, peak: 0.12})
  }

  function comboTone() {
    const t0 = now()
    voice({type: 'triangle', freq: 660, glideTo: 990, t0, a: 0.004, hold: 0.03, r: 0.18, peak: 0.24})
    voice({type: 'sine', freq: 1320, t0: t0 + 0.04, a: 0.004, hold: 0.02, r: 0.12, peak: 0.12})
  }

  function levelClear() {
    const t0 = now()
    const notes = [523, 659, 784, 1047, 1319]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.11, a: 0.006, hold: 0.06, r: 0.3, peak: 0.3})
      voice({type: 'sine', freq: f * 2, t0: t0 + i * 0.11, a: 0.006, hold: 0.02, r: 0.16, peak: 0.1})
    })
  }

  function lifeLost() {
    const t0 = now()
    voice({type: 'sawtooth', freq: 300, glideTo: 120, t0, a: 0.004, hold: 0.06, r: 0.4, peak: 0.4})
    voice({type: 'sine', freq: 150, glideTo: 60, t0, a: 0.004, hold: 0.06, r: 0.4, peak: 0.3})
  }

  function gameOver() {
    const t0 = now()
    const notes = [330, 277, 233, 165]
    notes.forEach((f, i) => {
      voice({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.7, peak: 0.32})
      voice({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.7, peak: 0.18})
    })
  }

  function victory() {
    const t0 = now()
    // a rising resolved cadence, then a held major chord = "silence achieved"
    const lead = [392, 523, 659, 784, 1047]
    lead.forEach((f, i) => voice({type: 'triangle', freq: f, t0: t0 + i * 0.16, a: 0.006, hold: 0.06, r: 0.3, peak: 0.3}))
    const chord = [523, 659, 784, 1047]
    chord.forEach((f) => voice({type: 'sawtooth', freq: f, t0: t0 + 0.9, a: 0.05, hold: 0.6, r: 1.2, peak: 0.16}))
  }

  // ---- menu cues ----
  function menuMove() { clickNoise(now(), {peak: 0.16, dur: 0.03, cutoff: 2600}) }
  function menuSelect() { voice({type: 'sine', freq: 520, glideTo: 780, t0: now(), a: 0.004, hold: 0.02, r: 0.12, peak: 0.26}) }
  function menuBack() { voice({type: 'sine', freq: 480, glideTo: 300, t0: now(), a: 0.004, hold: 0.02, r: 0.12, peak: 0.22}) }

  // ---- ambient (very soft, optional) ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const s = noiseSource()
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 300; bp.Q.value = 0.5
    const ng = c.createGain(); ng.gain.value = 0.012
    s.connect(bp).connect(ng).connect(out())
    s.start()
    ambient = {s, ng}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = now(); const a = ambient
    try {
      a.ng.gain.cancelScheduledValues(t0); a.ng.gain.setValueAtTime(a.ng.gain.value, t0)
      a.ng.gain.linearRampToValueAtTime(0.0001, t0 + 0.3)
      later(() => { try { a.s.stop(); a.ng.disconnect() } catch (e) {} }, 400)
    } catch (e) {}
    ambient = null
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    stopAmbient()
  }

  // ===========================================================================
  // diagnostics — learn samples + stereo test
  // ===========================================================================
  function sample(which) {
    switch (which) {
      case 'step': step(true); break
      case 'enemyL': enemyWarn('L', 'grunt', 2); later(() => enemyWarn('L', 'grunt', 1), 360); later(() => shoot('L', true), 720); break
      case 'enemyR': enemyWarn('R', 'grunt', 2); later(() => enemyWarn('R', 'grunt', 1), 360); later(() => shoot('R', true), 720); break
      case 'drone': enemyWarn('R', 'drone', 1); later(() => shoot('R', true), 360); break
      case 'hurdle': hurdleWarn(2); later(() => hurdleWarn(1), 360); later(() => jump(true), 720); break
      case 'beam': beamWarn(2); later(() => beamWarn(1), 360); later(() => duck(true), 720); break
      // syncopation demo: steps on the beat (0/500/1000 ms), one foe landing on
      // the OFF-beat (the "and", at 750) — hit it between the steps.
      case 'synco':
        step(true)
        later(() => enemyWarn('R', 'grunt', 1), 250)
        later(() => step(true), 500)
        later(() => shoot('R', true), 750)
        later(() => step(true), 1000)
        break
      case 'shoot': shoot('L', false); break
      case 'jump': jump(false); break
      case 'duck': duck(false); break
      case 'strike': strikeEnemy('L'); break
      case 'trip': trip(); break
      case 'bonk': bonk(); break
      case 'stumble': stumble(); break
      case 'offbeat': offbeat(); break
      case 'combo': comboTone(); break
      case 'clear': levelClear(); break
      case 'over': gameOver(); break
      case 'win': victory(); break
    }
  }

  function testStereo(which) {
    if (which === 'l') panAt(-0.92, (d, t0) => { voice({type: 'sine', freq: 523, t0, a: 0.005, hold: 0.16, r: 0.2, peak: 0.5, dest: d}); return 0.4 })
    else if (which === 'r') panAt(0.92, (d, t0) => { voice({type: 'sine', freq: 523, t0, a: 0.005, hold: 0.16, r: 0.2, peak: 0.5, dest: d}); return 0.4 })
    else if (which === 'c') panAt(0, (d, t0) => { voice({type: 'sine', freq: 523, t0, a: 0.005, hold: 0.16, r: 0.2, peak: 0.5, dest: d}); return 0.4 })
    else if (which === 'sweep') { testStereo('l'); later(() => testStereo('c'), 500); later(() => testStereo('r'), 1000) }
  }

  return {
    // telegraphs
    enemyWarn, hurdleWarn, beamWarn,
    // actions
    shoot, jump, duck, step,
    // misses
    strikeEnemy, trip, bonk, stumble, offbeat, misfire,
    // stings
    countTick, comboTone, levelClear, lifeLost, gameOver, victory,
    // menu
    menuMove, menuSelect, menuBack,
    // lifecycle
    startAmbient, stopAmbient, silenceAll,
    // diagnostics
    sample, testStereo,
  }
})()
