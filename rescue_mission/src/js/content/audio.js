// AIRLIFT audio: modern, realistic synth voices over a SIDE-VIEW, NON-ROTATING
// stereo field. No binaural head — the listener rides the chopper and every source
// is carried by stereo PAN (its x relative to you: left stays left, right stays
// right) and by PITCH/timbre (survivor beacons warm and mid, tanks low, the base a
// homing tone off to your left). A pulsing rotor bed runs underneath.
content.audio = (() => {
  const PAN_SCALE = 28
  let ambient = null
  let pendingTimeouts = []

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }

  function later(fn, ms) {
    const id = setTimeout(() => { pendingTimeouts = pendingTimeouts.filter((x) => x !== id); try { fn() } catch (e) {} }, ms)
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
  function noiseSource() { const s = ctx().createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; return s }

  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.linearRampToValueAtTime(0.0001, t0 + a + hold + r)
  }
  function panNode(dx) { const p = ctx().createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, dx / PAN_SCALE)); return p }

  function tone({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.4, pan = 0, detune = 0, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    if (detune) o.detune.value = detune
    env(g.gain, t0, {a, hold, r, peak})
    const p = (typeof pan === 'object') ? pan : panNode(pan)
    o.connect(g).connect(p).connect(dest || out())
    o.start(t0); o.stop(t0 + a + hold + r + 0.05)
    return {o, g}
  }
  function noiseBurst({t0, peak = 0.3, dur = 0.06, cutoff = 3000, hp = 0, pan = 0, sweepTo, dest}) {
    const c = ctx()
    const s = noiseSource()
    let head = s
    if (hp) { const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; head.connect(h); head = h }
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t0)
    if (sweepTo) lp.frequency.exponentialRampToValueAtTime(Math.max(120, sweepTo), t0 + dur)
    head.connect(lp)
    const g = c.createGain(); env(g.gain, t0, {a: 0.001, hold: 0, r: dur, peak})
    lp.connect(g).connect(panNode(pan)).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  function near(dx) { return Math.max(0, 1 - Math.abs(dx) / PAN_SCALE) }

  // ---- a stranded survivor waving (screen drives cadence; brighter when over them) ----
  function survivor(dx) {
    const t0 = ctx().currentTime
    const n = near(dx)
    tone({type: 'triangle', freq: 540 + n * 220, t0, a: 0.005, hold: 0.05, r: 0.12, peak: 0.16 + n * 0.28, pan: dx})
    tone({type: 'sine', freq: (540 + n * 220) * 1.5, t0, a: 0.005, hold: 0.02, r: 0.06, peak: 0.05 + n * 0.06, pan: dx})
  }
  // ---- the base, homing you home; more insistent when you're carrying ----
  function base(dx, carrying) {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: carrying ? 300 : 220, t0, a: 0.01, hold: 0.07, r: 0.16, peak: carrying ? 0.24 : 0.14, pan: dx})
    if (carrying) tone({type: 'sine', freq: 450, t0: t0 + 0.06, a: 0.005, hold: 0.03, r: 0.1, peak: 0.12, pan: dx})
  }
  function tankBlip(dx) {
    const t0 = ctx().currentTime
    const n = near(dx)
    tone({type: 'sawtooth', freq: 90, t0, a: 0.004, hold: 0.05, r: 0.1, peak: 0.12 + n * 0.2, pan: dx})
  }
  // rising aim telegraph — get off this column!
  function tankAim(dx) {
    const t0 = ctx().currentTime
    const o = ctx().createOscillator(); o.type = 'sawtooth'
    o.frequency.setValueAtTime(160, t0); o.frequency.linearRampToValueAtTime(420, t0 + 0.4)
    const g = ctx().createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.36); g.gain.linearRampToValueAtTime(0.0001, t0 + 0.5)
    o.connect(g).connect(panNode(dx)).connect(out()); o.start(t0); o.stop(t0 + 0.55)
  }
  function tankFire(dx) {
    const t0 = ctx().currentTime
    noiseBurst({t0, peak: 0.22, dur: 0.05, cutoff: 2200, hp: 400, pan: dx})
    // a shell climbing toward your altitude
    tone({type: 'triangle', freq: 300, glideTo: 760, t0, a: 0.003, hold: 0.02, r: K().RISE_TIME * 0.9, peak: 0.2, pan: dx})
  }
  function shellTop(dx) {
    const t0 = ctx().currentTime
    noiseBurst({t0, peak: 0.18 + near(dx) * 0.3, dur: 0.18, cutoff: 2600, sweepTo: 300, pan: dx})
  }
  function bombDrop() {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: 700, glideTo: 180, t0, a: 0.003, hold: 0.02, r: K().BOMB_FALL * 0.95, peak: 0.2, pan: 0})
  }
  function bombImpact(dx) {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: 150, glideTo: 45, t0, a: 0.001, hold: 0.03, r: 0.26, peak: 0.5, pan: dx})
    noiseBurst({t0, peak: 0.38, dur: 0.24, cutoff: 2600, sweepTo: 200, pan: dx})
  }
  function tankKilled(dx) {
    const t0 = ctx().currentTime
    tone({type: 'triangle', freq: 520, glideTo: 180, t0, a: 0.003, hold: 0.02, r: 0.18, peak: 0.22, pan: dx})
  }
  function hover(progress, dx) {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: 360 + progress * 360, t0, a: 0.002, hold: 0.02, r: 0.05, peak: 0.12, pan: dx})
  }
  function pickup() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 600, glideTo: 950, t0, a: 0.004, hold: 0.03, r: 0.14, peak: 0.3, pan: 0}) }
  function deliver(n) {
    const t0 = ctx().currentTime
    const notes = [523, 659, 784, 1047]
    for (let i = 0; i < Math.min(n + 1, 4); i++) tone({type: 'triangle', freq: notes[i], t0: t0 + i * 0.09, a: 0.006, hold: 0.05, r: 0.2, peak: 0.28, pan: 0})
  }
  function hurt() {
    const t0 = ctx().currentTime
    tone({type: 'sawtooth', freq: 260, glideTo: 50, t0, a: 0.002, hold: 0.07, r: 0.5, peak: 0.6, pan: 0})
    tone({type: 'sine', freq: 120, glideTo: 40, t0, a: 0.002, hold: 0.06, r: 0.5, peak: 0.4, pan: 0})
    noiseBurst({t0, peak: 0.45, dur: 0.45, cutoff: 2200, sweepTo: 150, pan: 0})
  }
  function respawn() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 320, glideTo: 480, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28, pan: 0}) }
  function waveClear() { const t0 = ctx().currentTime;[523, 659, 784, 1047].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.1, a: 0.008, hold: 0.06, r: 0.3, peak: 0.3, pan: 0})) }
  function waveStart() { const t0 = ctx().currentTime; tone({type: 'sawtooth', freq: 160, glideTo: 240, t0, a: 0.01, hold: 0.06, r: 0.18, peak: 0.2, pan: 0}) }
  function runStart() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 294, glideTo: 440, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28, pan: 0}) }
  function gameOver() { const t0 = ctx().currentTime;[294, 247, 196, 147].forEach((f, i) => { tone({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3, pan: 0}); tone({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16, pan: 0}) }) }
  function dud() { const t0 = ctx().currentTime; tone({type: 'square', freq: 150, glideTo: 90, t0, a: 0.001, hold: 0.01, r: 0.05, peak: 0.14, pan: 0}) }
  function menuMove() { noiseBurst({t0: ctx().currentTime, peak: 0.16, dur: 0.03, cutoff: 2600, pan: 0}) }
  function menuSelect() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26, pan: 0}) }
  function menuBack() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22, pan: 0}) }

  function K() { return content.constants }

  // ---- pulsing rotor bed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 64
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240
    const g = c.createGain(); g.gain.value = 0.0001
    o.connect(lp).connect(g).connect(out()); o.start()
    // whump-whump: gate the gain with an LFO
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 7
    const lg = c.createGain(); lg.gain.value = 0.03
    const base = c.createConstantSource(); base.offset.value = 0.04
    base.connect(g.gain); lfo.connect(lg).connect(g.gain); lfo.start(); base.start()
    ambient = {o, lp, g, lfo, lg, base}
  }
  function setSpeed(moving) {
    if (!ambient) return
    try { ambient.lfo.frequency.setTargetAtTime(moving ? 9.5 : 7, ctx().currentTime, 0.15) } catch (e) {}
  }
  function stopAmbient() {
    if (!ambient) return
    const a = ambient
    try { a.g.gain.setTargetAtTime(0.0001, ctx().currentTime, 0.1); later(() => { try { a.o.stop(); a.lfo.stop(); a.base.stop(); a.g.disconnect() } catch (e) {} }, 400) } catch (e) {}
    ambient = null
  }
  function silenceAll() { for (const id of pendingTimeouts) clearTimeout(id); pendingTimeouts = []; stopAmbient() }

  function sample(which) {
    switch (which) {
      case 'survivor': survivor(0); break
      case 'survivorR': survivor(20); break
      case 'base': base(-18, true); break
      case 'tank': tankBlip(0); break
      case 'tankAim': tankAim(0); break
      case 'tankFire': tankFire(0); break
      case 'shellTop': shellTop(0); break
      case 'bomb': bombDrop(); later(() => bombImpact(0), 400); break
      case 'pickup': pickup(); break
      case 'deliver': deliver(3); break
      case 'hurt': hurt(); break
      case 'over': gameOver(); break
    }
  }
  function testDirection(which) {
    const t0 = ctx().currentTime
    const map = {right: {pan: 24, f: 440}, left: {pan: -24, f: 440}, centre: {pan: 0, f: 440}}
    if (which === 'ring') { ['left', 'centre', 'right'].forEach((k, i) => later(() => { const m = map[k]; tone({type: 'sine', freq: m.f, t0: ctx().currentTime, a: 0.005, hold: 0.16, r: 0.2, peak: 0.45, pan: m.pan}) }, i * 460)) }
    else if (map[which]) tone({type: 'sine', freq: map[which].f, t0, a: 0.005, hold: 0.18, r: 0.22, peak: 0.45, pan: map[which].pan})
  }

  return {
    survivor, base, tankBlip, tankAim, tankFire, shellTop, bombDrop, bombImpact, tankKilled, hover,
    pickup, deliver, hurt, respawn, waveClear, waveStart, runStart, gameOver,
    dud, menuMove, menuSelect, menuBack,
    startAmbient, setSpeed, stopAmbient, silenceAll,
    sample, testDirection,
  }
})()
