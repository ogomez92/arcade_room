/**
 * Arcade-mode pickups. Each pickup is a small object in the arena that
 * loops a distinctive spatialised sound at its position so blind players
 * can navigate to it. Driving over a pickup grants its effect (instant
 * heal, or items added to inventory).
 *
 * Pickup types:
 *   health    — chimes; +25 health (overheals up to 125)
 *   shield    — elastic boing; +1 forcefield (stacks, blocks next bump)
 *   bullets   — aggressive sawtooth boing; +3..+6 bullets
 *   mine      — subtle clicking; +1 mine
 *   speed     — fast revving whir; +1 speed-burst charge
 *   teleport  — shimmering high-pitched warble; +1 teleport charge
 *
 * Lifecycle: create() builds the spatial voice. update() repositions the
 * binaural ear in listener-local frame. destroy() tears down the audio
 * graph cleanly.
 */
content.pickups = (() => {
  const config = {
    pickupRadius: 0.9,         // collide radius for grabbing
    spawnIntervalMin: 4,       // seconds between spawn attempts
    spawnIntervalMax: 7,
    maxConcurrent: 5,          // simultaneous pickups in arena
    minSpawnSpacing: 4.0,      // don't spawn within this of another pickup or a car
    arenaInset: 4.0,           // keep pickups away from walls
  }

  // Type table: weight controls spawn frequency.
  const TYPES = {
    health:   {weight: 3, label: 'health pack'},
    shield:   {weight: 2, label: 'shield'},
    bullets:  {weight: 2, label: 'bullets'},
    mine:     {weight: 1, label: 'mine'},
    speed:    {weight: 2, label: 'speed burst'},
    teleport: {weight: 1, label: 'teleport'},
  }

  let nextId = 1

  // ---- Behind-listener muffler shared by every voice. -----------------
  // Each voice routes `out → muffler → ear` instead of `out → ear`. The
  // returned `applyBehind(amount)` ramps the lowpass cutoff down (more
  // muffled) and detunes any pitched oscillators down (slightly lower
  // pitch) as `amount` goes from 0 (front) to 1 (directly behind). The
  // perceptual cue stacks on top of the binaural pan: behind sounds
  // darker and a touch lower, like the parking-sensor low-pitch beep.
  function attachMuffler(c, out, pitchedOscillators) {
    const muffler = c.createBiquadFilter()
    muffler.type = 'lowpass'
    muffler.frequency.value = 12000
    muffler.Q.value = 0.7
    out.connect(muffler)
    return {
      input: muffler,
      applyBehind(amount) {
        const a = amount < 0 ? 0 : amount > 1 ? 1 : amount
        engine.fn.setParam(muffler.frequency, engine.fn.lerp(12000, 1100, a), 0.10)
        const detune = -150 * a   // cents; ~1.5 semitones max
        for (const o of pitchedOscillators || []) {
          if (o && o.detune) engine.fn.setParam(o.detune, detune, 0.10)
        }
      },
    }
  }

  // ---- Looping spatial voices for each pickup type --------------------

  function createHealthVoice(position) {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Soft bell-like ping that repeats every 1.2 s — restorative, calm,
    // out of the 2-3 kHz fatigue band the old voice sat in. Three sines
    // tuned as fundamental + perfect-fifth + octave produce a warm chime;
    // a percussive amplitude envelope on the master gain (scheduled by a
    // JS-side timer) gives each cycle a soft bell strike with a long
    // exponential decay back to silence.
    const fundamental = c.createOscillator()
    fundamental.type = 'sine'
    fundamental.frequency.value = 660           // E5

    const fifth = c.createOscillator()
    fifth.type = 'sine'
    fifth.frequency.value = 990                 // B5
    const fifthGain = c.createGain()
    fifthGain.gain.value = 0.45

    const octave = c.createOscillator()
    octave.type = 'sine'
    octave.frequency.value = 1320               // E6 — gentle shimmer
    const octaveGain = c.createGain()
    octaveGain.gain.value = 0.18

    fundamental.connect(out)
    fifth.connect(fifthGain).connect(out)
    octave.connect(octaveGain).connect(out)

    const muffle = attachMuffler(c, out, [fundamental, fifth, octave])

    // Match the non-self car engine attenuation (50 m max, cubic falloff)
    // so pickups only become present when you're close, like other cars.
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 50,
        power: 3,
      }),
    })
    ear.from(muffle.input)
    ear.to(engine.mixer.output())

    fundamental.start()
    fifth.start()
    octave.start()

    // Percussive ping envelope: 12 ms attack, exponential decay that
    // runs right up to the next ping so the loop is back-to-back with
    // no audible silence. JS-side setInterval re-arms the audio-clock
    // schedule each cycle; cancelScheduledValues at the start prevents
    // events from accumulating if the timer ever fires twice in quick
    // succession.
    const PEAK = 0.20
    const CYCLE_MS = 600
    const DECAY_END = 0.58       // seconds — just shy of next cycle's attack
    function schedulePing() {
      const t = c.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(0, t)
      out.gain.linearRampToValueAtTime(PEAK, t + 0.012)
      out.gain.exponentialRampToValueAtTime(0.0001, t + DECAY_END)
    }
    schedulePing()
    const pingTimer = setInterval(schedulePing, CYCLE_MS)

    return {
      ear,
      applyBehind: muffle.applyBehind,
      destroy() {
        clearInterval(pingTimer)
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.15)
        setTimeout(() => {
          try { fundamental.stop() } catch (e) {}
          try { fifth.stop() } catch (e) {}
          try { octave.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 250)
      },
    }
  }

  function createShieldVoice(position) {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Elastic boing — pitched sine with a low LFO bending the pitch
    // up and down so it has that rubbery wobble.
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 320

    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.9
    const lfoGain = c.createGain()
    lfoGain.gain.value = 90
    lfo.connect(lfoGain).connect(o.frequency)

    o.connect(out)

    const muffle = attachMuffler(c, out, [o])

    // Match the non-self car engine attenuation (50 m max, cubic falloff)
    // so pickups only become present when you're close, like other cars.
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 50,
        power: 3,
      }),
    })
    ear.from(muffle.input)
    ear.to(engine.mixer.output())

    o.start()
    lfo.start()
    out.gain.linearRampToValueAtTime(0.16, c.currentTime + 0.3)

    return {
      ear,
      applyBehind: muffle.applyBehind,
      destroy() {
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.15)
        setTimeout(() => {
          try { o.stop() } catch (e) {}
          try { lfo.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 250)
      },
    }
  }

  function createBulletsVoice(position) {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Aggressive sawtooth boing — saw with a fast LFO bending pitch
    // sharply for that "menacing weapon" feel.
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = 200

    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1.4
    const lfoGain = c.createGain()
    lfoGain.gain.value = 140
    lfo.connect(lfoGain).connect(o.frequency)

    const filt = c.createBiquadFilter()
    filt.type = 'lowpass'
    filt.frequency.value = 1400
    filt.Q.value = 4

    o.connect(filt).connect(out)

    const muffle = attachMuffler(c, out, [o])

    // Match the non-self car engine attenuation (50 m max, cubic falloff)
    // so pickups only become present when you're close, like other cars.
    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 50,
        power: 3,
      }),
    })
    ear.from(muffle.input)
    ear.to(engine.mixer.output())

    o.start()
    lfo.start()
    out.gain.linearRampToValueAtTime(0.14, c.currentTime + 0.3)

    return {
      ear,
      applyBehind: muffle.applyBehind,
      destroy() {
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.15)
        setTimeout(() => {
          try { o.stop() } catch (e) {}
          try { lfo.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 250)
      },
    }
  }

  function createMineVoice(position) {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Subtle: very low filtered noise + occasional click.
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 2})
    noise.loop = true
    const filt = c.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 220
    filt.Q.value = 8
    noise.connect(filt).connect(out)

    // Slow tick — square at 1 Hz gating a quiet sine so a click
    // emerges every second.
    const ticker = c.createOscillator()
    ticker.type = 'sine'
    ticker.frequency.value = 0.6
    const tickGain = c.createGain()
    tickGain.gain.value = 0.18
    const offset = c.createConstantSource()
    offset.offset.value = 0.1
    ticker.connect(tickGain.gain)
    offset.connect(tickGain.gain)
    const tickOsc = c.createOscillator()
    tickOsc.type = 'sine'
    tickOsc.frequency.value = 540
    tickOsc.connect(tickGain).connect(out)

    const muffle = attachMuffler(c, out, [tickOsc])

    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 18,           // mines are subtle — only audible close
        power: 3,
      }),
    })
    ear.from(muffle.input)
    ear.to(engine.mixer.output())

    noise.start()
    ticker.start()
    tickOsc.start()
    offset.start()

    // Lower master gain — mines are meant to be sneaky.
    out.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.3)

    return {
      ear,
      applyBehind: muffle.applyBehind,
      destroy() {
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.15)
        setTimeout(() => {
          try { noise.stop() } catch (e) {}
          try { ticker.stop() } catch (e) {}
          try { tickOsc.stop() } catch (e) {}
          try { offset.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 250)
      },
    }
  }

  function createSpeedVoice(position) {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Racing whir: triangle carrier with rapid frequency wobble + a
    // sub octave + bandpassed noise for the "wind". Fast LFO gates
    // the whole thing into a chopping pattern so it reads as urgent.
    const carrier = c.createOscillator()
    carrier.type = 'triangle'
    carrier.frequency.value = 520
    const sub = c.createOscillator()
    sub.type = 'triangle'
    sub.frequency.value = 260

    // Vibrato on carrier for the racing-engine feel.
    const vibrato = c.createOscillator()
    vibrato.type = 'sine'
    vibrato.frequency.value = 9
    const vibratoGain = c.createGain()
    vibratoGain.gain.value = 80
    vibrato.connect(vibratoGain).connect(carrier.frequency)

    // Bandpass noise for wind.
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.pinkNoise({channels: 1, duration: 2})
    noise.loop = true
    const bandpass = c.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = 1100
    bandpass.Q.value = 4
    const noiseGain = c.createGain()
    noiseGain.gain.value = 0.4
    noise.connect(bandpass).connect(noiseGain)

    // Combined pre-gate signal.
    const mix = c.createGain()
    mix.gain.value = 0.5
    carrier.connect(mix)
    sub.connect(mix)
    noiseGain.connect(mix)

    // LFO chop — square-ish tremolo at 6 Hz.
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 6
    const lfoShape = c.createGain()
    lfoShape.gain.value = 0.6
    const lfoOffset = c.createConstantSource()
    lfoOffset.offset.value = 0.4
    lfo.connect(lfoShape)

    const gate = c.createGain()
    gate.gain.value = 0
    lfoShape.connect(gate.gain)
    lfoOffset.connect(gate.gain)

    mix.connect(gate).connect(out)

    const muffle = attachMuffler(c, out, [carrier, sub])

    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 50,
        power: 3,
      }),
    })
    ear.from(muffle.input)
    ear.to(engine.mixer.output())

    carrier.start()
    sub.start()
    vibrato.start()
    noise.start()
    lfo.start()
    lfoOffset.start()

    out.gain.linearRampToValueAtTime(0.16, c.currentTime + 0.3)

    return {
      ear,
      applyBehind: muffle.applyBehind,
      destroy() {
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.15)
        setTimeout(() => {
          try { carrier.stop() } catch (e) {}
          try { sub.stop() } catch (e) {}
          try { vibrato.stop() } catch (e) {}
          try { noise.stop() } catch (e) {}
          try { lfo.stop() } catch (e) {}
          try { lfoOffset.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 250)
      },
    }
  }

  function createTeleportVoice(position) {
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Sci-fi shimmer: a high carrier with a wide pitch wobble, plus a
    // detuned partial a fifth above. Slow tremolo gates the whole thing
    // into a phasing/pulsing shape so it stands apart from the other
    // pickups.
    const carrier = c.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = 1320

    const partial = c.createOscillator()
    partial.type = 'triangle'
    partial.frequency.value = 1980          // perfect fifth above
    const partialGain = c.createGain()
    partialGain.gain.value = 0.35

    // Wide vibrato so the pitch warbles in a "phasing" way.
    const vibrato = c.createOscillator()
    vibrato.type = 'sine'
    vibrato.frequency.value = 5
    const vibratoGain = c.createGain()
    vibratoGain.gain.value = 220
    vibrato.connect(vibratoGain)
    vibratoGain.connect(carrier.frequency)
    vibratoGain.connect(partial.frequency)

    const mix = c.createGain()
    mix.gain.value = 0.55
    carrier.connect(mix)
    partial.connect(partialGain).connect(mix)

    // Slow tremolo gate.
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1.1
    const lfoShape = c.createGain()
    lfoShape.gain.value = 0.45
    const lfoOffset = c.createConstantSource()
    lfoOffset.offset.value = 0.55
    lfo.connect(lfoShape)

    const gate = c.createGain()
    gate.gain.value = 0
    lfoShape.connect(gate.gain)
    lfoOffset.connect(gate.gain)

    mix.connect(gate).connect(out)

    const muffle = attachMuffler(c, out, [carrier, partial])

    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 50,
        power: 3,
      }),
    })
    ear.from(muffle.input)
    ear.to(engine.mixer.output())

    carrier.start()
    partial.start()
    vibrato.start()
    lfo.start()
    lfoOffset.start()

    out.gain.linearRampToValueAtTime(0.13, c.currentTime + 0.3)

    return {
      ear,
      applyBehind: muffle.applyBehind,
      destroy() {
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.15)
        setTimeout(() => {
          try { carrier.stop() } catch (e) {}
          try { partial.stop() } catch (e) {}
          try { vibrato.stop() } catch (e) {}
          try { lfo.stop() } catch (e) {}
          try { lfoOffset.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 250)
      },
    }
  }

  const VOICE_FACTORY = {
    health: createHealthVoice,
    shield: createShieldVoice,
    bullets: createBulletsVoice,
    mine: createMineVoice,
    speed: createSpeedVoice,
    teleport: createTeleportVoice,
  }

  // ---- Pickup model ---------------------------------------------------

  function createPickup(type, position, idOverride) {
    const factory = VOICE_FACTORY[type]
    const voice = factory(position)
    return {
      id: idOverride || `pickup-${nextId++}`,
      type,
      position: {x: position.x, y: position.y},
      voice,
      consumed: false,
    }
  }

  function destroyPickup(p) {
    if (!p) return
    p.consumed = true
    if (p.voice) {
      p.voice.destroy()
      p.voice = null
    }
  }

  function updateVoiceSpatial(p, listener, listenerYaw) {
    if (!p.voice || !p.voice.ear) return
    const dx = p.position.x - listener.x,
      dy = p.position.y - listener.y
    const cos = Math.cos(-listenerYaw), sin = Math.sin(-listenerYaw)
    const localX = dx * cos - dy * sin
    const localY = dx * sin + dy * cos
    p.voice.ear.update({x: localX, y: localY, z: 0})
    if (p.voice.applyBehind) {
      const dist = Math.hypot(localX, localY)
      const behind = dist > 0.001 ? engine.fn.clamp(-localX / dist, 0, 1) : 0
      p.voice.applyBehind(behind)
    }
  }

  // ---- Manager --------------------------------------------------------

  function createManager(game) {
    const items = []
    let nextSpawnAt = engine.time() + 0.5

    function pickRandomType() {
      const totalWeight = Object.values(TYPES).reduce((a, t) => a + t.weight, 0)
      let roll = Math.random() * totalWeight
      for (const [name, t] of Object.entries(TYPES)) {
        roll -= t.weight
        if (roll <= 0) return name
      }
      return 'health'
    }

    function findSpawnLocation() {
      const b = content.arena.bounds
      const inset = config.arenaInset
      for (let attempt = 0; attempt < 12; attempt++) {
        const x = engine.fn.lerp(b.minX + inset, b.maxX - inset, Math.random())
        const y = engine.fn.lerp(b.minY + inset, b.maxY - inset, Math.random())
        // Reject if too close to another pickup
        let ok = true
        for (const p of items) {
          if (Math.hypot(x - p.position.x, y - p.position.y) < config.minSpawnSpacing) {
            ok = false; break
          }
        }
        if (!ok) continue
        // Reject if too close to a living car
        for (const car of game.cars) {
          if (car.eliminated) continue
          if (Math.hypot(x - car.position.x, y - car.position.y) < config.minSpawnSpacing) {
            ok = false; break
          }
        }
        if (ok) return {x, y}
      }
      return null
    }

    function spawnOne() {
      if (items.length >= config.maxConcurrent) return
      const loc = findSpawnLocation()
      if (!loc) return
      const type = pickRandomType()
      items.push(createPickup(type, loc))
    }

    function update() {
      const t = engine.time()

      // Spawn loop
      if (t >= nextSpawnAt) {
        spawnOne()
        nextSpawnAt = t + engine.fn.lerp(
          config.spawnIntervalMin,
          config.spawnIntervalMax,
          Math.random(),
        )
      }

      // Pickup detection — any non-eliminated car within pickup radius.
      for (const p of items) {
        if (p.consumed) continue
        for (const car of game.cars) {
          if (car.eliminated) continue
          const d = Math.hypot(p.position.x - car.position.x, p.position.y - car.position.y)
          if (d <= config.pickupRadius + car.radius) {
            content.events.emit('pickupGrabbed', {pickupId: p.id, type: p.type, carId: car.id})
            destroyPickup(p)
            break
          }
        }
      }

      // Sweep consumed pickups
      for (let i = items.length - 1; i >= 0; i--) {
        if (items[i].consumed) items.splice(i, 1)
      }

      updateSpatial()
    }

    function updateSpatial() {
      const player = game.player()
      if (!player) return
      for (const p of items) {
        updateVoiceSpatial(p, player.position, player.heading)
      }
    }

    /**
     * Client-side: reconcile local items + voices against the host's
     * authoritative list (received in a snapshot). New ids → spawn voice;
     * missing ids → tear down voice; existing ids → keep + update position.
     */
    function applyRemoteItems(remoteList) {
      const incoming = new Map((remoteList || []).map((r) => [r.id, r]))
      // Remove items that no longer exist in the snapshot.
      for (let i = items.length - 1; i >= 0; i--) {
        if (!incoming.has(items[i].id)) {
          destroyPickup(items[i])
          items.splice(i, 1)
        }
      }
      // Add or update.
      for (const r of remoteList || []) {
        let p = items.find((it) => it.id === r.id)
        if (!p) {
          p = createPickup(r.type, {x: r.x, y: r.y}, r.id)
          items.push(p)
        } else {
          p.position.x = r.x
          p.position.y = r.y
        }
      }
    }

    /** Host-side: snapshot-friendly description of current pickups. */
    function toSnapshot() {
      return items
        .filter((p) => !p.consumed)
        .map((p) => ({id: p.id, type: p.type, x: p.position.x, y: p.position.y}))
    }

    function destroy() {
      for (const p of items) destroyPickup(p)
      items.length = 0
    }

    return {
      get items() { return items },
      update,
      updateSpatial,
      applyRemoteItems,
      toSnapshot,
      destroy,
    }
  }

  /**
   * Spin up a pickup loop voice for `durationMs` ms with the listener
   * sitting right on top of it (full-volume, centred). Used by the
   * "Learn the sounds" screen so players can preview what each pickup
   * actually sounds like sitting on the ground — not the one-shot
   * acquisition chime, which is a different sound.
   */
  function previewVoice(type, durationMs = 2500) {
    const factory = VOICE_FACTORY[type]
    if (!factory) return
    const voice = factory({x: 0, y: 0})
    if (voice && voice.ear) {
      voice.ear.update({x: 0, y: 0, z: 0})
    }
    setTimeout(() => {
      try { voice.destroy() } catch (e) {}
    }, durationMs)
  }

  return {
    config,
    TYPES,
    createManager,
    previewVoice,
  }
})()
