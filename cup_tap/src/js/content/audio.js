/**
 * TAPPER! — stereo audio engine.
 *
 * Listener mode: STEREO / non-spatial. Every voice gets its own
 * StereoPannerNode. We never touch engine.position, never set a
 * binaural ear. Lane is encoded by pitch family (LANE_BASE_HZ from
 * content.levels); pan is computed from each entity's x within its
 * own lane length.
 *
 * Continuous voices (refreshed each frame from the snapshot):
 *   - Per-lane drone: sine + triangle at LANE_BASE_HZ[i], centred (no
 *     pan). Active lane is much louder, AND each lane has a distinctive
 *     LFO heartbeat rate (LANE_DRONE_LFO_HZ — fast on top lane, slow
 *     on bottom) so the active lane is identifiable by tempo as well
 *     as by pitch.
 *   - Per-customer footstep voice: amplitude pulses at walk rate,
 *     panned by customer x.
 *   - Per-mug slide voice: continuous, loud, panned by mug x. Pitch
 *     is FIXED at lane base × 1.0 (same family as the lane drone /
 *     customer footstep) — full vs empty is differentiated by timbre
 *     (sawtooth vs square) and filter character, not by pitch. Voices
 *     created on enter, destroyed on exit (id-keyed maps).
 *   - Player presence voice: square wave at lane_base × 2, panned by
 *     player.x. Pulses as fast footsteps when walking, slow heartbeat
 *     when idle. Always audible so the player can locate themselves.
 *   - Pour voice: rising tone while the player holds at the kegs.
 *   - Floor-show ditty: 2-second per-theme musical fragment.
 *
 * One-shot SFX go through enqueue(...) → drain() called from frame().
 *
 * Cross-module references use lazy getters per CLAUDE.md gotcha.
 */
