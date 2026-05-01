// One-shot sound effects. Routed directly to the master mixer (not
// spatialized). Synthesized with WebAudio primitives — no samples.
content.sfx = (() => {
  const ctx = () => engine.context()
  const dest = () => engine.mixer.input()

  function envSine({freq, dur = 0.2, gain = 0.18, type = 'sine', pitchTo = null, when = 0, attack = 0.005}) {
    const c = ctx()
    const t0 = c.currentTime + when
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (pitchTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, pitchTo), t0 + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(g).connect(dest())
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
  }

  function noiseBurst({dur = 0.2, gain = 0.25, freq = 800, q = 4, when = 0}) {
    const c = ctx()
    const t0 = c.currentTime + when
    const sr = c.sampleRate
    const buf = c.createBuffer(1, Math.max(1, Math.floor(sr * dur)), sr)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource(); src.buffer = buf
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(0, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(bp).connect(g).connect(dest())
    src.start(t0); src.stop(t0 + dur + 0.05)
  }

  return {
    // Wing flap: brief upward chirp + tiny bandpassed noise burst for "feathers"
    flap: function () {
      envSine({freq: 380, pitchTo: 880, dur: 0.10, gain: 0.16, type: 'triangle'})
      noiseBurst({dur: 0.06, gain: 0.06, freq: 1800, q: 2})
    },

    // Pleasant ascending arpeggio: C5 - E5 - G5
    score: function () {
      const notes = [523.25, 659.25, 783.99]
      notes.forEach((f, i) => envSine({freq: f, dur: 0.18, gain: 0.14, type: 'triangle', when: i * 0.07}))
    },

    // Harsh descending tone for collision
    collide: function () {
      envSine({freq: 420, pitchTo: 70, dur: 0.45, gain: 0.32, type: 'sawtooth'})
      noiseBurst({dur: 0.40, gain: 0.20, freq: 220, q: 1.2})
    },

    // Game-over jingle: descending 4-note "fail" cadence
    gameOver: function () {
      const notes = [
        {f: 660, d: 0.18},
        {f: 555, d: 0.18},
        {f: 466, d: 0.18},
        {f: 330, d: 0.45},
      ]
      let t = 0
      for (const n of notes) {
        envSine({freq: n.f, dur: n.d, gain: 0.18, type: 'triangle', when: t})
        t += n.d * 0.85
      }
    },

    // Subtle menu "move focus" tick
    menuMove: function () {
      envSine({freq: 660, dur: 0.05, gain: 0.08, type: 'square'})
    },

    // "select" — rising two-tone
    menuSelect: function () {
      envSine({freq: 600, dur: 0.06, gain: 0.10, type: 'square'})
      envSine({freq: 900, dur: 0.08, gain: 0.10, type: 'square', when: 0.06})
    },

    // "back" — descending two-tone
    menuBack: function () {
      envSine({freq: 700, dur: 0.06, gain: 0.10, type: 'square'})
      envSine({freq: 460, dur: 0.08, gain: 0.10, type: 'square', when: 0.06})
    },

    // Gentle ready-set-go tone played when game starts
    ready: function () {
      envSine({freq: 440, dur: 0.10, gain: 0.16, type: 'sine'})
      envSine({freq: 660, dur: 0.18, gain: 0.18, type: 'sine', when: 0.15})
    },

    // Extra-life / new-record cheer
    cheer: function () {
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((f, i) => envSine({freq: f, dur: 0.2, gain: 0.14, type: 'triangle', when: i * 0.09}))
    },
  }
})()
