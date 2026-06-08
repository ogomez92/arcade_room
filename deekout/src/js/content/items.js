// Good items (helpful powerups) and nasty items (robot-only effects). Good
// items spawn from rapid coin collection; nasty items spawn on a shrinking
// interval the longer a level runs. Either the player or an enemy can grab a
// good item; a nasty item only matters if the ROBOT grabs it (player grab =
// denial). Owns bombs and hazard zones. References siblings lazily.
content.items = (() => {
  const C = () => content.constants
  const S = () => content.state

  const GRAB_RADIUS = 1.3
  const HAZARD_RADIUS = 0.9
  const goodVoices = new Map()
  const nastyVoices = new Map()
  const speedupExpiries = []
  let invisItemUntil = 0      // expiry of an invisibility ITEM (not spawn/hit mercy)
  let robotSpeedupUntil = 0   // expiry of the robot-speedup nasty effect
  // Continuous risers: pitch glides up over each temporary effect's life, then
  // an "off" cue fires when it ends. The robot one is spatial (follows the bot).
  let speedupRiser = null
  let invisRiser = null
  let robotRiser = null

  function stopRisers() {
    if (speedupRiser) { speedupRiser.stop(); speedupRiser = null }
    if (invisRiser) { invisRiser.stop(); invisRiser = null }
    if (robotRiser) { robotRiser.stop(); robotRiser = null }
  }

  function reset() {
    silenceAll()
    speedupExpiries.length = 0
    invisItemUntil = 0
    robotSpeedupUntil = 0
    stopRisers()
  }

  // ----- voices -----
  function startGoodVoice(item) {
    const prop = content.audio.makeProp({
      // Spatial beacon with the same binaural distance falloff as coins / the
      // bot (exponential gain model), so it fades with distance instead of being
      // heard everywhere. Direction comes from the stereo pan + binaural ear,
      // recomputed each frame via setPosition as the player moves.
      col: item.col, row: item.row, gain: 0.1, maxDistance: 30, power: 1.4,
      build: (out, ctx, detune) => {
        // A warm, bright ASCENDING MAJOR ARPEGGIO that loops fast — a rewarding,
        // happy "powerup" beacon. Triangle body (modern-synth warmth, not a
        // harsh square) plus a quiet octave-up sine sparkle, each note plucked
        // so the run flows. Per-instance pitch jitter (item.id) keeps two good
        // items distinguishable. coin-style audio-clock lookahead = gapless loop.
        const base = content.audio.jitter(660, item.id)
        const notes = [base, base * 1.25, base * 1.5] // root, major third, fifth
        const step = 0.075                             // ~0.225s for the whole motif
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.Q.value = 0.7
        lp.connect(out)
        let stopped = false, timer = null, idx = 0
        let nextT = ctx.currentTime + 0.05

        function pluck(t, f) {
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f
          if (detune) detune.connect(o.detune)
          const spark = ctx.createOscillator(); spark.type = 'sine'; spark.frequency.value = f * 2
          if (detune) detune.connect(spark.detune)
          const sg = ctx.createGain(); sg.gain.value = 0.25
          const env = ctx.createGain()
          env.gain.setValueAtTime(0.0001, t)
          env.gain.linearRampToValueAtTime(0.5, t + 0.005)
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.13)
          env.connect(lp)
          o.connect(env)
          spark.connect(sg).connect(env)
          o.start(t); o.stop(t + 0.15)
          spark.start(t); spark.stop(t + 0.15)
        }
        function pump() {
          if (stopped) return
          const horizon = ctx.currentTime + 0.12
          while (nextT < horizon) { pluck(nextT, notes[idx % notes.length]); idx++; nextT += step }
          timer = setTimeout(pump, 25)
        }
        pump()
        return [() => { stopped = true; if (timer) clearTimeout(timer) }]
      },
    })
    goodVoices.set(item.id, prop)
  }

  function startNastyVoice(item) {
    const prop = content.audio.makeProp({
      // Same spatial falloff as good items — fades with distance via the
      // binaural exponential gain model rather than being audible everywhere.
      col: item.col, row: item.row, gain: 0.1, maxDistance: 30, power: 1.4,
      build: (out, ctx, detune) => {
        // A dark, DESCENDING TWO-NOTE motif that loops (whole motif every 0.25s,
        // slower than the good-item beacon) — ominous and melodic rather than a
        // continuous drone. A low sawtooth + sub falling a tritone (the classic
        // "danger" interval) through a heavy lowpass. coin-style lookahead.
        const base = content.audio.jitter(220, item.id)
        const notes = [base, base * 0.707]  // root then a menacing tritone down
        const loop = 0.25                    // whole motif repeats every 0.25s
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2
        lp.connect(out)
        let stopped = false, timer = null, idx = 0
        let nextT = ctx.currentTime + 0.05

        function note(t, f) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
          if (detune) detune.connect(o.detune)
          const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = f / 2
          if (detune) detune.connect(sub.detune)
          const sg = ctx.createGain(); sg.gain.value = 0.6
          const env = ctx.createGain()
          env.gain.setValueAtTime(0.0001, t)
          env.gain.linearRampToValueAtTime(0.5, t + 0.008)
          env.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
          env.connect(lp)
          o.connect(env)
          sub.connect(sg).connect(env)
          o.start(t); o.stop(t + 0.13)
          sub.start(t); sub.stop(t + 0.13)
        }
        function pump() {
          if (stopped) return
          const horizon = ctx.currentTime + 0.12
          const step = loop / notes.length
          while (nextT < horizon) { note(nextT, notes[idx % notes.length]); idx++; nextT += step }
          timer = setTimeout(pump, 25)
        }
        pump()
        return [() => { stopped = true; if (timer) clearTimeout(timer) }]
      },
    })
    nastyVoices.set(item.id, prop)
  }

  function killGood(id) { const v = goodVoices.get(id); if (v) { v.destroy(); goodVoices.delete(id) } }
  function killNasty(id) { const v = nastyVoices.get(id); if (v) { v.destroy(); nastyVoices.delete(id) } }

  function silenceAll() {
    for (const id of [...goodVoices.keys()]) killGood(id)
    for (const id of [...nastyVoices.keys()]) killNasty(id)
    stopRisers()
  }

  // Audition the looping item drones on the learn screen.
  function previewNasty(world) {
    const g = C().GRID
    const w = world || {col: (g.cols - 1) / 2, row: (g.rows - 1) / 2 - 5}
    const id = '__preview_nasty'
    killNasty(id)
    startNastyVoice({id, col: w.col, row: w.row})
    const v = nastyVoices.get(id); if (v) v.setGain(0.3)
    setTimeout(() => killNasty(id), 3000)
  }
  function previewGood(world) {
    const g = C().GRID
    const w = world || {col: (g.cols - 1) / 2, row: (g.rows - 1) / 2 - 5}
    const id = '__preview_good'
    killGood(id)
    startGoodVoice({id, col: w.col, row: w.row})
    const v = goodVoices.get(id); if (v) v.setGain(0.3)
    setTimeout(() => killGood(id), 3000)
  }

  // ----- spawning -----
  function freeCell() {
    return content.field.randomFreeCell(null, {minFromPlayer: 3})
  }

  // Pick a good-item effect. Armor is special: permanent + wall-immune for the
  // whole run, so it's offered only if not already owned, at a per-difficulty
  // rate (easy generous, crazy rare) — never through the uniform pool.
  function pickGoodEffect() {
    const car = S().career()
    const params = C().levelParams(car.difficulty, car.level)
    if (!car.armorPermanent && Math.random() < (params.armorChance || 0)) {
      return C().ITEM.ARMOR
    }
    const pool = C().GOOD_ITEM_POOL.filter((id) => id !== C().ITEM.ARMOR)
    return pool[Math.floor(Math.random() * pool.length)]
  }

  function spawnGood() {
    const lvl = S().level()
    const cell = freeCell()
    if (!cell) return
    const id = S().nextId()
    const effectId = pickGoodEffect()
    lvl.goodItems.push({id, col: cell.col, row: cell.row, effectId})
    startGoodVoice(lvl.goodItems[lvl.goodItems.length - 1])
    content.scoring.award('dispatchGood')
    lvl.goodItemsDispatched++
    content.audio.itemDispatch()
    content.announcer.itemSpawned()
  }

  function spawnNasty() {
    const lvl = S().level()
    const cell = freeCell()
    if (!cell) return
    const id = S().nextId()
    const kind = C().NASTY_POOL[Math.floor(Math.random() * C().NASTY_POOL.length)]
    lvl.nastyItems.push({id, col: cell.col, row: cell.row, kind})
    startNastyVoice(lvl.nastyItems[lvl.nastyItems.length - 1])
    content.announcer.nastySpawned()
  }

  function scheduleNextNasty() {
    const lvl = S().level()
    const params = C().levelParams(S().career().difficulty, S().career().level)
    lvl.nastySpawns++
    const interval = Math.max(params.nasty.intervalFloor, params.nasty.intervalBase - params.nasty.shrinkPerSpawn * lvl.nastySpawns)
    lvl.nastyNextAt = lvl.timer + interval
  }

  // ----- bombs & hazards -----
  function scatterBombs() {
    const lvl = S().level()
    const n = 4 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) {
      const cell = content.field.randomFreeCell(null, {minFromPlayer: 1})
      if (!cell) continue
      lvl.bombs.push({id: S().nextId(), col: cell.col, row: cell.row, fuse: 1.5 + Math.random() * 3, lastTick: 0, exploded: false})
    }
  }

  function addHazard() {
    const lvl = S().level()
    const cell = content.field.randomFreeCell(null, {minFromPlayer: 3})
    if (!cell) return
    lvl.hazardCells.push({id: S().nextId(), col: cell.col, row: cell.row, ttl: 16, inside: false})
  }

  // ----- effects -----
  function applyGoodEffect(effectId) {
    const p = S().player()
    const car = S().career()
    const now = engine.time()
    switch (effectId) {
      case C().ITEM.SPEEDUP:
        p.speedups++; speedupExpiries.push(now + 8)
        if (speedupRiser) speedupRiser.stop()
        speedupRiser = content.audio.startEffectRiser('speedup', Math.max(...speedupExpiries) - now)
        break
      case C().ITEM.HEALTH: car.health += 30; break // no cap: overheal past max in every difficulty
      case C().ITEM.POINTS: content.scoring.award('pointsItem'); break
      case C().ITEM.INVISIBILITY:
        p.invisibleUntil = now + 8; invisItemUntil = now + 8
        if (invisRiser) invisRiser.stop()
        invisRiser = content.audio.startEffectRiser('invisibility', 8)
        break
      case C().ITEM.ARMOR: car.armorPermanent = true; break // permanent for the run; negates all wall damage
      case C().ITEM.COIN_SPAWN: content.coins.spawnBatch(8); break
    }
  }

  function applyNastyEffect(kind) {
    switch (kind) {
      case C().NASTY.ROBOT_SPEEDUP: {
        content.enemies.applyNastyEffect(kind)
        robotSpeedupUntil = engine.time() + 6
        if (robotRiser) robotRiser.stop()
        const rb = content.enemies.list().find((e) => e.type === C().ENEMY.ROBOT)
        const g = C().GRID
        robotRiser = content.audio.startEffectRiser('robotSpeedup', 6, rb ? {col: rb.col, row: rb.row} : {col: (g.cols - 1) / 2, row: (g.rows - 1) / 2})
        break
      }
      case C().NASTY.HAZARD: addHazard(); break
      case C().NASTY.STEAL_TIME: S().level().timer += 15; break
      case C().NASTY.BOMBS: scatterBombs(); break
      case C().NASTY.LEVEL_DROP: content.game.requestLevelDrop(); break
      case C().NASTY.NOTHING: content.audio.robotLaugh(); content.announcer.info(app.i18n.t('ann.robotLaugh')); break
    }
  }

  // ----- per-frame -----
  function frame() {
    const lvl = S().level()
    const p = S().player()
    const now = engine.time()

    // Expire speedups; when the LAST one ends, stop the riser + play its off cue.
    for (let i = speedupExpiries.length - 1; i >= 0; i--) {
      if (now >= speedupExpiries[i]) {
        speedupExpiries.splice(i, 1)
        if (p.speedups > 0) p.speedups--
      }
    }
    if (speedupRiser && p.speedups <= 0) {
      speedupRiser.stop(); speedupRiser = null
      content.audio.itemOff('speedup')
    }
    // Invisibility ITEM (tracked apart from spawn/hit mercy windows).
    if (invisItemUntil && now >= invisItemUntil) {
      invisItemUntil = 0
      if (invisRiser) { invisRiser.stop(); invisRiser = null }
      content.audio.itemOff('invisibility')
    }
    // Robot speed-up nasty — keep the spatial riser glued to the robot, then
    // stop it + fire the off cue from the robot's position when it ends.
    const robotE = content.enemies && content.enemies.list().find((e) => e.type === C().ENEMY.ROBOT)
    if (robotRiser && robotE) {
      robotRiser.setPosition(robotE.col, robotE.row)
      const d = Math.hypot(robotE.col - p.col, robotE.row - p.row)
      robotRiser.setGain(robotRiser.gainBase * (d <= 3 ? 1 : Math.min(1, Math.pow(3 / d, 0.95))))
      robotRiser.applyBehind(content.audio.behindness(robotE.col, robotE.row))
    }
    if (robotSpeedupUntil && now >= robotSpeedupUntil) {
      robotSpeedupUntil = 0
      if (robotRiser) { robotRiser.stop(); robotRiser = null }
      content.audio.itemOff('robotSpeedup', robotE ? {col: robotE.col, row: robotE.row} : null)
    }

    // Nasty spawn timer.
    if (lvl.timer >= lvl.nastyNextAt) { spawnNasty(); scheduleNextNasty() }

    // Items are static IN THE WORLD, but the listener is player-relative (the
    // player is always centred), so their position relative to the player —
    // and thus their pan / binaural placement — changes every time the player
    // moves. setPosition recomputes that each frame; without it the stereo
    // image freezes at wherever the item was when it spawned.
    for (const it of lvl.goodItems) {
      const v = goodVoices.get(it.id)
      if (v) {
        v.setPosition(it.col, it.row)
        v.setGain(0.1 * beaconGain(it, p))
        v.applyBehind(content.audio.behindness(it.col, it.row))
      }
    }
    for (const it of lvl.nastyItems) {
      const v = nastyVoices.get(it.id)
      if (v) {
        v.setPosition(it.col, it.row)
        v.setGain(0.1 * beaconGain(it, p))
        v.applyBehind(content.audio.behindness(it.col, it.row))
      }
    }

    // Bombs.
    for (let i = lvl.bombs.length - 1; i >= 0; i--) {
      const b = lvl.bombs[i]
      b.fuse -= engine.loop.delta()
      if (now - b.lastTick > Math.max(0.12, b.fuse * 0.15)) { b.lastTick = now; content.audio.bombTick({col: b.col, row: b.row}) }
      if (b.fuse <= 0) {
        content.audio.bombExplode({col: b.col, row: b.row})
        const d = Math.hypot(b.col - p.col, b.row - p.row)
        if (d < 4 && !S().isInvisible()) {
          const dmg = Math.round(40 * (1 - d / 4))
          if (dmg > 0) content.player.applyDamage(dmg, C().DEATH.BOMB)
        }
        lvl.bombs.splice(i, 1)
      }
    }

    // Hazard ttl + presence cue (periodic filtered double hiss when near) +
    // nearby warning.
    for (let i = lvl.hazardCells.length - 1; i >= 0; i--) {
      const h = lvl.hazardCells[i]
      h.ttl -= engine.loop.delta()
      if (h.ttl <= 0) { lvl.hazardCells.splice(i, 1); continue }
      const d = Math.hypot(h.col - p.col, h.row - p.row)
      if (d < 7 && now - (h.lastHiss || 0) > 1.3) { h.lastHiss = now; content.audio.hazardHiss({col: h.col, row: h.row}) }
      if (d < 3) content.announcer.warn('hazard')
    }
  }

  // Distance falloff for both item kinds. NO floor — the per-frame gain is what
  // actually fades the voice with distance (the StereoPanner path in makeProp
  // has no distance model of its own), so a floor here would keep items audible
  // everywhere. These are CONTINUOUS tones (unlike the coins' intermittent
  // metallic pings), so an equal peak/curve reads as far louder; keep the near
  // plateau small and the rolloff steep so a beacon is only prominent when the
  // player is close and fades hard across the field.
  function beaconGain(it, p) {
    const d = Math.hypot(it.col - p.col, it.row - p.row)
    return d <= 2 ? 1 : Math.min(1, Math.pow(2 / d, 1.7))
  }

  // ----- collisions -----
  function checkCollisions() {
    const lvl = S().level()
    const p = S().player()
    if (!lvl || !p) return null

    // Good items: player grab.
    for (let i = lvl.goodItems.length - 1; i >= 0; i--) {
      const it = lvl.goodItems[i]
      if (Math.hypot(it.col - p.col, it.row - p.row) <= GRAB_RADIUS) {
        content.scoring.award('collectGood')
        content.audio.pickupGood({col: it.col, row: it.row})
        content.announcer.itemGot('item.' + it.effectId)
        applyGoodEffect(it.effectId)
        killGood(it.id)
        lvl.goodItems.splice(i, 1)
      }
    }

    // Nasty items: player grab = denial.
    for (let i = lvl.nastyItems.length - 1; i >= 0; i--) {
      const it = lvl.nastyItems[i]
      if (Math.hypot(it.col - p.col, it.row - p.row) <= GRAB_RADIUS) {
        content.audio.pickupGood({col: it.col, row: it.row})
        killNasty(it.id)
        lvl.nastyItems.splice(i, 1)
      }
    }

    // Hazard zones: damage on entry. Game over (if any) is detected centrally
    // from health <= 0 in game.play(); no death cause is returned here.
    if (!S().isInvisible()) {
      for (const h of lvl.hazardCells) {
        const inside = Math.hypot(h.col - p.col, h.row - p.row) <= HAZARD_RADIUS
        if (inside && !h.inside) content.player.applyDamage(22, C().DEATH.HAZARD)
        h.inside = inside
      }
    }
    return null
  }

  // Robot grabbing items: good -> deny player; nasty -> trigger effect.
  function tryEnemyGrab(enemy) {
    const lvl = S().level()
    if (enemy.type === C().ENEMY.ROBOT) {
      for (let i = lvl.nastyItems.length - 1; i >= 0; i--) {
        const it = lvl.nastyItems[i]
        if (Math.hypot(it.col - enemy.col, it.row - enemy.row) <= GRAB_RADIUS) {
          killNasty(it.id)
          const kind = it.kind
          lvl.nastyItems.splice(i, 1)
          applyNastyEffect(kind)
        }
      }
    }
    for (let i = lvl.goodItems.length - 1; i >= 0; i--) {
      const it = lvl.goodItems[i]
      if (Math.hypot(it.col - enemy.col, it.row - enemy.row) <= GRAB_RADIUS) {
        killGood(it.id)
        lvl.goodItems.splice(i, 1)
      }
    }
  }

  function clearAllNasty() {
    const lvl = S().level()
    for (const it of lvl.nastyItems) killNasty(it.id)
    lvl.nastyItems.length = 0
    lvl.bombs.length = 0
    lvl.hazardCells.length = 0
  }

  return {
    reset,
    spawnGood,
    spawnNasty,
    applyGoodEffect,
    applyNastyEffect,
    tryEnemyGrab,
    clearAllNasty,
    frame,
    checkCollisions,
    silenceAll,
    previewNasty,
    previewGood,
    bombs: () => S().level().bombs,
    hazardCells: () => S().level().hazardCells,
  }
})()
