/**
 * Arcade-mode mines. Placed by a car (player presses F, AI does it
 * opportunistically). A mine sits at its placement position with a
 * subtle looping voice (audible only at close range), and detonates
 * when any non-eliminated car comes within `triggerRadius`.
 *
 * Detonation does damage in a small radius (with falloff) and emits
 * `mineExploded`. Game wires that into announcer + SFX.
 *
 * The placer gets a brief immunity window after dropping so they can
 * drive away without committing suicide.
 */
content.mines = (() => {
  const config = {
    triggerRadius: 1.4,         // any car within this trips the mine
    explosionRadius: 2.6,       // damage falloff out to here
    centerDamage: 38,
    edgeDamage: 12,
    placerImmunity: 1.0,        // seconds the placer is ignored after drop
    placeBehindOffset: 0.9,     // mine spawns slightly behind the placer
  }

  let nextId = 1

  function createMineVoice(position) {
    // Distinctly *placed-mine* timbre — sub-bass body + a slow deep
    // thud, no metallic tick. The pickup-mine voice in pickups.js sits
    // at ~220–540 Hz and reads as "subtle ticking"; the placed mine
    // should read as "menace lurking under the floor" so the player
    // can tell at a glance whether what they're hearing is something
    // to grab or something to avoid.
    const c = engine.context()
    const out = c.createGain()
    out.gain.value = 0

    // Low rumble bed: brown noise rolled off hard with a lowpass so all
    // that's left is sub-bass air-movement.
    const noise = c.createBufferSource()
    noise.buffer = engine.buffer.brownNoise({channels: 1, duration: 2})
    noise.loop = true
    const noiseLP = c.createBiquadFilter()
    noiseLP.type = 'lowpass'
    noiseLP.frequency.value = 110
    noiseLP.Q.value = 0.7
    const noiseGain = c.createGain()
    noiseGain.gain.value = 0.55
    noise.connect(noiseLP).connect(noiseGain).connect(out)

    // Sub-octave sustained drone (55 Hz ≈ A1) — gives the voice a
    // physical "weight" the pickup version lacks.
    const drone = c.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = 55
    const droneGain = c.createGain()
    droneGain.gain.value = 0.22
    drone.connect(droneGain).connect(out)

    // Slow heavy thud — slower than the pickup tick (0.4 vs 0.6 Hz),
    // pitched way down (160 vs 540 Hz), with a touch of pitch envelope
    // so each thud has some body. Uses an LFO to gate volume into a
    // pulse train.
    const ticker = c.createOscillator()
    ticker.type = 'sine'
    ticker.frequency.value = 0.4
    const tickGain = c.createGain()
    tickGain.gain.value = 0.18
    const offset = c.createConstantSource()
    offset.offset.value = 0.05
    ticker.connect(tickGain.gain)
    offset.connect(tickGain.gain)
    const tickOsc = c.createOscillator()
    tickOsc.type = 'triangle'
    tickOsc.frequency.value = 160
    tickOsc.connect(tickGain).connect(out)

    const ear = engine.ear.binaural.create({
      gainModel: engine.ear.gainModel.exponential.instantiate({
        maxDistance: 12,
        power: 3,
      }),
    })
    ear.from(out)
    ear.to(engine.mixer.output())

    noise.start()
    drone.start()
    ticker.start()
    tickOsc.start()
    offset.start()

    out.gain.linearRampToValueAtTime(0.07, c.currentTime + 0.3)

    return {
      ear,
      destroy() {
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.1)
        setTimeout(() => {
          try { noise.stop() } catch (e) {}
          try { drone.stop() } catch (e) {}
          try { ticker.stop() } catch (e) {}
          try { tickOsc.stop() } catch (e) {}
          try { offset.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 200)
      },
    }
  }

  function createManager(game) {
    const mines = []

    function place(owner) {
      if (!owner || owner.eliminated) return false
      if (!owner.inventory || owner.inventory.mines <= 0) return false

      // Spawn slightly behind so the placer doesn't immediately overlap.
      const bx = owner.position.x - Math.cos(owner.heading) * config.placeBehindOffset
      const by = owner.position.y - Math.sin(owner.heading) * config.placeBehindOffset

      // Clamp inside arena.
      const bounds = content.arena.bounds
      const cx = engine.fn.clamp(bx, bounds.minX + 0.5, bounds.maxX - 0.5)
      const cy = engine.fn.clamp(by, bounds.minY + 0.5, bounds.maxY - 0.5)

      const mine = {
        id: `mine-${nextId++}`,
        ownerId: owner.id,
        ownerLabel: owner.label,
        position: {x: cx, y: cy},
        placedAt: engine.time(),
        exploded: false,
        voice: createMineVoice({x: cx, y: cy}),
      }
      mines.push(mine)
      owner.inventory.mines--
      content.events.emit('minePlaced', {mineId: mine.id, ownerId: owner.id})
      return true
    }

    function detonate(mine, trigger) {
      if (mine.exploded) return
      mine.exploded = true

      content.events.emit('mineDetonated', {
        mineId: mine.id,
        x: mine.position.x,
        y: mine.position.y,
      })

      // Damage every non-eliminated car within explosionRadius.
      for (const car of game.cars) {
        if (car.eliminated) continue
        const d = Math.hypot(car.position.x - mine.position.x, car.position.y - mine.position.y)
        if (d > config.explosionRadius) continue
        const t = engine.fn.clamp(1 - d / config.explosionRadius, 0, 1)
        const damage = engine.fn.lerp(config.edgeDamage, config.centerDamage, t)
        const previousHealth = car.health
        const aggressor = game.cars.find((c) => c.id === mine.ownerId)
        content.car.applyDamage(car, damage, aggressor || null)
        const dealt = previousHealth - car.health
        content.events.emit('mineHit', {
          mineId: mine.id,
          ownerId: mine.ownerId,
          victimId: car.id,
          damage: dealt,
          triggerId: trigger ? trigger.id : null,
          x: mine.position.x,
          y: mine.position.y,
        })
      }
    }

    function update() {
      const t = engine.time()
      for (const mine of mines) {
        if (mine.exploded) continue
        for (const car of game.cars) {
          if (car.eliminated) continue
          if (car.id === mine.ownerId && (t - mine.placedAt) < config.placerImmunity) continue
          const d = Math.hypot(car.position.x - mine.position.x, car.position.y - mine.position.y)
          if (d <= config.triggerRadius + car.radius * 0.5) {
            detonate(mine, car)
            break
          }
        }
      }

      // Sweep exploded.
      for (let i = mines.length - 1; i >= 0; i--) {
        if (mines[i].exploded) {
          if (mines[i].voice) mines[i].voice.destroy()
          mines.splice(i, 1)
        }
      }

      updateSpatial()
    }

    function updateSpatial() {
      const player = game.player()
      if (!player) return
      for (const m of mines) {
        if (!m.voice || !m.voice.ear) continue
        const dx = m.position.x - player.position.x,
          dy = m.position.y - player.position.y
        const cos = Math.cos(-player.heading), sin = Math.sin(-player.heading)
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        m.voice.ear.update({x: localX, y: localY, z: 0})
      }
    }

    /** Host-side: snapshot description for transmission to clients. */
    function toSnapshot() {
      return mines
        .filter((m) => !m.exploded)
        .map((m) => ({id: m.id, x: m.position.x, y: m.position.y}))
    }

    /** Client-side: reconcile local mines with the host's authoritative list. */
    function applyRemoteItems(remoteList) {
      const incoming = new Map((remoteList || []).map((m) => [m.id, m]))
      for (let i = mines.length - 1; i >= 0; i--) {
        if (!incoming.has(mines[i].id)) {
          if (mines[i].voice) mines[i].voice.destroy()
          mines.splice(i, 1)
        }
      }
      for (const r of remoteList || []) {
        let m = mines.find((it) => it.id === r.id)
        if (!m) {
          m = {
            id: r.id,
            position: {x: r.x, y: r.y},
            placedAt: engine.time(),
            exploded: false,
            voice: createMineVoice({x: r.x, y: r.y}),
          }
          mines.push(m)
        } else {
          m.position.x = r.x
          m.position.y = r.y
        }
      }
    }

    function destroy() {
      for (const m of mines) {
        if (m.voice) m.voice.destroy()
      }
      mines.length = 0
    }

    return {
      config,
      get mines() { return mines },
      place,
      update,
      updateSpatial,
      applyRemoteItems,
      toSnapshot,
      destroy,
    }
  }

  return {
    config,
    createManager,
  }
})()
