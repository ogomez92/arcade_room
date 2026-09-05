// OH SHIT audio: bright retro-arcade synth voices over a STEREO, NON-SPATIAL
// field. There is no binaural head — position is carried purely by stereo PAN
// (a thing left of you sits in your left ear and slides to centre as you
// approach) and identity by timbre: rocks whistle down, score items bling,
// power-ups ring like bells, cannonballs rumble-whoosh, pits breathe wind.
// Directional cues all carry a broadband high-frequency component so the pan
// reads clearly (pure low tones sound centred).
content.audio = (() => {
  let pendingTimeouts = []
  const loops = {}   // key -> {nodes..., setPan}

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function PANR() { return content.constants.PAN_RADIUS }

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

  function tone({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.4, pan = 0, detune = 0, cutoff = 0, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    if (detune) o.detune.value = detune
    env(g.gain, t0, {a, hold, r, peak})
    const p = panner(pan)
    let head = g
    if (cutoff) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; g.connect(lp); head = lp }
    o.connect(g)
    head.connect(p).connect(dest || out())
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

  // relative squares -> pan
  function panFor(rel) { return Math.max(-1, Math.min(1, rel / PANR())) * 0.92 }
  function nearFor(rel) { return Math.max(0, 1 - Math.abs(rel) / PANR()) }

  // ---- movement (foley-style: noise-built, no tonal "beeps") ----
  function step(surface) {
    const t0 = ctx().currentTime
    if (surface === 'edge') {
      // crumbling rock ledge: gritty double-crunch, loose and low
      noiseBurst({t0, peak: 0.26, dur: 0.03, cutoff: 850, hp: 120, pan: 0})
      noiseBurst({t0: t0 + 0.03, peak: 0.16, dur: 0.05, cutoff: 600, hp: 90, sweepTo: 250, pan: 0})
      noiseBurst({t0: t0 + 0.012, peak: 0.07, dur: 0.025, cutoff: 2400, hp: 1200, pan: 0})
    } else {
      // dry concrete footfall: heel thump + faint sole scuff, short and crisp
      noiseBurst({t0, peak: 0.3, dur: 0.022, cutoff: 320, pan: 0})
      noiseBurst({t0: t0 + 0.008, peak: 0.09, dur: 0.028, cutoff: 2600, hp: 1100, pan: 0})
    }
  }
  function wallBump() {
    const t0 = ctx().currentTime
    noiseBurst({t0, peak: 0.3, dur: 0.05, cutoff: 420, sweepTo: 150, pan: 0})
    noiseBurst({t0: t0 + 0.01, peak: 0.08, dur: 0.04, cutoff: 1500, hp: 600, pan: 0})
  }
  function jump() {
    const t0 = ctx().currentTime
    // a push-off scuff and rising air whoosh — no tone
    noiseBurst({t0, peak: 0.18, dur: 0.03, cutoff: 500, pan: 0})
    noiseBurst({t0: t0 + 0.015, peak: 0.12, dur: 0.14, cutoff: 900, hp: 300, sweepTo: 2400, pan: 0})
  }
  function land(surface) {
    const t0 = ctx().currentTime
    noiseBurst({t0, peak: 0.32, dur: 0.03, cutoff: surface === 'edge' ? 500 : 350, pan: 0})
    noiseBurst({t0: t0 + 0.012, peak: 0.1, dur: 0.05, cutoff: surface === 'edge' ? 700 : 1800, hp: surface === 'edge' ? 100 : 800, pan: 0})
  }

  // ---- rocks ----
  // One CONTINUOUS descending whistle per falling rock: pitch glides down and
  // gain swells over the whole fall, pan tracked per frame by the screen.
  // Keyed in the loop registry like the pit wind; the screen sweeps it when
  // the rock lands and the impact one-shot takes over.
  function rockStart(key, rel, frac, fallTime) {
    if (loops[key]) return
    const c = ctx()
    const t0 = c.currentTime
    const remaining = Math.max(0.08, fallTime * (1 - frac))
    const f0 = Math.max(420, 1350 - 880 * frac)
    const o = c.createOscillator(); o.type = 'triangle'
    o.frequency.setValueAtTime(f0, t0)
    o.frequency.exponentialRampToValueAtTime(420, t0 + remaining)
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400
    const g = c.createGain()
    g.gain.setValueAtTime(0.02 + 0.13 * frac, t0)
    g.gain.linearRampToValueAtTime(0.17, t0 + remaining)
    // the air rush carries the sound; the whistle just tints it
    const s = noiseSource()
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(2400, t0)
    bp.frequency.exponentialRampToValueAtTime(900, t0 + remaining)
    bp.Q.value = 0.7
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.03 + 0.14 * frac, t0)
    ng.gain.linearRampToValueAtTime(0.26, t0 + remaining)
    const p = panner(panFor(rel))
    o.connect(lp).connect(g).connect(p)
    s.connect(bp).connect(ng).connect(p)
    p.connect(out())
    o.start(); s.start()
    loops[key] = {stopNodes: [o, s], gain: g, gain2: ng, pan: p}
    // safety: if the screen stops driving (pause/death) the voice dies anyway
    later(() => loopStop(key, 0.05), (remaining + 0.4) * 1000)
  }
  function rockImpact(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    const near = nearFor(rel)
    // heavy ground thud: deep noise slam + brief debris, only a trace of sub
    noiseBurst({t0, peak: 0.4 + 0.15 * near, dur: 0.07, cutoff: 700, sweepTo: 160, pan})
    noiseBurst({t0: t0 + 0.03, peak: 0.14, dur: 0.1, cutoff: 1800, hp: 500, sweepTo: 400, pan})
    tone({type: 'sine', freq: 75, glideTo: 42, t0, a: 0.002, hold: 0.02, r: 0.12, peak: 0.22 + 0.1 * near, pan})
  }
  function rockPit(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // falls past the floor: whistle keeps dropping away, swallowed
    tone({type: 'triangle', freq: 600, glideTo: 130, t0, a: 0.004, hold: 0.1, r: 0.4, peak: 0.2, pan})
    noiseBurst({t0: t0 + 0.32, peak: 0.1, dur: 0.12, cutoff: 500, pan})
  }
  function cannonDestroyed(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // metal clank + burst — the secret payoff
    tone({type: 'square', freq: 720, glideTo: 280, t0, a: 0.001, hold: 0.02, r: 0.2, peak: 0.3, pan})
    tone({type: 'square', freq: 1083, glideTo: 400, t0: t0 + 0.02, a: 0.001, hold: 0.02, r: 0.24, peak: 0.2, pan})
    noiseBurst({t0, peak: 0.4, dur: 0.35, cutoff: 3200, sweepTo: 250, pan})
    tone({type: 'sine', freq: 120, glideTo: 45, t0, a: 0.002, hold: 0.05, r: 0.4, peak: 0.4, pan})
  }

  // ---- items ----
  function itemChime(rel, kind, urgent) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    if (kind === 'power') {
      // a warm hand-bell: soft strike, round partials, gently lowpassed
      const f = 659
      tone({type: 'sine', freq: f, t0, a: 0.004, hold: 0.02, r: 0.55, peak: 0.2, pan})
      tone({type: 'sine', freq: f * 2, t0, a: 0.004, hold: 0.01, r: 0.35, peak: 0.09, pan})
      tone({type: 'triangle', freq: f * 3, t0, a: 0.003, hold: 0, r: 0.18, peak: 0.045, pan, cutoff: 3200})
      noiseBurst({t0, peak: 0.02, dur: 0.015, cutoff: 6000, hp: 3000, pan})
    } else {
      // two mellow plucks — bright enough to pan, soft enough to live with
      const dur = urgent ? 0.07 : 0.1
      tone({type: 'triangle', freq: 988, t0, a: 0.004, hold: 0.015, r: dur, peak: 0.17, pan, cutoff: 2600})
      tone({type: 'triangle', freq: 1319, t0: t0 + (urgent ? 0.045 : 0.07), a: 0.004, hold: 0.015, r: dur, peak: 0.15, pan, cutoff: 2800})
      noiseBurst({t0, peak: 0.02, dur: 0.015, cutoff: 7000, hp: 3500, pan})
    }
  }
  function pickupScore() {
    const t0 = ctx().currentTime
    ;[988, 1319, 1568].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.035, a: 0.003, hold: 0.015, r: 0.1, peak: 0.2, pan: 0, cutoff: 3200}))
  }
  function pickupPower() {
    const t0 = ctx().currentTime
    ;[523, 659, 784, 1047].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.05, a: 0.004, hold: 0.03, r: 0.16, peak: 0.22, pan: 0, cutoff: 3000}))
  }
  function itemExpired(rel) {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: 700, glideTo: 350, t0, a: 0.003, hold: 0.02, r: 0.16, peak: 0.1, pan: panFor(rel)})
  }

  // ---- cannons + balls ----
  function cannonIdle(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // slow metallic ratchet so you always know where it sits
    tone({type: 'sawtooth', freq: 150, glideTo: 130, t0, a: 0.003, hold: 0.02, r: 0.05, peak: 0.08, pan, cutoff: 900})
    tone({type: 'sawtooth', freq: 200, t0: t0 + 0.06, a: 0.003, hold: 0.012, r: 0.04, peak: 0.055, pan, cutoff: 1100})
    noiseBurst({t0, peak: 0.035, dur: 0.025, cutoff: 3200, hp: 1200, pan})
  }
  function cannonFire(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // a real concussive boom: deep noise body with a sub tail
    noiseBurst({t0, peak: 0.45, dur: 0.3, cutoff: 600, sweepTo: 90, pan})
    noiseBurst({t0, peak: 0.12, dur: 0.05, cutoff: 2400, hp: 800, pan})
    tone({type: 'sine', freq: 58, glideTo: 34, t0, a: 0.003, hold: 0.05, r: 0.28, peak: 0.3, pan})
  }
  // One CONTINUOUS rolling voice per cannonball: gravelly filtered noise
  // (wobbled by two slow LFOs so it tumbles rather than hums) over a low
  // thrum. The screen retunes proximity + pan every frame with ballSet.
  // deep=true is the runner's chaser: lower, heavier, angrier.
  function ballStart(key, rel, deep) {
    if (loops[key]) return
    const c = ctx()
    const near = nearFor(rel)
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'
    lp.frequency.value = (deep ? 320 : 460) + 900 * near
    // gravel: irregular amplitude wobble
    const mod = c.createGain(); mod.gain.value = 1
    const l1 = c.createOscillator(); l1.type = 'sine'; l1.frequency.value = (deep ? 6.3 : 9.7) + Math.random() * 2.5
    const l1g = c.createGain(); l1g.gain.value = 0.38
    const l2 = c.createOscillator(); l2.type = 'sine'; l2.frequency.value = (deep ? 3.1 : 4.7) + Math.random()
    const l2g = c.createGain(); l2g.gain.value = 0.22
    l1.connect(l1g).connect(mod.gain)
    l2.connect(l2g).connect(mod.gain)
    const ng = c.createGain(); ng.gain.value = 0.0001
    ng.gain.setTargetAtTime((deep ? 0.1 : 0.06) + 0.26 * near, c.currentTime, 0.06)
    // low thrum underneath, rising as it nears
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = deep ? 52 : 76
    const tg = c.createGain(); tg.gain.value = 0.0001
    tg.gain.setTargetAtTime((deep ? 0.12 : 0.07) + 0.18 * near, c.currentTime, 0.06)
    const p = panner(panFor(rel))
    s.connect(lp).connect(mod).connect(ng).connect(p)
    o.connect(tg).connect(p)
    p.connect(out())
    s.start(); o.start(); l1.start(); l2.start()
    loops[key] = {stopNodes: [s, o, l1, l2], gain: ng, gain2: tg, pan: p, filter: lp, deep: !!deep}
  }
  function ballSet(key, rel) {
    const l = loops[key]
    if (!l) return
    const t = ctx().currentTime
    const near = nearFor(rel)
    try {
      l.pan.pan.setTargetAtTime(panFor(rel), t, 0.06)
      l.filter.frequency.setTargetAtTime((l.deep ? 320 : 460) + 900 * near, t, 0.08)
      l.gain.gain.setTargetAtTime((l.deep ? 0.1 : 0.06) + 0.26 * near, t, 0.08)
      l.gain2.gain.setTargetAtTime((l.deep ? 0.12 : 0.07) + 0.18 * near, t, 0.08)
    } catch (e) {}
  }
  function ballJumped() {
    const t0 = ctx().currentTime
    noiseBurst({t0, peak: 0.22, dur: 0.16, cutoff: 4500, hp: 800, sweepTo: 700, pan: 0})
    tone({type: 'sine', freq: 500, glideTo: 900, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.14, pan: 0})
  }
  function ballWall(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // dull stone-on-stone smack, then it's gone
    noiseBurst({t0, peak: 0.26, dur: 0.04, cutoff: 480, sweepTo: 170, pan})
    noiseBurst({t0: t0 + 0.015, peak: 0.07, dur: 0.05, cutoff: 1200, hp: 400, pan})
  }
  function ballPit(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    tone({type: 'square', freq: 220, glideTo: 70, t0, a: 0.003, hold: 0.06, r: 0.3, peak: 0.14, pan})
  }

  // ---- pits ----
  function pitCrumble(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // grinding crackle — the 2-second "get off the floor" warning
    for (let i = 0; i < 3; i++) {
      noiseBurst({t0: t0 + i * 0.06, peak: 0.2 - i * 0.04, dur: 0.05, cutoff: 1100 - i * 200, hp: 120, pan})
    }
    tone({type: 'sawtooth', freq: 75, glideTo: 60, t0, a: 0.004, hold: 0.08, r: 0.1, peak: 0.12, pan})
  }
  function pitOpen(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    tone({type: 'sine', freq: 200, glideTo: 50, t0, a: 0.003, hold: 0.05, r: 0.5, peak: 0.3, pan})
    noiseBurst({t0, peak: 0.3, dur: 0.4, cutoff: 1600, sweepTo: 150, pan})
  }
  function coverSlide(rel) {
    const t0 = ctx().currentTime
    const pan = panFor(rel)
    // stone sliding home
    noiseBurst({t0, peak: 0.3, dur: 0.32, cutoff: 700, hp: 90, sweepTo: 300, pan})
    tone({type: 'sawtooth', freq: 90, glideTo: 70, t0, a: 0.01, hold: 0.22, r: 0.1, peak: 0.12, pan, cutoff: 600})
    tone({type: 'sine', freq: 160, glideTo: 60, t0: t0 + 0.28, a: 0.002, hold: 0.02, r: 0.13, peak: 0.26, pan})
  }
  function fall() {
    const t0 = ctx().currentTime
    tone({type: 'triangle', freq: 700, glideTo: 90, t0, a: 0.005, hold: 0.2, r: 0.8, peak: 0.4, pan: 0})
    tone({type: 'triangle', freq: 1050, glideTo: 140, t0: t0 + 0.05, a: 0.005, hold: 0.18, r: 0.7, peak: 0.2, pan: 0})
  }

  // wind loop per open pit
  function windStart(key, rel) {
    if (loops[key]) return
    const c = ctx()
    const s = noiseSource()
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 1.4
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.5 + Math.random() * 0.3
    const lg = c.createGain(); lg.gain.value = 180
    lfo.connect(lg).connect(bp.frequency)
    const g = c.createGain(); g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.12, c.currentTime, 0.4)
    const p = panner(panFor(rel))
    s.connect(bp).connect(g).connect(p).connect(out())
    s.start(); lfo.start()
    loops[key] = {stopNodes: [s, lfo], gain: g, pan: p}
  }
  function loopSetPan(key, rel) {
    const l = loops[key]
    if (l && l.pan) try { l.pan.pan.setTargetAtTime(panFor(rel), ctx().currentTime, 0.08) } catch (e) {}
  }
  function loopStop(key, fade = 0.25) {
    const l = loops[key]
    if (!l) return
    delete loops[key]
    try {
      l.gain.gain.cancelScheduledValues(ctx().currentTime)
      l.gain.gain.setTargetAtTime(0.0001, ctx().currentTime, fade)
      if (l.gain2) {
        l.gain2.gain.cancelScheduledValues(ctx().currentTime)
        l.gain2.gain.setTargetAtTime(0.0001, ctx().currentTime, fade)
      }
      later(() => { try { for (const n of l.stopNodes) n.stop() } catch (e) {} try { l.gain.disconnect() } catch (e) {} try { l.gain2 && l.gain2.disconnect() } catch (e) {} }, fade * 4000)
    } catch (e) {}
  }

  // ---- buffs ----
  function shimmerStart() {
    if (loops.shimmer) return
    // invincibility: a soft, low glassy pad — present, never piercing
    const c = ctx()
    const o1 = c.createOscillator(); o1.type = 'sine'; o1.frequency.value = 660
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 663
    const o3 = c.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 990
    const o3g = c.createGain(); o3g.gain.value = 0.35
    const am = c.createOscillator(); am.type = 'sine'; am.frequency.value = 4.5
    const amg = c.createGain(); amg.gain.value = 0.01
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600
    const g = c.createGain(); g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.026, c.currentTime, 0.3)
    am.connect(amg).connect(g.gain)
    const p = panner(0)
    o1.connect(lp); o2.connect(lp); o3.connect(o3g).connect(lp)
    lp.connect(g).connect(p).connect(out())
    o1.start(); o2.start(); o3.start(); am.start()
    loops.shimmer = {stopNodes: [o1, o2, o3, am], gain: g, pan: p}
  }
  function speedStart() {
    if (loops.speed) return
    const c = ctx()
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 330
    const am = c.createOscillator(); am.type = 'square'; am.frequency.value = 8
    const amg = c.createGain(); amg.gain.value = 0.018
    const g = c.createGain(); g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.022, c.currentTime, 0.3)
    am.connect(amg).connect(g.gain)
    const p = panner(0)
    o.connect(g).connect(p).connect(out())
    o.start(); am.start()
    loops.speed = {stopNodes: [o, am], gain: g, pan: p}
  }
  function buffTick() {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: 760, t0, a: 0.002, hold: 0.015, r: 0.05, peak: 0.13, pan: 0})
  }

  // ---- rock storm ----
  function rumbleStart() {
    if (loops.rumble) return
    const c = ctx()
    const s = noiseSource()
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 46
    const og = c.createGain(); og.gain.value = 0.5
    const g = c.createGain(); g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.16, c.currentTime, 0.5)
    const p = panner(0)
    s.connect(lp); o.connect(og).connect(lp)
    lp.connect(g).connect(p).connect(out())
    s.start(); o.start()
    loops.rumble = {stopNodes: [s, o], gain: g, pan: p}
  }
  function stormStart() {
    rumbleStart()
    const t0 = ctx().currentTime
    ;[660, 622, 660, 622].forEach((f, i) => tone({type: 'sawtooth', freq: f, t0: t0 + i * 0.11, a: 0.004, hold: 0.05, r: 0.06, peak: 0.2, pan: 0, cutoff: 1800}))
  }
  function stormSurvived() {
    loopStop('rumble', 0.4)
    const t0 = ctx().currentTime
    ;[523, 659, 784, 1047, 1319].forEach((f, i) => {
      tone({type: 'triangle', freq: f, t0: t0 + i * 0.07, a: 0.004, hold: 0.05, r: 0.24, peak: 0.24, pan: 0, cutoff: 3200})
      tone({type: 'sine', freq: f / 2, t0: t0 + i * 0.07, a: 0.004, hold: 0.05, r: 0.24, peak: 0.11, pan: 0})
    })
  }

  // ---- runner ----
  function levelClear() {
    const t0 = ctx().currentTime
    ;[784, 988, 1175, 1568].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.07, a: 0.004, hold: 0.05, r: 0.2, peak: 0.24, pan: 0, cutoff: 3400}))
  }
  function dqBuzzer() {
    const t0 = ctx().currentTime
    tone({type: 'sawtooth', freq: 196, t0, a: 0.006, hold: 0.35, r: 0.15, peak: 0.28, pan: 0, cutoff: 1200})
    tone({type: 'sawtooth', freq: 185, t0, a: 0.006, hold: 0.35, r: 0.15, peak: 0.22, pan: 0, cutoff: 1100})
  }
  function cannonPassed(rel) {
    const t0 = ctx().currentTime
    tone({type: 'sine', freq: 600, glideTo: 250, t0, a: 0.004, hold: 0.05, r: 0.3, peak: 0.16, pan: panFor(rel)})
  }
  function runnerIntro() {
    const t0 = ctx().currentTime
    ;[392, 494, 587].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.09, a: 0.004, hold: 0.06, r: 0.1, peak: 0.2, pan: 0, cutoff: 2600}))
  }

  // ---- meta ----
  function runStart() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 330, glideTo: 494, t0, a: 0.01, hold: 0.05, r: 0.2, peak: 0.28, pan: 0}) }
  function death() {
    const t0 = ctx().currentTime
    tone({type: 'sawtooth', freq: 220, glideTo: 50, t0, a: 0.002, hold: 0.1, r: 0.6, peak: 0.55, pan: 0})
    noiseBurst({t0, peak: 0.45, dur: 0.5, cutoff: 2400, sweepTo: 150, pan: 0})
  }
  function gameOver() {
    const t0 = ctx().currentTime
    ;[294, 247, 196, 147].forEach((f, i) => {
      tone({type: 'triangle', freq: f, t0: t0 + i * 0.15, a: 0.012, hold: 0.07, r: 0.45, peak: 0.28, pan: 0, cutoff: 2200})
      tone({type: 'sine', freq: f / 2, t0: t0 + i * 0.15, a: 0.012, hold: 0.07, r: 0.45, peak: 0.15, pan: 0})
    })
  }
  function tierUp() { const t0 = ctx().currentTime; [392, 523, 659].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.05, a: 0.005, hold: 0.04, r: 0.12, peak: 0.18, pan: 0, cutoff: 2800})) }
  function milestone() {
    const t0 = ctx().currentTime
    ;[659, 784, 988, 1319].forEach((f, i) => tone({type: 'triangle', freq: f, t0: t0 + i * 0.06, a: 0.004, hold: 0.04, r: 0.16, peak: 0.2, pan: 0, cutoff: 3200}))
  }
  function menuMove() { const t0 = ctx().currentTime; noiseBurst({t0, peak: 0.16, dur: 0.03, cutoff: 2600, pan: 0}) }
  function menuSelect() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 520, glideTo: 780, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.26, pan: 0}) }
  function menuBack() { const t0 = ctx().currentTime; tone({type: 'sine', freq: 480, glideTo: 300, t0, a: 0.004, hold: 0.02, r: 0.12, peak: 0.22, pan: 0}) }
  function denied() { const t0 = ctx().currentTime; tone({type: 'square', freq: 220, glideTo: 180, t0, a: 0.002, hold: 0.05, r: 0.08, peak: 0.18, pan: 0}) }

  // stop any <prefix>* loop whose key is no longer in the valid set (pit
  // sealed / rock landed / out of earshot in the runner)
  function _sweepLoops(prefix, valid, fade = 0.2) {
    for (const key of Object.keys(loops)) {
      if (key.startsWith(prefix) && !valid[key]) loopStop(key, fade)
    }
  }

  function silenceAll() {
    for (const id of pendingTimeouts) clearTimeout(id)
    pendingTimeouts = []
    for (const key of Object.keys(loops)) loopStop(key, 0.05)
  }

  // learn screen plays each cue in isolation
  function sample(which) {
    switch (which) {
      case 'step': step('concrete'); break
      case 'edge': step('edge'); break
      case 'jump': jump(); break
      case 'rockfall': rockStart('demoRock', 4, 0, 2.4); later(() => { loopStop('demoRock', 0.04); rockImpact(4) }, 2350); break
      case 'scoreitem': itemChime(3, 'score', false); later(() => itemChime(3, 'score', false), 1100); later(() => itemChime(3, 'score', false), 2200); break
      case 'powerbell': itemChime(-3, 'power', false); later(() => itemChime(-3, 'power', false), 1000); break
      case 'pickupScore': pickupScore(); break
      case 'pickupPower': pickupPower(); break
      case 'cannon': cannonIdle(6); later(() => cannonIdle(6), 800); later(() => cannonFire(6), 1700); break
      case 'ball': { ballStart('demoBall', 9); let i = 0; const h = setInterval(() => { i++; ballSet('demoBall', 9 - i * 0.9); if (i >= 10) { clearInterval(h); loopStop('demoBall', 0.08); ballWall(0.5) } }, 200); pendingTimeouts.push(h); break }
      case 'ballJumped': ballJumped(); break
      case 'ballWall': ballWall(5); break
      case 'crumble': pitCrumble(0); later(() => pitCrumble(0), 350); later(() => pitCrumble(0), 700); later(() => pitOpen(0), 1200); break
      case 'wind': windStart('demo', 2); later(() => loopStop('demo'), 2600); break
      case 'cover': coverSlide(1); break
      case 'fall': fall(); break
      case 'storm': stormStart(); later(() => loopStop('rumble', 0.3), 2500); break
      case 'chaser': { ballStart('demoChaser', -8, true); let i = 0; const h = setInterval(() => { i++; ballSet('demoChaser', -8 + i * 0.7); if (i >= 9) { clearInterval(h); loopStop('demoChaser', 0.2) } }, 220); pendingTimeouts.push(h); break }
      case 'over': gameOver(); break
    }
  }

  // stereo build: nothing to anchor, but the learn screen calls this
  function setStaticListener() {}

  return {
    step, wallBump, jump, land,
    rockStart, rockImpact, rockPit, cannonDestroyed,
    itemChime, pickupScore, pickupPower, itemExpired,
    cannonIdle, cannonFire, ballStart, ballSet, ballJumped, ballWall, ballPit,
    pitCrumble, pitOpen, coverSlide, fall,
    windStart, loopSetPan, loopStop,
    shimmerStart, speedStart, buffTick,
    stormStart, stormSurvived,
    levelClear, dqBuzzer, cannonPassed, runnerIntro,
    runStart, death, gameOver, tierUp, milestone,
    menuMove, menuSelect, menuBack, denied,
    silenceAll, sample, setStaticListener,
    _sweepLoops,
  }
})()
