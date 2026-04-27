// Procedural audio for Villains from Beyond.
//
// Sound design uses syngen's WebAudio context directly. Spatial sounds are
// panned via the lateral axis (x = 0..10, player at this.player.x) and
// pitch-attenuated by forward distance (ey - py) so distant enemies still
// have presence but localize correctly behind/ahead.
//
// We emulate the original game's `engine.pool` of 2D-positioned sounds with
// simple StereoPanner + GainNode chains.

content.audio = (() => {
  let ctx, out

  function init() {
    if (ctx) return
    ctx = engine.context()
    out = engine.mixer.input()
  }

  function makePanner(ex, ey, py = 0, refY = 30) {
    const panNode = ctx.createStereoPanner()
    const lateral = engine.fn.clamp((ex - 5) / 5, -1, 1)
    panNode.pan.value = lateral

    const fwd = Math.max(0, ey - py)
    const distGain = engine.fn.clamp(1 - fwd / refY, 0.1, 1)

    const gain = ctx.createGain()
    gain.gain.value = distGain

    panNode.connect(gain)
    return {input: panNode, output: gain, distGain, lateral, fwd}
  }

  function envelope(gainParam, when, attack, sustain, release, peak = 1) {
    const t0 = when
    gainParam.cancelScheduledValues(t0)
    gainParam.setValueAtTime(0, t0)
    gainParam.linearRampToValueAtTime(peak, t0 + attack)
    gainParam.setValueAtTime(peak, t0 + attack + sustain)
    gainParam.exponentialRampToValueAtTime(0.0001, t0 + attack + sustain + release)
  }

  function tone({freq, type = 'sine', duration = 0.2, peak = 0.4, ex = 5, ey = 0, py = 0, sweep = 0, attack = 0.01, release = 0.05}) {
    init()
    const when = ctx.currentTime
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    if (sweep) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), when + duration)
    }

    const gain = ctx.createGain()
    osc.connect(gain)

    const panner = makePanner(ex, ey, py)
    gain.connect(panner.input)
    panner.output.connect(out)

    envelope(gain.gain, when, attack, Math.max(0, duration - attack - release), release, peak * panner.distGain)

    osc.start(when)
    osc.stop(when + duration + 0.05)
    return {stop: (t) => { try { osc.stop(t || ctx.currentTime) } catch (_) {} }}
  }

  function noise({duration = 0.2, peak = 0.3, ex = 5, ey = 0, py = 0, color = 'white', filter}) {
    init()
    const when = ctx.currentTime
    const buffer = color == 'pink'
      ? engine.buffer.pinkNoise({channels: 1, duration})
      : color == 'brown'
        ? engine.buffer.brownNoise({channels: 1, duration})
        : engine.buffer.whiteNoise({channels: 1, duration})

    const src = ctx.createBufferSource()
    src.buffer = buffer

    let last = src

    if (filter) {
      const flt = ctx.createBiquadFilter()
      flt.type = filter.type || 'lowpass'
      flt.frequency.value = filter.freq || 1000
      flt.Q.value = filter.q || 1
      last.connect(flt)
      last = flt
    }

    const gain = ctx.createGain()
    last.connect(gain)

    const panner = makePanner(ex, ey, py)
    gain.connect(panner.input)
    panner.output.connect(out)

    envelope(gain.gain, when, 0.005, Math.max(0, duration - 0.05), 0.05, peak * panner.distGain)

    src.start(when)
    src.stop(when + duration + 0.05)
    return {stop: (t) => { try { src.stop(t || ctx.currentTime) } catch (_) {} }}
  }

  function loop({freq, type = 'square', detune = 0, peak = 0.4, ex = 5, ey = 0, py = 0}) {
    init()
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune

    // Steady gain (no LFO tremolo — that was making distant enemies inaudible
    // at the modulation troughs).
    const main = ctx.createGain()
    main.gain.value = peak

    osc.connect(main)

    const panner = ctx.createStereoPanner()
    panner.pan.value = engine.fn.clamp((ex - 5) / 5, -1, 1)

    const distGain = ctx.createGain()
    const fwd = Math.max(0, ey - py)
    distGain.gain.value = engine.fn.clamp(1 - fwd / 60, 0.35, 1)

    main.connect(panner)
    panner.connect(distGain)
    distGain.connect(out)

    osc.start()

    let stopped = false
    return {
      setPos: (nex, ney, npy) => {
        if (stopped) return
        panner.pan.setTargetAtTime(engine.fn.clamp((nex - 5) / 5, -1, 1), ctx.currentTime, 0.04)
        const f = Math.max(0, ney - npy)
        distGain.gain.setTargetAtTime(engine.fn.clamp(1 - f / 60, 0.35, 1), ctx.currentTime, 0.04)
      },
      setFreq: (f) => {
        if (stopped) return
        osc.frequency.setTargetAtTime(f, ctx.currentTime, 0.05)
      },
      stop: () => {
        if (stopped) return
        stopped = true
        const t = ctx.currentTime
        distGain.gain.cancelScheduledValues(t)
        distGain.gain.setValueAtTime(distGain.gain.value, t)
        distGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
        try { osc.stop(t + 0.15) } catch (_) {}
      },
    }
  }

  function ui(freq, dur = 0.1, type = 'sine', peak = 0.3) {
    return tone({freq, duration: dur, type, peak, ex: 5, ey: 0})
  }

  // Music: simple looped pad layer
  function startMusic(level = 1) {
    init()
    if (musicNodes) return
    const root = 110 + (level - 1) * 5
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = root
    const osc2 = ctx.createOscillator(); osc2.type = 'square';   osc2.frequency.value = root * 1.5
    const osc3 = ctx.createOscillator(); osc3.type = 'triangle'; osc3.frequency.value = root * 0.5

    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.25
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 6
    lfo.connect(lfoGain); lfoGain.connect(osc2.detune)

    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 600; flt.Q.value = 2

    const g = ctx.createGain(); g.gain.value = 0.025
    osc1.connect(flt); osc2.connect(flt); osc3.connect(flt)
    flt.connect(g); g.connect(out)
    osc1.start(); osc2.start(); osc3.start(); lfo.start()
    musicNodes = {oscs: [osc1, osc2, osc3, lfo], g}
  }

  function stopMusic() {
    if (!musicNodes) return
    const t = ctx.currentTime
    const {oscs, g} = musicNodes
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    oscs.forEach((o) => { try { o.stop(t + 0.55) } catch (_) {} })
    musicNodes = null
  }

  let musicNodes = null

  // Engine looped sound: subtle low rumble that pitches up with ship speed
  // and down with slower ship speed. Kept quiet so enemy loops stay audible.
  function startEngine() {
    init()
    if (engineNodes) return

    // Low oscillator (rumble) + slightly higher tone for harmonic body.
    const osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 60
    const osc2 = ctx.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 90

    // Heavy lowpass so the engine sits under everything else as a hum.
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 280; flt.Q.value = 0.5

    const g = ctx.createGain(); g.gain.value = 0.012

    osc1.connect(flt); osc2.connect(flt)
    flt.connect(g); g.connect(out)
    osc1.start(); osc2.start()
    engineNodes = {osc1, osc2, g}
  }

  function setEnginePitch(speed) {
    if (!engineNodes) return
    const t = ctx.currentTime
    // Map game's `speed` (ms-per-step: 300 fastest, 700 slowest) onto a
    // pitch range so faster ship = higher pitch.
    // 300 -> ratio 1 (fastest, highest); 700 -> ratio 0 (slowest, lowest).
    const ratio = engine.fn.clamp((700 - speed) / 400, 0, 1)
    const base1 = 45 + ratio * 70   // 45..115 Hz
    const base2 = 70 + ratio * 90   // 70..160 Hz
    engineNodes.osc1.frequency.setTargetAtTime(base1, t, 0.06)
    engineNodes.osc2.frequency.setTargetAtTime(base2, t, 0.06)
  }

  function stopEngine() {
    if (!engineNodes) return
    const t = ctx.currentTime
    const {osc1, osc2, g} = engineNodes
    g.gain.cancelScheduledValues(t)
    g.gain.setValueAtTime(g.gain.value, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2)
    try { osc1.stop(t + 0.25) } catch (_) {}
    try { osc2.stop(t + 0.25) } catch (_) {}
    engineNodes = null
  }

  let engineNodes = null

  return {
    init,
    get ctx() { return ctx },
    tone,
    noise,
    loop,
    ui,
    startMusic, stopMusic,
    startEngine, stopEngine, setEnginePitch,
    // Player weapons
    beam: (ex, ey, py) => tone({freq: 880, type: 'sawtooth', duration: 0.12, peak: 0.35, sweep: 1200, ex, ey, py}),
    bomb: (ex, ey, py) => noise({duration: 0.18, peak: 0.4, ex, ey, py, filter: {type: 'lowpass', freq: 800}}),
    bombHit: (ex, ey, py) => noise({duration: 0.5, peak: 0.7, ex, ey, py, color: 'brown', filter: {type: 'lowpass', freq: 600}}),
    beamHit: (ex, ey, py) => tone({freq: 1500, type: 'square', duration: 0.08, peak: 0.4, sweep: -800, ex, ey, py}),
    bitShot: () => tone({freq: 1200, type: 'sawtooth', duration: 0.25, peak: 0.5, sweep: 2000}),
    burst: () => {
      noise({duration: 0.4, peak: 0.5, color: 'white', filter: {type: 'highpass', freq: 600}})
      tone({freq: 80, type: 'sawtooth', duration: 0.3, peak: 0.4, sweep: -40})
    },
    shieldHit: (ex, ey, py) => tone({freq: 600, type: 'square', duration: 0.15, peak: 0.4, sweep: 1200, ex, ey, py}),
    shieldExp: () => {
      tone({freq: 200, type: 'sawtooth', duration: 0.6, peak: 0.4, sweep: -150})
      noise({duration: 0.6, peak: 0.4, color: 'pink'})
    },
    die: () => {
      tone({freq: 220, type: 'sawtooth', duration: 0.8, peak: 0.5, sweep: -180})
      noise({duration: 0.6, peak: 0.4, color: 'pink', filter: {type: 'lowpass', freq: 1000}})
    },
    extend: () => {
      tone({freq: 660, type: 'triangle', duration: 0.15, peak: 0.4})
      setTimeout(() => tone({freq: 990, type: 'triangle', duration: 0.2, peak: 0.4}), 130)
    },
    combo: (n) => tone({freq: 440 + 60 * n, type: 'square', duration: 0.06, peak: 0.3}),
    enemyShot: (ex, ey, py) => tone({freq: 600, type: 'sawtooth', duration: 0.1, peak: 0.3, sweep: -300, ex, ey, py}),
    enemyShootWarn: (ex, ey, py) => tone({freq: 300, type: 'square', duration: 0.15, peak: 0.25, ex, ey, py}),
    sphereWarn: (ex, ey, py) => tone({freq: 200, type: 'sawtooth', duration: 0.3, peak: 0.3, sweep: 250, ex, ey, py}),
    sphereExp: (ex, ey, py) => {
      tone({freq: 100, type: 'sawtooth', duration: 0.7, peak: 0.6, sweep: -50, ex, ey, py})
      noise({duration: 0.6, peak: 0.5, color: 'brown', ex, ey, py})
    },
    itemAppear: (ex, ey, py) => tone({freq: 800, type: 'triangle', duration: 0.4, peak: 0.4, sweep: 600, ex, ey, py}),
    itemObtain: () => {
      tone({freq: 520, type: 'triangle', duration: 0.1, peak: 0.4})
      setTimeout(() => tone({freq: 780, type: 'triangle', duration: 0.1, peak: 0.4}), 80)
      setTimeout(() => tone({freq: 1040, type: 'triangle', duration: 0.2, peak: 0.4}), 160)
    },
    itemPop: () => tone({freq: 200, type: 'sawtooth', duration: 0.2, peak: 0.3, sweep: -150}),
    levelUp: () => {
      ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({freq: f, type: 'triangle', duration: 0.18, peak: 0.4}), i * 130))
    },
    ready: () => {
      ;[392, 523].forEach((f, i) => setTimeout(() => tone({freq: f, type: 'triangle', duration: 0.2, peak: 0.4}), i * 200))
    },
    levelEnd: (ex, ey, py) => tone({freq: 400, type: 'triangle', duration: 0.2, peak: 0.3, ex, ey, py}),
    genesisAppear: () => {
      tone({freq: 80, type: 'sawtooth', duration: 1.4, peak: 0.5, sweep: 200})
      noise({duration: 1.4, peak: 0.4, color: 'brown'})
    },
    genesisDie: () => {
      tone({freq: 160, type: 'sawtooth', duration: 1.5, peak: 0.6, sweep: -120})
      noise({duration: 1.2, peak: 0.5, color: 'pink'})
    },
    genesisDanger: (ex, ey, py) => loop({freq: 220, type: 'sawtooth', peak: 0.18, ex, ey, py}),
    diegenesis: () => {
      tone({freq: 100, type: 'sawtooth', duration: 1.0, peak: 0.6, sweep: -60})
      noise({duration: 1.0, peak: 0.4, color: 'brown'})
    },
    towerAlarm: () => {
      ;[0, 0.3, 0.6].forEach((dt) => setTimeout(() => tone({freq: 880, type: 'square', duration: 0.08, peak: 0.4}), dt * 1000))
    },
    towerAppear: (ex, ey, py) => tone({freq: 320, type: 'square', duration: 0.4, peak: 0.4, sweep: 200, ex, ey, py}),
    towerDestroy: (ex, ey, py) => {
      tone({freq: 200, type: 'sawtooth', duration: 0.6, peak: 0.6, sweep: -120, ex, ey, py})
      noise({duration: 0.5, peak: 0.5, color: 'brown', ex, ey, py})
    },
    edgeWarn: () => tone({freq: 220, type: 'sawtooth', duration: 0.06, peak: 0.2}),
    turnSound: (left) => tone({freq: 500, type: 'square', duration: 0.05, peak: 0.2, ex: left ? 0 : 10, ey: 0}),
    speedShift: (up) => tone({freq: up ? 700 : 400, type: 'square', duration: 0.07, peak: 0.25}),
    avoid: () => tone({freq: 1500, type: 'triangle', duration: 0.04, peak: 0.15}),
    pauseTone: () => tone({freq: 440, type: 'sine', duration: 0.15, peak: 0.3}),
  }
})()
