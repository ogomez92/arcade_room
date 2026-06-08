// Bonus rounds, played after clearing level 5, 15, 25, ... Driven by the
// game FSM's BONUS state, which calls frame() until isComplete(). Self
// contained: drives the player and listener directly and manages its own
// coins (Coin Shower) or bombs (Mine Field). Lazy sibling refs.
content.bonus = (() => {
  const C = () => content.constants
  const S = () => content.state

  const st = {
    kind: null,
    endAt: 0,
    done: false,
    extraPoints: 0,
    collectedGroups: 0,
    startCoins: 0,
    nextBombAt: 0,
    bombsSurvived: 0,
    diedEarly: false,
  }

  function pickKind() {
    return Math.random() < 0.5 ? C().BONUS.COIN_SHOWER : C().BONUS.MINE_FIELD
  }

  function start(kind) {
    const p = S().player()
    const g = C().GRID
    p.col = (g.cols - 1) / 2
    p.row = (g.rows - 1) / 2
    content.field.reset()
    content.player.clearHeld()
    if (content.enemies) content.enemies.silenceAll()
    if (content.bullets) content.bullets.clear()
    if (content.items) content.items.silenceAll()
    content.coins.silenceAll()

    const params = C().bonusParams(kind)
    st.kind = kind
    st.done = false
    st.extraPoints = 0
    st.collectedGroups = 0
    st.bombsSurvived = 0
    st.diedEarly = false
    st.endAt = engine.time() + params.durationS

    const lvl = S().level()
    lvl.coins = []
    lvl.bombs = []

    if (kind === C().BONUS.COIN_SHOWER) {
      content.coins.setRapidEnabled(false)
      content.coins.spawnLevel(params.coins)
      st.startCoins = S().coinsRemaining()
    } else {
      st.nextBombAt = engine.time() + 0.5
    }
    content.audio.bonusCue(kind)
  }

  function frame() {
    if (st.done) return
    const now = engine.time()
    content.player.frame()
    content.audio.frame()
    if (content.music) content.music.frame()

    if (st.kind === C().BONUS.COIN_SHOWER) coinShowerFrame()
    else mineFieldFrame(now)

    if (now >= st.endAt) finish()
  }

  function coinShowerFrame() {
    content.coins.frame()
    const collected = st.startCoins - S().coinsRemaining()
    const groups = Math.floor(collected / 5)
    if (groups > st.collectedGroups) {
      st.extraPoints += (groups - st.collectedGroups) * C().bonusParams(C().BONUS.COIN_SHOWER).per5Coins
      st.collectedGroups = groups
    }
    if (S().coinsRemaining() === 0) finish()
  }

  function mineFieldFrame(now) {
    const lvl = S().level()
    const p = S().player()
    const dt = engine.loop.delta()

    if (now >= st.nextBombAt) {
      const cell = content.field.randomFreeCell(null, {minFromPlayer: 0})
      if (cell) lvl.bombs.push({id: S().nextId(), col: cell.col, row: cell.row, fuse: 1.2 + Math.random() * 2, lastTick: 0})
      st.nextBombAt = now + 0.35 + Math.random() * 0.4
    }

    for (let i = lvl.bombs.length - 1; i >= 0; i--) {
      const b = lvl.bombs[i]
      b.fuse -= dt
      if (now - b.lastTick > Math.max(0.1, b.fuse * 0.15)) { b.lastTick = now; content.audio.bombTick({col: b.col, row: b.row}) }
      if (b.fuse <= 0) {
        content.audio.bombExplode({col: b.col, row: b.row})
        const d = Math.hypot(b.col - p.col, b.row - p.row)
        if (d < 3.5) {
          const dmg = Math.round(45 * (1 - d / 3.5))
          if (dmg > 0) {
            content.player.applyDamage(dmg)
            if (S().career().health <= 0) { st.diedEarly = true; finish(); return }
          }
        } else {
          st.bombsSurvived++
          st.extraPoints += C().bonusParams(C().BONUS.MINE_FIELD).perBombSurvived
        }
        lvl.bombs.splice(i, 1)
      }
    }
  }

  function finish() {
    if (st.done) return
    st.done = true
    if (st.kind === C().BONUS.MINE_FIELD && !st.diedEarly) {
      st.extraPoints += C().bonusParams(C().BONUS.MINE_FIELD).fullSurvive
    }
    content.coins.setRapidEnabled(true)
    content.coins.silenceAll()
    // Make sure health can't be left lethal coming out of a mine field.
    const car = S().career()
    if (car.health <= 0) car.health = 1
  }

  function isComplete() { return st.done }
  function result() { return {points: st.extraPoints} }
  function silenceAll() {
    content.coins.setRapidEnabled(true)
    content.coins.silenceAll()
  }

  return {pickKind, start, frame, isComplete, result, silenceAll}
})()
