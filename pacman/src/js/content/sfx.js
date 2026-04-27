// One-shot sound effects (chomp, eat-ghost, life-lost, fruit-eaten, extra-life)
// and short jingles. All synthesized via WebAudio. Routed directly to the master
// mixer (not spatialized).
content.sfx = (() => {
  const ctx = () => engine.context()
  const dest = () => engine.mixer.input()

  function envelopedSine({freq, dur = 0.3, gain = 0.2, type = 'sine', pitchTo = null, when = 0}) {
    const c = ctx()
    const t0 = c.currentTime + when
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (pitchTo !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, pitchTo), t0 + dur)
    }
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(dest())
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  function noiseBurst({dur = 0.15, gain = 0.3, freq = 800, when = 0}) {
    const c = ctx()
    const t0 = c.currentTime + when
    const sr = c.sampleRate
    const buf = c.createBuffer(1, sr * dur, sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource(); src.buffer = buf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 6
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(bp).connect(g).connect(dest())
    src.start(t0); src.stop(t0 + dur + 0.05)
  }

  return {
    // "Waka-waka": two flat square-wave tones that alternate as pellets are
    // eaten. A is the low "wa", B is the higher "ka" (perfect fifth above).
    chompA: () => envelopedSine({freq: 440, dur: 0.08, gain: 0.18, type: 'square'}),
    chompB: () => envelopedSine({freq: 660, dur: 0.08, gain: 0.18, type: 'square'}),
    eatPower: () => {
      noiseBurst({dur: 0.4, gain: 0.25, freq: 600})
      envelopedSine({freq: 200, dur: 0.4, gain: 0.2, type: 'sawtooth', pitchTo: 800})
    },
    eatGhost: () => {
      // Rising arpeggio
      envelopedSine({freq: 400, dur: 0.12, gain: 0.2, type: 'square', when: 0.0})
      envelopedSine({freq: 600, dur: 0.12, gain: 0.2, type: 'square', when: 0.12})
      envelopedSine({freq: 900, dur: 0.18, gain: 0.2, type: 'square', when: 0.24})
    },
    eatFruit: () => {
      envelopedSine({freq: 800, dur: 0.12, gain: 0.22, type: 'triangle', pitchTo: 1200})
      envelopedSine({freq: 1200, dur: 0.18, gain: 0.18, type: 'sine', when: 0.1})
    },
    death: () => {
      // Lose-life sound, modeled on the arcade death cry: a short up-whoop with
      // vibrato (~0.5s), followed by four downward portamento "wails" that step
      // through the register. Square waves throughout for chiptune character.
      const c = ctx()
      const t0 = c.currentTime

      // Phase 1: rising-then-falling whoop with vibrato
      const osc1 = c.createOscillator()
      osc1.type = 'square'
      osc1.frequency.setValueAtTime(330, t0)
      osc1.frequency.linearRampToValueAtTime(700, t0 + 0.08)
      osc1.frequency.exponentialRampToValueAtTime(140, t0 + 0.5)

      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 22
      const lfoGain = c.createGain()
      lfoGain.gain.value = 30
      lfo.connect(lfoGain).connect(osc1.frequency)

      const env1 = c.createGain()
      env1.gain.setValueAtTime(0, t0)
      env1.gain.linearRampToValueAtTime(0.24, t0 + 0.02)
      env1.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55)

      osc1.connect(env1).connect(dest())
      osc1.start(t0); osc1.stop(t0 + 0.6)
      lfo.start(t0); lfo.stop(t0 + 0.6)

      // Phase 2: four descending wails, each sliding from a higher pitch to a
      // lower one. Stagger them so the next step starts before the previous
      // fully fades — gives the "wah-wah-wah" stair-step feel.
      const steps = [
        {f0: 480, f1: 280, dur: 0.13},
        {f0: 360, f1: 200, dur: 0.14},
        {f0: 250, f1: 130, dur: 0.15},
        {f0: 160, f1: 70,  dur: 0.30},
      ]
      let t = t0 + 0.55
      for (const s of steps) {
        const o = c.createOscillator()
        o.type = 'square'
        o.frequency.setValueAtTime(s.f0, t)
        o.frequency.exponentialRampToValueAtTime(s.f1, t + s.dur)
        const g = c.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.20, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.001, t + s.dur)
        o.connect(g).connect(dest())
        o.start(t); o.stop(t + s.dur + 0.03)
        t += s.dur * 0.88
      }
    },
    extraLife: () => {
      // Cheerful ding
      envelopedSine({freq: 1200, dur: 0.2, gain: 0.2, type: 'sine', when: 0.0})
      envelopedSine({freq: 1600, dur: 0.3, gain: 0.2, type: 'sine', when: 0.15})
    },
    levelClear: () => {
      const notes = [523, 659, 784, 1047]
      notes.forEach((f, i) => {
        envelopedSine({freq: f, dur: 0.18, gain: 0.18, type: 'square', when: i * 0.18})
      })
    },
    introJingle: () => {
      // Old-arcade chiptune: two pure square-wave voices, no drums, no filter.
      // ~3.1 seconds at 150 BPM. Lead runs rapid 16th-note arpeggios through
      // C → G → F → V → I, ending on a held high C. Bass bounces root+octave
      // eighths under the chord changes. The point is to sound like a 1980-era
      // PSG chip (Pac-Man / Galaga / Donkey Kong era), not a modern fanfare.
      const c = ctx()
      const t0 = c.currentTime
      const out = dest()

      function voice(freq, when, dur, gain) {
        const osc = c.createOscillator()
        osc.type = 'square'
        osc.frequency.value = freq
        const g = c.createGain()
        // Snap-on, hold near full, snap-off — staccato chip envelope.
        g.gain.setValueAtTime(0, t0 + when)
        g.gain.linearRampToValueAtTime(gain, t0 + when + 0.002)
        g.gain.setValueAtTime(gain, t0 + when + Math.max(0.004, dur - 0.012))
        g.gain.exponentialRampToValueAtTime(0.001, t0 + when + dur)
        osc.connect(g).connect(out)
        osc.start(t0 + when)
        osc.stop(t0 + when + dur + 0.02)
      }

      // 150 BPM
      const S = 0.1, E = 0.2, Q = 0.4

      // C major notes
      const C2 = 65.41, F2 = 87.31, G2 = 98.00
      const C3 = 130.81, F3 = 174.61, G3 = 196.00
      const C5 = 523.25, D5 = 587.33, G5 = 783.99, A5 = 880.00, B5 = 987.77, E5 = 659.25, F5 = 698.46
      const C6 = 1046.50, D6 = 1174.66, E6 = 1318.51, F6 = 1396.91, G6 = 1567.98
      const C7 = 2093.00

      // Lead: 24 sixteenths of arpeggios spelling I → V → IV → V, then held C7.
      const melody = [
        // b1: C arp up
        [C5, S], [E5, S], [G5, S], [C6, S],
        // b2: peak flutter
        [G5, S], [C6, S], [E6, S], [G5, S],
        // b3: G arp up
        [D5, S], [G5, S], [B5, S], [D6, S],
        // b4: peak descent
        [G6, S], [D6, S], [B5, S], [G5, S],
        // b5: F arp up
        [F5, S], [A5, S], [C6, S], [F6, S],
        // b6: V climb to G6
        [G5, S], [C6, S], [E6, S], [G6, S],
        // b7-8: triumphant held tonic
        [C7, Q + 0.3],
      ]
      let t = 0
      for (const [f, d] of melody) { voice(f, t, d, 0.10); t += d }

      // Bass: each beat = root (eighth) + octave (eighth). I I V V IV V I.
      const bassChords = [
        [C2, C3], [C2, C3],   // b1-2: I
        [G2, G3], [G2, G3],   // b3-4: V
        [F2, F3],             // b5: IV
        [G2, G3],             // b6: V
        [C2, C3],             // b7: I (lead held above)
      ]
      for (let i = 0; i < bassChords.length; i++) {
        const bt = i * Q
        voice(bassChords[i][0], bt, E, 0.14)
        voice(bassChords[i][1], bt + E, E, 0.14)
      }
    },
    footstep: () => {
      // Soft low-frequency click, fires once per tile crossed. Quiet enough
      // to sit under the chomp/ghost sounds but audible when nothing else is.
      const c = ctx()
      const t0 = c.currentTime
      const noise = c.createBufferSource()
      const sr = c.sampleRate
      const buf = c.createBuffer(1, Math.floor(sr * 0.05), sr)
      const data = buf.getChannelData(0)
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
      noise.buffer = buf
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220
      const g = c.createGain()
      g.gain.setValueAtTime(0, t0)
      g.gain.linearRampToValueAtTime(0.08, t0 + 0.002)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05)
      noise.connect(lp).connect(g).connect(dest())
      noise.start(t0); noise.stop(t0 + 0.07)
    },
    wallHit: () => {
      // Short low thud — bandpass-filtered noise burst plus a short sub-frequency
      // sine ping. Distinct from any in-play sound; reads as "you bumped".
      noiseBurst({dur: 0.10, gain: 0.32, freq: 180})
      envelopedSine({freq: 90, dur: 0.12, gain: 0.18, type: 'sine', pitchTo: 50})
    },
    menuMove: () => envelopedSine({freq: 440, dur: 0.06, gain: 0.1, type: 'square'}),
    menuSelect: () => envelopedSine({freq: 880, dur: 0.12, gain: 0.15, type: 'square', pitchTo: 1320}),
    menuBack: () => envelopedSine({freq: 880, dur: 0.12, gain: 0.12, type: 'square', pitchTo: 440}),
  }
})()
