// KILLING SPREE audio. STEREO, car-centred: the listener sits in the driver's
// seat and there is no binaural head — position is stereo PAN plus distance
// gain/lowpass plus Doppler.
//
//   • YOUR CAR (engine, tyres, squeal, rumble strip, scrape) pans with your
//     lateral offset from the road centre: hear it on the right → you are
//     right of centre → steer left. Keep it in the middle.
//   • THE ROAD VOICE (an airy whistle) pans to the side the road bends
//     toward, pitch rising with tightness. Steer toward the road voice, away
//     from your engine pan.
//   • PEDESTRIANS pan by where they are relative to your bonnet, swell as you
//     close, and Doppler up on approach / down as they fall behind.
//   • PACENOTES: a whoosh + 1..4 pips on the curve's side a few seconds out;
//     more pips = tighter.
//
// Everything is synthesised: the engine is a multi-voice combustion model
// (firing-rate saw + half-order exhaust thump + AM-gated exhaust noise +
// intake whine), pedestrians are formant babble / whistles / ringtones /
// foley footsteps, impacts are noise-shaped foley with metallic partials.
content.audio = (() => {
  const K = () => content.constants
  const ctx = () => engine.context()
  const out = () => engine.mixer.input()

  let pendingTimeouts = []
  function later(fn, ms) {
    const id = setTimeout(() => {
      pendingTimeouts = pendingTimeouts.filter((x) => x !== id)
      try { fn() } catch (e) { console.error(e) }
    }, ms)
    pendingTimeouts.push(id)
    return id
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
  function lerp(a, b, t) { return a + (b - a) * t }
  function now() { return ctx().currentTime }
  function smooth(param, value, tc) {
    try { param.setTargetAtTime(value, now(), tc == null ? 0.03 : tc) } catch (e) {}
  }

  // ---- buffers -------------------------------------------------------------
  const buffers = {}
  function noiseBuffer(kind) {
    if (buffers[kind]) return buffers[kind]
    const c = ctx()
    const len = Math.floor(c.sampleRate * 2.5)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + w * 0.0555179
        b1 = 0.99332 * b1 + w * 0.0750759
        b2 = 0.96900 * b2 + w * 0.1538520
        b3 = 0.86650 * b3 + w * 0.3104856
        b4 = 0.55000 * b4 + w * 0.5329522
        b5 = -0.7616 * b5 - w * 0.0168980
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
        b6 = w * 0.115926
      }
    } else { // brown
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.5
      }
    }
    buffers[kind] = buf
    return buf
  }
  function noiseSource(kind) {
    const s = ctx().createBufferSource()
    s.buffer = noiseBuffer(kind || 'white')
    s.loop = true
    return s
  }

  // ---- primitives ----------------------------------------------------------
  function env(param, t0, {a = 0.005, hold = 0, r = 0.08, peak = 1}) {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0.0001, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + hold)
    param.exponentialRampToValueAtTime(0.0001, t0 + a + hold + r)
  }
  function panner(pan) {
    const p = ctx().createStereoPanner()
    p.pan.value = clamp(pan || 0, -1, 1)
    return p
  }
  function filter(type, freq, q) {
    const f = ctx().createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    if (q != null) f.Q.value = q
    return f
  }
  function gainNode(v) { const g = ctx().createGain(); g.gain.value = v == null ? 1 : v; return g }

  function tone({type = 'sine', freq, glideTo, t0, a = 0.005, hold = 0.04, r = 0.1, peak = 0.3, pan = 0, detune = 0, cutoff = 0, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (glideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t0 + a + hold + r)
    if (detune) o.detune.value = detune
    env(g.gain, t0, {a, hold, r, peak})
    let head = g
    if (cutoff) { const lp = filter('lowpass', cutoff); g.connect(lp); head = lp }
    o.connect(g)
    head.connect(panner(pan)).connect(dest || out())
    o.start(t0)
    o.stop(t0 + a + hold + r + 0.05)
    return o
  }
  function noiseBurst({t0, peak = 0.3, dur = 0.06, a = 0.001, cutoff = 3000, hp = 0, q = 0.7, pan = 0, sweepTo, kind = 'white', dest}) {
    const c = ctx()
    const s = noiseSource(kind)
    let head = s
    if (hp) { const h = filter('highpass', hp); head.connect(h); head = h }
    const lp = filter('lowpass', cutoff, q)
    lp.frequency.setValueAtTime(cutoff, t0)
    if (sweepTo) lp.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + dur)
    head.connect(lp)
    const g = c.createGain()
    env(g.gain, t0, {a, hold: 0, r: dur, peak})
    lp.connect(g).connect(panner(pan)).connect(dest || out())
    s.start(t0)
    s.stop(t0 + a + dur + 0.05)
  }
  // a short formant "voice" one-shot (yelps, heys, whoas)
  function yelp({t0, f0 = 380, fPeak = 520, fEnd = 170, dur = 0.32, peak = 0.22, pan = 0, f1 = 700, f2 = 1300, dest}) {
    const c = ctx()
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(f0, t0)
    o.frequency.exponentialRampToValueAtTime(fPeak, t0 + dur * 0.25)
    o.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur)
    const b1 = filter('bandpass', f1, 6)
    const b2 = filter('bandpass', f2, 8)
    const lp = filter('lowpass', 900)
    const sum = gainNode(1)
    const g1 = gainNode(1.0), g2 = gainNode(0.6), g3 = gainNode(0.25)
    o.connect(b1).connect(g1).connect(sum)
    o.connect(b2).connect(g2).connect(sum)
    o.connect(lp).connect(g3).connect(sum)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.02, hold: dur * 0.5, r: dur * 0.5, peak})
    sum.connect(g).connect(panner(pan)).connect(dest || out())
    o.start(t0)
    o.stop(t0 + dur + 0.1)
  }

  // ---- buses ----------------------------------------------------------------
  let bus = null
  function ensureBus() {
    if (bus) return bus
    const c = ctx()
    bus = {
      car: c.createGain(),
      world: c.createGain(),
      sfx: c.createGain(),
      duck: c.createGain(),
    }
    bus.car.gain.value = 1
    bus.world.gain.value = 1
    bus.sfx.gain.value = 1
    bus.car.connect(out())
    bus.world.connect(out())
    bus.sfx.connect(out())
    return bus
  }
  function carPan(x) { return clamp(x / K().CAR_PAN_X, -1, 1) * 0.92 }
  function pedPan(rel) { return clamp(rel / K().PED_PAN_X, -1, 1) * 0.95 }

  // =========================================================================
  // THE CAR
  // =========================================================================
  let car = null
  let starting = false // starter motor running; the engine catches shortly

  function carStart() {
    if (car) return
    const c = ctx()
    ensureBus()
    const t0 = now()
    const pan = panner(0)
    const master = gainNode(0)
    master.connect(pan).connect(bus.car)

    // --- engine ---
    const engineSum = gainNode(1)
    const engineTone = filter('lowpass', 3200, 0.7)
    engineSum.connect(engineTone).connect(master)

    const block = c.createOscillator(); block.type = 'sawtooth'; block.frequency.value = 30
    const blockLp = filter('lowpass', 400, 1.2)
    const blockG = gainNode(0.16)
    block.connect(blockLp).connect(blockG).connect(engineSum)

    const thump = c.createOscillator(); thump.type = 'square'; thump.frequency.value = 15
    const thumpLp = filter('lowpass', 380, 0.8)
    const thumpG = gainNode(0.13)
    thump.connect(thumpLp).connect(thumpG).connect(engineSum)

    const whine = c.createOscillator(); whine.type = 'triangle'; whine.frequency.value = 60; whine.detune.value = 4
    const whineLp = filter('lowpass', 1800, 1)
    const whineG = gainNode(0.05)
    whine.connect(whineLp).connect(whineG).connect(engineSum)

    // exhaust: brown noise, bandpassed near the 4th order, gated by a firing-rate AM
    const exhaust = noiseSource('brown')
    const exhaustBp = filter('bandpass', 120, 1.4)
    const exhaustAm = gainNode(0.5)
    const amOsc = c.createOscillator(); amOsc.type = 'sine'; amOsc.frequency.value = 30
    const amDepth = gainNode(0.5)
    amOsc.connect(amDepth).connect(exhaustAm.gain)
    const exhaustG = gainNode(0.2)
    exhaust.connect(exhaustBp).connect(exhaustAm).connect(exhaustG).connect(engineSum)

    // --- tyres / road hum (pans with the car) ---
    const hum = noiseSource('brown')
    const humBp = filter('bandpass', 95, 0.8)
    const humG = gainNode(0)
    hum.connect(humBp).connect(humG).connect(master)

    // --- squeal ---
    const squeal = noiseSource('pink')
    const sqBp1 = filter('bandpass', 1700, 7)
    const sqBp2 = filter('bandpass', 2500, 9)
    const sqLfo = c.createOscillator(); sqLfo.type = 'sine'; sqLfo.frequency.value = 11
    const sqLfoG = gainNode(140)
    sqLfo.connect(sqLfoG).connect(sqBp2.frequency)
    const sqG = gainNode(0)
    squeal.connect(sqBp1).connect(sqG)
    squeal.connect(sqBp2).connect(sqG)
    sqG.connect(master)

    // --- rumble strip (own panner: it is under the outer wheels) ---
    const rumble = c.createOscillator(); rumble.type = 'sawtooth'; rumble.frequency.value = 40
    const rumbleLp = filter('lowpass', 480, 1)
    const rumbleG = gainNode(0)
    const rumblePan = panner(0)
    rumble.connect(rumbleLp).connect(rumbleG).connect(rumblePan).connect(bus.car)

    // --- barrier scrape ---
    const scrape = noiseSource('pink')
    const scrapeHp = filter('highpass', 700)
    const scrapeBp = filter('bandpass', 1500, 2.5)
    const scrapeG = gainNode(0)
    const scrapePan = panner(0)
    scrape.connect(scrapeHp).connect(scrapeBp).connect(scrapeG)
    const ringG = gainNode(0.12)
    for (const f of [2150, 3320, 4710]) {
      const r = filter('bandpass', f, 22)
      scrape.connect(r).connect(ringG)
    }
    ringG.connect(scrapeG)
    scrapeG.connect(scrapePan).connect(bus.car)

    // --- wind (wide, not panned with the car) ---
    const windL = noiseSource('pink'), windR = noiseSource('pink')
    const windLpL = filter('lowpass', 200, 0.5), windLpR = filter('lowpass', 200, 0.5)
    const windG = gainNode(0)
    windL.connect(windLpL).connect(panner(-0.6)).connect(windG)
    windR.connect(windLpR).connect(panner(0.6)).connect(windG)
    windG.connect(bus.car)

    for (const n of [block, thump, whine, exhaust, amOsc, hum, squeal, sqLfo, rumble, scrape, windL, windR]) n.start(t0)

    car = {
      pan, master, engineTone, block, blockLp, blockG, thump, whine, whineG, amOsc, exhaustBp, exhaustG,
      humG, sqBp1, sqG, rumble, rumbleG, rumblePan, scrapeG, scrapePan, windLpL, windLpR, windG,
      nodes: [block, thump, whine, exhaust, amOsc, hum, squeal, sqLfo, rumble, scrape, windL, windR],
      startupT: -1, lastThrottle: 0, lastRpm: 900, popT: 0, engineGain: 0.34, dead: false,
    }
    return car
  }

  function carSet(s, health, phase, dt) {
    if (!car) return
    const k = K()
    const c = car
    const t = now()
    const rpm = Math.max(0, s.rpm)
    let f0 = rpm / 30
    let throttle = s.throttle

    // startup bump: engine catches high and settles
    if (c.startupT >= 0) {
      const e = (t - c.startupT)
      if (e < 1.0) { f0 = f0 * (1 + 0.9 * Math.exp(-e * 3.5)); throttle = Math.max(throttle, 0.5 * Math.exp(-e * 3)) }
      else c.startupT = -1
    }
    f0 = Math.max(4, f0)
    smooth(c.block.frequency, f0, 0.02)
    smooth(c.thump.frequency, f0 / 2, 0.02)
    smooth(c.whine.frequency, f0 * 2, 0.02)
    smooth(c.amOsc.frequency, f0, 0.02)
    smooth(c.exhaustBp.frequency, clamp(f0 * 4, 80, 1400), 0.03)
    const load = throttle
    smooth(c.blockLp.frequency, 260 + load * 900 + f0 * 5, 0.05)
    smooth(c.blockG.gain, 0.15 + 0.13 * load, 0.05)
    smooth(c.whineG.gain, 0.04 + 0.09 * load, 0.05)
    smooth(c.exhaustG.gain, 0.16 + 0.16 * load, 0.05)
    smooth(c.engineTone.frequency, 2600 + load * 1800, 0.08)
    const dying = phase === 'dying' || phase === 'gameover'
    const eng = dying ? c.engineGain * clamp(rpm / 900, 0, 1) : c.engineGain
    smooth(c.master.gain, eng, 0.05)

    // overrun pops when lifting off at high rpm
    if (c.lastThrottle > 0.6 && throttle < 0.2 && rpm > 4200 && t - c.popT > 0.8) {
      c.popT = t
      const n = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) {
        noiseBurst({t0: t + 0.05 + i * (0.09 + Math.random() * 0.12), peak: 0.2, dur: 0.04, cutoff: 700, sweepTo: 180, kind: 'brown', pan: carPan(s.x), dest: bus.car})
      }
    }
    c.lastThrottle = throttle
    c.lastRpm = rpm

    // pan by lateral offset
    smooth(c.pan.pan, carPan(s.x), 0.04)

    // speed-driven textures
    const vf = clamp(s.v / k.V_MAX_REPORT, 0, 1)
    smooth(c.humG.gain, dying ? 0.02 * vf : 0.05 * vf + 0.12 * vf * vf, 0.08)
    const windCut = 160 + s.v * 42
    smooth(c.windLpL.frequency, windCut, 0.1)
    smooth(c.windLpR.frequency, windCut * 1.07, 0.1)
    smooth(c.windG.gain, 0.32 * Math.pow(vf, 1.6), 0.1)

    // tyres protesting → squeal
    const sq = clamp(s.squeal * 0.22 + clamp(s.slip, 0, 1) * 0.28, 0, 0.42)
    smooth(c.sqG.gain, dying ? 0 : sq, 0.04)
    smooth(c.sqBp1.frequency, 1600 + clamp(s.slip, 0, 1) * 700, 0.05)

    // rumble strip under the outer wheels
    const overX = Math.abs(s.x) - k.RUMBLE_X
    const depth = clamp(overX / (k.WALL_X - k.CAR_HALF_W - k.RUMBLE_X), 0, 1)
    smooth(c.rumble.frequency, clamp(s.v / 0.45, 8, 150), 0.03)
    smooth(c.rumbleG.gain, depth * 0.3 * clamp(s.v / 6, 0, 1), 0.04)
    smooth(c.rumblePan.pan, Math.sign(s.x) * 0.9, 0.05)

    // scraping the barrier
    const scr = s.contact ? 0.3 * clamp(s.v / 20, 0.25, 1) : 0
    smooth(c.scrapeG.gain, scr, 0.03)
    if (s.contact) smooth(c.scrapePan.pan, s.contact * 0.95, 0.02)
  }

  function carStop() {
    if (!car) return
    const c = car
    smooth(c.master.gain, 0, 0.05)
    smooth(c.windG.gain, 0, 0.05)
    smooth(c.sqG.gain, 0, 0.02)
    smooth(c.rumbleG.gain, 0, 0.02)
    smooth(c.scrapeG.gain, 0, 0.02)
    smooth(c.humG.gain, 0, 0.02)
    const nodes = c.nodes
    later(() => { for (const n of nodes) { try { n.stop() } catch (e) {} } }, 400)
    car = null
  }

  function engineStart() {
    ensureBus()
    const t0 = now()
    // starter motor: a laboured saw churned at ~7 Hz, then the engine catches
    const c = ctx()
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(48, t0)
    o.frequency.linearRampToValueAtTime(58, t0 + 0.7)
    const am = gainNode(0.5)
    const amO = c.createOscillator(); amO.type = 'sine'; amO.frequency.value = 7.2
    const amD = gainNode(0.5)
    amO.connect(amD).connect(am.gain)
    const lp = filter('lowpass', 600)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.03, hold: 0.55, r: 0.15, peak: 0.22})
    o.connect(am).connect(lp).connect(g).connect(bus.car)
    o.start(t0); amO.start(t0); o.stop(t0 + 0.95); amO.stop(t0 + 0.95)
    noiseBurst({t0, peak: 0.08, dur: 0.7, a: 0.05, cutoff: 900, kind: 'pink', dest: bus.car})
    // catch
    starting = true
    later(() => {
      starting = false
      carStart()
      car.startupT = now()
      car.master.gain.setValueAtTime(0, now())
      car.master.gain.linearRampToValueAtTime(car.engineGain, now() + 0.15)
    }, 720)
  }

  // =========================================================================
  // THE ROAD VOICE
  // =========================================================================
  let road = null
  function roadStart() {
    if (road) return
    const c = ctx()
    ensureBus()
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = 300
    const oLp = filter('lowpass', 1600)
    const oG = gainNode(0.6)
    const n = noiseSource('pink')
    const nBp = filter('bandpass', 600, 5)
    const nG = gainNode(0.9)
    const master = gainNode(0)
    const pan = panner(0)
    o.connect(oLp).connect(oG).connect(master)
    n.connect(nBp).connect(nG).connect(master)
    master.connect(pan).connect(bus.world)
    o.start(); n.start()
    road = {o, nBp, master, pan, nodes: [o, n]}
  }
  function roadSet(kappa) {
    if (!road) return
    const tight = clamp(Math.abs(kappa) * 55, 0, 1)
    const presence = clamp(Math.abs(kappa) / 0.0022, 0, 1)
    const f = 220 * Math.pow(2, tight * 1.6)
    smooth(road.o.frequency, f, 0.06)
    smooth(road.nBp.frequency, f * 2, 0.06)
    smooth(road.master.gain, (0.05 + 0.24 * tight) * presence, 0.08)
    if (Math.abs(kappa) > 1e-5) smooth(road.pan.pan, Math.sign(kappa) * 0.85, 0.08)
  }
  function roadStop() {
    if (!road) return
    smooth(road.master.gain, 0, 0.05)
    const nodes = road.nodes
    later(() => { for (const n of nodes) { try { n.stop() } catch (e) {} } }, 400)
    road = null
  }

  // pacenote: whoosh toward the side, then 1..4 pips (more = tighter)
  function callout(dir, tier, dest) {
    ensureBus()
    const t0 = now()
    const pan = dir * 0.8
    const d = dest || bus.world
    noiseBurst({t0, peak: 0.16, dur: 0.28, a: 0.06, cutoff: 2600, hp: 500, kind: 'pink', pan, dest: d})
    const base = [520, 620, 740, 880][clamp(tier, 1, 4) - 1]
    const n = clamp(tier, 1, 4)
    const gap = tier >= 4 ? 0.085 : 0.115
    for (let i = 0; i < n; i++) {
      const t = t0 + 0.22 + i * gap
      tone({type: 'triangle', freq: base, t0: t, a: 0.004, hold: 0.03, r: 0.07, peak: 0.22, pan, cutoff: 3200, dest: d})
      noiseBurst({t0: t, peak: 0.07, dur: 0.018, cutoff: 9000, hp: 3000, pan, dest: d})
    }
    if (tier >= 4) tone({type: 'sine', freq: 140, t0: t0 + 0.2, a: 0.01, hold: 0.25, r: 0.15, peak: 0.2, pan, dest: d})
  }

  // =========================================================================
  // PEDESTRIANS — one continuous voice each, driven per frame
  // =========================================================================
  const peds = {}
  const PENTA = [0, 2, 4, 7, 9, 12, 14]

  function voiceShell(pan, gainMax) {
    const c = ctx()
    const lp = filter('lowpass', 8000, 0.5)
    const g = c.createGain(); g.gain.value = 0
    const p = panner(pan)
    lp.connect(g).connect(p).connect(bus.world)
    return {lp, g, p, gainMax, oscs: [], nodes: [], next: 0, phraseLeft: 0, dest: lp}
  }

  function buildTalker(v, ped) {
    const c = ctx()
    const female = ped.voice % 2 === 1
    const f0 = (female ? 205 : 118) * ped.pitch
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f0
    const vib = c.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.3 + Math.random()
    const vibG = gainNode(f0 * 0.025)
    vib.connect(vibG).connect(o.frequency)
    const f1 = filter('bandpass', 600, 7), f2 = filter('bandpass', 1400, 9)
    const lp = filter('lowpass', 700)
    const sum = gainNode(1)
    const g1 = gainNode(1.0), g2 = gainNode(0.7), g3 = gainNode(0.35)
    o.connect(f1).connect(g1).connect(sum)
    o.connect(f2).connect(g2).connect(sum)
    o.connect(lp).connect(g3).connect(sum)
    const gate = gainNode(0)
    sum.connect(gate).connect(v.dest)
    o.start(); vib.start()
    v.oscs.push(o); v.nodes.push(o, vib)
    v.f0 = f0; v.osc = o; v.f1 = f1; v.f2 = f2; v.gate = gate
    v.tick = function (t) {
      // schedule syllables ahead of the audio clock
      if (v.phraseLeft <= 0) {
        // phrase pause
        v.phraseLeft = 3 + Math.floor(Math.random() * 6)
        v.next = t + 0.25 + Math.random() * 0.9
        return
      }
      const dur = 0.12 + Math.random() * 0.1
      const f = v.f0 * (0.88 + Math.random() * 0.28)
      v.osc.frequency.setTargetAtTime(f, v.next, 0.04)
      v.f1.frequency.setTargetAtTime(300 + Math.random() * 500, v.next, 0.02)
      v.f2.frequency.setTargetAtTime(900 + Math.random() * 1400, v.next, 0.02)
      v.gate.gain.setTargetAtTime(0.9, v.next, 0.015)
      v.gate.gain.setTargetAtTime(0.0, v.next + dur * 0.7, 0.03)
      v.next += dur + 0.02 + Math.random() * 0.05
      v.phraseLeft--
    }
  }

  function buildWhistler(v, ped) {
    const c = ctx()
    const base = 1180 * ped.pitch
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base
    const vib = c.createOscillator(); vib.type = 'sine'; vib.frequency.value = 5.8
    const vibG = gainNode(base * 0.012)
    vib.connect(vibG).connect(o.frequency)
    const breath = noiseSource('pink')
    const bBp = filter('bandpass', base, 14)
    const bG = gainNode(0.25)
    const gate = gainNode(0)
    o.connect(gate)
    breath.connect(bBp).connect(bG).connect(gate)
    gate.connect(v.dest)
    o.start(); vib.start(); breath.start()
    v.oscs.push(o); v.nodes.push(o, vib, breath)
    v.osc = o; v.bBp = bBp; v.gate = gate; v.base = base
    v.tick = function (t) {
      if (v.phraseLeft <= 0) {
        v.phraseLeft = 4 + Math.floor(Math.random() * 5)
        v.gate.gain.setTargetAtTime(0, v.next, 0.05)
        v.next = t + 0.4 + Math.random() * 1.1
        return
      }
      const semi = PENTA[Math.floor(Math.random() * PENTA.length)]
      const f = v.base * Math.pow(2, semi / 12)
      const dur = 0.18 + Math.random() * 0.25
      v.osc.frequency.setTargetAtTime(f, v.next, 0.03)
      v.bBp.frequency.setTargetAtTime(f, v.next, 0.03)
      v.gate.gain.setTargetAtTime(0.55, v.next, 0.03)
      v.next += dur
      v.phraseLeft--
    }
  }

  function buildPhone(v, ped) {
    const c = ctx()
    const base = 880 * ped.pitch
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = base
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 2
    const o2g = gainNode(0.3)
    const gate = gainNode(0)
    o.connect(gate); o2.connect(o2g).connect(gate)
    gate.connect(v.dest)
    o.start(); o2.start()
    v.oscs.push(o, o2); v.nodes.push(o, o2)
    v.osc = o; v.osc2 = o2; v.gate = gate; v.base = base
    v.melody = ped.voice % 2 === 0 ? [0, 4, 7, 12, 7, 4] : [7, 7, 12, 7, 4, 0] // two 6-note ringtones
    v.step = 0
    v.tick = function (t) {
      if (v.phraseLeft <= 0) {
        v.phraseLeft = v.melody.length
        v.step = 0
        v.next = t + 0.9 + Math.random() * 0.6
        return
      }
      const f = v.base * Math.pow(2, v.melody[v.step] / 12)
      v.osc.frequency.setValueAtTime(f, v.next)
      v.osc2.frequency.setValueAtTime(f * 2, v.next)
      v.gate.gain.setValueAtTime(0.0, v.next)
      v.gate.gain.linearRampToValueAtTime(0.7, v.next + 0.008)
      v.gate.gain.exponentialRampToValueAtTime(0.001, v.next + 0.13)
      v.next += 0.14
      v.step++
      v.phraseLeft--
    }
  }

  function buildSteps(v, ped, {rate, breath, heel}) {
    // foley footsteps: thump + scuff, scheduled ahead; optional breathing
    const c = ctx()
    v.rate = rate
    v.heel = heel
    if (breath) {
      const b = noiseSource('pink')
      const bBp = filter('bandpass', 900, 1.2)
      const bG = gainNode(0)
      b.connect(bBp).connect(bG).connect(v.dest)
      b.start()
      v.nodes.push(b)
      v.breathG = bG
      v.breathNext = now() + 0.3
    }
    v.tick = function (t) {
      const t0 = v.next
      const thump = noiseSource('brown')
      const lp = filter('lowpass', 360)
      const g = c.createGain()
      env(g.gain, t0, {a: 0.002, hold: 0, r: 0.045, peak: 0.55})
      thump.connect(lp).connect(g).connect(v.dest)
      thump.start(t0); thump.stop(t0 + 0.1)
      const scuff = noiseSource('white')
      const hp = filter('highpass', v.heel ? 1800 : 1100)
      const lp2 = filter('lowpass', v.heel ? 6500 : 3800)
      const g2 = c.createGain()
      env(g2.gain, t0 + 0.006, {a: 0.001, hold: 0, r: v.heel ? 0.02 : 0.035, peak: v.heel ? 0.3 : 0.18})
      scuff.connect(hp).connect(lp2).connect(g2).connect(v.dest)
      scuff.start(t0); scuff.stop(t0 + 0.08)
      v.next = t0 + 1 / v.rate * (0.96 + Math.random() * 0.08)
      if (v.breathG && t0 >= v.breathNext) {
        v.breathG.gain.setTargetAtTime(0.5, v.breathNext, 0.08)
        v.breathG.gain.setTargetAtTime(0.0, v.breathNext + 0.28, 0.1)
        v.breathNext += 0.7
      }
    }
  }

  function buildCrosser(v, ped) {
    // at the kerb: occasional low mutter; once crossing the screen swaps in steps
    buildTalker(v, ped)
    const baseTick = v.tick
    v.mode = 'waiting'
    v.tick = function (t) {
      if (v.mode === 'waiting') {
        if (v.phraseLeft <= 0) {
          v.phraseLeft = 2 + Math.floor(Math.random() * 2)
          v.next = t + 0.9 + Math.random() * 1.4
          return
        }
        baseTick(t)
      } else {
        v.stepsTick(t)
      }
    }
  }

  function pedStart(ped) {
    if (peds[ped.id]) return peds[ped.id]
    ensureBus()
    const v = voiceShell(pedPan(ped.rel), 1)
    v.type = ped.type
    v.next = now() + 0.05 + Math.random() * 0.3
    v.pitch = ped.pitch
    switch (ped.type) {
      case 'talker': buildTalker(v, ped); v.gainMax = 0.5; break
      case 'whistler': buildWhistler(v, ped); v.gainMax = 0.32; break
      case 'phone': buildPhone(v, ped); v.gainMax = 0.34; break
      case 'jogger': buildSteps(v, ped, {rate: 2.9, breath: true, heel: false}); v.gainMax = 0.6; break
      case 'crosser': buildCrosser(v, ped); v.gainMax = 0.5; break
      default: buildTalker(v, ped); v.gainMax = 0.5
    }
    peds[ped.id] = v
    return v
  }

  function pedCrossing(ped) {
    const v = peds[ped.id]
    if (!v || v.type !== 'crosser') return
    v.mode = 'crossing'
    // hard heel clicks at a hurried 2.3 steps/s
    const shell = {dest: v.dest, nodes: v.nodes, next: now() + 0.05}
    buildSteps(shell, ped, {rate: 2.3, breath: false, heel: true})
    v.stepsTick = function (t) { shell.next = Math.max(shell.next, v.next); shell.tick(t); v.next = shell.next }
    if (v.gate) v.gate.gain.setTargetAtTime(0, now(), 0.02)
    v.next = now() + 0.05
    v.gainMax = 0.62
    // a startled "hey!" as they step off
    yelp({t0: now(), f0: 300 * v.pitch, fPeak: 430 * v.pitch, fEnd: 240 * v.pitch, dur: 0.22, peak: 0.16, pan: v.p.pan.value, dest: bus.world})
  }

  // per-frame: pan, distance gain / muffle, doppler
  function pedSet(ped, hearDist, v) {
    const voice = peds[ped.id]
    if (!voice) return
    const k = K()
    const d = ped.dist
    let gain, cutoff
    if (d >= 0) {
      const near = clamp(1 - d / hearDist, 0, 1)
      gain = Math.pow(near, 1.7)
      cutoff = 900 + 9000 * near * near
    } else {
      const behind = clamp(1 + d / 25, 0, 1)
      gain = behind * behind * 0.8
      cutoff = 1100
    }
    smooth(voice.g.gain, gain * voice.gainMax, 0.05)
    smooth(voice.lp.frequency, cutoff, 0.06)
    smooth(voice.p.pan, pedPan(ped.rel), 0.04)
    // doppler: closing speed along the road, exaggerated ×1.6
    const closing = d >= 0 ? (v - ped.vs) : -(v - ped.vs)
    const ratio = clamp(1 + closing * 1.6 / 340, 0.7, 1.4)
    const cents = 1200 * Math.log2(ratio)
    for (const o of voice.oscs) smooth(o.detune, cents, 0.05)
    // schedule ahead (resync after a hidden tab so we never stack a backlog)
    const t = now()
    if (voice.next < t - 0.5) voice.next = t
    let guard = 0
    while (voice.next < t + 0.12 && guard++ < 6) voice.tick(t)
  }

  function pedStop(id, fadeMs) {
    const v = peds[id]
    if (!v) return
    delete peds[id]
    smooth(v.g.gain, 0, (fadeMs || 120) / 1000 / 3)
    const nodes = v.nodes
    later(() => { for (const n of nodes) { try { n.stop() } catch (e) {} } try { v.p.disconnect() } catch (e) {} }, (fadeMs || 120) + 150)
  }

  // =========================================================================
  // ONE-SHOTS
  // =========================================================================
  function hit({rel, v, combo, type, group, pitch}) {
    ensureBus()
    const t0 = now()
    const pan = pedPan(rel) * 0.5
    const p = pitch || 1
    // the thud: wet, low, short
    noiseBurst({t0, peak: 0.55, dur: 0.11, cutoff: 750, sweepTo: 150, kind: 'brown', pan, dest: bus.sfx})
    tone({type: 'sine', freq: 75, glideTo: 34, t0, a: 0.004, hold: 0.05, r: 0.16, peak: 0.42, pan, dest: bus.sfx})
    noiseBurst({t0: t0 + 0.01, peak: 0.16, dur: 0.03, cutoff: 9000, hp: 3500, pan, dest: bus.sfx})
    // the yelp
    yelp({t0: t0 + 0.02, f0: 360 * p, fPeak: 540 * p, fEnd: 150 * p, dur: 0.3, peak: 0.24, pan, dest: bus.sfx})
    // score chime: rises with combo, extra note from ×5, doubled for groups
    const step = Math.min(combo || 1, 12) - 1
    const base = 660 * Math.pow(2, step / 24)
    const d = bus.sfx
    tone({type: 'triangle', freq: base, t0: t0 + 0.06, a: 0.004, hold: 0.03, r: 0.09, peak: 0.2, pan: 0, cutoff: 4000, dest: d})
    tone({type: 'triangle', freq: base * 1.5, t0: t0 + 0.13, a: 0.004, hold: 0.04, r: 0.12, peak: 0.2, pan: 0, cutoff: 4000, dest: d})
    if ((combo || 0) >= 5) tone({type: 'triangle', freq: base * 2, t0: t0 + 0.2, a: 0.004, hold: 0.05, r: 0.14, peak: 0.18, pan: 0, cutoff: 4500, dest: d})
    if (group) tone({type: 'sine', freq: base * 2.5, t0: t0 + 0.27, a: 0.004, hold: 0.05, r: 0.16, peak: 0.14, pan: 0, dest: d})
  }

  function nearMiss(rel) {
    ensureBus()
    const t0 = now()
    const side = Math.sign(rel) || 1
    // a pass-by whoosh that sweeps from the side to behind
    const c = ctx()
    const s = noiseSource('pink')
    const bp = filter('bandpass', 1500, 1.2)
    bp.frequency.setValueAtTime(1800, t0)
    bp.frequency.exponentialRampToValueAtTime(350, t0 + 0.32)
    const g = c.createGain()
    env(g.gain, t0, {a: 0.03, hold: 0.05, r: 0.28, peak: 0.28})
    const p = panner(side * 0.5)
    p.pan.setValueAtTime(side * 0.5, t0)
    p.pan.linearRampToValueAtTime(side * 0.95, t0 + 0.3)
    s.connect(bp).connect(g).connect(p).connect(bus.sfx)
    s.start(t0); s.stop(t0 + 0.5)
    yelp({t0: t0 + 0.05, f0: 260, fPeak: 340, fEnd: 200, dur: 0.24, peak: 0.14, pan: side * 0.8, f1: 500, f2: 1100, dest: bus.sfx})
  }

  function comboLost(combo) {
    if (!combo || combo < 3) return
    ensureBus()
    const t0 = now()
    tone({type: 'triangle', freq: 440, t0, a: 0.005, hold: 0.05, r: 0.1, peak: 0.14, cutoff: 2500, dest: bus.sfx})
    tone({type: 'triangle', freq: 330, t0: t0 + 0.1, a: 0.005, hold: 0.07, r: 0.14, peak: 0.14, cutoff: 2500, dest: bus.sfx})
  }

  function crash({side, vLat, damage}) {
    ensureBus()
    const t0 = now()
    const i = clamp(vLat / 14, 0.25, 1)
    const pan = (side || 0) * 0.7
    const d = bus.sfx
    tone({type: 'sine', freq: 115, glideTo: 36, t0, a: 0.003, hold: 0.06, r: 0.3, peak: 0.6 * i, pan, dest: d})
    noiseBurst({t0, peak: 0.6 * i, dur: 0.26, cutoff: 1900, sweepTo: 220, kind: 'brown', pan, dest: d})
    noiseBurst({t0: t0 + 0.005, peak: 0.28 * i, dur: 0.05, cutoff: 12000, hp: 2500, pan, dest: d})
    for (const f of [1730, 2420, 3610]) {
      tone({type: 'sine', freq: f, t0: t0 + 0.01, a: 0.002, hold: 0.02, r: 0.45, peak: 0.13 * i, pan, dest: d})
    }
    // glass
    const shards = 3 + Math.round(i * 4)
    for (let n = 0; n < shards; n++) {
      noiseBurst({t0: t0 + 0.04 + n * (0.03 + Math.random() * 0.06), peak: 0.1 * i, dur: 0.03, cutoff: 14000, hp: 5000, pan: pan + (Math.random() - 0.5) * 0.4, dest: d})
    }
    if (content.music && content.music.duck) content.music.duck(0.35, 0.7)
  }

  function scrapeStart(side) {
    ensureBus()
    noiseBurst({t0: now(), peak: 0.3, dur: 0.05, cutoff: 600, sweepTo: 200, kind: 'brown', pan: side * 0.8, dest: bus.sfx})
  }

  function gearShift(up) {
    ensureBus()
    noiseBurst({t0: now(), peak: up ? 0.14 : 0.1, dur: 0.035, cutoff: 500, kind: 'brown', dest: bus.car})
  }

  function lockTick() {
    ensureBus()
    const t0 = now()
    tone({type: 'sine', freq: 1150, t0, a: 0.002, hold: 0.008, r: 0.04, peak: 0.12, dest: bus.sfx})
    noiseBurst({t0, peak: 0.05, dur: 0.012, cutoff: 8000, hp: 2500, dest: bus.sfx})
  }

  function levelUp(level) {
    ensureBus()
    const t0 = now()
    const d = bus.sfx
    const notes = [523, 659, 784, 1046]
    notes.forEach((f, i) => {
      tone({type: 'triangle', freq: f, t0: t0 + i * 0.085, a: 0.004, hold: 0.05, r: 0.16, peak: 0.2, cutoff: 4000, dest: d})
    })
    noiseBurst({t0, peak: 0.1, dur: 0.35, a: 0.08, cutoff: 3000, hp: 800, kind: 'pink', dest: d})
  }

  // heartbeat under low health
  let heart = null
  function heartStart() {
    if (heart) return
    ensureBus()
    heart = {next: now() + 0.1, rate: 1.3}
  }
  function heartTick(health) {
    if (!heart) return
    const t = now()
    heart.rate = 1.2 + (1 - clamp(health / K().LOW_HEALTH, 0, 1)) * 1.1
    if (heart.next < t - 0.5) heart.next = t
    while (heart.next < t + 0.15) {
      const t0 = heart.next
      tone({type: 'sine', freq: 62, glideTo: 40, t0, a: 0.004, hold: 0.03, r: 0.12, peak: 0.34, dest: bus.sfx})
      tone({type: 'sine', freq: 54, glideTo: 36, t0: t0 + 0.17, a: 0.004, hold: 0.02, r: 0.1, peak: 0.24, dest: bus.sfx})
      heart.next += 1 / heart.rate
    }
  }
  function heartStop() { heart = null }

  function healthLow() {
    ensureBus()
    const t0 = now()
    tone({type: 'square', freq: 230, t0, a: 0.005, hold: 0.09, r: 0.05, peak: 0.12, cutoff: 900, dest: bus.sfx})
    tone({type: 'square', freq: 230, t0: t0 + 0.2, a: 0.005, hold: 0.09, r: 0.05, peak: 0.12, cutoff: 900, dest: bus.sfx})
    heartStart()
  }

  function death(cause) {
    ensureBus()
    const t0 = now()
    heartStop()
    if (cause === 'crash') {
      crash({side: 0, vLat: 16, damage: 50})
      // secondary tumble
      noiseBurst({t0: t0 + 0.35, peak: 0.4, dur: 0.3, cutoff: 1200, sweepTo: 150, kind: 'brown', dest: bus.sfx})
      noiseBurst({t0: t0 + 0.7, peak: 0.25, dur: 0.25, cutoff: 900, sweepTo: 120, kind: 'brown', dest: bus.sfx})
    } else {
      // the engine coughs and dies
      for (let i = 0; i < 4; i++) {
        noiseBurst({t0: t0 + i * 0.22, peak: 0.22 - i * 0.04, dur: 0.06, cutoff: 500, sweepTo: 120, kind: 'brown', dest: bus.car})
      }
    }
    // steam
    noiseBurst({t0: t0 + 0.6, peak: 0.12, dur: 1.4, a: 0.2, cutoff: 5000, hp: 1500, kind: 'pink', dest: bus.sfx})
  }

  function gameOver() {
    ensureBus()
    const t0 = now()
    const d = bus.sfx
    tone({type: 'triangle', freq: 220, t0, a: 0.01, hold: 0.3, r: 0.35, peak: 0.2, cutoff: 1800, dest: d})
    tone({type: 'triangle', freq: 185, t0: t0 + 0.42, a: 0.01, hold: 0.45, r: 0.6, peak: 0.2, cutoff: 1600, dest: d})
    tone({type: 'sine', freq: 92, t0: t0 + 0.42, a: 0.02, hold: 0.45, r: 0.7, peak: 0.16, dest: d})
  }

  // menu
  function menuMove() { ensureBus(); tone({type: 'sine', freq: 1200, t0: now(), a: 0.002, hold: 0.01, r: 0.05, peak: 0.08, dest: bus.sfx}) }
  function menuSelect() {
    ensureBus(); const t0 = now()
    tone({type: 'triangle', freq: 660, t0, a: 0.004, hold: 0.03, r: 0.08, peak: 0.14, cutoff: 3000, dest: bus.sfx})
    tone({type: 'triangle', freq: 990, t0: t0 + 0.07, a: 0.004, hold: 0.04, r: 0.12, peak: 0.14, cutoff: 3000, dest: bus.sfx})
  }
  function menuBack() {
    ensureBus(); const t0 = now()
    tone({type: 'triangle', freq: 660, t0, a: 0.004, hold: 0.03, r: 0.08, peak: 0.12, cutoff: 3000, dest: bus.sfx})
    tone({type: 'triangle', freq: 440, t0: t0 + 0.07, a: 0.004, hold: 0.04, r: 0.12, peak: 0.12, cutoff: 3000, dest: bus.sfx})
  }

  // =========================================================================
  // FRAME DRIVER
  // =========================================================================
  let lockNext = 0
  const seen = new Set()

  function frame(snap, dt) {
    if (!snap) return
    ensureBus()
    const k = K()
    const c = snap.car
    // resuming from pause: the voices were silenced on exit, bring them back
    if (!car && !starting && snap.phase === 'running') carStart()
    carSet(c, snap.health, snap.phase, dt)
    if (!road) roadStart()
    roadSet(content.road.curvatureAt(c.s + c.v * 0.35))

    // pedestrians
    seen.clear()
    const dying = snap.phase !== 'running'
    for (const p of snap.peds) {
      if (p.dist > snap.hearDist) continue
      seen.add(p.id)
      if (!peds[p.id]) pedStart(p)
      pedSet(p, snap.hearDist, c.v)
    }
    for (const id in peds) if (!seen.has(+id)) pedStop(+id, 250)

    // lined-up tick: nearest pedestrian inside the bonnet corridor
    if (!dying) {
      const t = now()
      const corridor = k.CAR_HALF_W + k.PED_RADIUS - 0.2
      for (const p of snap.peds) {
        if (p.dist <= 0) continue
        if (p.dist / Math.max(c.v, 4) > k.LOCK_TIME) break
        if (Math.abs(p.rel) < corridor) {
          if (t >= lockNext) { lockTick(); lockNext = t + 0.2 }
          break
        }
      }
    }

    heartTick(snap.health)
    if (content.music) content.music.frame(snap, dt)
  }

  function setStaticListener() { /* stereo game — nothing to orient */ }

  function silenceAll() {
    // clear queued timers/intervals FIRST — the stops below schedule their own
    // node-stop timers, which must survive
    for (const id of pendingTimeouts) { clearTimeout(id); clearInterval(id) }
    pendingTimeouts = []
    starting = false
    for (const id in peds) pedStop(+id, 80)
    carStop()
    roadStop()
    heartStop()
    if (content.music) content.music.stop()
  }

  // learn-the-sounds samples
  function sample(which) {
    ensureBus()
    const t0 = now()
    const demoPed = (type, rel) => {
      const ped = {id: 9000 + Math.floor(Math.random() * 1000), type, rel, dist: 20, x: rel, vs: 0, pitch: 1 + (Math.random() - 0.5) * 0.3, voice: Math.floor(Math.random() * 4), state: 'idle'}
      pedStart(ped)
      const id = ped.id
      let t = 0
      const iv = setInterval(() => {
        t += 0.05
        ped.dist = 20 - t * 8
        pedSet(ped, 40, 8)
        if (type === 'crosser' && t > 1.2 && peds[id] && peds[id].mode === 'waiting') { ped.state = 'crossing'; pedCrossing(ped) }
        if (type === 'crosser' && peds[id] && peds[id].mode === 'crossing') { ped.x += -Math.sign(rel || 1) * 1.8 * 0.05; ped.rel = ped.x }
        if (t > 3.2) { clearInterval(iv); pedStop(id, 300) }
      }, 50)
      pendingTimeouts.push(iv)
    }
    switch (which) {
      case 'engine': {
        if (!car) { engineStart() }
        let t = 0
        const iv = setInterval(() => {
          t += 0.05
          const v = clamp((t - 1) * 8, 0, 42)
          const gearTop = content.car.GEAR_TOP
          let gear = 0
          while (gear < gearTop.length - 1 && v / gearTop[gear] > 0.98) gear++
          const rpm = 900 + 6100 * (v / gearTop[gear])
          const x = Math.sin(t * 0.8) * 3.2
          carSet({rpm, throttle: t < 5.5 ? 0.85 : 0, v, x, squeal: 0, slip: 0, contact: 0}, 100, 'running', 0.05)
          if (t > 7) { clearInterval(iv); carStop() }
        }, 50)
        pendingTimeouts.push(iv)
        break
      }
      case 'panLeft': case 'panRight': {
        const side = which === 'panLeft' ? -1 : 1
        if (!car) carStart()
        let t = 0
        const iv = setInterval(() => {
          t += 0.05
          carSet({rpm: 3200, throttle: 0.4, v: 25, x: side * Math.min(3.6, t * 2.2), squeal: 0, slip: 0, contact: 0}, 100, 'running', 0.05)
          if (t > 2.6) { clearInterval(iv); carStop() }
        }, 50)
        pendingTimeouts.push(iv)
        break
      }
      case 'roadLeft': case 'roadRight': {
        const dir = which === 'roadLeft' ? -1 : 1
        roadStart()
        let t = 0
        const iv = setInterval(() => {
          t += 0.05
          const tight = t < 1.5 ? t / 1.5 : t < 3 ? 1 : Math.max(0, 1 - (t - 3) / 1)
          roadSet(dir * tight / 55)
          if (t > 4.2) { clearInterval(iv); roadStop() }
        }, 50)
        pendingTimeouts.push(iv)
        break
      }
      case 'callout1': callout(-1, 1); break
      case 'callout2': callout(1, 2); break
      case 'callout3': callout(-1, 3); break
      case 'callout4': callout(1, 4); break
      case 'squeal': {
        if (!car) carStart()
        let t = 0
        const iv = setInterval(() => {
          t += 0.05
          const sq = t < 0.6 ? t / 0.6 : 1
          carSet({rpm: 4200, throttle: 0.3, v: 30, x: 0, squeal: sq, slip: t > 1.4 ? Math.min(1, (t - 1.4)) : 0, contact: 0}, 100, 'running', 0.05)
          if (t > 2.8) { clearInterval(iv); carStop() }
        }, 50)
        pendingTimeouts.push(iv)
        break
      }
      case 'rumble': {
        if (!car) carStart()
        let t = 0
        const iv = setInterval(() => {
          t += 0.05
          carSet({rpm: 3600, throttle: 0.4, v: 28, x: 3.4 + Math.min(1.0, t * 0.6), squeal: 0, slip: 0, contact: 0}, 100, 'running', 0.05)
          if (t > 2.4) { clearInterval(iv); carStop() }
        }, 50)
        pendingTimeouts.push(iv)
        break
      }
      case 'scrape': {
        if (!car) carStart()
        scrapeStart(1)
        let t = 0
        const iv = setInterval(() => {
          t += 0.05
          carSet({rpm: 3600, throttle: 0.2, v: 26 - t * 3, x: 4.5, squeal: 0, slip: 0, contact: 1}, 100, 'running', 0.05)
          if (t > 2.2) { clearInterval(iv); carStop() }
        }, 50)
        pendingTimeouts.push(iv)
        break
      }
      case 'crash': crash({side: 1, vLat: 12, damage: 30}); break
      case 'talker': demoPed('talker', -1.5); break
      case 'whistler': demoPed('whistler', 1.8); break
      case 'phone': demoPed('phone', -2.5); break
      case 'jogger': demoPed('jogger', 3.0); break
      case 'crosser': demoPed('crosser', 4.2); break
      case 'lock': { let n = 0; const iv = setInterval(() => { lockTick(); if (++n >= 6) clearInterval(iv) }, 200); pendingTimeouts.push(iv); break }
      case 'hit': hit({rel: 0.3, v: 30, combo: 1, type: 'talker'}); break
      case 'hitCombo': hit({rel: -0.5, v: 40, combo: 6, type: 'talker'}); break
      case 'nearMiss': nearMiss(1.2); break
      case 'comboLost': comboLost(5); break
      case 'levelUp': levelUp(2); break
      case 'healthLow': healthLow(); later(() => heartStop(), 4000); break
      case 'gearShift': gearShift(true); later(() => gearShift(false), 500); break
      case 'gameOver': gameOver(); break
      case 'engineStart': engineStart(); later(() => carStop(), 3000); break
      default: break
    }
  }

  return {
    // lifecycle
    engineStart, carStart, carStop, roadStart, roadStop, frame, silenceAll, setStaticListener,
    // pedestrians
    pedStart, pedStop, pedCrossing,
    // one-shots
    hit, nearMiss, comboLost, crash, scrapeStart, gearShift, callout, levelUp, healthLow, heartStop, death, gameOver,
    menuMove, menuSelect, menuBack, lockTick,
    sample,
    bus: () => ensureBus(),
    helpers: {tone, noiseBurst, noiseSource, env, panner, filter, gainNode, later, clamp, now},
  }
})()
