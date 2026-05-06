/**
 * SPACE INVADERS! — stereo audio engine.
 *
 * Listener mode: STEREO / non-spatial. Each enemy carries a single
 * StereoPannerNode whose pan = enemy.x ∈ [-1, 1]. We never touch
 * engine.position, never set a binaural ear, never set a listener yaw.
 * That keeps the audio model honest: the player is locked at the
 * centre of the field; aim is steered by ear panning alone.
 *
 * Per-source mix:
 *   voice osc(s) → voiceGain → lowpass → outputGain → stereoPan → master
 *   (urgency ticks ride the same panner via shared sub-bus)
 *
 * Cross-module references use lazy getters per CLAUDE.md gotcha.
 *
 * Audio-event relay queue: every audible game-side event goes through
 * `enqueue({type, payload})`. We drain the queue at the end of each
 * frame() and dispatch locally. This is co-op-shaped (drop-in for
 * pong-style host→client replay) without any networking yet.
 */
content.audio = (() => {
  const _state = {
    started: false,
    masterBus: null,            // game-content sum bus (above engine mixer)
    droneBus: null,             // continuous voices (low priority)
    sfxBus: null,               // one-shot SFX
    enemyBins: new Map(),       // id -> {pan, output, lowpass, drone, droneGain, kind, drift}
    lowEnergy: null,            // {osc, gain} or null
    aimVoice: null,             // {osc, gain, pan} — continuous crosshair locator
    targetLock: null,           // {timer, panX} — fast beep when aim is on a target
    queue: [],                  // pending audio events
  }

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }

  // ----------------------------- ADSR helper -----------------------------
  // Cancels prior schedules and applies a clean A/H/R envelope at t0.
  // peak = peak amplitude; attack/hold/release = seconds. The gain ends
  // at 0 after release. A trailing setValueAtTime(0, end) closes the curve.
  function adsr(gainParam, t0, attack, hold, release, peak) {
    try {
      gainParam.cancelScheduledValues(t0)
      gainParam.setValueAtTime(0.0001, t0)
      gainParam.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + Math.max(0.001, attack))
      gainParam.setValueAtTime(peak, t0 + attack + hold)
      gainParam.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.001, release))
      gainParam.setValueAtTime(0, t0 + attack + hold + release + 0.001)
    } catch (e) { /* ignore — context might be in odd state */ }
  }

  // ----------------------------- bus setup -----------------------------
  function ensureStarted() {
    if (_state.started) return
    _state.started = true
    const c = ctx()
    _state.masterBus = c.createGain()
    _state.masterBus.gain.value = 1
    _state.masterBus.connect(engine.mixer.input())

    _state.droneBus = c.createGain()
    _state.droneBus.gain.value = 0.7
    _state.droneBus.connect(_state.masterBus)

    _state.sfxBus = c.createGain()
    _state.sfxBus.gain.value = 1
    _state.sfxBus.connect(_state.masterBus)
  }

  // ----------------------------- enqueue / drain -----------------------------
  function enqueue(ev) {
    _state.queue.push(ev)
  }
  function drain() {
    if (!_state.queue.length) return
    const events = _state.queue
    _state.queue = []
    for (const ev of events) {
      try { dispatch(ev) } catch (e) { console.error(e) }
    }
  }

  function dispatch(ev) {
    if (!_state.started) ensureStarted()
    switch (ev.type) {
      case 'spawn':       return onSpawn(ev)
      case 'kill':        return onKill(ev)
      case 'breach':      return onBreach(ev)
      case 'shieldHit':   return onShieldHit(ev)
      case 'fire':        return onFire(ev)
      case 'hit':         return onHit(ev)
      case 'miss':        return onMiss(ev)
      case 'bounce':      return onBounce(ev)
      case 'civilian':    return onCivilianHit(ev)
      case 'weaponSwitch':return onWeaponSwitch(ev)
      case 'shieldRefill':return onShieldRefill(ev)
      case 'extraLife':   return onExtraLife(ev)
      case 'waveStart':   return onWaveStart(ev)
      case 'waveClear':   return onWaveClear(ev)
      case 'waveSurvived':return onWaveSurvived(ev)
      case 'gameOver':    return onGameOver(ev)
      case 'urgencyTick': return onUrgencyTick(ev)
    }
  }

  // ----------------------------- per-class voice voices -----------------------------
  // Per-class base frequency families. Pitch jitter per-instance keeps
  // multiple ships of the same class disambiguable (CLAUDE.md "pitch
  // families").
  const CLASS_DEFS = {
    scout:      {base: 880, drift: 0.12, droneType: 'square',   droneGain: 0.04, label: 'scout'},
    bomber:     {base: 165, drift: 0.06, droneType: 'sine',     droneGain: 0.10, label: 'bomber'},
    battleship: {base:  82, drift: 0.04, droneType: 'sawtooth', droneGain: 0.08, label: 'battleship'},
    civilian:   {base: 330, drift: 0.04, droneType: 'triangle', droneGain: 0.05, label: 'civilian'},
  }

  function makeEnemyBin(enemy) {
    ensureStarted()
    const c = ctx()
    const def = CLASS_DEFS[enemy.kind] || CLASS_DEFS.scout
    const jitter = (Math.random() - 0.5) * def.drift
    const baseHz = def.base * Math.pow(2, jitter)

    const output = c.createGain()
    output.gain.value = 0.0001
    const lowpass = c.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 800
    output.connect(lowpass)

    const pan = c.createStereoPanner()
    pan.pan.value = enemy.x
    lowpass.connect(pan)
    pan.connect(_state.droneBus)

    // Continuous drone identifying the class
    const drone = c.createOscillator()
    drone.type = def.droneType
    drone.frequency.value = baseHz
    const droneGain = c.createGain()
    droneGain.gain.value = def.droneGain
    drone.connect(droneGain).connect(output)

    // Civilians get a bright major-third dyad on top — that's their
    // unmistakable harmonic signature.
    let dyad = null, dyadGain = null
    if (enemy.kind === 'civilian') {
      dyad = c.createOscillator()
      dyad.type = 'triangle'
      dyad.frequency.value = baseHz * Math.pow(2, 4 / 12)  // major third
      dyadGain = c.createGain()
      dyadGain.gain.value = def.droneGain * 0.85
      dyad.connect(dyadGain).connect(output)
    }
    // Bombers also get a low rumble sub-osc for their "low rumble + bell" tell
    let sub = null, subGain = null
    if (enemy.kind === 'bomber') {
      sub = c.createOscillator()
      sub.type = 'sine'
      sub.frequency.value = baseHz / 2
      subGain = c.createGain()
      subGain.gain.value = 0.05
      sub.connect(subGain).connect(output)
    }
    // Battleships add a detuned saw partial for the heavy drone
    let det = null, detGain = null
    if (enemy.kind === 'battleship') {
      det = c.createOscillator()
      det.type = 'sawtooth'
      det.frequency.value = baseHz * 1.012
      detGain = c.createGain()
      detGain.gain.value = 0.05
      det.connect(detGain).connect(output)
    }

    drone.start()
    if (dyad) dyad.start()
    if (sub) sub.start()
    if (det) det.start()

    const bin = {
      kind: enemy.kind,
      baseHz,
      pan, output, lowpass,
      drone, droneGain, dyad, dyadGain, sub, subGain, det, detGain,
    }
    _state.enemyBins.set(enemy.id, bin)
    return bin
  }

  function destroyEnemyBin(id) {
    const bin = _state.enemyBins.get(id)
    if (!bin) return
    const t = now()
    try {
      bin.output.gain.cancelScheduledValues(t)
      // Smooth ~600ms fade-out (time constant 0.12) — kill stinger covers
      // it during gameplay; tutorial hears it as a graceful tail.
      bin.output.gain.setTargetAtTime(0.0001, t, 0.12)
    } catch (e) {}
    setTimeout(() => {
      try { bin.drone.stop() } catch (e) {}
      try { bin.dyad && bin.dyad.stop() } catch (e) {}
      try { bin.sub && bin.sub.stop() } catch (e) {}
      try { bin.det && bin.det.stop() } catch (e) {}
      try { bin.output.disconnect() } catch (e) {}
      try { bin.lowpass.disconnect() } catch (e) {}
      try { bin.pan.disconnect() } catch (e) {}
    }, 700)
    _state.enemyBins.delete(id)
  }

  // ----------------------------- urgency tick -----------------------------
  // A short ADSR'd square at the ship's pitch, panned at its current x.
  // For tagged ships we substitute the chain note so chain-tagged ships
  // are audible by ear via their pitch.
  // Close Encounters of the Third Kind — the classic 5-note phrase, full
  // stop. The film is in B♭ major; we keep clean intervals in C here:
  //   1: D5 (re)        587.33 Hz
  //   2: E5 (mi)        659.25 Hz
  //   3: C5 (do)        523.25 Hz
  //   4: C4 (do, low)   261.63 Hz
  //   5: G4 (sol)       392.00 Hz
  const CHAIN_NOTES = [null, 587.33, 659.25, 523.25, 261.63, 392.00]

  function onUrgencyTick(ev) {
    const {x, kind, chainIndex, z} = ev
    const c = ctx()
    const t0 = now()
    const def = CLASS_DEFS[kind] || CLASS_DEFS.scout
    let freq = def.base * (1 + (1 - z) * 0.6)
    // Tagged ships use the chain note instead so their identity is audible
    if (chainIndex && CHAIN_NOTES[chainIndex]) freq = CHAIN_NOTES[chainIndex]
    const o = c.createOscillator()
    o.type = kind === 'civilian' ? 'triangle' : (kind === 'battleship' ? 'sawtooth' : 'square')
    o.frequency.value = freq
    const g = c.createGain()
    g.gain.value = 0
    o.connect(g)
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-1, Math.min(1, x))
    g.connect(pan).connect(_state.sfxBus)
    const peak = 0.18 + (1 - z) * 0.12
    adsr(g.gain, t0, 0.005, 0.020, 0.060, peak)
    o.start(t0)
    o.stop(t0 + 0.12)
    setTimeout(() => {
      try { o.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
    }, 200)
  }

  // ----------------------------- frame ticking -----------------------------
  // Called by content.game.tick(); updates each ship's pan, output gain
  // and lowpass cutoff from its z, drains the audio queue.
  function frame() {
    if (!_state.started) return
    const t = now()
    for (const [id, bin] of _state.enemyBins) {
      const e = _findEnemyById(id)
      if (!e) continue
      // pan tracks live x
      try { bin.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, e.x)), t, 0.04) } catch (err) {}
      // gain rises as z → 0 (with a soft floor so distant ships are barely audible)
      const closeness = 1 - Math.max(0, Math.min(1, e.z))
      const gain = 0.05 + closeness * 0.85
      try { bin.output.gain.setTargetAtTime(gain, t, 0.05) } catch (err) {}
      // lowpass cutoff opens with closeness
      const cutoff = 350 + closeness * 6500
      try { bin.lowpass.frequency.setTargetAtTime(cutoff, t, 0.05) } catch (err) {}
    }
    // Aim crosshair tone — pans live at the player's aim
    if (_state.aimVoice) {
      const s = content.state.get()
      const aim = s ? s.aim : 0
      try { _state.aimVoice.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, aim)), t, 0.02) } catch (err) {}
    }
    drain()
  }

  // ----------------------------- aim crosshair tone -----------------------------
  // A continuous quiet sine at 130 Hz panned at the current aim. Sits below
  // the class-voice frequency range (scout square @ 880 Hz, civilian dyad
  // @ 330 Hz, battleship saw @ 82 Hz) so it doesn't mask. Started by the
  // game module on startRun, stopped on endRun / silenceAll.
  function startAimVoice() {
    if (_state.aimVoice) return
    ensureStarted()
    const c = ctx()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 130
    const g = c.createGain()
    g.gain.value = 0.0001
    const pan = c.createStereoPanner()
    pan.pan.value = 0
    o.connect(g).connect(pan).connect(_state.masterBus)
    o.start()
    g.gain.setTargetAtTime(0.06, now(), 0.20)
    _state.aimVoice = {osc: o, gain: g, pan}
  }
  // Park or sweep the aim crosshair tone to a specific pan, bypassing the
  // state-driven update in frame(). Used by the help-screen tutorial to
  // demonstrate panning without a running game session.
  function setAimVoicePan(x, rampSec) {
    if (!_state.aimVoice) return
    const t0 = now()
    const v = Math.max(-1, Math.min(1, x))
    const dur = rampSec || 0
    try {
      const p = _state.aimVoice.pan.pan
      const cur = p.value
      p.cancelScheduledValues(t0)
      p.setValueAtTime(cur, t0)
      if (dur > 0) p.linearRampToValueAtTime(v, t0 + dur)
      else p.setValueAtTime(v, t0)
    } catch (e) {}
  }
  function stopAimVoice() {
    if (!_state.aimVoice) return
    const v = _state.aimVoice
    _state.aimVoice = null
    try { v.gain.gain.setTargetAtTime(0.0001, now(), 0.10) } catch (e) {}
    setTimeout(() => {
      try { v.osc.stop() } catch (e) {}
      try { v.osc.disconnect() } catch (e) {}
      try { v.gain.disconnect() } catch (e) {}
      try { v.pan.disconnect() } catch (e) {}
    }, 250)
  }

  // ----------------------------- target-lock beep -----------------------------
  // Fast continuous beep that fires while the player's aim is on a target —
  // i.e. firing now would connect. Critical for blind play: without this the
  // crosshair tone alone doesn't tell you when you've crossed onto an enemy.
  // Pans live at the target's position so the lock cue carries its own
  // localisation. The beep mirrors the locked ship's urgency-tick voice
  // (same waveform + frequency family, including chain note for tagged
  // ships), but fires at ~30 Hz — far above any ship's own pulse rate
  // (scout near = 6.5 Hz). The result: the lock sounds like *that* ship
  // buzzed up into a fast trill, so the player can identify what they're
  // locked onto without confusing it for the ship itself.
  function setTargetLock(on, info) {
    if (on) {
      const data = info || {}
      const px = data.x != null ? Math.max(-1, Math.min(1, data.x)) : 0
      const kind = data.kind || 'scout'
      const chainIndex = data.chainIndex || 0
      const z = data.z != null ? data.z : 0.4
      if (_state.targetLock) {
        _state.targetLock.panX = px
        _state.targetLock.kind = kind
        _state.targetLock.chainIndex = chainIndex
        _state.targetLock.z = z
        return
      }
      ensureStarted()
      const c = ctx()
      // Wrap the trill in a gain bus that ramps in (~120ms) and out (~150ms)
      // so the lock onset/offset doesn't pop. Each beep routes through this
      // bus instead of straight to sfxBus.
      const trillBus = c.createGain()
      trillBus.gain.value = 0.0001
      trillBus.connect(_state.sfxBus)
      trillBus.gain.setTargetAtTime(1.0, now(), 0.04)
      _state.targetLock = {timer: null, panX: px, kind, chainIndex, z, trillBus}
      const beep = () => {
        if (!_state.targetLock) return
        const t0 = now()
        const lk = _state.targetLock
        const def = CLASS_DEFS[lk.kind] || CLASS_DEFS.scout
        let freq = def.base * (1 + (1 - lk.z) * 0.6)
        if (lk.chainIndex && CHAIN_NOTES[lk.chainIndex]) freq = CHAIN_NOTES[lk.chainIndex]
        const o = c.createOscillator()
        o.type = lk.kind === 'civilian' ? 'triangle' : (lk.kind === 'battleship' ? 'sawtooth' : 'square')
        o.frequency.value = freq
        const g = c.createGain()
        g.gain.value = 0
        const pan = c.createStereoPanner()
        pan.pan.value = lk.panX
        o.connect(g).connect(pan).connect(lk.trillBus)
        adsr(g.gain, t0, 0.001, 0.008, 0.020, 0.32)
        o.start(t0)
        o.stop(t0 + 0.05)
        setTimeout(() => {
          try { o.disconnect() } catch (e) {}
          try { g.disconnect() } catch (e) {}
          try { pan.disconnect() } catch (e) {}
        }, 150)
      }
      beep()  // fire onset beep immediately so the lock is audible the frame it engages
      _state.targetLock.timer = setInterval(beep, 33)
    } else {
      if (!_state.targetLock) return
      const tl = _state.targetLock
      _state.targetLock = null
      try { clearInterval(tl.timer) } catch (e) {}
      if (tl.trillBus) {
        try { tl.trillBus.gain.cancelScheduledValues(now()) } catch (e) {}
        try { tl.trillBus.gain.setTargetAtTime(0.0001, now(), 0.05) } catch (e) {}
        setTimeout(() => { try { tl.trillBus.disconnect() } catch (e) {} }, 600)
      }
    }
  }

  function _findEnemyById(id) {
    const s = content.state.get()
    if (!s) return null
    for (const e of s.enemies) if (e.id === id) return e
    return null
  }

  // ----------------------------- silenceAll -----------------------------
  function silenceAll() {
    if (!_state.started) return
    for (const id of Array.from(_state.enemyBins.keys())) destroyEnemyBin(id)
    if (_state.lowEnergy) {
      try { _state.lowEnergy.osc.stop() } catch (e) {}
      try { _state.lowEnergy.osc.disconnect() } catch (e) {}
      try { _state.lowEnergy.gain.disconnect() } catch (e) {}
      _state.lowEnergy = null
    }
    stopAimVoice()
    setTargetLock(false)
    _state.queue = []
  }

  // ----------------------------- event handlers -----------------------------
  function onSpawn(ev) {
    const enemy = ev.enemy
    if (!enemy) return
    if (_state.enemyBins.has(enemy.id)) return
    makeEnemyBin(enemy)
  }

  function onKill(ev) {
    // Brief explosion sting + remove the ship's voice.
    const c = ctx()
    const t0 = now()
    const noiseBuf = c.createBuffer(1, c.sampleRate * 0.35, c.sampleRate)
    const ch = noiseBuf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.5)
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const g = c.createGain()
    g.gain.value = 0
    src.connect(lp).connect(g)
    const pan = c.createStereoPanner()
    pan.pan.value = ev.x || 0
    g.connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.005, 0.060, 0.250, 0.55)
    src.start(t0)
    setTimeout(() => {
      try { src.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
    }, 500)
    if (ev.id != null) destroyEnemyBin(ev.id)
  }

  function onBreach(ev) {
    // The ship reached the player. Loud impact + rumble at centre.
    const c = ctx()
    const t0 = now()
    const noiseBuf = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate)
    const ch = noiseBuf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.0)
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1200
    const g = c.createGain()
    g.gain.value = 0
    src.connect(lp).connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.005, 0.10, 0.5, 0.85)
    src.start(t0)
    // Plus a bell impact
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = 90
    const og = c.createGain()
    og.gain.value = 0
    o.connect(og).connect(_state.sfxBus)
    adsr(og.gain, t0, 0.002, 0.04, 0.4, 0.6)
    o.start(t0)
    o.stop(t0 + 0.5)
    setTimeout(() => {
      try { src.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { o.disconnect() } catch (e) {}
      try { og.disconnect() } catch (e) {}
    }, 800)
    if (ev.id != null) destroyEnemyBin(ev.id)
  }

  function onShieldHit(ev) {
    // The ship reached the player but shields absorbed it. Distinct from
    // the breach SFX: a metallic ring (high triangle + brief noise)
    // signals "impact, shield held."
    const c = ctx()
    const t0 = now()
    const pan = c.createStereoPanner()
    pan.pan.value = ev.x || 0
    pan.connect(_state.sfxBus)
    // Ring tone — descending triangle pair
    const o1 = c.createOscillator()
    o1.type = 'triangle'
    o1.frequency.setValueAtTime(1320, t0)
    o1.frequency.exponentialRampToValueAtTime(880, t0 + 0.32)
    const o2 = c.createOscillator()
    o2.type = 'triangle'
    o2.frequency.setValueAtTime(1980, t0)
    o2.frequency.exponentialRampToValueAtTime(1320, t0 + 0.32)
    const g = c.createGain()
    g.gain.value = 0
    o1.connect(g); o2.connect(g)
    g.connect(pan)
    adsr(g.gain, t0, 0.005, 0.030, 0.36, 0.45)
    o1.start(t0); o2.start(t0)
    o1.stop(t0 + 0.45); o2.stop(t0 + 0.45)
    // Brief noise transient under it (the "thump" of contact)
    const noiseBuf = c.createBuffer(1, c.sampleRate * 0.10, c.sampleRate)
    const ch = noiseBuf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.5)
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 800
    const ng = c.createGain()
    ng.gain.value = 0
    src.connect(lp).connect(ng).connect(pan)
    adsr(ng.gain, t0, 0.002, 0.020, 0.080, 0.30)
    src.start(t0)
    setTimeout(() => {
      try { o1.disconnect() } catch (e) {}
      try { o2.disconnect() } catch (e) {}
      try { g.disconnect() } catch (e) {}
      try { src.disconnect() } catch (e) {}
      try { lp.disconnect() } catch (e) {}
      try { ng.disconnect() } catch (e) {}
      try { pan.disconnect() } catch (e) {}
    }, 600)
    if (ev.id != null) destroyEnemyBin(ev.id)
  }

  function onFire(ev) {
    // Three sonically distinct weapons: pulse = laser pew (fast sine sweep),
    // beam = sustained ring tone (FM-modulated triangle), missile = noise
    // whoosh. Pulse must NOT be a square — Scout's drone is a square at
    // 880 Hz, and a square pulse at the same register is indistinguishable
    // mid-fight.
    const c = ctx()
    const t0 = now()
    const weapon = ev.weapon || 'pulse'
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-1, Math.min(1, ev.aim || 0))
    pan.connect(_state.sfxBus)
    if (weapon === 'pulse') {
      // Laser "pew" — sine sweeps 4500 → 600 Hz in ~70ms with a quieter
      // saw fifth on top for a touch of buzz. Snappy, smooth, unmistakable.
      const o = c.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(4500, t0)
      o.frequency.exponentialRampToValueAtTime(600, t0 + 0.070)
      const o2 = c.createOscillator()
      o2.type = 'sawtooth'
      o2.frequency.setValueAtTime(4500 * 1.5, t0)
      o2.frequency.exponentialRampToValueAtTime(600 * 1.5, t0 + 0.070)
      const g = c.createGain();  g.gain.value = 0
      const g2 = c.createGain(); g2.gain.value = 0
      o.connect(g).connect(pan)
      o2.connect(g2).connect(pan)
      adsr(g.gain,  t0, 0.001, 0.005, 0.075, 0.45)
      adsr(g2.gain, t0, 0.001, 0.003, 0.055, 0.16)
      o.start(t0);  o.stop(t0 + 0.10)
      o2.start(t0); o2.stop(t0 + 0.10)
      setTimeout(() => {
        try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){}
        try{o2.disconnect()}catch(e){} try{g2.disconnect()}catch(e){}
        try{pan.disconnect()}catch(e){}
      }, 200)
    } else if (weapon === 'beam') {
      // Phaser-beam — a sustained ringing triangle at fixed pitch with
      // ±28 Hz FM modulation at 14 Hz for that "ring." Longer than pulse
      // (~280ms) so the player hears a held tone, not a snap.
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 1100
      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 14
      const lfoGain = c.createGain()
      lfoGain.gain.value = 28
      lfo.connect(lfoGain).connect(o.frequency)
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(pan)
      adsr(g.gain, t0, 0.020, 0.180, 0.080, 0.38)
      o.start(t0);  o.stop(t0 + 0.32)
      lfo.start(t0); lfo.stop(t0 + 0.32)
      setTimeout(() => {
        try{o.disconnect()}catch(e){} try{lfo.disconnect()}catch(e){}
        try{lfoGain.disconnect()}catch(e){} try{g.disconnect()}catch(e){}
        try{pan.disconnect()}catch(e){}
      }, 450)
    } else if (weapon === 'missile') {
      // Whoosh — bandpass-filtered noise burst with a descending centre.
      const noiseBuf = c.createBuffer(1, c.sampleRate * 0.30, c.sampleRate)
      const ch = noiseBuf.getChannelData(0)
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.5)
      const src = c.createBufferSource()
      src.buffer = noiseBuf
      const lp = c.createBiquadFilter()
      lp.type = 'bandpass'
      lp.frequency.setValueAtTime(2000, t0)
      lp.frequency.exponentialRampToValueAtTime(400, t0 + 0.30)
      lp.Q.value = 6
      const g = c.createGain()
      g.gain.value = 0
      src.connect(lp).connect(g).connect(pan)
      adsr(g.gain, t0, 0.010, 0.060, 0.220, 0.50)
      src.start(t0)
      setTimeout(() => { try{src.disconnect()}catch(e){} try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){} try{pan.disconnect()}catch(e){} }, 400)
    }
  }

  function onHit(ev) {
    // Confirmation sting — high bell that signals "you connected."
    const c = ctx()
    const t0 = now()
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(2200, t0)
    o.frequency.exponentialRampToValueAtTime(1400, t0 + 0.08)
    const g = c.createGain()
    g.gain.value = 0
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-1, Math.min(1, ev.aim || 0))
    o.connect(g).connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.003, 0.030, 0.140, 0.45)
    o.start(t0); o.stop(t0 + 0.20)
    setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} try{pan.disconnect()}catch(e){} }, 300)
  }

  function onMiss(ev) {
    // Soft "fft" — quick noise blip at the aim position.
    const c = ctx()
    const t0 = now()
    const noiseBuf = c.createBuffer(1, c.sampleRate * 0.10, c.sampleRate)
    const ch = noiseBuf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * 0.6
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const lp = c.createBiquadFilter()
    lp.type = 'highpass'
    lp.frequency.value = 1500
    const g = c.createGain()
    g.gain.value = 0
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-1, Math.min(1, ev.aim || 0))
    src.connect(lp).connect(g).connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.002, 0.010, 0.060, 0.18)
    src.start(t0)
    setTimeout(() => { try{src.disconnect()}catch(e){} try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){} try{pan.disconnect()}catch(e){} }, 200)
  }

  function onBounce(ev) {
    // Distinctive "thud" — low square + lowpass.
    const c = ctx()
    const t0 = now()
    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.value = 110
    const g = c.createGain()
    g.gain.value = 0
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-1, Math.min(1, ev.aim || 0))
    o.connect(g).connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.005, 0.060, 0.220, 0.45)
    o.start(t0); o.stop(t0 + 0.30)
    setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} try{pan.disconnect()}catch(e){} }, 400)
  }

  function onCivilianHit(ev) {
    // Brief dissonant minor-second cluster + a low impact. Distinct from
    // every other sting so the "wrong target" feedback is unmistakable.
    const c = ctx()
    const t0 = now()
    const f1 = c.createOscillator(); f1.type = 'triangle'; f1.frequency.value = 660
    const f2 = c.createOscillator(); f2.type = 'triangle'; f2.frequency.value = 660 * Math.pow(2, 1/12)
    const g = c.createGain(); g.gain.value = 0
    f1.connect(g); f2.connect(g)
    g.connect(_state.sfxBus)
    adsr(g.gain, t0, 0.008, 0.10, 0.45, 0.5)
    f1.start(t0); f2.start(t0)
    f1.stop(t0 + 0.6); f2.stop(t0 + 0.6)
    setTimeout(() => { try{f1.disconnect()}catch(e){} try{f2.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 800)
    if (ev.id != null) destroyEnemyBin(ev.id)
  }

  function onWeaponSwitch(ev) {
    // Quick UI tone identifying which weapon is now active.
    const c = ctx()
    const t0 = now()
    const o = c.createOscillator()
    o.type = 'triangle'
    const f = ev.weapon === 'pulse' ? 880
            : ev.weapon === 'beam'  ? 1318
            : 587   // missile (D5)
    o.frequency.value = f
    const g = c.createGain()
    g.gain.value = 0
    o.connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.003, 0.040, 0.080, 0.30)
    o.start(t0); o.stop(t0 + 0.18)
    setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 250)
  }

  function onShieldRefill(ev) {
    // A short ascending click pair.
    const c = ctx()
    const t0 = now()
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator()
      o.type = 'square'
      o.frequency.value = i === 0 ? 1100 : 1650
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0 + i * 0.06, 0.002, 0.008, 0.040, 0.30)
      o.start(t0 + i * 0.06); o.stop(t0 + i * 0.06 + 0.08)
      setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 250 + i * 80)
    }
  }

  function onExtraLife(ev) {
    // A bright triplet — A C E ascending.
    const c = ctx()
    const t0 = now()
    const notes = [440, 554.37, 659.25]
    notes.forEach((f, i) => {
      const o = c.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      const g = c.createGain()
      g.gain.value = 0
      o.connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0 + i * 0.10, 0.005, 0.040, 0.10, 0.32)
      o.start(t0 + i * 0.10); o.stop(t0 + i * 0.10 + 0.18)
      setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 600)
    })
  }

  function onWaveStart(ev) {
    const c = ctx()
    const t0 = now()
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(120, t0)
    o.frequency.exponentialRampToValueAtTime(440, t0 + 0.45)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const g = c.createGain()
    g.gain.value = 0
    o.connect(lp).connect(g).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.030, 0.30, 0.30, 0.45)
    o.start(t0); o.stop(t0 + 0.70)
    setTimeout(() => { try{o.disconnect()}catch(e){} try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 800)
  }

  function onWaveClear(ev) {
    // Brassy fanfare for clean wave clear: ascending C-major arpeggio
    // played by detuned saw pair, then a sustained C-major triad with an
    // octave on top to stick the landing.
    const c = ctx()
    const t0 = now()
    const arp = [523.25, 659.25, 783.99, 1046.50]
    arp.forEach((f, i) => {
      const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = f
      const o2 = c.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f * 1.005
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4500
      const g = c.createGain(); g.gain.value = 0
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(_state.sfxBus)
      const t = t0 + i * 0.085
      adsr(g.gain, t, 0.005, 0.05, 0.14, 0.32)
      o1.start(t); o1.stop(t + 0.22)
      o2.start(t); o2.stop(t + 0.22)
      setTimeout(() => {
        try{o1.disconnect()}catch(e){} try{o2.disconnect()}catch(e){}
        try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){}
      }, 700)
    })
    const chordT = t0 + 0.46
    const chord = [523.25, 659.25, 783.99, 1046.50]
    chord.forEach((f) => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f
      const g = c.createGain(); g.gain.value = 0
      o.connect(g).connect(_state.sfxBus)
      adsr(g.gain, chordT, 0.01, 0.32, 0.50, 0.20)
      o.start(chordT); o.stop(chordT + 0.90)
      setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 1500)
    })
  }

  function onWaveSurvived(ev) {
    // Subdued "you got through it, but barely" sting. Two-note minor
    // descent (Bb4 → F4) on soft triangle, with a low F3 sine underline.
    // Distinct from waveClear: no triumph, no rising arpeggio.
    const c = ctx()
    const t0 = now()
    const notes = [
      {f: 466.16, t: 0.00, dur: 0.28, peak: 0.28},   // Bb4
      {f: 349.23, t: 0.20, dur: 0.45, peak: 0.32},   // F4
    ]
    notes.forEach(n => {
      const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = n.f
      const g = c.createGain(); g.gain.value = 0
      o.connect(g).connect(_state.sfxBus)
      adsr(g.gain, t0 + n.t, 0.015, 0.10, n.dur - 0.10, n.peak)
      o.start(t0 + n.t); o.stop(t0 + n.t + n.dur + 0.05)
      setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} }, 900)
    })
    const sub = c.createOscillator(); sub.type = 'sine'; sub.frequency.value = 174.61   // F3
    const subG = c.createGain(); subG.gain.value = 0
    sub.connect(subG).connect(_state.sfxBus)
    adsr(subG.gain, t0 + 0.05, 0.05, 0.30, 0.45, 0.18)
    sub.start(t0 + 0.05); sub.stop(t0 + 0.90)
    setTimeout(() => { try{sub.disconnect()}catch(e){} try{subG.disconnect()}catch(e){} }, 1200)
  }

  function onGameOver(ev) {
    // Slow descending Bb-minor figure (D4 → Bb3 → F3), each note
    // overlapping with long releases. Triangle voiced with a sub-octave
    // sine for warmth + weight, lowpass filtered for a fade-to-black
    // feel. A short low-noise rumble underlines the "punch" of the loss.
    const c = ctx()
    const t0 = now()
    const notes = [
      {f: 293.66, t: 0.00, dur: 0.85, peak: 0.32},   // D4
      {f: 233.08, t: 0.55, dur: 0.95, peak: 0.34},   // Bb3
      {f: 174.61, t: 1.15, dur: 1.50, peak: 0.36},   // F3
    ]
    notes.forEach(n => {
      const o1 = c.createOscillator(); o1.type = 'triangle'; o1.frequency.value = n.f
      const o2 = c.createOscillator(); o2.type = 'sine';     o2.frequency.value = n.f / 2
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600
      const g = c.createGain(); g.gain.value = 0
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(_state.sfxBus)
      const tStart = t0 + n.t
      adsr(g.gain, tStart, 0.05, n.dur * 0.35, n.dur * 0.65, n.peak)
      o1.start(tStart); o1.stop(tStart + n.dur + 0.10)
      o2.start(tStart); o2.stop(tStart + n.dur + 0.10)
      setTimeout(() => {
        try{o1.disconnect()}catch(e){} try{o2.disconnect()}catch(e){}
        try{lp.disconnect()}catch(e){} try{g.disconnect()}catch(e){}
      }, (n.t + n.dur + 0.4) * 1000)
    })
    const noiseBuf = c.createBuffer(1, c.sampleRate * 0.9, c.sampleRate)
    const ch = noiseBuf.getChannelData(0)
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 1.4)
    const src = c.createBufferSource()
    src.buffer = noiseBuf
    const lpN = c.createBiquadFilter(); lpN.type = 'lowpass'; lpN.frequency.value = 220
    const gN = c.createGain(); gN.gain.value = 0
    src.connect(lpN).connect(gN).connect(_state.sfxBus)
    adsr(gN.gain, t0, 0.01, 0.15, 0.70, 0.55)
    src.start(t0)
    setTimeout(() => { try{src.disconnect()}catch(e){} try{lpN.disconnect()}catch(e){} try{gN.disconnect()}catch(e){} }, 1200)
  }

  // ----------------------------- low-energy siren -----------------------------
  // Emergency-siren style sweep that turns on when energy < 30% and off
  // when refilled. Saw oscillator centred at 600 Hz with a 1.6 Hz LFO
  // sweeping ±220 Hz, lowpass-filtered to keep the harmonics from biting.
  // Attached directly to the master bus.
  function setLowEnergy(on) {
    if (on) {
      if (_state.lowEnergy) return
      ensureStarted()
      const c = ctx()
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = 600
      // LFO modulates the carrier frequency to produce the siren sweep.
      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 1.6     // ~1.6 Hz wail
      const lfoGain = c.createGain()
      lfoGain.gain.value = 220       // ±220 Hz sweep around the centre
      lfo.connect(lfoGain).connect(o.frequency)
      const g = c.createGain()
      g.gain.value = 0.0001
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 1500
      o.connect(lp).connect(g).connect(_state.masterBus)
      o.start()
      lfo.start()
      g.gain.setTargetAtTime(0.16, now(), 0.15)
      _state.lowEnergy = {osc: o, lfo, lfoGain, gain: g, lp}
    } else {
      if (!_state.lowEnergy) return
      const le = _state.lowEnergy
      _state.lowEnergy = null
      try { le.gain.gain.setTargetAtTime(0.0001, now(), 0.10) } catch (e) {}
      setTimeout(() => {
        try { le.osc.stop() } catch (e) {}
        try { le.lfo.stop() } catch (e) {}
        try { le.osc.disconnect() } catch (e) {}
        try { le.lfo.disconnect() } catch (e) {}
        try { le.lfoGain.disconnect() } catch (e) {}
        try { le.gain.disconnect() } catch (e) {}
        try { le.lp.disconnect() } catch (e) {}
      }, 300)
    }
  }

  // ----------------------------- diagnostic / learn helpers -----------------------------
  function emitTickAt(panX, freq) {
    ensureStarted()
    const c = ctx()
    const t0 = now()
    const o = c.createOscillator()
    o.type = 'square'
    o.frequency.value = freq || 1500
    const g = c.createGain()
    g.gain.value = 0
    const pan = c.createStereoPanner()
    pan.pan.value = Math.max(-1, Math.min(1, panX))
    o.connect(g).connect(pan).connect(_state.sfxBus)
    adsr(g.gain, t0, 0.003, 0.040, 0.080, 0.50)
    o.start(t0); o.stop(t0 + 0.18)
    setTimeout(() => { try{o.disconnect()}catch(e){} try{g.disconnect()}catch(e){} try{pan.disconnect()}catch(e){} }, 250)
  }

  // Spawn a non-tracking "preview" enemy bin we control directly. Returns
  // a stop fn that destroys it.
  function previewClassDrone(kind, lateral) {
    ensureStarted()
    const fakeId = -1 - Math.floor(Math.random() * 1e6)
    const fakeEnemy = {id: fakeId, kind, x: lateral || 0, z: 0.4, dxPerSec: 0, hp: 1, chainIndex: 0, pulsePhase: 0}
    const bin = makeEnemyBin(fakeEnemy)
    // Manually pin gain/lowpass (we won't be in the frame loop). Slower
    // time-constant on gain (~500ms) so the drone fades in gracefully —
    // matches the destroyEnemyBin fade-out for symmetric tutorial flow.
    const t = now()
    try {
      bin.output.gain.setTargetAtTime(0.6, t, 0.10)
      bin.lowpass.frequency.setTargetAtTime(4500, t, 0.05)
    } catch (e) {}
    // Also fire a couple of urgency ticks so the player hears the pulse cue
    onUrgencyTick({x: lateral || 0, kind, chainIndex: 0, z: 0.5})
    setTimeout(() => onUrgencyTick({x: lateral || 0, kind, chainIndex: 0, z: 0.4}), 350)
    setTimeout(() => onUrgencyTick({x: lateral || 0, kind, chainIndex: 0, z: 0.3}), 700)
    return () => destroyEnemyBin(fakeId)
  }

  function previewWeapon(weapon) {
    onFire({weapon, aim: 0})
    return () => {}
  }

  function previewHit() { onHit({aim: 0}); return () => {} }
  function previewMiss() { onMiss({aim: 0}); return () => {} }
  function previewBounce() { onBounce({aim: 0}); return () => {} }
  function previewLowEnergy() {
    setLowEnergy(true)
    setTimeout(() => setLowEnergy(false), 1800)
    return () => setLowEnergy(false)
  }
  function previewShieldRefill() { onShieldRefill({}); return () => {} }
  function previewShieldHit() { onShieldHit({x: 0}); return () => {} }
  function previewBreach() { onBreach({x: 0}); return () => {} }
  function previewKill() { onKill({x: 0}); return () => {} }
  function previewExtraLife() { onExtraLife({}); return () => {} }
  function previewWaveStart() { onWaveStart({}); return () => {} }
  function previewWaveClear() { onWaveClear({}); return () => {} }
  function previewWaveSurvived() { onWaveSurvived({}); return () => {} }
  function previewGameOver() { onGameOver({}); return () => {} }
  function previewAimTone() {
    startAimVoice()
    // Pan it left → centre → right so the player can hear how the locator
    // tracks. We can't hijack content.state.aim during a preview, so we
    // override the pan directly.
    if (_state.aimVoice) {
      const t0 = now()
      _state.aimVoice.pan.pan.cancelScheduledValues(t0)
      _state.aimVoice.pan.pan.setValueAtTime(-1, t0)
      _state.aimVoice.pan.pan.linearRampToValueAtTime(1, t0 + 2.0)
    }
    setTimeout(() => stopAimVoice(), 2400)
    return () => stopAimVoice()
  }
  function previewTargetLock() {
    setTargetLock(true, {x: 0, kind: 'scout', chainIndex: 0, z: 0.4})
    const stop = () => setTargetLock(false)
    setTimeout(stop, 1800)
    return stop
  }
  function previewChainTag(idx) {
    onUrgencyTick({x: 0, kind: 'scout', chainIndex: idx, z: 0.5})
    setTimeout(() => onUrgencyTick({x: 0, kind: 'scout', chainIndex: idx, z: 0.5}), 280)
    return () => {}
  }
  function previewUrgency() {
    // simulate a close ship — fast pulses
    let n = 0
    const id = setInterval(() => {
      onUrgencyTick({x: 0, kind: 'bomber', chainIndex: 0, z: 0.05})
      if (++n > 6) clearInterval(id)
    }, 160)
    return () => clearInterval(id)
  }

  // ----------------------------- public API -----------------------------
  return {
    // bus
    start: ensureStarted,
    silenceAll,
    frame,
    // event queue
    enqueue,
    drain,
    // direct dispatch (for screen one-shots that bypass the queue)
    dispatch,
    // continuous toggles
    setLowEnergy,
    startAimVoice,
    stopAimVoice,
    setAimVoicePan,
    setTargetLock,
    // diagnostics
    emitTickAt,
    // learn
    previewClassDrone,
    previewWeapon,
    previewHit,
    previewMiss,
    previewBounce,
    previewLowEnergy,
    previewShieldRefill,
    previewShieldHit,
    previewBreach,
    previewKill,
    previewExtraLife,
    previewWaveStart,
    previewWaveClear,
    previewWaveSurvived,
    previewGameOver,
    previewAimTone,
    previewTargetLock,
    previewChainTag,
    previewUrgency,
    // constants exposed for chain rendering
    CHAIN_NOTES,
    CLASS_DEFS,
    _state,
  }
})()