content.audio = (() => {
  const _state = {
    started: false,
    masterBus: null,
    droneBus: null,
    sfxBus: null,
    musicBus: null,
    laneDrones: [],         // [{osc, lfo, lfoGain, gain}, ...] indexed by lane
    customerVoices: new Map(), // id → {osc, gain, pan, step, stepT}
    mugVoices: new Map(),      // id → {osc, gain, pan, lfo, kind}
    pourVoice: null,           // {osc, gain, started}
    playerVoice: null,         // {osc, lp, gain, pan, stepT, idleT, lastX, lastLane}
    prevPlayerLane: null,      // tracks lane between frames for swap glissando
    queue: [],
    levelKey: 'saloon',
    floorShowUntil: 0,
  }

  // Per-lane drone "heartbeat" rates (Hz). Different rate per lane so the
  // ear can identify the active lane by tempo as well as by pitch — fast
  // pulse = top lane, slow pulse = bottom lane.
  const LANE_DRONE_LFO_HZ = [3.4, 2.1, 1.3, 0.85]
  const LANE_DRONE_LFO_DEPTH = [0.06, 0.06, 0.06, 0.06]

  function ctx() { return engine.context() }
  function now() { return ctx().currentTime }

  function adsr(gainParam, t0, attack, hold, release, peak) {
    try {
      gainParam.cancelScheduledValues(t0)
      gainParam.setValueAtTime(0.0001, t0)
      gainParam.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + Math.max(0.001, attack))
      gainParam.setValueAtTime(peak, t0 + attack + hold)
      gainParam.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + Math.max(0.001, release))
      gainParam.setValueAtTime(0, t0 + attack + hold + release + 0.001)
    } catch (e) {}
  }

  function clampPan(x) { return Math.max(-1, Math.min(1, x)) }

  function panForX(x, laneLen) {
    return clampPan((x / Math.max(1, laneLen - 1)) * 2 - 1)
  }

  function laneBase(lane) {
    return content.levels.LANE_BASE_HZ[lane] || 440
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
    _state.droneBus.gain.value = 0.45
    _state.droneBus.connect(_state.masterBus)

    _state.sfxBus = c.createGain()
    _state.sfxBus.gain.value = 1
    _state.sfxBus.connect(_state.masterBus)

    _state.musicBus = c.createGain()
    _state.musicBus.gain.value = 0.6
    _state.musicBus.connect(_state.masterBus)
  }

  function ensureLaneDrones() {
    if (_state.laneDrones.length === 4) return
    const c = ctx()
    const t0 = now()
    for (let i = 0; i < 4; i++) {
      const base = laneBase(i)
      const osc = c.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = base / 2 // sub-octave for body
      const harm = c.createOscillator()
      harm.type = 'triangle'
      harm.frequency.value = base
      const harmGain = c.createGain()
      harmGain.gain.value = 0.18
      harm.connect(harmGain)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = base * 3
      lp.Q.value = 0.6
      const gain = c.createGain()
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.06, t0 + 0.3)
      // Per-lane heartbeat — distinctive rate so the player can identify
      // the active lane by pulse tempo, not just pitch. Lane 0 fast, 3 slow.
      const lfo = c.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = LANE_DRONE_LFO_HZ[i] || 1
      const lfoGain = c.createGain()
      lfoGain.gain.value = LANE_DRONE_LFO_DEPTH[i] || 0.04
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)

      osc.connect(lp)
      harmGain.connect(lp)
      lp.connect(gain)
      gain.connect(_state.droneBus)
      osc.start(t0)
      harm.start(t0)
      lfo.start(t0)
      _state.laneDrones.push({osc, harm, lfo, lfoGain, gain, lp, base})
    }
  }

  function destroyLaneDrones() {
    const t0 = now()
    for (const d of _state.laneDrones) {
      try {
        d.gain.gain.cancelScheduledValues(t0)
        d.gain.gain.setValueAtTime(d.gain.gain.value, t0)
        d.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2)
        d.osc.stop(t0 + 0.25)
        d.harm.stop(t0 + 0.25)
        d.lfo.stop(t0 + 0.25)
      } catch (e) {}
    }
    _state.laneDrones = []
  }

  // ----------------------------- mug voices ----------------------------
  // Continuous slide voice — loud, with LFO shimmer — panned by mug x.
  // Pitch is FIXED at lane base × 1.0 for the mug's whole life so the
  // mug audibly belongs to its lane (same family as the lane drone and
  // customer footstep). Full vs empty is differentiated by timbre
  // (sawtooth vs square) + filter character, NOT by pitch. Never ramp
  // frequency with proximity — that wrecks lane identification.
  function ensureMugVoice(mug, lane, laneLen) {
    let v = _state.mugVoices.get(mug.id)
    if (v) return v
    const c = ctx()
    const t0 = now()
    const base = laneBase(lane)
    const isFull = mug.kind === 'full'

    const osc = c.createOscillator()
    osc.type = isFull ? 'sawtooth' : 'square'
    osc.frequency.value = base
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = isFull ? base * 4 : base * 7
    lp.Q.value = isFull ? 1.4 : 4
    const lfo = c.createOscillator()
    lfo.type = isFull ? 'sine' : 'square'
    lfo.frequency.value = isFull ? 9 : 14
    const lfoGain = c.createGain()
    lfoGain.gain.value = isFull ? 0.04 : 0.06
    lfo.connect(lfoGain)
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(isFull ? 0.13 : 0.10, t0 + 0.05)
    lfoGain.connect(gain.gain)
    const pan = c.createStereoPanner()
    pan.pan.value = panForX(mug.x, laneLen)
    osc.connect(lp)
    lp.connect(gain)
    gain.connect(pan)
    pan.connect(_state.sfxBus)
    osc.start(t0)
    lfo.start(t0)
    v = {osc, lp, gain, pan, lfo, lfoGain, kind: mug.kind, lane}
    _state.mugVoices.set(mug.id, v)
    return v
  }

  function destroyMugVoice(id) {
    const v = _state.mugVoices.get(id)
    if (!v) return
    const t0 = now()
    try {
      v.gain.gain.cancelScheduledValues(t0)
      v.gain.gain.setValueAtTime(v.gain.gain.value, t0)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
      v.osc.stop(t0 + 0.08)
      v.lfo.stop(t0 + 0.08)
    } catch (e) {}
    _state.mugVoices.delete(id)
  }

  // ----------------------------- customer voices -----------------------
  function ensureCustomerVoice(c0, lane, laneLen) {
    let v = _state.customerVoices.get(c0.id)
    if (v) return v
    const c = ctx()
    const t0 = now()
    const base = laneBase(lane)

    const osc = c.createOscillator()
    osc.type = 'triangle'
    // Unison with the lane drone fundamental so the customer audibly
    // belongs to this lane. The previous × 0.66 ratio (a fifth below)
    // landed near the adjacent lane's base — lane 0 customers at ~436 Hz
    // sounded like lane 1, lane 2 customers at ~218 Hz sounded like
    // lane 3 — actively confusing the lane identification. The footstep
    // ADSR pulse keeps it from blending into the sustained drone.
    osc.frequency.value = base
    // Per-customer detune so multiple customers on the same lane don't
    // collapse into one rhythmic blob.
    osc.detune.value = (Math.random() - 0.5) * 30 // ±15 cents
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = base * 2.5
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t0)
    const pan = c.createStereoPanner()
    pan.pan.value = panForX(c0.x, laneLen)
    osc.connect(lp)
    lp.connect(gain)
    gain.connect(pan)
    pan.connect(_state.sfxBus)
    osc.start(t0)
    v = {osc, lp, gain, pan, lane, stepT: 0, lastFrame: t0}
    _state.customerVoices.set(c0.id, v)
    return v
  }

  function destroyCustomerVoice(id) {
    const v = _state.customerVoices.get(id)
    if (!v) return
    const t0 = now()
    try {
      v.gain.gain.cancelScheduledValues(t0)
      v.gain.gain.setValueAtTime(v.gain.gain.value, t0)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
      v.osc.stop(t0 + 0.1)
    } catch (e) {}
    _state.customerVoices.delete(id)
  }

  // ----------------------------- pour voice ----------------------------
  function startPourVoice(playerLane) {
    if (_state.pourVoice) return
    const c = ctx()
    const t0 = now()
    const base = laneBase(playerLane)
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(base * 0.5, t0)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(base * 1.5, t0)
    lp.Q.value = 2
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(0.10, t0 + 0.08)
    osc.connect(lp); lp.connect(gain); gain.connect(_state.sfxBus)
    osc.start(t0)
    _state.pourVoice = {osc, lp, gain, base, started: t0}
  }
  function stopPourVoice() {
    if (!_state.pourVoice) return
    const v = _state.pourVoice
    _state.pourVoice = null
    const t0 = now()
    try {
      v.gain.gain.cancelScheduledValues(t0)
      v.gain.gain.setValueAtTime(v.gain.gain.value, t0)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06)
      v.osc.stop(t0 + 0.08)
    } catch (e) {}
  }
  function updatePourVoice(charge, playerLane) {
    if (!_state.pourVoice) return
    const v = _state.pourVoice
    const base = laneBase(playerLane)
    const t = now()
    const f = base * (0.5 + charge * 1.0)
    try {
      v.osc.frequency.setTargetAtTime(f, t, 0.05)
      v.lp.frequency.setTargetAtTime(base * (1.5 + charge * 4), t, 0.05)
    } catch (e) {}
  }

  // ----------------------------- player voice --------------------------
  // The player has no other audio identity, so we emit a periodic "presence"
  // ping panned by player.x and pitched at lane_base * 2 (an octave above
  // the lane drone, distinct from customer/mug voices). When walking, the
  // ping fires at footstep cadence; when idle, it fires as a slow heartbeat
  // so the player always knows where they are.
  function ensurePlayerVoice() {
    if (_state.playerVoice) return
    const c = ctx()
    const t0 = now()
    const osc = c.createOscillator()
    osc.type = 'square'
    osc.frequency.value = laneBase(1) * 2
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 4000
    lp.Q.value = 3
    const gain = c.createGain()
    gain.gain.setValueAtTime(0, t0)
    const pan = c.createStereoPanner()
    pan.pan.value = 0
    osc.connect(lp); lp.connect(gain); gain.connect(pan); pan.connect(_state.sfxBus)
    osc.start(t0)
    _state.playerVoice = {osc, lp, gain, pan, stepT: 999, idleT: 0, lastX: null, lastLane: null}
  }
  function destroyPlayerVoice() {
    if (!_state.playerVoice) return
    const v = _state.playerVoice
    _state.playerVoice = null
    const t0 = now()
    try {
      v.gain.gain.cancelScheduledValues(t0)
      v.gain.gain.setValueAtTime(v.gain.gain.value, t0)
      v.gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
      v.osc.stop(t0 + 0.08)
    } catch (e) {}
  }
  function updatePlayerVoice(snap, dt) {
    ensurePlayerVoice()
    const v = _state.playerVoice
    const lane = snap.player.lane
    const x = snap.player.x
    const laneLen = snap.lanes[lane].length
    const base = laneBase(lane)
    const t = now()
    try {
      v.osc.frequency.setTargetAtTime(base * 2, t, 0.02)
      v.pan.pan.setTargetAtTime(panForX(x, laneLen), t, 0.02)
      v.lp.frequency.setTargetAtTime(base * 5, t, 0.05)
    } catch (e) {}

    // Detect walking by x-change between frames (ignore lane swaps which
    // can also shift x via clamping).
    const sameLane = (v.lastLane === lane)
    const walking = sameLane && v.lastX != null && Math.abs(x - v.lastX) > 0.01
    v.lastX = x
    v.lastLane = lane

    if (walking) {
      v.idleT = 0
      v.stepT += dt
      // Footstep cadence: ~5 steps/s when walking at PLAYER_WALK_SPEED.
      const stepInterval = 0.20
      if (v.stepT >= stepInterval) {
        v.stepT = 0
        adsr(v.gain.gain, t, 0.003, 0.012, 0.10, 0.10)
      }
    } else {
      v.stepT = 999  // first step after starting again should fire immediately
      v.idleT += dt
      // Idle heartbeat — slower, softer, but always present so the player
      // can still locate themselves by ear.
      if (v.idleT >= 0.8) {
        v.idleT = 0
        adsr(v.gain.gain, t, 0.005, 0.025, 0.18, 0.05)
      }
    }
  }

  // ----------------------------- frame update --------------------------
  function frame(snap, dt) {
    if (!_state.started) ensureStarted()
    if (_state.laneDrones.length === 0) ensureLaneDrones()
    drain()
    if (!snap) return

    // Per-lane drone gain — strongly boost the active lane so it's
    // unmistakable which row the player is on. Inactive lanes stay
    // audible (at much lower gain) so events on other lanes still register.
    for (let i = 0; i < 4; i++) {
      const d = _state.laneDrones[i]
      if (!d) continue
      const target = (i === snap.player.lane) ? 0.24 : 0.035
      try { d.gain.gain.setTargetAtTime(target, now(), 0.08) } catch (e) {}
    }

    // Player presence/footstep voice — always audible, panned by x,
    // pitched by lane. Gives the player a constant "I am here" cue.
    updatePlayerVoice(snap, dt)

    // Mug voices: ensure / refresh / destroy. Continuous slide voice,
    // pitch fixed at lane base — only the pan tracks x.
    const seenMugs = new Set()
    for (let i = 0; i < snap.lanes.length; i++) {
      const ln = snap.lanes[i]
      for (const m of ln.mugs) {
        seenMugs.add(m.id)
        const v = ensureMugVoice(m, i, ln.length)
        try {
          v.pan.pan.setTargetAtTime(panForX(m.x, ln.length), now(), 0.02)
        } catch (e) {}
      }
    }
    for (const id of Array.from(_state.mugVoices.keys())) {
      if (!seenMugs.has(id)) destroyMugVoice(id)
    }

    // Customer voices
    const seenCust = new Set()
    for (let i = 0; i < snap.lanes.length; i++) {
      const ln = snap.lanes[i]
      for (const c of ln.customers) {
        seenCust.add(c.id)
        const v = ensureCustomerVoice(c, i, ln.length)
        try {
          v.pan.pan.setTargetAtTime(panForX(c.x, ln.length), now(), 0.04)
        } catch (e) {}
        // Pulse footsteps at walk rate (one tap per cell, scaled by walkSpeed)
        if (!c.leaving && c.dwell <= 0 && snap.floorShow <= 0) {
          v.stepT += dt * snap.rules.walkSpeed
          if (v.stepT >= 1) {
            v.stepT -= 1
            const t0 = now()
            adsr(v.gain.gain, t0, 0.005, 0.02, 0.12, 0.05)
          }
        }
      }
    }
    for (const id of Array.from(_state.customerVoices.keys())) {
      if (!seenCust.has(id)) destroyCustomerVoice(id)
    }

    // Pour voice tracking
    if (snap.pour.active) {
      startPourVoice(snap.player.lane)
      updatePourVoice(snap.pour.charge, snap.player.lane)
    } else {
      stopPourVoice()
    }

    // Remember lane so the next laneSwap event can glissando from old → new.
    _state.prevPlayerLane = snap.player.lane
  }

  // ----------------------------- one-shot dispatcher -------------------
  function enqueue(ev) { _state.queue.push(ev) }
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
      case 'laneSwap':   return playLaneSwap(ev)
      case 'pourStart':  return playPourStart(ev)
      case 'sling':      return playSling(ev)
      case 'fizzle':     return playFizzle(ev)
      case 'catch':      return playCatch(ev)
      case 'catchEmpty': return playCatchEmpty(ev)
      case 'emptyFling': return playEmptyFling(ev)
      case 'spawn':      return playSpawn(ev)
      case 'tipDrop':    return playTipDrop(ev)
      case 'tipPickup':  return playTipPickup(ev)
      case 'loseLife':   return playLoseLife(ev)
      case 'levelClear': return playLevelClear(ev)
      case 'gameOver':   return playGameOver(ev)
      case 'levelStart': return playLevelStart(ev)
    }
  }

  // ----------------------------- one-shots -----------------------------
  function tone({freq, type='sine', pan=0, attack=0.005, hold=0.05, release=0.18, peak=0.18, when=0, sweepTo=null, sweepTime=0.2}) {
    if (!_state.started) ensureStarted()
    const c = ctx()
    const t0 = now() + Math.max(0, when)
    const osc = c.createOscillator()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    if (sweepTo != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + sweepTime)
    }
    const gain = c.createGain()
    adsr(gain.gain, t0, attack, hold, release, peak)
    const panNode = c.createStereoPanner()
    panNode.pan.value = clampPan(pan)
    osc.connect(gain); gain.connect(panNode); panNode.connect(_state.sfxBus)
    osc.start(t0)
    osc.stop(t0 + attack + hold + release + 0.05)
  }

  function noiseBurst({pan=0, hp=400, lp=2000, peak=0.3, dur=0.15, when=0}) {
    if (!_state.started) ensureStarted()
    const c = ctx()
    const t0 = now() + Math.max(0, when)
    const len = Math.ceil(c.sampleRate * dur)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = c.createBufferSource()
    src.buffer = buf
    const hpf = c.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = lp
    const gain = c.createGain()
    adsr(gain.gain, t0, 0.005, dur * 0.4, dur * 0.55, peak)
    const panNode = c.createStereoPanner()
    panNode.pan.value = clampPan(pan)
    src.connect(hpf); hpf.connect(lpf); lpf.connect(gain); gain.connect(panNode); panNode.connect(_state.sfxBus)
    src.start(t0)
  }

  function playLaneSwap(ev) {
    const lane = ev.snap.player.lane
    const prev = (_state.prevPlayerLane != null && _state.prevPlayerLane !== lane)
      ? _state.prevPlayerLane : lane
    const fromBase = laneBase(prev)
    const toBase = laneBase(lane)
    // Glissando from old lane base → new lane base. Direction (up/down)
    // tells the player whether they moved to a higher or lower lane,
    // and the landing pitch confirms which lane they're on.
    tone({
      freq: fromBase * 1.5, sweepTo: toBase * 1.5, sweepTime: 0.10,
      type: 'triangle', pan: 0, peak: 0.13,
      attack: 0.005, hold: 0.02, release: 0.10,
    })
    // Confirmation tap at the new lane's base pitch.
    tone({
      freq: toBase, type: 'sine', pan: 0, peak: 0.10,
      attack: 0.005, hold: 0.05, release: 0.14, when: 0.10,
    })
  }
  function playPourStart() {
    tone({freq: 200, type: 'square', pan: -0.9, peak: 0.05, hold: 0.02, release: 0.06})
  }
  function playSling(ev) {
    const charge = ev.charge != null ? ev.charge : 1
    const lane = ev.lane
    noiseBurst({pan: -0.85, hp: 600, lp: 4000, peak: 0.25 * charge, dur: 0.18})
    tone({freq: laneBase(lane) * 1.8, sweepTo: laneBase(lane) * 0.9, sweepTime: 0.2, type: 'sawtooth', pan: -0.7, peak: 0.16, hold: 0.04, release: 0.18})
  }
  function playFizzle() {
    tone({freq: 180, sweepTo: 90, sweepTime: 0.18, type: 'square', pan: -0.7, peak: 0.05, hold: 0.02, release: 0.12})
  }
  function playCatch(ev) {
    const ln = ev.snap.lanes[ev.lane]
    const pan = panForX(ev.x, ln.length)
    tone({freq: laneBase(ev.lane) * 0.7, sweepTo: laneBase(ev.lane) * 0.4, sweepTime: 0.15, type: 'triangle', pan, peak: 0.18, hold: 0.06, release: 0.18})
    noiseBurst({pan, hp: 100, lp: 600, peak: 0.18, dur: 0.12})
    if (ev.exit) {
      // Bonus chime — customer pushed out
      tone({freq: laneBase(ev.lane) * 2, type: 'triangle', pan, peak: 0.15, hold: 0.06, release: 0.25, when: 0.04})
      tone({freq: laneBase(ev.lane) * 3, type: 'triangle', pan, peak: 0.10, hold: 0.06, release: 0.25, when: 0.10})
    }
  }
  function playCatchEmpty(ev) {
    const ln = ev.snap.lanes[ev.lane]
    const pan = panForX(ev.x, ln.length)
    tone({freq: laneBase(ev.lane) * 2.4, type: 'sine', pan, peak: 0.15, hold: 0.02, release: 0.10})
    noiseBurst({pan, hp: 1500, lp: 6000, peak: 0.10, dur: 0.06})
  }
  function playEmptyFling(ev) {
    const ln = ev.snap.lanes[ev.lane]
    const pan = panForX(ev.x, ln.length)
    tone({freq: laneBase(ev.lane) * 2.0, sweepTo: laneBase(ev.lane) * 1.3, sweepTime: 0.18, type: 'square', pan, peak: 0.12, hold: 0.02, release: 0.10})
  }
  function playSpawn(ev) {
    const pan = 1 // door is on the right
    // Door creak + footstep
    noiseBurst({pan, hp: 200, lp: 1500, peak: 0.10, dur: 0.18})
    tone({freq: laneBase(ev.lane) * 0.5, type: 'triangle', pan, peak: 0.08, hold: 0.04, release: 0.12, when: 0.06})
  }
  function playTipDrop(ev) {
    const ln = ev.snap.lanes[ev.lane]
    const pan = panForX(ev.x, ln.length)
    // Coin-on-bar tick
    tone({freq: 1800, type: 'sine', pan, peak: 0.18, hold: 0.02, release: 0.18})
    tone({freq: 2400, type: 'sine', pan, peak: 0.12, hold: 0.02, release: 0.18, when: 0.06})
  }
  function playTipPickup(ev) {
    // Centred chime + brief floor show
    tone({freq: 880, type: 'sine', pan: 0, peak: 0.20, hold: 0.06, release: 0.30})
    tone({freq: 1320, type: 'sine', pan: 0, peak: 0.16, hold: 0.06, release: 0.30, when: 0.07})
    tone({freq: 1760, type: 'sine', pan: 0, peak: 0.14, hold: 0.06, release: 0.40, when: 0.14})
    playFloorShow(ev.snap)
  }
  function playFloorShow(snap) {
    const theme = snap.themeKey
    const c = ctx()
    const t0 = now() + 0.05
    const seqs = {
      saloon:    [{f: 440, dur: 0.18}, {f: 659, dur: 0.18}, {f: 880, dur: 0.18}, {f: 740, dur: 0.34}, {f: 587, dur: 0.34}],
      discoteca: [{f: 220, dur: 0.10}, {f: 220, dur: 0.10}, {f: 220, dur: 0.10}, {f: 330, dur: 0.18}, {f: 440, dur: 0.34}],
      estadio:   [{f: 392, dur: 0.18}, {f: 392, dur: 0.18}, {f: 523, dur: 0.18}, {f: 392, dur: 0.18}, {f: 622, dur: 0.40}],
      yates:     [{f: 880, dur: 0.20}, {f: 1175, dur: 0.20}, {f: 1320, dur: 0.20}, {f: 1568, dur: 0.20}, {f: 1760, dur: 0.40}],
    }
    const seq = seqs[theme] || seqs.saloon
    let t = t0
    for (const note of seq) {
      const osc = c.createOscillator()
      osc.type = 'triangle'
      osc.frequency.value = note.f
      const gain = c.createGain()
      adsr(gain.gain, t, 0.01, note.dur * 0.4, note.dur * 0.5, 0.10)
      osc.connect(gain); gain.connect(_state.musicBus)
      osc.start(t); osc.stop(t + note.dur + 0.05)
      t += note.dur
    }
  }
  function playLoseLife(ev) {
    const lane = ev.lane
    // Reason-specific stings, panned at the failure site (kegs for
    // breach/shatter, door for waste).
    if (ev.reason === 'breach') {
      const pan = -1
      tone({freq: 110, type: 'square', pan, peak: 0.30, hold: 0.10, release: 0.40})
      tone({freq: 165, type: 'sawtooth', pan, peak: 0.18, hold: 0.10, release: 0.40, when: 0.04})
      noiseBurst({pan, hp: 100, lp: 800, peak: 0.20, dur: 0.30, when: 0.10})
    } else if (ev.reason === 'shatter') {
      const pan = -1
      noiseBurst({pan, hp: 2000, lp: 8000, peak: 0.40, dur: 0.25})
      tone({freq: 1800, type: 'square', pan, peak: 0.15, hold: 0.05, release: 0.20})
      tone({freq: 2400, type: 'square', pan, peak: 0.12, hold: 0.05, release: 0.20, when: 0.06})
    } else if (ev.reason === 'waste') {
      const pan = 1
      tone({freq: laneBase(lane) * 1.5, sweepTo: laneBase(lane) * 0.4, sweepTime: 0.6, type: 'sawtooth', pan, peak: 0.22, hold: 0.05, release: 0.5})
      noiseBurst({pan, hp: 200, lp: 1200, peak: 0.20, dur: 0.20, when: 0.10})
    }
  }
  function playLevelClear(ev) {
    const root = laneBase(ev.snap.player.lane)
    const chord = [root, root * 1.25, root * 1.5, root * 2]
    chord.forEach((f, i) => {
      tone({freq: f, type: 'triangle', pan: 0, peak: 0.16, attack: 0.02, hold: 0.10, release: 0.45, when: i * 0.06})
    })
  }
  function playGameOver() {
    const root = 220
    const seq = [root * 1.5, root * 1.2, root * 1.0, root * 0.75]
    seq.forEach((f, i) => {
      tone({freq: f, type: 'triangle', pan: 0, peak: 0.22, attack: 0.02, hold: 0.12, release: 0.45, when: i * 0.32})
    })
    tone({freq: 60, type: 'sine', pan: 0, peak: 0.15, attack: 0.05, hold: 0.20, release: 0.80, when: 0.6})
  }
  function playLevelStart(ev) {
    const root = laneBase(ev.snap.player.lane)
    tone({freq: root, type: 'triangle', pan: 0, peak: 0.12, hold: 0.05, release: 0.15})
    tone({freq: root * 1.5, type: 'triangle', pan: 0, peak: 0.10, hold: 0.05, release: 0.20, when: 0.10})
  }

  // ----------------------------- public hooks --------------------------
  function silenceAll() {
    // Stop continuous voices on screen exit / pause-leave.
    for (const id of Array.from(_state.mugVoices.keys())) destroyMugVoice(id)
    for (const id of Array.from(_state.customerVoices.keys())) destroyCustomerVoice(id)
    stopPourVoice()
    destroyPlayerVoice()
    destroyLaneDrones()
    _state.prevPlayerLane = null
  }

  function reset() {
    silenceAll()
    _state.queue = []
  }

  return {
    frame,
    silenceAll,
    reset,
    onLaneSwap:       (snap) => enqueue({type: 'laneSwap', snap}),
    onPourStart:      (snap) => enqueue({type: 'pourStart', snap}),
    onSling:          (snap, ev) => enqueue({type: 'sling', snap, ...ev}),
    onSlingFizzle:    (snap) => enqueue({type: 'fizzle', snap}),
    onCatch:          (snap, ev) => enqueue({type: 'catch', snap, ...ev}),
    onCatchEmpty:     (snap, ev) => enqueue({type: 'catchEmpty', snap, ...ev}),
    onEmptyFling:     (snap, ev) => enqueue({type: 'emptyFling', snap, ...ev}),
    onCustomerSpawn:  (snap, ev) => enqueue({type: 'spawn', snap, ...ev}),
    onTipDrop:        (snap, ev) => enqueue({type: 'tipDrop', snap, ...ev}),
    onTipPickup:      (snap, ev) => enqueue({type: 'tipPickup', snap, ...ev}),
    onLoseLife:       (snap, ev) => enqueue({type: 'loseLife', snap, ...ev}),
    onLevelClear:     (snap) => enqueue({type: 'levelClear', snap}),
    onGameOver:       (snap) => enqueue({type: 'gameOver', snap}),
    onLevelStart:     (snap) => enqueue({type: 'levelStart', snap}),
  }
})()
