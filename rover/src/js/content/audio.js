// ROVER audio: modern, realistic synth voices over a SIDE-VIEW, NON-ROTATING
// stereo field. There is no binaural head here — position is carried by stereo PAN
// (an obstacle far AHEAD sits to the right and slides toward centre as it nears
// the buggy) and by PITCH (ground hazards low, air hazards high). Each obstacle
// type has its own timbre so you can tell a crater from a rock from a UFO by ear.
content.audio = (() => {
  let ambient = null
  let pendingTimeouts = []
  const SPAWN_DIST = () => content.constants.SPAWN_DIST

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
  function panner(pan) { const p = ctx().createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); return p }

  // one stereo tone through a pan node
  function tone({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.4, pan = 0, detune = 0, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    if (detune) o.detune.value = detune
    env(g.gain, t0, {a, hold, r, peak})
    const p = panner(pan)
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
    lp.connect(g).connect(panner(pan)).connect(dest || out())
    s.start(t0); s.stop(t0 + dur + 0.05)
    later(() => { try { g.disconnect() } catch (e) {} }, (dur + 0.2) * 1000)
  }

  function panFor(dist) { return Math.max(0, Math.min(1, dist / SPAWN_DIST())) * 0.92 }
  function nearFor(dist) { return Math.max(0, 1 - dist / SPAWN_DIST()) }

  // ---- the hazard approach blip (screen drives cadence; faster + louder as it nears) ----
  function obstacle(type, dist) {
    const t0 = ctx().currentTime
    const pan = panFor(dist)
    const near = nearFor(dist)
    if (type === 'crater') {
      // hollow, low, airy — a gap in the ground
      tone({type: 'sine', freq: 150 - near * 30, t0, a: 0.004, hold: 0.05, r: 0.1, peak: 0.18 + near * 0.34, pan})
      noiseBurst({t0, peak: 0.05 + near * 0.08, dur: 0.08, cutoff: 400, pan})
    } else if (type === 'rock') {
      // solid, gritty, low-mid
      tone({type: 'sawtooth', freq: 230, t0, a: 0.003, hold: 0.04, r: 0.07, peak: 0.16 + near * 0.34, pan})
      tone({type: 'square', freq: 115, t0, a: 0.003, hold: 0.03, r: 0.05, peak: 0.08 + near * 0.16, pan})
    } else { // ufo — warbly, high
      const v = tone({type: 'triangle', freq: 620, t0, a: 0.004, hold: 0.06, r: 0.08, peak: 0.16 + near * 0.34, pan, detune: -18})
      try { const lfo = ctx().createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 22; const lg = ctx().createGain(); lg.gain.value = 40; lfo.connect(lg).connect(v.o.frequency); lfo.start(t0); lfo.stop(t0 + 0.18) } catch (e) {}
      tone({type: 'sine', freq: 1240, t0, a: 0.004, hold: 0.03, r: 0.05, peak: 0.06 + near * 0.1, pan})
    }
  }
  // a sharp "act now" tick when a hazard enters the action window
  function imminent(lane) {
    const t0 = ctx().currentTime
    tone({type: 'square', freq: lane === 'air' ? 880 : 330, t0, a: 0.001, hold: 0.015, r: 0.04, peak: 0.24, pan: 0})
  }

  function jump() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 240, glideTo: 600, t0, a: 0.005, hold: 0.04, r: 0.16, peak: 0.34, pan: 0}); noiseBurst({t0, peak: 0.1, dur: 0.12, cutoff: 1800, hp: 400, sweepTo: 600, pan: 0}) }
  function land() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 160, glideTo: 70, t0, a: 0.002, hold: 0.02, r: 0.1, peak: 0.3, pan: 0}); noiseBurst({t0, peak: 0.16, dur: 0.08, cutoff: 700, pan: 0}) }
  function shot(dir) {
    const t0 = ctx().currentTime
    noiseBurst({t0, peak: 0.3, dur: 0.06, cutoff: 4000, hp: 700, sweepTo: 900, pan: 0})
    tone({type: 'square', freq: dir === 'up' ? 520 : 300, glideTo: dir === 'up' ? 260 : 150, t0, a: 0.001, hold: 0.01, r: 0.06, peak: 0.2, pan: 0})
  }
  function miss() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 200, glideTo: 150, t0, a: 0.001, hold: 0.005, r: 0.05, peak: 0.1, pan: 0}) }
  function kill(type, dist) {
    const t0 = ctx().currentTime
    const pan = panFor(dist)
    tone({type: 'sine', freq: type === 'ufo' ? 300 : 180, glideTo: 50, t0, a: 0.001, hold: 0.03, r: 0.28, peak: 0.55, pan})
    noiseBurst({t0, peak: 0.4, dur: 0.26, cutoff: 3000, sweepTo: 250, pan})
  }
  function cleared() { const t0 = ctx().currentTime; tone({type: 'triangle', freq: 520, glideTo: 760, t0, a: 0.003, hold: 0.02, r: 0.1, peak: 0.16, pan: 0}) }
  function crash() {
    const t0 = ctx().currentTime
    tone({type: 'sawtooth', freq: 200, glideTo: 45, t0, a: 0.002, hold: 0.08, r: 0.5, peak: 0.6, pan: 0})
    tone({type: 'sine', freq: 100, glideTo: 35, t0, a: 0.002, hold: 0.07, r: 0.5, peak: 0.4, pan: 0})
    noiseBurst({t0, peak: 0.5, dur: 0.5, cutoff: 2400, sweepTo: 150, pan: 0})
  }
  function tierUp() { const t0 = ctx().currentTime; [392, 523, 659].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.08, a: 0.008, hold: 0.05, r: 0.18, peak: 0.24, pan: 0})) }
  function runStart() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 330, glideTo: 494, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28, pan: 0}) }
  function gameOver() { const t0 = ctx().currentTime; [294, 247, 196, 147].forEach((f, i) => { tone({type: 'triangle', freq: f, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.3, pan: 0}); tone({type: 'sine', freq: f / 2, t0: t0 + i * 0.24, a: 0.02, hold: 0.1, r: 0.6, peak: 0.16, pan: 0}) }) }
  function menuMove() { const t0 = ctx().currentTime; noiseBurst({t0, peak: 0.16, dur: 0.03, cutoff: 2600, pan: 0}) }
  function menuSelect() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26, pan: 0}) }
  function menuBack() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22, pan: 0}) }

  // ---- continuous engine rumble: pitch + grit rise with scroll speed ----
  function startAmbient() {
    if (ambient) return
    const c = ctx()
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 58
    const olp = c.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 220
    const og = c.createGain(); og.gain.value = 0.05
    o.connect(olp).connect(og).connect(out()); o.start()
    const s = noiseSource(); const nlp = c.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 300
    const ng = c.createGain(); ng.gain.value = 0.03
    s.connect(nlp).connect(ng).connect(out()); s.start()
    ambient = {o, olp, og, s, nlp, ng}
  }
  function setSpeed(speed) {
    if (!ambient) return
    const f = 50 + speed * 1.4
    try { ambient.o.frequency.setTargetAtTime(f, ctx().currentTime, 0.1); ambient.olp.frequency.setTargetAtTime(180 + speed * 6, ctx().currentTime, 0.1); ambient.ng.frequency && 0 } catch (e) {}
  }
  function stopAmbient() {
    if (!ambient) return
    const t0 = ctx().currentTime; const a = ambient
    try { a.og.gain.setTargetAtTime(0.0001, t0, 0.1); a.ng.gain.setTargetAtTime(0.0001, t0, 0.1); later(() => { try { a.o.stop(); a.s.stop(); a.og.disconnect(); a.ng.disconnect() } catch (e) {} }, 400) } catch (e) {}
    ambient = null
  }
  function silenceAll() { for (const id of pendingTimeouts) clearTimeout(id); pendingTimeouts = []; stopAmbient() }

  function sample(which) {
    switch (which) {
      case 'crater': obstacle('crater', 18); break
      case 'rock': obstacle('rock', 18); break
      case 'ufo': obstacle('ufo', 18); break
      case 'imminentG': imminent('ground'); break
      case 'imminentA': imminent('air'); break
      case 'jump': jump(); break
      case 'shotFwd': shot('fwd'); break
      case 'shotUp': shot('up'); break
      case 'kill': kill('ufo', 18); break
      case 'crash': crash(); break
      case 'over': gameOver(); break
    }
  }
  function testDirection(which) {
    const t0 = ctx().currentTime
    const map = {ahead: {pan: 0.9, f: 330}, behind: {pan: -0.9, f: 330}, ground: {pan: 0, f: 160}, air: {pan: 0, f: 760}}
    if (which === 'ring') { ['ahead', 'air', 'ground', 'behind'].forEach((k, i) => later(() => { const m = map[k]; tone({type: 'sine', freq: m.f, t0: ctx().currentTime, a: 0.005, hold: 0.14, r: 0.2, peak: 0.45, pan: m.pan}) }, i * 460)) }
    else if (map[which]) tone({type: 'sine', freq: map[which].f, t0, a: 0.005, hold: 0.16, r: 0.22, peak: 0.45, pan: map[which].pan})
  }

  return {
    obstacle, imminent, jump, land, shot, miss, kill, cleared, crash,
    tierUp, runStart, gameOver, menuMove, menuSelect, menuBack,
    startAmbient, setSpeed, stopAmbient, silenceAll,
    sample, testDirection,
  }
})()
