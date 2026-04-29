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
      case 'tower': {
        // Heavy stationary ground generator: mains hum + rumble, slow load.
        const hum = o('square', 55, cents)
        const humLp = f('lowpass', 180, 0.5)
        const humG = g(0.32)
        hum.connect(humLp); humLp.connect(humG); humG.connect(master)

        const rum = n('brown')
        const rumLp = f('lowpass', 320, 0.7)
        const rumG = g(0.55)
        const trem = tremolo(1.5 * rate)
        rum.connect(rumLp); rumLp.connect(rumG); rumG.connect(trem); trem.connect(master)
        masterPeak = peak * 0.42
        break
      }

      case 'ground-base': {
        // enemy_2: industrial emplacement. Constant grind, no pulses — sits
        // *under* tower's tremolo so the two read as different ground objects.
        const grind = n('brown')
        const grindLp = f('lowpass', 280, 0.8)
        const grindG = g(0.5)
        grind.connect(grindLp); grindLp.connect(grindG); grindG.connect(master)

        const body = o('sawtooth', 80 * (1 + (jit - 0.5) * 0.04))
        const bodyLp = f('lowpass', 240, 0.6)
        const bodyG = g(0.22)
        body.connect(bodyLp); bodyLp.connect(bodyG); bodyG.connect(master)
        masterPeak = peak * 0.36
        break
      }

      case 'flier-light': {
        // Level-1 small ship: high turbine whine. Almost all air, no body
        // weight — instantly distinguishable from any ground enemy.
        const air = n('pink')
        const airHp = f('highpass', 2400)
        const airBp = f('bandpass', 3200, 3.5)
        const airG = g(0.45)
        air.connect(airHp); airHp.connect(airBp); airBp.connect(airG); airG.connect(master)

        // Thin jet whine, fast pitch warble so it's never read as a note.
        const whine = o('triangle', 1100 * (1 + (jit - 0.5) * 0.06))
        const wLfo = o('sine', 7.5 * rate)
        const wDepth = g(45)
        wLfo.connect(wDepth); wDepth.connect(whine.detune)
        const wLp = f('lowpass', 1800, 0.5)
        const wG = g(0.10)
        whine.connect(wLp); wLp.connect(wG); wG.connect(master)
        masterPeak = peak * 0.32
        break
      }

      case 'flier-heavy': {
        // enemy_4 armored: chunky low-mid roar with breathing filter.
        const roar = n('pink')
        const roarBp = f('bandpass', 700, 1.0)
        const roarG = g(0.4)
        roar.connect(roarBp); roarBp.connect(roarG); roarG.connect(master)

        const sub = o('sawtooth', 75 * (1 + (jit - 0.5) * 0.04))
        const subLp = f('lowpass', 280, 0.6)
        const subG = g(0.32)
        sub.connect(subLp); subLp.connect(subG); subG.connect(master)

        const lfo = o('sine', 0.6 * rate)
        const lfoD = g(180)
        lfo.connect(lfoD); lfoD.connect(roarBp.frequency)
        masterPeak = peak * 0.40
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
        // enemy_8 ground turret: tank-tread chunk-clack over a low grind.
        const grind = n('brown')
        const grindLp = f('lowpass', 360, 0.6)
        const grindG = g(0.45)
        grind.connect(grindLp); grindLp.connect(grindG); grindG.connect(master)

        const chunk = o('sawtooth', 65, cents)
        const chunkLp = f('lowpass', 220, 0.5)
        const chunkG = g(0.22)
        chunk.connect(chunkLp); chunkLp.connect(chunkG); chunkG.connect(master)

        const click = n('white')
        const clickBp = f('bandpass', 1500, 2.5)
        const clickG = g(0.22)
        const trem = tremolo(2.5 * rate)
        click.connect(clickBp); clickBp.connect(clickG); clickG.connect(trem); trem.connect(master)
        masterPeak = peak * 0.40
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

  // Engine looped sound. Layered like a real turbine:
  //   * Two detuned saws make the throaty body.
  //   * A square one octave up adds blade harmonics.
  //   * Pink noise through a bandpass gives air/whoosh that opens with speed.
  //   * A subtle tremolo LFO makes it feel mechanical instead of static.
  // The lowpass filter cutoff and the noise band both ride speed alongside
  // pitch, so the listener gets multiple cues that the ship is accelerating.
  function startEngine() {
    init()
    if (engineNodes) return

    const oscA = ctx.createOscillator(); oscA.type = 'sawtooth'; oscA.frequency.value = 80; oscA.detune.value = -8
    const oscB = ctx.createOscillator(); oscB.type = 'sawtooth'; oscB.frequency.value = 80; oscB.detune.value = +8
    const oscC = ctx.createOscillator(); oscC.type = 'square';   oscC.frequency.value = 160

    const tonalGain = ctx.createGain(); tonalGain.gain.value = 0.55
    oscA.connect(tonalGain); oscB.connect(tonalGain); oscC.connect(tonalGain)

    // Lowpass cap kept below the band where most enemy loops live (~700 Hz
    // and up) so the engine sits *under* enemies instead of masking them.
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = 380
    flt.Q.value = 0.7
    tonalGain.connect(flt)

    // Air noise component — quieter than before so distant enemy hiss isn't
    // drowned by the player's own air rush.
    const noiseBuf = engine.buffer.pinkNoise({channels: 1, duration: 2})
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = noiseBuf; noiseSrc.loop = true
    const noiseFlt = ctx.createBiquadFilter()
    noiseFlt.type = 'bandpass'
    noiseFlt.frequency.value = 480
    noiseFlt.Q.value = 0.8
    const noiseGain = ctx.createGain(); noiseGain.gain.value = 0.10
    noiseSrc.connect(noiseFlt); noiseFlt.connect(noiseGain)

    // Tremolo: slow gain wobble so the engine breathes.
    const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 6.5
    const lfoDepth = ctx.createGain(); lfoDepth.gain.value = 0.035
    lfo.connect(lfoDepth)

    // Master nearly halved (was 0.08) so a single enemy loop is plainly
    // audible over the engine even at full speed.
    const master = ctx.createGain(); master.gain.value = 0.045
    flt.connect(master); noiseGain.connect(master)
    lfoDepth.connect(master.gain)

    master.connect(out)
    oscA.start(); oscB.start(); oscC.start(); noiseSrc.start(); lfo.start()
    engineNodes = {oscA, oscB, oscC, noiseSrc, noiseFlt, flt, lfo, master, lfoDepth}
  }

  function setEnginePitch(speed) {
    if (!engineNodes) return
    const t = ctx.currentTime
    // speed is ms per forward step: 300 fastest, 700 slowest.
    const ratio = engine.fn.clamp((700 - speed) / 400, 0, 1)
    // Pitch sweeps a perceptually-meaningful range (~octave and a half).
    const fundamental = 55 + ratio * 110            // 55..165 Hz
    engineNodes.oscA.frequency.setTargetAtTime(fundamental, t, 0.08)
    engineNodes.oscB.frequency.setTargetAtTime(fundamental, t, 0.08)
    engineNodes.oscC.frequency.setTargetAtTime(fundamental * 2, t, 0.08)
    // Open the filter and air-band as we accelerate, but cap well below the
    // ≈700 Hz floor of the enemy turbine/whoosh band so the engine never
    // climbs into the same spectral space as an enemy.
    engineNodes.flt.frequency.setTargetAtTime(280 + ratio * 380, t, 0.1)
    engineNodes.noiseFlt.frequency.setTargetAtTime(380 + ratio * 320, t, 0.1)
    // Faster -> tremolo speeds up too (turbine spin).
    engineNodes.lfo.frequency.setTargetAtTime(5 + ratio * 7, t, 0.15)
  }

  function stopEngine() {
    if (!engineNodes) return
    const t = ctx.currentTime
    const n = engineNodes
    n.master.gain.cancelScheduledValues(t)
    n.master.gain.setValueAtTime(n.master.gain.value, t)
    n.master.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    try { n.oscA.stop(t + 0.3) } catch (_) {}
    try { n.oscB.stop(t + 0.3) } catch (_) {}
    try { n.oscC.stop(t + 0.3) } catch (_) {}
    try { n.noiseSrc.stop(t + 0.3) } catch (_) {}
    try { n.lfo.stop(t + 0.3) } catch (_) {}
    engineNodes = null
  }

  let engineNodes = null

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
    startMusic, stopMusic,
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
    // by its loop but by the way it goes down.
    explode: (kind, ex, ey, py) => {
      switch (kind) {
        case 'flier-light':
          // Small turbine shatter: thin metal crack + dying-whine sweep.
          noise({duration: 0.18, peak: 0.40, color: 'white', ex, ey, py, filter: {type: 'highpass', freq: 1200}})
          noise({duration: 0.06, peak: 0.45, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: 3500, q: 4}})
          tone({freq: 900, type: 'triangle', duration: 0.20, peak: 0.30, sweep: -700, attack: 0.001, release: 0.1, ex, ey, py})
          break
        case 'flier-heavy':
          // Big armored boom — sub thump + brown noise bed.
          tone({freq: 90, type: 'sawtooth', duration: 0.55, peak: 0.50, sweep: -55, attack: 0.005, release: 0.30, ex, ey, py})
          tone({freq: 50, type: 'sine',     duration: 0.70, peak: 0.45, sweep: -20, attack: 0.005, release: 0.40, ex, ey, py})
          noise({duration: 0.45, peak: 0.45, color: 'brown', ex, ey, py, filter: {type: 'lowpass', freq: 900}})
          break
        case 'ground-base':
          // Heavy emplacement collapse — low rumble plus a debris crack.
          tone({freq: 110, type: 'sawtooth', duration: 0.60, peak: 0.40, sweep: -75, attack: 0.005, release: 0.35, ex, ey, py})
          noise({duration: 0.55, peak: 0.50, color: 'brown', ex, ey, py, filter: {type: 'lowpass', freq: 700}})
          noise({duration: 0.18, peak: 0.30, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: 1800, q: 3}})
          break
        case 'sphere':
          // Implosion-then-boom: high-mid suck inward, then low boom.
          tone({freq: 300, type: 'sine',     duration: 0.18, peak: 0.40, sweep: -260, attack: 0.005, release: 0.08, ex, ey, py})
          tone({freq: 80,  type: 'sawtooth', duration: 0.55, peak: 0.45, sweep: -45,  attack: 0.005, release: 0.30, ex, ey, py})
          noise({duration: 0.40, peak: 0.40, color: 'pink', ex, ey, py, filter: {type: 'lowpass', freq: 1200}})
          break
        case 'porter':
          // Phasing fizzle — pitch warbles down through a resonant noise band.
          tone({freq: 600, type: 'triangle', duration: 0.35, peak: 0.32, sweep: -480, attack: 0.005, release: 0.18, ex, ey, py})
          tone({freq: 220, type: 'square',   duration: 0.30, peak: 0.18, sweep: -150, attack: 0.005, release: 0.12, ex, ey, py})
          noise({duration: 0.40, peak: 0.32, color: 'pink', ex, ey, py, filter: {type: 'bandpass', freq: 1500, q: 6}})
          break
        case 'slider-air':
          // Airy pop — broad mid burst, no sub.
          noise({duration: 0.30, peak: 0.45, color: 'pink', ex, ey, py, filter: {type: 'bandpass', freq: 1400, q: 1.5}})
          tone({freq: 320, type: 'triangle', duration: 0.25, peak: 0.30, sweep: -240, attack: 0.005, release: 0.12, ex, ey, py})
          break
        case 'slider-ground':
          // Ground tank crump — heavy and short.
          tone({freq: 75, type: 'sawtooth', duration: 0.50, peak: 0.45, sweep: -35, attack: 0.005, release: 0.30, ex, ey, py})
          noise({duration: 0.40, peak: 0.50, color: 'brown', ex, ey, py, filter: {type: 'lowpass', freq: 600}})
          noise({duration: 0.05, peak: 0.35, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: 1800, q: 4}})
          break
        case 'bouncer':
          // Rapid clatter — staggered chittery breaks.
          for (let i = 0; i < 4; i++) {
            const fq = 2400 + i * 320
            setTimeout(() => noise({duration: 0.06, peak: 0.32, color: 'white', ex, ey, py, filter: {type: 'bandpass', freq: fq, q: 5}}), i * 35)
          }
          tone({freq: 280, type: 'triangle', duration: 0.22, peak: 0.25, sweep: -180, attack: 0.003, release: 0.10, ex, ey, py})
          break
        default:
          // Fallback: a generic mid-weight pop.
          tone({freq: 180, type: 'sawtooth', duration: 0.35, peak: 0.4, sweep: -100, attack: 0.005, release: 0.2, ex, ey, py})
          noise({duration: 0.3, peak: 0.35, color: 'pink', ex, ey, py, filter: {type: 'lowpass', freq: 1100}})
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
    // Side thruster puff: short pneumatic gas burst. No oscillator — the old
    // sub-down-sweep made it sound like a low buzzy note ("brr") instead of
    // compressed gas escaping a nozzle. This is purely noise: a fast hi-band
    // hiss attack with a soft pink-noise tail underneath.
    turnSound: (left) => {
      init()
      const t0 = ctx.currentTime
      const dur = 0.13
      const pan = left ? -0.45 : 0.45

      // High-band hiss: the pop of the valve opening.
      const hiss = ctx.createBufferSource()
      hiss.buffer = engine.buffer.whiteNoise({channels: 1, duration: dur})
      const hissBp = ctx.createBiquadFilter()
      hissBp.type = 'bandpass'; hissBp.frequency.value = 2200; hissBp.Q.value = 1.4
      const hissHp = ctx.createBiquadFilter()
      hissHp.type = 'highpass'; hissHp.frequency.value = 900
      const hissG = ctx.createGain()
      hiss.connect(hissBp); hissBp.connect(hissHp); hissHp.connect(hissG)
      hissG.gain.setValueAtTime(0, t0)
      hissG.gain.linearRampToValueAtTime(0.34, t0 + 0.004)
      hissG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

      // Soft body tail — pink noise in the breath range so the puff has body
      // rather than ending in a click.
      const body = ctx.createBufferSource()
      body.buffer = engine.buffer.pinkNoise({channels: 1, duration: dur + 0.05})
      const bodyBp = ctx.createBiquadFilter()
      bodyBp.type = 'bandpass'; bodyBp.frequency.value = 600; bodyBp.Q.value = 0.9
      const bodyG = ctx.createGain()
      body.connect(bodyBp); bodyBp.connect(bodyG)
      bodyG.gain.setValueAtTime(0, t0)
      bodyG.gain.linearRampToValueAtTime(0.16, t0 + 0.006)
      bodyG.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.03)

      const sum = ctx.createGain(); sum.gain.value = 1
      hissG.connect(sum); bodyG.connect(sum)
      const p = ctx.createStereoPanner(); p.pan.value = pan
      sum.connect(p); p.connect(out)

      hiss.start(t0); hiss.stop(t0 + dur + 0.05)
      body.start(t0); body.stop(t0 + dur + 0.1)
    },
    speedShift: (up) => tone({freq: up ? 600 : 360, type: 'triangle', duration: 0.08, peak: 0.22, attack: 0.005, release: 0.05}),
    avoid: () => tone({freq: 1100, type: 'triangle', duration: 0.04, peak: 0.12, attack: 0.002, release: 0.03}),
    pauseTone: () => tone({freq: 440, type: 'sine', duration: 0.15, peak: 0.3}),
  }
})()
