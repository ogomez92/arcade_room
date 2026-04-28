content.creatures = (() => {
  const env = (param, t0, a, h, r, peak) => {
    param.cancelScheduledValues(t0)
    param.setValueAtTime(0, t0)
    param.linearRampToValueAtTime(peak, t0 + a)
    param.setValueAtTime(peak, t0 + a + h)
    param.linearRampToValueAtTime(0, t0 + a + h + r)
  }

  function ctx () { return engine.context() }

  // Each voice receives `mono`, the mono input gain into the binaural ear.
  // The ear handles L/R spatialization internally based on its update().

  // ---- Frog (Q) — low square ribbits with a quick croak.
  const frog = {
    pop: (mono, when) => {
      const c = ctx()
      const o = c.createOscillator()
      const g = c.createGain()
      const lp = c.createBiquadFilter()
      o.type = 'square'
      lp.type = 'lowpass'
      lp.frequency.value = 900
      o.connect(lp).connect(g).connect(mono)
      o.frequency.setValueAtTime(180, when)
      o.frequency.linearRampToValueAtTime(120, when + 0.08)
      o.frequency.linearRampToValueAtTime(165, when + 0.18)
      o.frequency.linearRampToValueAtTime(95, when + 0.32)
      env(g.gain, when, 0.01, 0.05, 0.06, 0.45)
      env(g.gain, when + 0.16, 0.01, 0.05, 0.10, 0.40)
      o.start(when)
      o.stop(when + 0.45)
      return {duration: 0.45}
    },
    bonk: (mono, when) => bonkVoiced(mono, when, {f0: 220, fEnd: 70, type: 'sawtooth', squeak: 880}),
    hide: (mono, when) => sneak(mono, when, {f0: 130, fEnd: 60, type: 'square'}),
  }

  // ---- Bird (E) — high sine chirp with a quick rising sweep.
  const bird = {
    pop: (mono, when) => {
      const c = ctx()
      function chirp(t, f1, f2, dur, peak) {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(f1, t)
        o.frequency.exponentialRampToValueAtTime(f2, t + dur)
        env(g.gain, t, 0.005, 0.02, dur - 0.025, peak)
        o.connect(g).connect(mono)
        o.start(t)
        o.stop(t + dur + 0.05)
      }
      chirp(when,         1900, 2500, 0.09, 0.35)
      chirp(when + 0.13,  2200, 3000, 0.07, 0.30)
      chirp(when + 0.24,  2400, 1800, 0.10, 0.32)
      return {duration: 0.40}
    },
    bonk: (mono, when) => bonkVoiced(mono, when, {f0: 1200, fEnd: 280, type: 'triangle', squeak: 2400}),
    hide: (mono, when) => sneak(mono, when, {f0: 1500, fEnd: 800, type: 'sine'}),
  }

  // ---- Cat (T) — meow: triangle with vibrato, sweep up then down.
  const cat = {
    pop: (mono, when) => {
      const c = ctx()
      const o = c.createOscillator()
      const lfo = c.createOscillator()
      const lfoG = c.createGain()
      const g = c.createGain()
      o.type = 'triangle'
      lfo.type = 'sine'
      lfo.frequency.value = 7
      lfoG.gain.value = 18
      lfo.connect(lfoG).connect(o.detune)
      o.connect(g).connect(mono)
      o.frequency.setValueAtTime(420, when)
      o.frequency.linearRampToValueAtTime(720, when + 0.15)
      o.frequency.linearRampToValueAtTime(360, when + 0.55)
      env(g.gain, when, 0.04, 0.30, 0.20, 0.32)
      o.start(when); lfo.start(when)
      o.stop(when + 0.6); lfo.stop(when + 0.6)
      return {duration: 0.55}
    },
    bonk: (mono, when) => bonkVoiced(mono, when, {f0: 700, fEnd: 200, type: 'sawtooth', squeak: 1500}),
    hide: (mono, when) => sneak(mono, when, {f0: 500, fEnd: 220, type: 'triangle'}),
  }

  // ---- Pup (Z) — short bark: noise burst + low tone.
  const pup = {
    pop: (mono, when) => {
      const c = ctx()
      function bark(t, f1, f2, peak) {
        const o = c.createOscillator()
        const g = c.createGain()
        const noise = c.createBufferSource()
        const ng = c.createGain()
        const buf = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
        noise.buffer = buf
        const hp = c.createBiquadFilter()
        hp.type = 'bandpass'
        hp.frequency.value = 900
        noise.connect(hp).connect(ng).connect(mono)

        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f1, t)
        o.frequency.exponentialRampToValueAtTime(f2, t + 0.10)
        o.connect(g).connect(mono)

        env(g.gain, t, 0.005, 0.04, 0.07, peak)
        env(ng.gain, t, 0.005, 0.03, 0.05, peak * 0.6)

        o.start(t); noise.start(t)
        o.stop(t + 0.13); noise.stop(t + 0.13)
      }
      bark(when, 320, 140, 0.34)
      bark(when + 0.20, 340, 130, 0.30)
      return {duration: 0.40}
    },
    bonk: (mono, when) => bonkVoiced(mono, when, {f0: 320, fEnd: 80, type: 'sawtooth', squeak: 700}),
    hide: (mono, when) => sneak(mono, when, {f0: 200, fEnd: 90, type: 'sawtooth'}),
  }

  // ---- Owl (C) — hoot: low sine pulses.
  const owl = {
    pop: (mono, when) => {
      const c = ctx()
      function hoot(t) {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = 'sine'
        o.frequency.setValueAtTime(310, t)
        o.frequency.linearRampToValueAtTime(260, t + 0.08)
        o.frequency.linearRampToValueAtTime(280, t + 0.25)
        o.connect(g).connect(mono)
        env(g.gain, t, 0.03, 0.12, 0.12, 0.40)
        o.start(t); o.stop(t + 0.30)
      }
      hoot(when)
      hoot(when + 0.30)
      return {duration: 0.55}
    },
    bonk: (mono, when) => bonkVoiced(mono, when, {f0: 280, fEnd: 90, type: 'triangle', squeak: 1100}),
    hide: (mono, when) => sneak(mono, when, {f0: 240, fEnd: 110, type: 'sine'}),
  }

  // ---- Mouse (B) — fast high squeaks.
  const mouse = {
    pop: (mono, when) => {
      const c = ctx()
      function sq(t, f, dur, peak) {
        const o = c.createOscillator()
        const g = c.createGain()
        o.type = 'square'
        o.frequency.setValueAtTime(f, t)
        o.frequency.linearRampToValueAtTime(f * 1.4, t + dur)
        const lp = c.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 4000
        o.connect(lp).connect(g).connect(mono)
        env(g.gain, t, 0.005, 0.01, dur - 0.02, peak)
        o.start(t); o.stop(t + dur + 0.02)
      }
      sq(when,         1500, 0.06, 0.20)
      sq(when + 0.09,  1700, 0.05, 0.20)
      sq(when + 0.16,  1900, 0.07, 0.22)
      return {duration: 0.30}
    },
    bonk: (mono, when) => bonkVoiced(mono, when, {f0: 1700, fEnd: 600, type: 'square', squeak: 2600}),
    hide: (mono, when) => sneak(mono, when, {f0: 1800, fEnd: 1100, type: 'square'}),
  }

  // ---- Shared "comedic bonk + squeak" used as the hurt sound across critters.
  function bonkVoiced(mono, when, {f0, fEnd, type, squeak}) {
    const c = ctx()
    // Wood-clonk first 80ms.
    const o = c.createOscillator()
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1400
    o.type = 'sine'
    o.frequency.setValueAtTime(280, when)
    o.frequency.exponentialRampToValueAtTime(80, when + 0.08)
    o.connect(lp).connect(g).connect(mono)
    env(g.gain, when, 0.001, 0.01, 0.08, 0.55)
    o.start(when); o.stop(when + 0.10)

    // Critter "ouch" tail — quick sweep down on the critter's own timbre.
    const o2 = c.createOscillator()
    const g2 = c.createGain()
    o2.type = type
    o2.frequency.setValueAtTime(f0, when + 0.05)
    o2.frequency.exponentialRampToValueAtTime(fEnd, when + 0.40)
    o2.connect(g2).connect(mono)
    env(g2.gain, when + 0.05, 0.01, 0.06, 0.30, 0.30)
    o2.start(when + 0.05); o2.stop(when + 0.45)

    // Tiny squeak right after the clonk.
    const o3 = c.createOscillator()
    const g3 = c.createGain()
    o3.type = 'sine'
    o3.frequency.setValueAtTime(squeak, when + 0.06)
    o3.frequency.exponentialRampToValueAtTime(squeak * 1.4, when + 0.16)
    o3.connect(g3).connect(mono)
    env(g3.gain, when + 0.06, 0.005, 0.04, 0.05, 0.18)
    o3.start(when + 0.06); o3.stop(when + 0.20)

    return {duration: 0.45}
  }

  // ---- Shared "going back" sneak: a downward gliss on the critter's timbre.
  function sneak(mono, when, {f0, fEnd, type}) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, when)
    o.frequency.exponentialRampToValueAtTime(fEnd, when + 0.35)
    o.connect(g).connect(mono)
    env(g.gain, when, 0.02, 0.02, 0.30, 0.18)
    o.start(when); o.stop(when + 0.40)
    return {duration: 0.40}
  }

  const byKey = {q: frog, e: bird, t: cat, z: pup, c: owl, b: mouse}

  function play(slot, kind) {
    const def = byKey[slot.critter]
    if (!def || !def[kind]) return
    const {ear, mono} = content.audio.spawnVoice(slot.x, slot.y)
    const when = engine.time() + 0.02
    const out = def[kind](mono, when)
    const lifetime = (out && out.duration) || 0.5
    setTimeout(() => {
      try { ear.destroy() } catch (e) {}
      try { mono.disconnect() } catch (e) {}
    }, (lifetime + 0.4) * 1000)
  }

  return {
    play,
    keys: () => Object.keys(byKey),
  }
})()
