// CADENCE music — a per-level generative bed locked to the gameplay clock. The
// engine schedules a 16th-note grid on the audio clock with a short lookahead
// (so frame jitter never tears the groove); the game loop just pumps update().
//
// CRITICAL CONTRACT: a kick lands on EVERY quarter note (grid steps 0,4,8,12),
// and the sequencer's step 0 is anchored to the game's beat 0 (t0). So the kick
// you hear IS the beat you move to. Everything else (snare, hats, bass, pad,
// arp, lead, stabs) is colour layered per the level's `style`/`timbre`, giving
// each sector its own modern-synth character without ever losing the pulse.
content.music = (() => {
  const LOOKAHEAD = 0.18
  const STEPS = 16

  const L = () => content.levels

  let running = false
  let step = 0
  let bar = 0
  let nextTime = 0
  let cfg = null         // resolved music config for the current level
  let beatDur = 0.5
  let master = null      // {gain, lp}

  function ctx() { return engine.context() }
  function out() { return engine.mixer.input() }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12) }
  function stepDur() { return beatDur / 4 }

  function ensureMaster() {
    if (master) return master
    const c = ctx()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 5200
    const gain = c.createGain()
    gain.gain.value = 0.0001
    lp.connect(gain).connect(out())
    master = {gain, lp}
    return master
  }
  function dest() { return ensureMaster().lp }

  // ---- noise buffer (hats/snare) ----
  let _noise = null
  function noiseBuf() {
    if (_noise) return _noise
    const c = ctx()
    const len = Math.floor(c.sampleRate * 0.5)
    const b = c.createBuffer(1, len, c.sampleRate)
    const d = b.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    _noise = b
    return _noise
  }

  // ---- voices ----
  function kick(t, peak) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.setValueAtTime(140, t)
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak || 0.95, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20)
    o.connect(g).connect(dest())
    o.start(t); o.stop(t + 0.22)
  }

  function snare(t, peak) {
    const c = ctx()
    const s = c.createBufferSource(); s.buffer = noiseBuf()
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak || 0.4, t + 0.003)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    s.connect(bp).connect(g).connect(dest())
    s.start(t); s.stop(t + 0.2)
    // body tone
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(180, t)
    const og = c.createGain()
    og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(0.18, t + 0.003)
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
    o.connect(og).connect(dest()); o.start(t); o.stop(t + 0.14)
  }

  function hat(t, peak, open) {
    const c = ctx()
    const s = c.createBufferSource(); s.buffer = noiseBuf()
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000
    const g = c.createGain()
    const r = open ? 0.12 : 0.04
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + r)
    s.connect(hp).connect(g).connect(dest())
    s.start(t); s.stop(t + r + 0.03)
  }

  function bass(t, freq, dur, type) {
    const c = ctx()
    const o = c.createOscillator()
    const lp = c.createBiquadFilter()
    const g = c.createGain()
    o.type = type === 'square' ? 'square' : 'sawtooth'
    o.frequency.setValueAtTime(freq, t)
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(360 + (cfg.intensity || 1) * 220, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(type === 'sub' ? 0.6 : 0.42, t + 0.012)
    g.gain.setValueAtTime(g.gain.value, t + dur * 0.6)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    if (type === 'sub') {
      const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(freq / 2, t)
      const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(0.35, t + 0.012)
      sg.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      sub.connect(sg).connect(dest()); sub.start(t); sub.stop(t + dur + 0.03)
    }
    o.connect(lp).connect(g).connect(dest())
    o.start(t); o.stop(t + dur + 0.03)
  }

  function tone(t, freq, dur, peak, type) {
    const c = ctx()
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type || 'triangle'
    o.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(peak, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(dest())
    o.start(t); o.stop(t + dur + 0.03)
    // a touch of FM shimmer for the 'fm' lead
    if (type === 'fm') {
      const m = c.createOscillator(); m.type = 'sine'; m.frequency.value = freq * 2.01
      const mg = c.createGain(); mg.gain.value = freq * 0.6
      m.connect(mg).connect(o.frequency); m.start(t); m.stop(t + dur + 0.03)
    }
  }

  function chordNotes(chord) {
    const root = cfg.root + 12 + chord.r
    const q = chord.q
    let third = q === 'maj' ? 4 : q === 'sus2' ? 2 : 3
    let fifth = q === 'dim' ? 6 : 7
    return [root, root + third, root + fifth]
  }

  function pad(t, chord) {
    const notes = chordNotes(chord).map((m) => m + 12)
    notes.forEach((m, i) => {
      const c = ctx()
      const o = c.createOscillator()
      const g = c.createGain()
      o.type = cfg.timbre.pad === 'square' ? 'square' : 'sawtooth'
      o.frequency.setValueAtTime(mtof(m) * (i === 0 ? 1 : 1.005), t)
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(0.05, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.0001, t + beatDur * 3.6)
      o.connect(g).connect(dest())
      o.start(t); o.stop(t + beatDur * 3.7)
    })
  }

  function stab(t, chord, peak) {
    const notes = chordNotes(chord)
    notes.forEach((m) => tone(t, mtof(m + 12), stepDur() * 1.6, peak || 0.10, 'sawtooth'))
  }

  // ---- the per-step scheduler ----
  function scheduleStep(s, t) {
    const style = cfg.style
    const chord = cfg.prog[bar % cfg.prog.length]
    const scale = L().SCALES[cfg.scale] || L().SCALES.minor
    const isBeat = s % 4 === 0
    const beatIdx = s / 4 // 0..3 on beats

    // kick on every quarter — the metronome. A touch louder on the downbeat.
    if (isBeat) kick(t, beatIdx === 0 ? 1.0 : 0.9)

    // snare
    if (style.snare === '2and4' && (s === 4 || s === 12)) snare(t, 0.4)
    if (style.snare === 'backbeat' && (s === 4 || s === 12)) snare(t, 0.45)
    if (style.snare === 'driving' && (s === 4 || s === 10 || s === 12)) snare(t, s === 10 ? 0.22 : 0.42)

    // hats
    if (style.hats >= 1 && s % 4 === 2) hat(t, 0.10, true)
    if (style.hats >= 2 && s % 2 === 0) hat(t, 0.08, false)
    if (style.hats >= 3 && s % 2 === 1) hat(t, 0.05, false)

    // bass
    const broot = cfg.root + chord.r
    if (style.bass === 'root' && isBeat) bass(t, mtof(broot), beatDur * 0.9, cfg.timbre.bass)
    if (style.bass === 'octave' && (s === 0 || s === 6 || s === 8 || s === 14))
      bass(t, mtof(broot + (s === 6 || s === 14 ? 12 : 0)), stepDur() * 1.8, cfg.timbre.bass)
    if (style.bass === 'driving' && s % 2 === 0)
      bass(t, mtof(broot + (s % 8 === 6 ? 7 : 0)), stepDur() * 1.5, cfg.timbre.bass)
    // bassOff — a syncopated 16th pickup just before the downbeats (Act II push)
    if (style.bassOff && (s === 7 || s === 15))
      bass(t, mtof(broot + 12), stepDur() * 1.2, cfg.timbre.bass)

    // pad — one swell per bar on the downbeat
    if (style.pad && s === 0) pad(t, chord)

    // stab — chord hit on beats 2 & 4
    if (style.stab && (s === 4 || s === 12)) stab(t, chord)
    // offStab — softer chord stabs on the "and"s (Act II syncopation)
    if (style.offStab && (s === 2 || s === 6 || s === 10 || s === 14)) stab(t, chord, 0.06)

    // arp — chord/scale tones cycling up. arp16 runs the full 16th grid (faster).
    if (style.arp && (style.arp16 || s % 2 === 0)) {
      const tones = chordNotes(chord).concat([chordNotes(chord)[0] + 12])
      const idx = (style.arp16 ? s : s / 2) % tones.length
      const f = mtof(tones[idx] + 12)
      tone(t, f, stepDur() * (style.arp16 ? 0.9 : 1.2), style.arp16 ? 0.05 : 0.07,
        cfg.timbre.lead === 'square' ? 'square' : 'triangle')
    }

    // lead — a motif from scale degrees. leadBusy plays more, shorter notes
    // (faster melody) for the Act II sectors.
    if (style.lead) {
      const leadSteps = style.leadBusy ? [0, 3, 6, 8, 10, 13] : [0, 6, 10]
      if (leadSteps.indexOf(s) !== -1) {
        const pool = style.leadBusy ? [0, 4, 2, 5, 3, 7, 4, 2] : [0, 4, 2]
        const deg = pool[(bar + s) % pool.length]
        const m = cfg.root + 24 + chord.r + scale[deg % scale.length]
        tone(t, mtof(m), beatDur * (style.leadBusy ? 0.45 : 0.7), 0.08, cfg.timbre.lead)
      }
    }

    if (s === STEPS - 1) bar = (bar + 1) % 1000000
  }

  function update() {
    if (!running) return
    const c = ctx()
    const now = c.currentTime
    if (nextTime < now - 0.3) nextTime = now + 0.03 // recover from a stall
    const sw = (cfg && cfg.swing) || 0
    while (nextTime < now + LOOKAHEAD) {
      // swing: nudge odd 8ths a little later
      const swung = (step % 2 === 1) ? nextTime + sw * stepDur() : nextTime
      scheduleStep(step, swung)
      step = (step + 1) % STEPS
      nextTime += stepDur()
    }
    const m = ensureMaster()
    const target = Math.min(0.26, 0.14 + (cfg.intensity || 1) * 0.06)
    m.gain.gain.setTargetAtTime(target, now, 0.3)
  }

  // Start the bed anchored so that grid step 0 == game beat 0 (t0).
  function start(t0, level) {
    const def = L().get(level)
    cfg = def.music
    beatDur = 60 / def.bpm
    running = true
    step = 0
    bar = 0
    nextTime = t0
    const c = ctx()
    const m = ensureMaster()
    m.gain.gain.cancelScheduledValues(c.currentTime)
    m.gain.gain.setValueAtTime(0.0001, c.currentTime)
    m.gain.gain.setTargetAtTime(0.14, c.currentTime, 0.4)
  }

  function stop() {
    running = false
    if (!master) return
    const c = ctx()
    const t = c.currentTime
    try {
      master.gain.gain.cancelScheduledValues(t)
      master.gain.gain.setValueAtTime(master.gain.gain.value, t)
      master.gain.gain.linearRampToValueAtTime(0.0001, t + 0.3)
    } catch (e) {}
  }

  return {start, stop, update, isOn: () => running}
})()
