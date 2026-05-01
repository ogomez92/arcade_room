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

  // Pan relative to the player's lateral position so the player is always
  // dead-center of the stereo image — they aim by lining up *with* an enemy,
  // not by predicting where the player happens to be on the world grid.
  // Capped at ±0.85 so extremes feel directional, not painful on headphones.
  const PAN_CAP = 0.85
  function lateralPan(ex) {
    const px = (content.state && content.state.session) ? content.state.session.x : 5
    return engine.fn.clamp((ex - px) / 5, -1, 1) * PAN_CAP
  }

  function makePanner(ex, ey, py = 0, refY = 30) {
    const panNode = ctx.createStereoPanner()
    const lateral = lateralPan(ex)
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

  function tone({freq, type = 'sine', duration = 0.2, peak = 0.4, ex = 5, ey = 0, py = 0, sweep = 0, attack = 0.01, release = 0.05, refY = 30}) {
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

    const panner = makePanner(ex, ey, py, refY)
    gain.connect(panner.input)
    panner.output.connect(out)

    envelope(gain.gain, when, attack, Math.max(0, duration - attack - release), release, peak * panner.distGain)

    osc.start(when)
    osc.stop(when + duration + 0.05)
    return {stop: (t) => { try { osc.stop(t || ctx.currentTime) } catch (_) {} }}
  }

  function noise({duration = 0.2, peak = 0.3, ex = 5, ey = 0, py = 0, color = 'white', filter, refY = 30}) {
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

    const panner = makePanner(ex, ey, py, refY)
    gain.connect(panner.input)
    panner.output.connect(out)

    envelope(gain.gain, when, 0.005, Math.max(0, duration - 0.05), 0.05, peak * panner.distGain)

    src.start(when)
    src.stop(when + duration + 0.05)
    return {stop: (t) => { try { src.stop(t || ctx.currentTime) } catch (_) {} }}
  }

  // Melodic variant of loop(): clean, slightly chorused, recognizable pitch.
  // Used for collectibles where the player wants to identify the item type
  // by its tone, not by its grit.
  function melodicLoop({freq, type, detune, peak, ex, ey, py}) {
    const osc1 = ctx.createOscillator(); osc1.type = type
    osc1.frequency.value = freq; osc1.detune.value = detune - 6
    const osc2 = ctx.createOscillator(); osc2.type = type
    osc2.frequency.value = freq; osc2.detune.value = detune + 6

    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'
    flt.frequency.value = Math.min(2400, Math.max(900, freq * 4))
    flt.Q.value = 0.4

    const main = ctx.createGain(); main.gain.value = peak * 0.55
    osc1.connect(flt); osc2.connect(flt); flt.connect(main)

    const panner = ctx.createStereoPanner()
    panner.pan.value = lateralPan(ex)
    const distGain = ctx.createGain()
    const fwd = Math.max(0, ey - py)
    distGain.gain.value = engine.fn.clamp(1 - fwd / 60, 0.35, 1)
    main.connect(panner); panner.connect(distGain); distGain.connect(out)
    osc1.start(); osc2.start()

    let stopped = false
    return {
      setPos: (nex, ney, npy) => {
        if (stopped) return
        panner.pan.setTargetAtTime(lateralPan(nex), ctx.currentTime, 0.04)
        const f = Math.max(0, ney - npy)
        distGain.gain.setTargetAtTime(engine.fn.clamp(1 - f / 60, 0.35, 1), ctx.currentTime, 0.04)
      },
      setFreq: (f) => {
        if (stopped) return
        osc1.frequency.setTargetAtTime(f, ctx.currentTime, 0.05)
        osc2.frequency.setTargetAtTime(f, ctx.currentTime, 0.05)
        flt.frequency.setTargetAtTime(Math.min(2400, Math.max(900, f * 4)), ctx.currentTime, 0.08)
      },
      stop: () => {
        if (stopped) return
        stopped = true
        const t = ctx.currentTime
        distGain.gain.cancelScheduledValues(t)
        distGain.gain.setValueAtTime(distGain.gain.value, t)
        distGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1)
        try { osc1.stop(t + 0.15) } catch (_) {}
        try { osc2.stop(t + 0.15) } catch (_) {}
      },
    }
  }

  // Continuous "spaceship" loops — these are deliberately *not* held notes.
  // Each `kind` is a textural identity: turbine air, generator hum, plasma
  // drone, tank tread. The listener identifies an enemy by what kind of
  // machine it sounds like, not by what pitch is playing. Tonal layers are
  // present only as colour and are buried under noise/filter work so a
  // screenful of ships reads as a soundscape rather than a chord.
  function loop(opts = {}) {
    init()
    const {kind = 'flier-light', ex = 5, ey = 0, py = 0, peak = 0.35, freq, type, mech} = opts

    // Items and other gameplay-critical "must be a recognizable pitch" cues
    // bypass spaceship-mode and use the melodic loop.
    if (kind === 'item' || mech === false) {
      return melodicLoop({freq: freq || 600, type: type || 'triangle', detune: 0, peak, ex, ey, py})
    }

    const t0 = ctx.currentTime

    // Output chain shared by every spaceship kind.
    const master = ctx.createGain(); master.gain.value = 0
    const panner = ctx.createStereoPanner(); panner.pan.value = lateralPan(ex)
    const distGain = ctx.createGain()
    const fwd = Math.max(0, ey - py)
    distGain.gain.value = engine.fn.clamp(1 - fwd / 60, 0.35, 1)
    master.connect(panner); panner.connect(distGain); distGain.connect(out)

    // Per-instance jitter so duplicates of the same enemy don't phase-lock
    // into a single uncannily synchronised LFO/pitch.
    const jit = ((ex * 0.071 + ey * 0.013 + Math.random() * 0.4) % 1) + 0.001
    const cents = (jit - 0.5) * 30                // ±15 cents per instance
    const rate = 1 + (jit - 0.5) * 0.3            // ±15% LFO rate

    const started = []  // anything that needs .start(t0) / .stop(t)
    const o = (t, f, det = 0) => {
      const x = ctx.createOscillator(); x.type = t; x.frequency.value = f
      if (det) x.detune.value = det
      started.push(x); return x
    }
    const n = (color, dur = 2) => {
      const buf = color === 'brown' ? engine.buffer.brownNoise({channels: 1, duration: dur})
                : color === 'pink'  ? engine.buffer.pinkNoise({channels: 1, duration: dur})
                                    : engine.buffer.whiteNoise({channels: 1, duration: dur})
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true
      started.push(s); return s
    }
    const g = (v) => { const x = ctx.createGain(); x.gain.value = v; return x }
    const f = (t, fr, q = 1) => {
      const x = ctx.createBiquadFilter(); x.type = t; x.frequency.value = fr; x.Q.value = q; return x
    }
    // 0..1 amplitude gate driven by a sine LFO at `hz`. Built by summing
    // (lfo*0.5) and a constant 0.5 into a zero-valued GainNode's gain
    // AudioParam. The signal passing through that node is therefore
    // multiplied by an amplitude that swings 0→1.
    const tremolo = (hz) => {
      const lfo = o('sine', hz)
      const half = g(0.5)
      const bias = ctx.createConstantSource(); bias.offset.value = 0.5
      started.push(bias)
      const gate = g(0)
      lfo.connect(half); half.connect(gate.gain); bias.connect(gate.gain)
      return gate
    }

    let masterPeak = peak * 0.30   // tuned per-kind below

    switch (kind) {
      // Ground enemies: steady, tremolo-free drones. Air enemies (below)
      // keep their tremolos/breathing filters so the listener can tell at
      // a glance "this thing is on the ground" vs "this thing is flying".
      case 'tower': {
        // Heavy stationary generator — mains-style hum + brown rumble +
        // mid grind. All layers steady; no LFO modulation anywhere.
        const hum = o('square', 50, cents)
        const humLp = f('lowpass', 170, 0.5)
        const humG = g(0.34)
        hum.connect(humLp); humLp.connect(humG); humG.connect(master)

        const grind = n('pink')
        const grindBp = f('bandpass', 320, 1.6)
        const grindG = g(0.28)
        grind.connect(grindBp); grindBp.connect(grindG); grindG.connect(master)

        const rum = n('brown')
        const rumLp = f('lowpass', 280, 0.7)
        const rumG = g(0.55)
        rum.connect(rumLp); rumLp.connect(rumG); rumG.connect(master)
        masterPeak = peak * 0.5
        break
      }

      case 'ground-base': {
        // Industrial emplacement — three steady layers (deep grind,
        // resonant mid hum, sub body). No tremolo: ground enemy.
        const grind = n('brown')
        const grindLp = f('lowpass', 320, 0.7)
        const grindG = g(0.7)
        grind.connect(grindLp); grindLp.connect(grindG); grindG.connect(master)

        const hum = n('pink')
        const humBp = f('bandpass', 240, 1.4)
        const humG = g(0.42)
        hum.connect(humBp); humBp.connect(humG); humG.connect(master)

        const body = o('sawtooth', 70 * (1 + (jit - 0.5) * 0.04))
        const bodyLp = f('lowpass', 200, 0.6)
        const bodyG = g(0.34)
        body.connect(bodyLp); bodyLp.connect(bodyG); bodyG.connect(master)
        masterPeak = peak * 0.58
        break
      }

      case 'flier-light': {
        // Small fighter craft. The old "high turbine whine" was thin and
        // whistly; this version layers a mid prop wash, a quiet body band,
        // and a sub-perceptual saw so it reads as a small *vehicle* — still
        // bright and distinguishable from heavy fliers, just less whistle.
        const wash = n('pink')
        const washBp = f('bandpass', 1500, 1.3)
        const washG = g(0.45)
        const trem = tremolo(7 * rate)
        wash.connect(washBp); washBp.connect(washG); washG.connect(trem); trem.connect(master)

        const body = n('pink')
        const bodyBp = f('bandpass', 420, 1.0)
        const bodyG = g(0.32)
        body.connect(bodyBp); bodyBp.connect(bodyG); bodyG.connect(master)

        const sub = o('sawtooth', 115 * (1 + (jit - 0.5) * 0.05))
        const subLp = f('lowpass', 260, 0.5)
        const subG = g(0.18)
        sub.connect(subLp); subLp.connect(subG); subG.connect(master)

        const wlfo = o('sine', 5.5 * rate)
        const wDepth = g(22)
        wlfo.connect(wDepth); wDepth.connect(sub.detune)
        masterPeak = peak * 0.42
        break
      }

      case 'flier-heavy': {
        // Heavy armored airship: chunky low-mid roar, mid metallic
        // resonance for the hull, sub thump, breathing filter on the roar.
        const roar = n('pink')
        const roarBp = f('bandpass', 480, 1.1)
        const roarG = g(0.5)
        roar.connect(roarBp); roarBp.connect(roarG); roarG.connect(master)

        const rumble = n('brown')
        const rumLp = f('lowpass', 220, 0.5)
        const rumG = g(0.42)
        rumble.connect(rumLp); rumLp.connect(rumG); rumG.connect(master)

        const plate = n('pink')
        const plateBp = f('bandpass', 850, 2.0)
        const plateG = g(0.20)
        plate.connect(plateBp); plateBp.connect(plateG); plateG.connect(master)

        const sub = o('sawtooth', 65 * (1 + (jit - 0.5) * 0.04))
        const subLp = f('lowpass', 200, 0.6)
        const subG = g(0.32)
        sub.connect(subLp); subLp.connect(subG); subG.connect(master)

        const lfo = o('sine', 0.6 * rate)
        const lfoD = g(180)
        lfo.connect(lfoD); lfoD.connect(roarBp.frequency)
        masterPeak = peak * 0.5
        break
      }

      case 'sphere': {
        // enemy_3 sphere shooter: ominous slow-pulsing drone.
        const sub = o('sine', 50)
        const subG = g(0.35); sub.connect(subG)
        const body = o('sawtooth', 100, cents)
        const bodyLp = f('lowpass', 250, 0.8)
        const bodyG = g(0.25)
        body.connect(bodyLp); bodyLp.connect(bodyG)
        const air = n('brown')
        const airLp = f('lowpass', 350, 0.6)
        const airG = g(0.4)
        air.connect(airLp); airLp.connect(airG)

        const trem = tremolo(1.3 * rate)
        subG.connect(trem); bodyG.connect(trem); airG.connect(trem)
        trem.connect(master)
        masterPeak = peak * 0.40
        break
      }

      case 'porter': {
        // enemy_5 porter: unstable / "wrong" feeling — slow deep wobble of
        // both filter and pitch so it never settles into any pitch.
        const air = n('pink')
        const airBp = f('bandpass', 800, 4)
        const airG = g(0.5)
        air.connect(airBp); airBp.connect(airG); airG.connect(master)

        const tone = o('triangle', 220, cents)
        const toneG = g(0.15)
        tone.connect(toneG); toneG.connect(master)

        const lfo = o('sine', 0.9 * rate)
        const pDepth = g(60)     // cents on tone
        const fDepth = g(420)    // Hz on bandpass
        lfo.connect(pDepth); pDepth.connect(tone.detune)
        lfo.connect(fDepth); fDepth.connect(airBp.frequency)
        masterPeak = peak * 0.34
        break
      }

      case 'slider-air': {
        // enemy_6 air slider: lighter mid whoosh — pulses faster than tower.
        const air = n('pink')
        const airBp = f('bandpass', 1300, 1.2)
        const airG = g(0.42)
        const trem = tremolo(4 * rate)
        air.connect(airBp); airBp.connect(airG); airG.connect(trem); trem.connect(master)

        const tone = o('sine', 380, cents)
        const toneLp = f('lowpass', 700, 0.6)
        const toneG = g(0.16)
        tone.connect(toneLp); toneLp.connect(toneG); toneG.connect(master)
        masterPeak = peak * 0.32
        break
      }

      case 'bouncer': {
        // enemy_7 bouncer: nervous high chittering over a low rumble. The
        // fast tremolo on the high band gives it that "agitated" character.
        const low = n('brown')
        const lowLp = f('lowpass', 380, 0.5)
        const lowG = g(0.32)
        low.connect(lowLp); lowLp.connect(lowG); lowG.connect(master)

        const chit = n('pink')
        const chitHp = f('highpass', 1900)
        const chitBp = f('bandpass', 2800, 3)
        const chitG = g(0.3)
        const trem = tremolo(8.5 * rate)
        chit.connect(chitHp); chitHp.connect(chitBp); chitBp.connect(chitG); chitG.connect(trem); trem.connect(master)
        masterPeak = peak * 0.36
        break
      }

      case 'slider-ground': {
        // Ground turret — steady armoured drone (no tremolo: ground enemy).
        // The old tank-tread tremolo clack is replaced with a continuous
        // metallic mid-band so it still reads as armour, but rhythmically
        // flat like the other ground enemies.
        const grind = n('brown')
        const grindLp = f('lowpass', 360, 0.6)
        const grindG = g(0.5)
        grind.connect(grindLp); grindLp.connect(grindG); grindG.connect(master)

        const chunk = o('sawtooth', 65, cents)
        const chunkLp = f('lowpass', 220, 0.5)
        const chunkG = g(0.25)
        chunk.connect(chunkLp); chunkLp.connect(chunkG); chunkG.connect(master)

        const metal = n('pink')
        const metalBp = f('bandpass', 900, 2.0)
        const metalG = g(0.22)
        metal.connect(metalBp); metalBp.connect(metalG); metalG.connect(master)
        masterPeak = peak * 0.42
        break
      }

      case 'genesis': {
        // Boss: sub-bass dread with a slow filter sweep on the brown bed.
        const sub = o('sine', 38)
        const subG = g(0.45); sub.connect(subG); subG.connect(master)
        const body = o('sawtooth', 55, cents)
        const bodyLp = f('lowpass', 200, 0.6)
        const bodyG = g(0.32)
        body.connect(bodyLp); bodyLp.connect(bodyG); bodyG.connect(master)
        const air = n('brown')
        const airLp = f('lowpass', 700, 0.7)
        const airG = g(0.5)
        air.connect(airLp); airLp.connect(airG); airG.connect(master)

        const lfo = o('sine', 0.25)
        const lfoD = g(160)
        lfo.connect(lfoD); lfoD.connect(airLp.frequency)
        masterPeak = peak * 0.55
        break
      }

      case 'genesis-danger': {
        // Klaxon-style alarm drone overlaid on Genesis encounters.
        const a = o('sawtooth', 200)
        const b = o('sine', 100)
        const aLp = f('lowpass', 900, 0.8)
        const bLp = f('lowpass', 250, 0.5)
        const aG = g(0.3); const bG = g(0.35)
        a.connect(aLp); aLp.connect(aG)
        b.connect(bLp); bLp.connect(bG)
        const dirt = n('brown')
        const dirtBp = f('bandpass', 800, 1.2)
        const dirtG = g(0.32)
        dirt.connect(dirtBp); dirtBp.connect(dirtG)

        const trem = tremolo(4.2)
        aG.connect(trem); bG.connect(trem); dirtG.connect(trem); trem.connect(master)
        masterPeak = peak * 0.45
        break
      }

      case 'shot': {
        // Generic enemy plasma shot in flight.
        const air = n('pink')
        const airBp = f('bandpass', 1500, 4)
        const airG = g(0.55)
        air.connect(airBp); airBp.connect(airG); airG.connect(master)
        const tone = o('triangle', 700)
        const toneG = g(0.14)
        tone.connect(toneG); toneG.connect(master)
        masterPeak = peak * 0.55
        break
      }

      case 'shot-sphere': {
        // Heavy plasma sphere — the dangerous one. Sub bass + low rumble.
        const air = n('brown')
        const airBp = f('bandpass', 250, 2)
        const airG = g(0.5)
        air.connect(airBp); airBp.connect(airG); airG.connect(master)
        const sub = o('sine', 60)
        const subG = g(0.4)
        sub.connect(subG); subG.connect(master)
        masterPeak = peak * 0.5
        break
      }

      case 'item-static': {
        // Scorpion: parked alien creature. Low rasp + chittery high tick.
        const rasp = n('brown')
        const raspLp = f('lowpass', 500, 0.8)
        const raspG = g(0.4)
        rasp.connect(raspLp); raspLp.connect(raspG); raspG.connect(master)

        const tick = n('white')
        const tickBp = f('bandpass', 3500, 5)
        const tickG = g(0.22)
        const trem = tremolo(5.5)
        tick.connect(tickBp); tickBp.connect(tickG); tickG.connect(trem); trem.connect(master)
        masterPeak = peak * 0.30
        break
      }

      default: {
        const air = n('pink')
        const airBp = f('bandpass', 1200, 1.5)
        const airG = g(0.45)
        air.connect(airBp); airBp.connect(airG); airG.connect(master)
        masterPeak = peak * 0.30
      }
    }

    master.gain.cancelScheduledValues(t0)
    master.gain.setValueAtTime(0, t0)
    master.gain.linearRampToValueAtTime(masterPeak, t0 + 0.05)

    for (const node of started) try { node.start(t0) } catch (_) {}

    let stopped = false
    return {
      setPos(nex, ney, npy) {
        if (stopped) return
        panner.pan.setTargetAtTime(lateralPan(nex), ctx.currentTime, 0.04)
        const fdist = Math.max(0, ney - npy)
        distGain.gain.setTargetAtTime(engine.fn.clamp(1 - fdist / 60, 0.35, 1), ctx.currentTime, 0.04)
      },
      // Spaceship kinds aren't pitched, so setFreq is a no-op. Items take
      // the melodicLoop path above and get a real setFreq.
      setFreq() {},
      stop() {
        if (stopped) return
        stopped = true
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
        for (const node of started) try { node.stop(t + 0.18) } catch (_) {}
      },
    }
  }

  function ui(freq, dur = 0.1, type = 'sine', peak = 0.3) {
    return tone({freq, duration: dur, type, peak, ex: 5, ey: 0})
  }

  // Engine — muffled airship drone. Two noise layers, both heavily
  // lowpassed; nothing above ~600 Hz so the engine sounds like it's heard
  // through the gondola wall. No oscillators (no notes), all filters
  // low-Q (no resonance peak), slow irrational wobbles keep it alive.
  //   * Hull rumble — brown noise, lowpass ~250 Hz. The dominant layer.
  //   * Soft air — pink noise, narrow band 150–550 Hz. Quiet support so
  //     the rumble has texture without any hiss.
  // Speed cues are spectral: throttle modestly brightens both filters
  // and lifts the air layer.
  function startEngine() {
    init()
    if (engineNodes) return

    const rumbleBuf = engine.buffer.brownNoise({channels: 1, duration: 4})
    const rumbleSrc = ctx.createBufferSource()
    rumbleSrc.buffer = rumbleBuf; rumbleSrc.loop = true
    const rumbleLp = ctx.createBiquadFilter()
    rumbleLp.type = 'lowpass'; rumbleLp.frequency.value = 240; rumbleLp.Q.value = 0.4
    const rumbleG = ctx.createGain(); rumbleG.gain.value = 0.5
    rumbleSrc.connect(rumbleLp); rumbleLp.connect(rumbleG)

    const airBuf = engine.buffer.pinkNoise({channels: 1, duration: 4})
    const airSrc = ctx.createBufferSource()
    airSrc.buffer = airBuf; airSrc.loop = true
    const airHp = ctx.createBiquadFilter()
    airHp.type = 'highpass'; airHp.frequency.value = 150; airHp.Q.value = 0.4
    const airLp = ctx.createBiquadFilter()
    airLp.type = 'lowpass'; airLp.frequency.value = 550; airLp.Q.value = 0.3
    const airG = ctx.createGain(); airG.gain.value = 0.16
    airSrc.connect(airHp); airHp.connect(airLp); airLp.connect(airG)

    const wobbleA = ctx.createOscillator(); wobbleA.type = 'sine'; wobbleA.frequency.value = 0.27
    const wobbleAD = ctx.createGain(); wobbleAD.gain.value = 50
    wobbleA.connect(wobbleAD); wobbleAD.connect(rumbleLp.frequency)

    const wobbleB = ctx.createOscillator(); wobbleB.type = 'sine'; wobbleB.frequency.value = 0.41
    const wobbleBD = ctx.createGain(); wobbleBD.gain.value = 90
    wobbleB.connect(wobbleBD); wobbleBD.connect(airLp.frequency)

    const master = ctx.createGain(); master.gain.value = 0.06
    rumbleG.connect(master); airG.connect(master)
    master.connect(out)

    rumbleSrc.start(); airSrc.start()
    wobbleA.start(); wobbleB.start()
    engineNodes = {rumbleSrc, airSrc, rumbleLp, airLp, airG, wobbleA, wobbleB, master}
  }

  function setEnginePitch(speed) {
    if (!engineNodes) return
    const t = ctx.currentTime
    // speed is ms per forward step: 300 fastest, 700 slowest.
    const ratio = engine.fn.clamp((700 - speed) / 400, 0, 1)
    // Modest spectral movement — the engine works a little harder, the
    // air band opens, but everything stays below ~700 Hz so the muffled
    // character is preserved at any throttle.
    engineNodes.airLp.frequency.setTargetAtTime(480 + ratio * 220, t, 0.3)
    engineNodes.rumbleLp.frequency.setTargetAtTime(210 + ratio * 90, t, 0.3)
    engineNodes.airG.gain.setTargetAtTime(0.13 + ratio * 0.08, t, 0.3)
  }

  function stopEngine() {
    if (!engineNodes) return
    const t = ctx.currentTime
    const n = engineNodes
    n.master.gain.cancelScheduledValues(t)
    n.master.gain.setValueAtTime(n.master.gain.value, t)
    n.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    try { n.rumbleSrc.stop(t + 0.3) } catch (_) {}
    try { n.airSrc.stop(t + 0.3) } catch (_) {}
    try { n.wobbleA.stop(t + 0.3) } catch (_) {}
    try { n.wobbleB.stop(t + 0.3) } catch (_) {}
    engineNodes = null
  }

  let engineNodes = null
  let thrustNodes = null

  // Travelling player-projectile voice. Spawned by BeamShot at fire time and
  // moved each tick so the player can ear-track their bullet as it flies up
  // the field. Pitch drops slightly with forward distance so receding shots
  // localize as "going away" rather than just getting quieter. Modeled on
  // bumper's bullet voice but tuned shorter and tighter for vfb's faster
  // grid-stepped projectiles.
  function beamVoice(ex, ey, py) {
    init()
    const t0 = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 1500

    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 6
    osc.connect(bp)

    const lfo = ctx.createOscillator()
    lfo.type = 'sine'; lfo.frequency.value = 24
    const lfoG = ctx.createGain(); lfoG.gain.value = 110
    lfo.connect(lfoG); lfoG.connect(osc.frequency)

    const main = ctx.createGain(); main.gain.value = 0
    bp.connect(main)

    const panner = ctx.createStereoPanner()
    panner.pan.value = lateralPan(ex)
    const distGain = ctx.createGain()
    const fwd0 = Math.max(0, ey - py)
    distGain.gain.value = engine.fn.clamp(1 - fwd0 / 30, 0.25, 1)
    main.connect(panner); panner.connect(distGain); distGain.connect(out)

    osc.start(t0); lfo.start(t0)
    main.gain.linearRampToValueAtTime(0.22, t0 + 0.025)

    let stopped = false
    return {
      setPos: (nex, ney, npy) => {
        if (stopped) return
        const t = ctx.currentTime
        panner.pan.setTargetAtTime(lateralPan(nex), t, 0.02)
        const f = Math.max(0, ney - npy)
        distGain.gain.setTargetAtTime(engine.fn.clamp(1 - f / 30, 0.25, 1), t, 0.02)
        // Drop ~250 Hz over the full 30-cell flight so receding bullets
        // tilt downward in pitch as well as in volume.
        osc.frequency.setTargetAtTime(1500 - Math.min(30, f) * 8, t, 0.04)
      },
      stop: () => {
        if (stopped) return
        stopped = true
        const t = ctx.currentTime
        main.gain.cancelScheduledValues(t)
        main.gain.setValueAtTime(main.gain.value, t)
        main.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
        try { osc.stop(t + 0.1) } catch (_) {}
        try { lfo.stop(t + 0.1) } catch (_) {}
      },
    }
  }

  return {
    init,
    get ctx() { return ctx },
    tone,
    noise,
    loop,
    ui,
    startEngine, stopEngine, setEnginePitch,
    // Player weapons
    // Beam: noise-led plasma zap with a quick mid-band tonal punch beneath.
    // The triangle pew alone read too musical — the white-noise transient
    // is what makes it feel like a discharge instead of a note.
    beam: (ex, ey, py) => {
      noise({duration: 0.05, peak: 0.32, color: 'white', ex, ey, py, filter: {type: 'highpass', freq: 1400}})
      tone({freq: 480, type: 'triangle', duration: 0.1, peak: 0.26, sweep: -300, attack: 0.002, release: 0.06, ex, ey, py})
      tone({freq: 220, type: 'sine', duration: 0.1, peak: 0.16, sweep: -110, attack: 0.002, release: 0.06, ex, ey, py})
    },
    beamVoice,
    bomb: (ex, ey, py) => {
      tone({freq: 180, type: 'sine', duration: 0.15, peak: 0.35, sweep: -120, attack: 0.005, release: 0.08, ex, ey, py})
      noise({duration: 0.18, peak: 0.3, ex, ey, py, filter: {type: 'lowpass', freq: 600}})
    },
    bombHit: (ex, ey, py) => {
      noise({duration: 0.5, peak: 0.55, ex, ey, py, color: 'brown', filter: {type: 'lowpass', freq: 500}})
      tone({freq: 70, type: 'sine', duration: 0.4, peak: 0.45, sweep: -30, attack: 0.005, release: 0.25, ex, ey, py})
    },
    // Hit: a metallic clink — short, mid-range, no high screech.
    beamHit: (ex, ey, py) => {
      tone({freq: 720, type: 'triangle', duration: 0.07, peak: 0.28, sweep: -480, attack: 0.001, release: 0.05, ex, ey, py})
      noise({duration: 0.04, peak: 0.18, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: 1200, q: 4}})
    },
    bitShot: () => {
      // Plasma slash — quick triangle bend with body, not a screech.
      tone({freq: 660, type: 'triangle', duration: 0.18, peak: 0.32, sweep: 600, attack: 0.003, release: 0.08})
      tone({freq: 220, type: 'sawtooth', duration: 0.18, peak: 0.18, sweep: 200, attack: 0.003, release: 0.08})
    },
    burst: () => {
      noise({duration: 0.45, peak: 0.4, color: 'white', filter: {type: 'highpass', freq: 800}})
      tone({freq: 140, type: 'sawtooth', duration: 0.45, peak: 0.45, sweep: -90, attack: 0.005, release: 0.25})
      tone({freq: 70, type: 'sine', duration: 0.5, peak: 0.4, sweep: -25, attack: 0.005, release: 0.3})
    },
    shieldHit: (ex, ey, py) => {
      tone({freq: 480, type: 'triangle', duration: 0.18, peak: 0.32, sweep: 700, attack: 0.002, release: 0.08, ex, ey, py})
      noise({duration: 0.12, peak: 0.2, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: 2200, q: 6}})
    },
    shieldExp: () => {
      tone({freq: 240, type: 'sawtooth', duration: 0.7, peak: 0.4, sweep: -180, attack: 0.005, release: 0.3})
      noise({duration: 0.7, peak: 0.35, color: 'pink', filter: {type: 'lowpass', freq: 2000}})
    },
    die: () => {
      tone({freq: 220, type: 'sawtooth', duration: 0.9, peak: 0.45, sweep: -200, attack: 0.005, release: 0.4})
      tone({freq: 110, type: 'sine', duration: 1.1, peak: 0.4, sweep: -90, attack: 0.005, release: 0.6})
      noise({duration: 0.8, peak: 0.35, color: 'pink', filter: {type: 'lowpass', freq: 800}})
    },
    extend: () => {
      tone({freq: 660, type: 'triangle', duration: 0.15, peak: 0.35})
      setTimeout(() => tone({freq: 990, type: 'triangle', duration: 0.2, peak: 0.35}), 130)
    },
    // Combo: rounded triangle in a comfortable mid range, gain proportional
    // to combo length but capped so high combos don't pierce.
    combo: (n) => tone({
      freq: 320 + 40 * Math.min(n, 8),
      type: 'triangle',
      duration: 0.08,
      peak: Math.min(0.32, 0.14 + 0.02 * n),
      attack: 0.002,
      release: 0.05,
    }),
    enemyShot: (ex, ey, py) => {
      noise({duration: 0.1, peak: 0.32, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: 1800, q: 5}})
      tone({freq: 380, type: 'triangle', duration: 0.08, peak: 0.16, sweep: -240, attack: 0.001, release: 0.05, ex, ey, py})
    },
    enemyShootWarn: (ex, ey, py) => {
      tone({freq: 240, type: 'square', duration: 0.18, peak: 0.2, sweep: 60, ex, ey, py, attack: 0.01, release: 0.08})
      tone({freq: 120, type: 'sawtooth', duration: 0.18, peak: 0.15, sweep: 30, ex, ey, py})
    },
    // Sphere warn: ominous low rising rumble — feels like a charging cannon.
    sphereWarn: (ex, ey, py) => {
      tone({freq: 90, type: 'sawtooth', duration: 0.45, peak: 0.32, sweep: 110, attack: 0.02, release: 0.15, ex, ey, py})
      tone({freq: 180, type: 'square', duration: 0.45, peak: 0.18, sweep: 220, attack: 0.02, release: 0.15, ex, ey, py})
    },
    sphereExp: (ex, ey, py) => {
      tone({freq: 95, type: 'sawtooth', duration: 0.8, peak: 0.55, sweep: -55, attack: 0.005, release: 0.4, ex, ey, py})
      tone({freq: 50, type: 'sine', duration: 1.0, peak: 0.5, sweep: -20, attack: 0.005, release: 0.5, ex, ey, py})
      noise({duration: 0.7, peak: 0.45, color: 'brown', ex, ey, py, filter: {type: 'lowpass', freq: 1200}})
    },
    // Per-kind destruction sound. Tower and Genesis bypass this — they have
    // their own bespoke death cues (towerDestroy / genesisDie). Everything
    // else funnels through here so each enemy class is recognisable not just
    // by its loop but by the way it goes down. Peaks and `refY` are
    // deliberately generous: explosions need to read clearly even when the
    // enemy was killed at long range — the previous values were inaudible
    // beyond ~10 forward units.
    explode: (kind, ex, ey, py) => {
      const RY = 70                          // distance falloff reaches further
      switch (kind) {
        case 'flier-light':
          noise({duration: 0.18, peak: 0.55, color: 'white', ex, ey, py, refY: RY, filter: {type: 'highpass', freq: 1200}})
          noise({duration: 0.06, peak: 0.60, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 3500, q: 4}})
          tone({freq: 900, type: 'triangle', duration: 0.20, peak: 0.42, sweep: -700, attack: 0.001, release: 0.1, ex, ey, py, refY: RY})
          break
        case 'flier-heavy':
          tone({freq: 90, type: 'sawtooth', duration: 0.55, peak: 0.70, sweep: -55, attack: 0.005, release: 0.30, ex, ey, py, refY: RY})
          tone({freq: 50, type: 'sine',     duration: 0.70, peak: 0.65, sweep: -20, attack: 0.005, release: 0.40, ex, ey, py, refY: RY})
          noise({duration: 0.45, peak: 0.65, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 900}})
          break
        case 'ground-base':
          tone({freq: 110, type: 'sawtooth', duration: 0.60, peak: 0.58, sweep: -75, attack: 0.005, release: 0.35, ex, ey, py, refY: RY})
          noise({duration: 0.55, peak: 0.70, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 700}})
          noise({duration: 0.18, peak: 0.45, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1800, q: 3}})
          break
        case 'sphere':
          tone({freq: 300, type: 'sine',     duration: 0.18, peak: 0.55, sweep: -260, attack: 0.005, release: 0.08, ex, ey, py, refY: RY})
          tone({freq: 80,  type: 'sawtooth', duration: 0.55, peak: 0.60, sweep: -45,  attack: 0.005, release: 0.30, ex, ey, py, refY: RY})
          noise({duration: 0.40, peak: 0.55, color: 'pink', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 1200}})
          break
        case 'porter':
          tone({freq: 600, type: 'triangle', duration: 0.35, peak: 0.45, sweep: -480, attack: 0.005, release: 0.18, ex, ey, py, refY: RY})
          tone({freq: 220, type: 'square',   duration: 0.30, peak: 0.28, sweep: -150, attack: 0.005, release: 0.12, ex, ey, py, refY: RY})
          noise({duration: 0.40, peak: 0.45, color: 'pink', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1500, q: 6}})
          break
        case 'slider-air':
          noise({duration: 0.30, peak: 0.62, color: 'pink', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1400, q: 1.5}})
          tone({freq: 320, type: 'triangle', duration: 0.25, peak: 0.42, sweep: -240, attack: 0.005, release: 0.12, ex, ey, py, refY: RY})
          break
        case 'slider-ground':
          tone({freq: 75, type: 'sawtooth', duration: 0.50, peak: 0.62, sweep: -35, attack: 0.005, release: 0.30, ex, ey, py, refY: RY})
          noise({duration: 0.40, peak: 0.70, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 600}})
          noise({duration: 0.05, peak: 0.50, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1800, q: 4}})
          break
        case 'bouncer':
          for (let i = 0; i < 4; i++) {
            const fq = 2400 + i * 320
            setTimeout(() => noise({duration: 0.06, peak: 0.45, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: fq, q: 5}}), i * 35)
          }
          tone({freq: 280, type: 'triangle', duration: 0.22, peak: 0.36, sweep: -180, attack: 0.003, release: 0.10, ex, ey, py, refY: RY})
          break
        default:
          tone({freq: 180, type: 'sawtooth', duration: 0.35, peak: 0.55, sweep: -100, attack: 0.005, release: 0.2, ex, ey, py, refY: RY})
          noise({duration: 0.3, peak: 0.50, color: 'pink', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 1100}})
      }
    },
    // Per-kind hit cue. Replaces the generic beamHit click on enemies so the
    // listener can tell what they hit, and — for multi-HP enemies (Bouncer
    // is hp=2) — distinguishes a non-killing hit from the killing one.
    // `killing=true` is layered on top of the per-kind explode that follows;
    // it's the *impact* before the explosion, weighted to the enemy class.
    enemyHit: (kind, ex, ey, py, killing = false) => {
      const RY = 60                          // matches explode's reach
      const k = killing ? 1.25 : 0.9         // killing hit is a touch louder
      switch (kind) {
        case 'flier-light':
          tone({freq: 1400, type: 'triangle', duration: 0.07, peak: 0.30 * k, sweep: -700, attack: 0.001, release: 0.05, ex, ey, py, refY: RY})
          noise({duration: 0.05, peak: 0.28 * k, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 2600, q: 4}})
          break
        case 'flier-heavy':
          tone({freq: 220, type: 'sawtooth', duration: 0.10, peak: 0.32 * k, sweep: -120, attack: 0.001, release: 0.07, ex, ey, py, refY: RY})
          noise({duration: 0.09, peak: 0.30 * k, color: 'pink', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 700}})
          break
        case 'ground-base':
          tone({freq: 180, type: 'triangle', duration: 0.12, peak: 0.32 * k, sweep: -120, attack: 0.001, release: 0.08, ex, ey, py, refY: RY})
          noise({duration: 0.12, peak: 0.32 * k, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 800}})
          break
        case 'sphere':
          tone({freq: 880, type: 'sine',     duration: 0.10, peak: 0.30 * k, attack: 0.001, release: 0.07, ex, ey, py, refY: RY})
          tone({freq: 1320, type: 'triangle', duration: 0.07, peak: 0.18 * k, attack: 0.001, release: 0.05, ex, ey, py, refY: RY})
          break
        case 'porter':
          tone({freq: 700, type: 'square', duration: 0.10, peak: 0.26 * k, sweep: 240, attack: 0.001, release: 0.06, ex, ey, py, refY: RY})
          noise({duration: 0.07, peak: 0.20 * k, color: 'pink', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1400, q: 5}})
          break
        case 'slider-air':
          tone({freq: 620, type: 'triangle', duration: 0.08, peak: 0.28 * k, sweep: -240, attack: 0.001, release: 0.05, ex, ey, py, refY: RY})
          noise({duration: 0.06, peak: 0.26 * k, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1800, q: 3}})
          break
        case 'slider-ground':
          tone({freq: 380, type: 'triangle', duration: 0.09, peak: 0.30 * k, sweep: -160, attack: 0.001, release: 0.06, ex, ey, py, refY: RY})
          noise({duration: 0.08, peak: 0.30 * k, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 800, q: 2}})
          break
        case 'bouncer':
          if (killing) {
            // Killing hit on bouncer: deeper crack, signals "this one's done".
            tone({freq: 800, type: 'triangle', duration: 0.10, peak: 0.34 * k, sweep: -500, attack: 0.001, release: 0.06, ex, ey, py, refY: RY})
            noise({duration: 0.08, peak: 0.30 * k, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 700}})
          } else {
            // Non-killing hit on bouncer: nervous tink, no body — telegraphs
            // "still alive, hit it again".
            tone({freq: 1500, type: 'triangle', duration: 0.06, peak: 0.30, sweep: 200, attack: 0.001, release: 0.04, ex, ey, py, refY: RY})
            noise({duration: 0.04, peak: 0.22, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 3000, q: 5}})
          }
          break
        case 'tower':
          // Tower has its own death path so this only fires on non-killing
          // hits in practice — but provided for completeness.
          tone({freq: 90,  type: 'sine',     duration: 0.18, peak: 0.36 * k, attack: 0.005, release: 0.10, ex, ey, py, refY: RY})
          tone({freq: 240, type: 'triangle', duration: 0.12, peak: 0.20 * k, sweep: -80, attack: 0.005, release: 0.08, ex, ey, py, refY: RY})
          noise({duration: 0.10, peak: 0.24 * k, color: 'brown', ex, ey, py, refY: RY, filter: {type: 'lowpass', freq: 600}})
          break
        default:
          // Fallback mirrors the old beamHit so any unmapped kind still
          // gets a sane cue.
          tone({freq: 720, type: 'triangle', duration: 0.07, peak: 0.28 * k, sweep: -480, attack: 0.001, release: 0.05, ex, ey, py, refY: RY})
          noise({duration: 0.04, peak: 0.18 * k, color: 'white', ex, ey, py, refY: RY, filter: {type: 'bandpass', freq: 1200, q: 4}})
      }
    },
    itemAppear: (ex, ey, py) => tone({freq: 700, type: 'triangle', duration: 0.4, peak: 0.32, sweep: 500, attack: 0.005, release: 0.18, ex, ey, py}),
    itemObtain: () => {
      tone({freq: 520, type: 'triangle', duration: 0.1, peak: 0.35})
      setTimeout(() => tone({freq: 780, type: 'triangle', duration: 0.1, peak: 0.35}), 80)
      setTimeout(() => tone({freq: 1040, type: 'triangle', duration: 0.2, peak: 0.35}), 160)
    },
    itemPop: () => tone({freq: 200, type: 'triangle', duration: 0.18, peak: 0.25, sweep: -130}),
    levelUp: () => {
      ;[523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone({freq: f, type: 'triangle', duration: 0.18, peak: 0.35}), i * 130))
    },
    ready: () => {
      ;[392, 523].forEach((f, i) => setTimeout(() => tone({freq: f, type: 'triangle', duration: 0.2, peak: 0.35}), i * 200))
    },
    levelEnd: (ex, ey, py) => {
      tone({freq: 400, type: 'triangle', duration: 0.22, peak: 0.28, ex, ey, py})
      setTimeout(() => tone({freq: 600, type: 'triangle', duration: 0.3, peak: 0.28, ex, ey, py}), 200)
    },
    genesisAppear: () => {
      tone({freq: 65, type: 'sawtooth', duration: 1.6, peak: 0.5, sweep: 180, attack: 0.05, release: 0.6})
      tone({freq: 130, type: 'square', duration: 1.6, peak: 0.25, sweep: 360, attack: 0.05, release: 0.6})
      noise({duration: 1.6, peak: 0.35, color: 'brown', filter: {type: 'lowpass', freq: 600}})
    },
    genesisDie: () => {
      tone({freq: 180, type: 'sawtooth', duration: 1.6, peak: 0.55, sweep: -140, attack: 0.005, release: 0.7})
      tone({freq: 60, type: 'sine', duration: 2.0, peak: 0.5, sweep: -45, attack: 0.005, release: 1.0})
      noise({duration: 1.4, peak: 0.45, color: 'pink', filter: {type: 'lowpass', freq: 1500}})
    },
    genesisDanger: (ex, ey, py) => loop({kind: 'genesis-danger', peak: 0.18, ex, ey, py}),
    diegenesis: () => {
      tone({freq: 90, type: 'sawtooth', duration: 1.0, peak: 0.55, sweep: -55, attack: 0.005, release: 0.5})
      tone({freq: 50, type: 'sine', duration: 1.2, peak: 0.45, sweep: -20, attack: 0.005, release: 0.7})
      noise({duration: 1.0, peak: 0.4, color: 'brown', filter: {type: 'lowpass', freq: 800}})
    },
    towerAlarm: () => {
      ;[0, 0.3, 0.6].forEach((dt) => setTimeout(() => tone({freq: 760, type: 'triangle', duration: 0.1, peak: 0.3, attack: 0.005, release: 0.05}), dt * 1000))
    },
    towerAppear: (ex, ey, py) => tone({freq: 280, type: 'triangle', duration: 0.4, peak: 0.32, sweep: 180, attack: 0.005, release: 0.2, ex, ey, py}),
    towerDestroy: (ex, ey, py) => {
      tone({freq: 200, type: 'sawtooth', duration: 0.6, peak: 0.5, sweep: -120, attack: 0.005, release: 0.3, ex, ey, py})
      tone({freq: 80, type: 'sine', duration: 0.8, peak: 0.4, sweep: -30, attack: 0.005, release: 0.45, ex, ey, py})
      noise({duration: 0.5, peak: 0.4, color: 'brown', ex, ey, py, filter: {type: 'lowpass', freq: 800}})
    },
    edgeWarn: () => tone({freq: 200, type: 'triangle', duration: 0.07, peak: 0.18}),
    // Hydraulic thrust loop — held while the strafe key is down, released
    // when the key comes up. Continuous filtered pink noise with a slow
    // pump-cycle filter sweep so it reads as a working hydraulic system,
    // not a one-shot whoosh. Calling startThrust again while running just
    // re-pans (e.g. when the player switches direction without releasing).
    startThrust: (left) => {
      init()
      const newPan = left ? -0.6 : 0.6
      if (thrustNodes) {
        thrustNodes.panner.pan.setTargetAtTime(newPan, ctx.currentTime, 0.04)
        return
      }
      const t0 = ctx.currentTime

      const buf = engine.buffer.pinkNoise({channels: 1, duration: 3})
      const src = ctx.createBufferSource()
      src.buffer = buf; src.loop = true

      // Mid-band pressurized fluid. Q just over neutral so there's a gentle
      // emphasis without a hangable pitch.
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.9

      const g = ctx.createGain(); g.gain.value = 0
      src.connect(bp); bp.connect(g)

      // Pump cycle — slow filter sweep so the loop feels mechanical.
      const sweep = ctx.createOscillator(); sweep.type = 'sine'
      sweep.frequency.value = 5.5
      const sweepD = ctx.createGain(); sweepD.gain.value = 110
      sweep.connect(sweepD); sweepD.connect(bp.frequency)

      const panner = ctx.createStereoPanner()
      panner.pan.value = newPan
      g.connect(panner); panner.connect(out)

      // Quick attack — valve opens.
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.16, t0 + 0.04)

      src.start(); sweep.start()
      thrustNodes = {src, sweep, bp, g, panner}
    },
    stopThrust: () => {
      if (!thrustNodes) return
      const t = ctx.currentTime
      const n = thrustNodes
      n.g.gain.cancelScheduledValues(t)
      n.g.gain.setValueAtTime(n.g.gain.value, t)
      // Pressure release — fast but not abrupt.
      n.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
      try { n.src.stop(t + 0.12) } catch (_) {}
      try { n.sweep.stop(t + 0.12) } catch (_) {}
      thrustNodes = null
    },
    speedShift: (up) => tone({freq: up ? 600 : 360, type: 'triangle', duration: 0.08, peak: 0.22, attack: 0.005, release: 0.05}),
    avoid: () => tone({freq: 1100, type: 'triangle', duration: 0.04, peak: 0.12, attack: 0.002, release: 0.03}),
    pauseTone: () => tone({freq: 440, type: 'sine', duration: 0.15, peak: 0.3}),
  }
})()
