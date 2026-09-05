/**
 * Pipe — audio. Stereo (non-spatial) modern synth, per the design brief.
 *
 * Every voice is oscillator/noise -> gain (ADSR) -> StereoPanner -> a game
 * sub-bus -> syngen master bus (so the limiter still catches us). There is no
 * binaural pipeline: position is conveyed purely by stereo pan, which matches
 * how the original Pipe placed enemies and bonus-round items in the field.
 *
 * Loops (gushing water, an approaching animal, the avoid/line-up beeps, and
 * the background music) are held as handles with .stop(); silenceAll() kills
 * every loop and is called whenever we leave the game/bonus screens.
 */
content.audio = (() => {
  const ctx = () => engine.context()

  let master, sfx, music
  let noiseBuffer
  let stereoSign = 1          // flipped by the speaker test if channels are reversed
  let musicEnabled = true
  let useTts = false

  // ---- graph ---------------------------------------------------------------

  function ensureGraph() {
    if (master) return
    const c = ctx()
    master = c.createGain()
    master.gain.value = 0.9
    master.connect(engine.mixer.input())

    sfx = c.createGain()
    sfx.gain.value = 1
    sfx.connect(master)

    music = c.createGain()
    music.gain.value = 0.32
    music.connect(master)

    noiseBuffer = makeNoiseBuffer(c, 2)
  }

  function makeNoiseBuffer(c, seconds) {
    const len = Math.floor(c.sampleRate * seconds)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    return buf
  }

  function setStereoSign(sign) { stereoSign = sign < 0 ? -1 : 1 }
  function setMusicEnabled(v) {
    musicEnabled = Boolean(v)
    if (!musicEnabled) stopMusic()
  }
  function setUseTts(v) { useTts = Boolean(v) }

  // ---- primitive voices ----------------------------------------------------

  // One-shot tone with a linear ADSR. Returns nothing; self-cleans.
  function tone({freq = 440, type = 'triangle', when = 0, dur = 0.18,
                 attack = 0.005, release = 0.09, gain = 0.3, pan = 0,
                 glideTo = null, dest} = {}) {
    ensureGraph()
    const c = ctx()
    const t0 = when || c.currentTime
    const osc = c.createOscillator()
    const g = c.createGain()
    const p = c.createStereoPanner()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (glideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t0 + dur)
    p.pan.value = engine.fn.clamp(pan * stereoSign, -1, 1)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur + release)
    osc.connect(g); g.connect(p); p.connect(dest || sfx)
    osc.start(t0)
    osc.stop(t0 + attack + dur + release + 0.03)
  }

  // One-shot filtered noise burst.
  function noise({when = 0, dur = 0.2, gain = 0.3, pan = 0, type = 'bandpass',
                  freq = 1200, q = 1, attack = 0.004, release = 0.12, dest} = {}) {
    ensureGraph()
    const c = ctx()
    const t0 = when || c.currentTime
    const src = c.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    const f = c.createBiquadFilter()
    f.type = type; f.frequency.value = freq; f.Q.value = q
    const g = c.createGain()
    const p = c.createStereoPanner()
    p.pan.value = engine.fn.clamp(pan * stereoSign, -1, 1)
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.linearRampToValueAtTime(gain, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + dur + release)
    src.connect(f); f.connect(g); g.connect(p); p.connect(dest || sfx)
    src.start(t0)
    src.stop(t0 + attack + dur + release + 0.03)
  }

  function chord(freqs, opts = {}) {
    const base = opts.when || ctx().currentTime
    freqs.forEach((f, i) => tone({...opts, freq: f, when: base + (opts.spread || 0) * i}))
  }

  // ---- discrete cues -------------------------------------------------------

  // Toolbox cycle: a short blip whose pitch encodes the pipe number.
  function cycleTick(n, total) {
    const semis = (n - 1)
    const freq = 392 * Math.pow(2, semis / 12)
    tone({freq, type: 'triangle', dur: 0.07, gain: 0.22, release: 0.05})
  }

  // "It fits" — bright rising two-tone.
  function testFit() {
    const t = ctx().currentTime
    tone({freq: 660, type: 'triangle', when: t, dur: 0.08, gain: 0.3})
    tone({freq: 990, type: 'triangle', when: t + 0.07, dur: 0.16, gain: 0.3})
  }

  // "No fit" — flat dissonant clink.
  function testNoFit() {
    const t = ctx().currentTime
    tone({freq: 233, type: 'square', when: t, dur: 0.12, gain: 0.22})
    tone({freq: 246, type: 'square', when: t, dur: 0.12, gain: 0.16})
  }

  function hammerHit(i, total) {
    const t = ctx().currentTime
    const f = 520 + 90 * (i / Math.max(1, total))
    noise({when: t, dur: 0.03, gain: 0.35, freq: 2600, q: 0.7, type: 'bandpass', release: 0.05})
    tone({freq: f, type: 'square', when: t, dur: 0.04, gain: 0.18, release: 0.05})
  }

  function hammerDone() {
    const t = ctx().currentTime
    noise({when: t, dur: 0.05, gain: 0.4, freq: 3000, q: 0.6, release: 0.08})
    chord([523, 659, 784], {type: 'triangle', when: t + 0.02, dur: 0.22, gain: 0.26, release: 0.18})
  }

  function drench() {
    const t = ctx().currentTime
    noise({when: t, dur: 0.5, gain: 0.5, type: 'lowpass', freq: 900, q: 0.4, release: 0.4})
    tone({freq: 180, type: 'sine', when: t, dur: 0.4, glideTo: 70, gain: 0.3, release: 0.3})
  }

  function avoidSuccess(type) {
    const t = ctx().currentTime
    if (type === 'bee') {
      // spray hiss
      noise({when: t, dur: 0.3, gain: 0.35, type: 'highpass', freq: 4000, release: 0.2})
    } else if (type === 'bat') {
      // duck whoosh
      noise({when: t, dur: 0.25, gain: 0.3, type: 'bandpass', freq: 800, q: 1.2, release: 0.2})
    } else {
      // jump boing
      tone({freq: 300, type: 'sine', when: t, dur: 0.22, glideTo: 700, gain: 0.3})
    }
    chord([659, 880], {type: 'triangle', when: t + 0.05, dur: 0.18, gain: 0.24})
  }

  function enemyHit(type) {
    const t = ctx().currentTime
    noise({when: t, dur: 0.18, gain: 0.45, type: 'bandpass', freq: 500, q: 0.8, release: 0.2})
    tone({freq: 220, type: 'sawtooth', when: t, dur: 0.3, glideTo: 90, gain: 0.32, release: 0.25})
  }

  function trip() {
    const t = ctx().currentTime
    tone({freq: 440, type: 'sawtooth', when: t, dur: 0.5, glideTo: 130, gain: 0.28, release: 0.2})
  }

  function handClap() {
    noise({dur: 0.04, gain: 0.5, type: 'bandpass', freq: 1500, q: 0.5, release: 0.06})
  }

  function balanceOk() {
    const t = ctx().currentTime
    chord([523, 659, 784, 1047], {type: 'triangle', when: t, dur: 0.18, gain: 0.24, spread: 0.04})
  }

  function fall() {
    const t = ctx().currentTime
    tone({freq: 300, type: 'sawtooth', when: t, dur: 0.6, glideTo: 60, gain: 0.34, release: 0.3})
    noise({when: t + 0.3, dur: 0.25, gain: 0.4, type: 'lowpass', freq: 400, release: 0.25})
  }

  // ---- bonus round item timbres -------------------------------------------
  // Five distinguishable voices. index 0..4 maps to the manual's
  // cymbal / "bass" / choir / sax / bottle.
  const BONUS_NAMES = ['cymbal', 'bass', 'choir', 'sax', 'bottle']

  function bonusSound(index, pan = 0) {
    const t = ctx().currentTime
    const p = pan
    switch (index) {
      case 0: // cymbal
        noise({when: t, dur: 0.3, gain: 0.34, type: 'highpass', freq: 6000, release: 0.35, pan: p})
        break
      case 1: // bass
        tone({freq: 98, type: 'sine', when: t, dur: 0.3, gain: 0.4, release: 0.2, pan: p})
        tone({freq: 196, type: 'triangle', when: t, dur: 0.3, gain: 0.18, release: 0.2, pan: p})
        break
      case 2: // choir pad
        chord([392, 494, 587], {type: 'triangle', when: t, dur: 0.4, gain: 0.2, release: 0.3, pan: p})
        break
      case 3: // sax-ish reedy note
        tone({freq: 330, type: 'sawtooth', when: t, dur: 0.35, gain: 0.22, release: 0.2, pan: p})
        tone({freq: 660, type: 'sine', when: t, dur: 0.35, gain: 0.1, release: 0.2, pan: p})
        break
      default: // bottle smash
        noise({when: t, dur: 0.22, gain: 0.4, type: 'highpass', freq: 3500, q: 0.5, release: 0.25, pan: p})
        tone({freq: 1200, type: 'square', when: t, dur: 0.05, gain: 0.18, pan: p})
    }
  }

  function bonusGot() {
    const t = ctx().currentTime
    chord([784, 1047], {type: 'triangle', when: t, dur: 0.16, gain: 0.28, spread: 0.05})
  }

  // ---- jingles -------------------------------------------------------------

  function levelJingle() {
    const t = ctx().currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((f, i) => tone({freq: f, type: 'triangle', when: t + i * 0.12, dur: 0.16, gain: 0.26}))
  }

  function bonusIntroJingle() {
    const t = ctx().currentTime
    const notes = [659, 784, 880, 1047, 1318]
    notes.forEach((f, i) => tone({freq: f, type: 'square', when: t + i * 0.09, dur: 0.1, gain: 0.2}))
  }

  function gameOverDirge() {
    const t = ctx().currentTime
    const notes = [392, 330, 262, 196]
    notes.forEach((f, i) => tone({freq: f, type: 'sawtooth', when: t + i * 0.28, dur: 0.32, gain: 0.3, release: 0.25}))
  }

  function menuBlip() {
    tone({freq: 587, type: 'triangle', dur: 0.06, gain: 0.18, release: 0.05})
  }

  // ---- loops ---------------------------------------------------------------

  let waterLoop = null

  function startWater() {
    ensureGraph()
    stopWater()
    const c = ctx()
    const src = c.createBufferSource()
    src.buffer = noiseBuffer
    src.loop = true
    const f = c.createBiquadFilter()
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.6
    const g = c.createGain()
    g.gain.value = 0.04
    src.connect(f); f.connect(g); g.connect(sfx)
    src.start()
    waterLoop = {src, f, g}
  }

  // urgency 0..1 -> louder, brighter, with rising drip pressure.
  function setWaterUrgency(u) {
    if (!waterLoop) return
    const c = ctx()
    const t = c.currentTime
    const gain = engine.fn.lerp(0.04, 0.34, u)
    const cut = engine.fn.lerp(500, 2600, u)
    waterLoop.g.gain.setTargetAtTime(gain, t, 0.08)
    waterLoop.f.frequency.setTargetAtTime(cut, t, 0.08)
  }

  function stopWater() {
    if (!waterLoop) return
    try { waterLoop.src.stop() } catch (e) {}
    waterLoop = null
  }

  // Approaching animal: a continuous panned voice per type.
  let enemyLoop = null

  function startEnemy(type, pan = 0) {
    ensureGraph()
    stopEnemy()
    const c = ctx()
    const p = c.createStereoPanner()
    p.pan.value = engine.fn.clamp(pan * stereoSign, -1, 1)
    p.connect(sfx)
    const g = c.createGain()
    g.gain.value = 0.0001
    g.gain.setTargetAtTime(0.22, c.currentTime, 0.1)
    g.connect(p)

    const nodes = [g, p]
    if (type === 'bee') {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'; osc.frequency.value = 300
      const lfo = c.createOscillator(); lfo.frequency.value = 7
      const lfoGain = c.createGain(); lfoGain.gain.value = 30
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency)
      osc.connect(g); osc.start(); lfo.start()
      nodes.push(osc, lfo, lfoGain)
    } else if (type === 'dog') {
      const osc = c.createOscillator()
      osc.type = 'sawtooth'; osc.frequency.value = 90
      const am = c.createOscillator(); am.frequency.value = 16
      const amGain = c.createGain(); amGain.gain.value = 0.12
      am.connect(amGain); amGain.connect(g.gain)
      osc.connect(g); osc.start(); am.start()
      nodes.push(osc, am, amGain)
    } else { // bat: flapping noise pulses
      const osc = c.createOscillator()
      osc.type = 'triangle'; osc.frequency.value = 140
      const flap = c.createOscillator(); flap.frequency.value = 6
      const flapGain = c.createGain(); flapGain.gain.value = 0.18
      flap.connect(flapGain); flapGain.connect(g.gain)
      osc.connect(g); osc.start(); flap.start()
      nodes.push(osc, flap, flapGain)
    }
    enemyLoop = {nodes, p, g, type}
  }

  function setEnemyPan(pan) {
    if (enemyLoop) enemyLoop.p.pan.setTargetAtTime(engine.fn.clamp(pan * stereoSign, -1, 1), ctx().currentTime, 0.05)
  }

  function stopEnemy() {
    if (!enemyLoop) return
    const c = ctx()
    try {
      enemyLoop.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.05)
      for (const n of enemyLoop.nodes) {
        if (n.stop) { try { n.stop(c.currentTime + 0.2) } catch (e) {} }
      }
    } catch (e) {}
    enemyLoop = null
  }

  // Repeating short beep (avoid window, or bonus line-up). interval ms.
  let beepTimer = null

  function startBeep(interval = 320, freq = 880, pan = 0) {
    stopBeep()
    const fire = () => tone({freq, type: 'square', dur: 0.06, gain: 0.2, pan})
    fire()
    beepTimer = setInterval(fire, interval)
  }

  function stopBeep() {
    if (beepTimer) { clearInterval(beepTimer); beepTimer = null }
  }

  // ---- background music ----------------------------------------------------
  // Simple generative loop: a walking bass + arpeggio, scheduled on the audio
  // clock. Toggled by the backgroundMusic setting.
  let musicTimer = null
  let musicStep = 0

  const MUSIC_BASS = [131, 131, 196, 175]            // C  C  G  F (roots)
  const MUSIC_ARP = [
    [262, 330, 392, 330], [262, 330, 392, 330],
    [392, 494, 587, 494], [349, 440, 523, 440],
  ]

  function startMusic() {
    if (!musicEnabled) return
    ensureGraph()
    stopMusic()
    musicStep = 0
    const stepMs = 230
    const tick = () => {
      const bar = Math.floor(musicStep / 4) % MUSIC_BASS.length
      const beat = musicStep % 4
      if (beat === 0) {
        tone({freq: MUSIC_BASS[bar] / 2, type: 'triangle', dur: 0.5, gain: 0.22, release: 0.2, dest: music})
      }
      const arp = MUSIC_ARP[bar]
      tone({freq: arp[beat], type: 'sine', dur: 0.16, gain: 0.14, release: 0.1, dest: music})
      musicStep++
    }
    tick()
    musicTimer = setInterval(tick, stepMs)
  }

  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null }
  }

  // ---- speech (optional TTS) ----------------------------------------------
  function speak(text) {
    if (!useTts || typeof speechSynthesis === 'undefined') return
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(String(text))
      u.rate = 1.15
      speechSynthesis.speak(u)
    } catch (e) {}
  }

  function silenceAll() {
    stopWater(); stopEnemy(); stopBeep(); stopMusic()
    if (typeof speechSynthesis !== 'undefined') { try { speechSynthesis.cancel() } catch (e) {} }
  }

  return {
    ensureGraph,
    setStereoSign,
    setMusicEnabled,
    setUseTts,
    // discrete cues
    cycleTick, testFit, testNoFit, hammerHit, hammerDone, drench,
    avoidSuccess, enemyHit, trip, handClap, balanceOk, fall,
    bonusSound, bonusGot, BONUS_NAMES,
    levelJingle, bonusIntroJingle, gameOverDirge, menuBlip,
    // loops
    startWater, setWaterUrgency, stopWater,
    startEnemy, setEnemyPan, stopEnemy,
    startBeep, stopBeep,
    startMusic, stopMusic,
    // misc
    speak, silenceAll,
  }
})()
