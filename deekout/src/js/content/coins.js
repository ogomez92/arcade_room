// Coin field. Coins sit on grid cells; each voiced coin owns a looping
// spatial tone (per-instance pitch jitter so adjacent coins stay
// distinguishable). To bound voice count, only the nearest set is voiced:
// all-mode voices the nearest VOICE_CAP, single-mode voices career.nearestCount
// (1-5). Pickup is automatic when the player rolls within PICKUP_RADIUS of a
// coin's cell (align the column by ear, then close the distance). References
// siblings lazily.
content.coins = (() => {
  const C = () => content.constants
  const S = () => content.state

  const VOICE_CAP = 3
  const COIN_BASE_HZ = 820

  const voices = new Map()  // coinId -> prop
  let rapidEnabled = true

  function startVoice(coin) {
    const prop = content.audio.makeProp({
      col: coin.col, row: coin.row, gain: 0, maxDistance: 26, power: 1.5,
      build: (out, ctx, detune) => {
        // A looping metallic BOUNCE beacon: a steady, even run of struck-metal
        // pings at a CONSTANT tempo and CONSTANT level — no settle, no fade, no
        // rests — so it reads as something metallic skittering on the floor and
        // keeps urging you to grab it. coin.pitch (jittered per coin) keeps
        // adjacent coins distinguishable; the stereo panner carries L/R so the
        // timbre stays bright-metallic without being piercing.
        const f = coin.pitch
        const interval = 0.17
        let stopped = false
        let timer = null
        let nextT = ctx.currentTime + 0.06

        function ping(t) {
          // Struck-metal: fundamental + two inharmonic partials, fast decay.
          // Every ping is identical — the bounce stays even, never settles.
          const peak = 0.30
          const partials = [[1, peak, 0.11], [2.76, peak * 0.42, 0.06], [5.40, peak * 0.18, 0.04]]
          for (const [mult, pk, dec] of partials) {
            const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * mult
            if (detune) detune.connect(o.detune)
            const g = ctx.createGain()
            g.gain.setValueAtTime(0.0001, t)
            g.gain.linearRampToValueAtTime(pk, t + 0.0015)
            g.gain.exponentialRampToValueAtTime(0.00001, t + 0.0015 + dec)
            o.connect(g).connect(out)
            o.start(t); o.stop(t + 0.0015 + dec + 0.02)
          }
        }

        // Audio-clock lookahead: refill ~120ms ahead so setTimeout jitter never
        // gaps the rhythm.
        function pump() {
          if (stopped) return
          const horizon = ctx.currentTime + 0.12
          while (nextT < horizon) {
            ping(nextT)
            nextT += interval
          }
          timer = setTimeout(pump, 30)
        }
        pump()
        return [() => { stopped = true; if (timer) clearTimeout(timer) }]
      },
    })
    voices.set(coin.id, prop)
    return prop
  }

  function killVoice(id) {
    const v = voices.get(id)
    if (v) { v.destroy(); voices.delete(id) }
  }

  function silenceAll() {
    for (const id of [...voices.keys()]) killVoice(id)
  }

  function occupied() {
    const set = new Set()
    const lvl = S().level()
    for (const c of lvl.coins) set.add(c.col + ',' + c.row)
    return set
  }

  function placeCoins(count, opts = {}) {
    const lvl = S().level()
    const taken = occupied()
    let placed = 0
    for (let i = 0; i < count; i++) {
      const cell = content.field.randomFreeCell((col, row) => !taken.has(col + ',' + row), {minFromPlayer: opts.minFromPlayer || 2})
      if (!cell) break
      taken.add(cell.col + ',' + cell.row)
      const id = S().nextId()
      lvl.coins.push({
        id,
        col: cell.col,
        row: cell.row,
        pitch: content.audio.jitter(COIN_BASE_HZ, 'coin' + id),
        special: !!opts.special,
        collected: false,
      })
      placed++
    }
    return placed
  }

  // Fresh coins for a new level.
  function spawnLevel(count) {
    silenceAll()
    placeCoins(count, {minFromPlayer: 3})
  }

  // Extra batch from a coin-spawn good item. Enables the full-bonus early end.
  function spawnBatch(n) {
    const lvl = S().level()
    placeCoins(n, {minFromPlayer: 1})
    lvl.coinSpawnUsed = true
    lvl.earlyEndAllowed = true
  }

  function nearestSet() {
    const lvl = S().level()
    const p = S().player()
    const active = lvl.coins.filter((c) => !c.collected)
    const cap = S().career().coinMode === C().COIN_MODE.SINGLE
      ? Math.max(1, Math.min(5, S().career().nearestCount))
      : VOICE_CAP
    active.sort((a, b) => dist2(a, p) - dist2(b, p))
    return active.slice(0, cap)
  }

  function dist2(c, p) {
    const dc = c.col - p.col, dr = c.row - p.row
    return dc * dc + dr * dr
  }

  function frame() {
    const lvl = S().level()
    const p = S().player()
    if (!lvl || !p) return

    const set = nearestSet()
    const setIds = new Set(set.map((c) => c.id))

    // Drop voices no longer in the audible set.
    for (const id of [...voices.keys()]) {
      if (!setIds.has(id)) killVoice(id)
    }

    // Voice + shape the audible set; auto-collect on contact. `set` is sorted
    // nearest-first, so rank 0 is the closest coin.
    const R = C().PLAYER.pickupRadius
    set.forEach((coin, rank) => {
      let v = voices.get(coin.id)
      if (!v) v = startVoice(coin)
      v.setPosition(coin.col, coin.row)
      const d = Math.hypot(coin.col - p.col, coin.row - p.row)
      const dGain = d <= 1.5 ? 1 : Math.min(1, Math.pow(1.5 / d, 1.4))
      // Smart focus: the nearest coin dominates; farther voiced coins are
      // attenuated by rank so they're faint hints, not competition for
      // centring on the one you're chasing.
      const rankMul = rank === 0 ? 1 : (rank === 1 ? 0.38 : 0.16)
      v.setGain(0.2 * dGain * rankMul)
      v.applyBehind(content.audio.behindness(coin.col, coin.row))
      if (d <= R) collect(coin, 'player')
    })
  }

  function collect(coin) {
    if (coin.collected) return
    coin.collected = true
    killVoice(coin.id)

    if (coin.special || S().level().earlyEndAllowed) {
      content.audio.coinSpecial({col: coin.col, row: coin.row})
    } else {
      content.audio.coinDing({col: coin.col, row: coin.row}, coin.pitch)
    }

    if (content.scoring) content.scoring.award('coin')
    else S().career().score += C().POINTS.COIN

    recordRapid()
  }

  // Rapid-collect tracking: N coins within windowS seconds -> spawn a good item.
  function recordRapid() {
    if (!rapidEnabled) return
    const lvl = S().level()
    const car = S().career()
    const params = C().levelParams(car.difficulty, car.level)
    const now = engine.time()
    lvl.rapidWindow.push(now)
    const cutoff = now - params.rapidCoin.windowS
    lvl.rapidWindow = lvl.rapidWindow.filter((t) => t >= cutoff)
    if (lvl.rapidWindow.length >= params.rapidCoin.n) {
      lvl.rapidWindow = []
      if (content.items) content.items.spawnGood()
    }
  }

  function setMode(mode) {
    S().career().coinMode = mode
    if (content.announcer) content.announcer.coinMode(mode, S().career().nearestCount)
  }
  function toggleMode() {
    const m = S().career().coinMode === C().COIN_MODE.SINGLE ? C().COIN_MODE.ALL : C().COIN_MODE.SINGLE
    setMode(m)
  }
  function setNearestCount(n) {
    S().career().nearestCount = Math.max(1, Math.min(5, n | 0))
    S().career().coinMode = C().COIN_MODE.SINGLE
    if (content.announcer) content.announcer.coinMode(C().COIN_MODE.SINGLE, S().career().nearestCount)
  }

  function setRapidEnabled(on) { rapidEnabled = !!on }

  return {
    spawnLevel,
    spawnBatch,
    frame,
    collect,
    silenceAll,
    setMode,
    toggleMode,
    setNearestCount,
    setRapidEnabled,
    remaining: () => S().coinsRemaining(),
  }
})()
