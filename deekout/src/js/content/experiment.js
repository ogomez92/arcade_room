// Experiment components + inventory. On flagged levels, numbered pieces are
// strewn about; collecting them in ASCENDING order grants a one-shot
// inventory item (Neutralizer / Collector / Wall Fusion), DESCENDING grants a
// batch of oil slicks, and a wrong order makes them all vanish. Also owns the
// inventory-use side effects (E/C/W/S) and oil-slick collisions. Lazy refs.
content.experiment = (() => {
  const C = () => content.constants
  const S = () => content.state

  const PIECE_RADIUS = 1.2
  const OIL_RADIUS = 0.7
  const MIN_SEPARATION = 11 // cells; spread experiment pieces across the field
  const voices = new Map()       // pieceNum -> prop

  function init(level) {
    silenceVoices()
    const lvl = S().level()
    lvl.experimentPieces = []
    lvl.expExpectedNext = 1
    lvl.expDirection = null
    if (!C().isExperimentLevel(level)) return
    const count = 3 + (level % 3) // 3..5
    const taken = new Set()
    const placed = []
    for (let i = 1; i <= count; i++) {
      // Spread pieces across the field: prefer a cell far from every piece
      // already placed, relaxing the minimum separation if the board is crowded.
      let cell = null
      for (let minSep = MIN_SEPARATION; minSep >= 0 && !cell; minSep -= 3) {
        for (let attempt = 0; attempt < 24; attempt++) {
          const cand = content.field.randomFreeCell((col, row) => !taken.has(col + ',' + row), {minFromPlayer: 4})
          if (!cand) break
          if (placed.every((q) => Math.hypot(q.col - cand.col, q.row - cand.row) >= minSep)) { cell = cand; break }
        }
      }
      if (!cell) break
      taken.add(cell.col + ',' + cell.row)
      placed.push(cell)
      lvl.experimentPieces.push({num: i, col: cell.col, row: cell.row, collected: false})
    }
    lvl._expCount = lvl.experimentPieces.length
    for (const piece of lvl.experimentPieces) startVoice(piece)
    if (lvl.experimentPieces.length) content.announcer.info(app.i18n.t('ann.experiment', {n: 1}))
  }

  function startVoice(piece) {
    const prop = content.audio.makeProp({
      col: piece.col, row: piece.row, gain: 0.12, maxDistance: 30, power: 1.4,
      build: (out, ctx, detune) => {
        const base = 523.25 * Math.pow(2, ((piece.num - 1) % 8) / 12)
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = base
        if (detune) detune.connect(o.detune)
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = base * 3
        const g2 = ctx.createGain(); g2.gain.value = 0.12
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 4
        const lg = ctx.createGain(); lg.gain.value = 0.5
        const tg = ctx.createGain(); tg.gain.value = 0.5
        lfo.connect(lg).connect(tg.gain)
        o.connect(tg).connect(out)
        o2.connect(g2).connect(out)
        o.start(); o2.start(); lfo.start()
        return [() => { try { o.stop() } catch (e) {} }, () => { try { o2.stop() } catch (e) {} }, () => { try { lfo.stop() } catch (e) {} }]
      },
    })
    voices.set(piece.num, prop)
  }

  function killVoice(num) { const v = voices.get(num); if (v) { v.destroy(); voices.delete(num) } }
  function silenceVoices() { for (const n of [...voices.keys()]) killVoice(n) }

  function frame() {
    const lvl = S().level()
    const p = S().player()
    if (!lvl) return

    for (const piece of lvl.experimentPieces) {
      if (piece.collected) continue
      const v = voices.get(piece.num)
      if (v) {
        const d = Math.hypot(piece.col - p.col, piece.row - p.row)
        v.setGain(0.16 * (d <= 2 ? 1 : Math.min(1, Math.pow(2 / d, 1.4))))
        v.applyBehind(content.audio.behindness(piece.col, piece.row))
      }
    }

    // Robot slipping on an oil slick.
    if (content.enemies) {
      for (const e of content.enemies.list()) {
        if (!e.alive) continue
        for (let i = lvl.oilSlicks.length - 1; i >= 0; i--) {
          const o = lvl.oilSlicks[i]
          if (Math.hypot(o.col - e.col, o.row - e.row) <= OIL_RADIUS) {
            content.enemies.kill(e.id, C().DEATH.OIL)
            break
          }
        }
      }
    }
  }

  function checkCollisions() {
    const lvl = S().level()
    const p = S().player()
    if (!lvl || !p) return null

    for (const piece of lvl.experimentPieces) {
      if (piece.collected) continue
      if (Math.hypot(piece.col - p.col, piece.row - p.row) <= PIECE_RADIUS) pickup(piece)
    }

    // Player slipping on their own oil slick.
    if (!S().isInvisible()) {
      for (const o of lvl.oilSlicks) {
        if (Math.hypot(o.col - p.col, o.row - p.row) <= OIL_RADIUS) return C().DEATH.OIL
      }
    }
    return null
  }

  function pickup(piece) {
    const lvl = S().level()
    const count = lvl._expCount || lvl.experimentPieces.length

    // Decide direction on the first pickup.
    if (lvl.expDirection == null) {
      if (piece.num === 1) { lvl.expDirection = 'asc'; lvl.expExpectedNext = 1 }
      else if (piece.num === count) { lvl.expDirection = 'desc'; lvl.expExpectedNext = count }
      else { vanish(); return }
    }

    if (piece.num !== lvl.expExpectedNext) { vanish(); return }

    piece.collected = true
    killVoice(piece.num)
    content.audio.experimentTone(piece.num, {col: piece.col, row: piece.row})
    content.announcer.experimentNumber(piece.num)
    lvl.expExpectedNext += (lvl.expDirection === 'asc' ? 1 : -1)

    const done = lvl.experimentPieces.every((x) => x.collected)
    if (done) complete(lvl.expDirection)
  }

  function vanish() {
    const lvl = S().level()
    for (const piece of lvl.experimentPieces) { piece.collected = true; killVoice(piece.num) }
    content.announcer.info(app.i18n.t('ann.robotLaugh'))
  }

  function complete(direction) {
    content.scoring.award('experiment')
    const car = S().career()
    if (direction === 'asc') {
      const pool = [C().INV.NEUTRALIZER, C().INV.COLLECTOR, C().INV.FUSION]
      grantInventory(pool[Math.floor(Math.random() * pool.length)])
    } else {
      car.inventory.S += 5
      content.announcer.info(app.i18n.t('ann.gotItem', {item: app.i18n.t('item.coinSpawn')}))
    }
    content.audio.pickupGood(content.audio.playerPos())
  }

  function grantInventory(id) {
    S().career().inventory[id]++
  }

  // ----- inventory use (keys E/C/W/S) -----
  function useInventory(id) {
    const car = S().career()
    if (!car || !content.game.isPlaying()) return
    if ((car.inventory[id] || 0) <= 0) return
    switch (id) {
      case C().INV.NEUTRALIZER: content.items.clearAllNasty(); break
      case C().INV.COLLECTOR: collectAllPieces(); break
      case C().INV.FUSION: S().player().fusionArmed = true; break
      case C().INV.OIL: dropOil(); break
    }
    car.inventory[id]--
    content.audio.itemDispatch()
    content.announcer.inventory()
  }

  function collectAllPieces() {
    const lvl = S().level()
    const remaining = lvl.experimentPieces.filter((x) => !x.collected)
    if (!remaining.length) return
    for (const piece of remaining) { piece.collected = true; killVoice(piece.num) }
    content.scoring.award('experiment')
    content.audio.pickupGood(content.audio.playerPos())
  }

  function dropOil() {
    const lvl = S().level()
    const p = S().player()
    const dir = p.lastMoveDir || {dx: 0, dy: -1}
    const col = content.field.clamp(Math.round(p.col + dir.dx))
    const row = content.field.clamp(Math.round(p.row + dir.dy))
    lvl.oilSlicks.push({id: S().nextId(), col, row})
    content.audio.oilDrop({col, row})
  }

  function reset() {
    silenceVoices()
  }

  return {
    init,
    frame,
    checkCollisions,
    pickup,
    grantInventory,
    useInventory,
    dropOil,
    reset,
    silenceAll: silenceVoices,
  }
})()
