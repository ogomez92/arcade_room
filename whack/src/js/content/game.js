content.game = (() => {
  const cfg = () => content.config

  // Per-slot popup state. Only one popup can be active per slot at a time;
  // multiple slots can be active simultaneously.
  const slotState = new Map() // key -> {active, popAt, hideAt, hit}

  let running = false
  let elapsed = 0
  let nextSpawnAt = 0
  let score = 0
  let misses = 0
  let level = 1
  let _onGameOver = null

  function reset() {
    slotState.clear()
    for (const s of cfg().slots) {
      slotState.set(s.key, {active: false, popAt: 0, hideAt: 0, hit: false})
    }
    elapsed = 0
    nextSpawnAt = 0
    score = 0
    misses = 0
    level = 1
  }

  // Difficulty curves driven by elapsed seconds.
  function difficulty() {
    // Spawn cadence: starts 1.5s, decays to 0.45s by ~90s elapsed.
    const spawnInterval = Math.max(0.45, 1.5 - elapsed * 0.013)
    // Visible duration: starts 1.9s, decays to 0.7s by ~70s.
    const popDuration = Math.max(0.7, 1.9 - elapsed * 0.018)
    // Max concurrent popups: 1 -> 4 by 80s.
    const maxConcurrent = Math.min(4, 1 + Math.floor(elapsed / 22))
    const newLevel = Math.max(1, 1 + Math.floor(elapsed / 18))
    return {spawnInterval, popDuration, maxConcurrent, level: newLevel}
  }

  function activeCount() {
    let n = 0
    for (const v of slotState.values()) if (v.active) n++
    return n
  }

  function spawnOne(now, popDuration) {
    const free = cfg().slots.filter((s) => !slotState.get(s.key).active)
    if (free.length === 0) return
    const pick = free[Math.floor(Math.random() * free.length)]
    const st = slotState.get(pick.key)
    st.active = true
    st.hit = false
    st.popAt = now
    st.hideAt = now + popDuration
    content.creatures.play(pick, 'pop')
    const name = app.i18n.t('critter.' + pick.critter)
    const dir = app.i18n.t('dir.' + pick.dir)
    app.announce.polite(app.i18n.t('ann.pop', {name, direction: dir}))
  }

  function update(delta) {
    if (!running) return
    elapsed += delta
    const d = difficulty()

    if (d.level !== level) {
      level = d.level
      const layer = Math.min(4, 1 + Math.floor((level - 1) / 2))
      content.music.setLayer(layer)
      app.announce.assertive(app.i18n.t('ann.levelUp', {level}))
      const el = document.querySelector('.js-level')
      if (el) el.textContent = String(level)
    }

    const now = engine.time()

    // Process timeouts (creatures that escaped without being hit).
    for (const s of cfg().slots) {
      const st = slotState.get(s.key)
      if (st.active && !st.hit && now >= st.hideAt) {
        st.active = false
        content.creatures.play(s, 'hide')
        registerMiss()
      }
    }

    // Spawn new popups when due.
    if (running && elapsed >= nextSpawnAt) {
      nextSpawnAt = elapsed + d.spawnInterval
      if (activeCount() < d.maxConcurrent) {
        spawnOne(now, d.popDuration)
      }
    }
  }

  function registerMiss() {
    misses++
    content.music.duck()
    app.announce.assertive(app.i18n.t('ann.miss'))
    const me = document.querySelector('.js-misses')
    if (me) me.textContent = String(Math.max(0, cfg().MAX_MISSES - misses))
    if (misses >= cfg().MAX_MISSES) {
      end()
    }
  }

  function whack(slotKey) {
    if (!running) return {kind: 'inactive'}
    const slot = cfg().slotByKey(slotKey)
    if (!slot) return {kind: 'invalid'}
    const st = slotState.get(slot.key)
    content.hammer.whoosh(slot)
    if (!st.active || st.hit) {
      return {kind: 'whoosh'}
    }
    // Hit. Compute timing-based score: 1.0 fresh, 0.0 about-to-hide.
    const now = engine.time()
    const span = st.hideAt - st.popAt
    const remaining = Math.max(0, st.hideAt - now)
    const fraction = span > 0 ? Math.max(0, Math.min(1, remaining / span)) : 1
    const earned = Math.round(30 + fraction * 120) // 30..150
    score += earned
    st.hit = true
    st.active = false
    content.hammer.thwack(slot)
    content.creatures.play(slot, 'bonk')
    const sc = document.querySelector('.js-score')
    if (sc) sc.textContent = String(score)
    return {kind: 'hit', earned, fraction}
  }

  function start(onGameOver) {
    reset()
    _onGameOver = onGameOver || null
    running = true
    content.audio.start()
    content.music.start()
    content.music.setLayer(1)
    nextSpawnAt = 1.0 // first popup ~1s in
    const sc = document.querySelector('.js-score')
    const me = document.querySelector('.js-misses')
    const lv = document.querySelector('.js-level')
    if (sc) sc.textContent = '0'
    if (me) me.textContent = String(cfg().MAX_MISSES)
    if (lv) lv.textContent = '1'
    app.announce.assertive(app.i18n.t('ann.start'))
  }

  function end() {
    if (!running) return
    running = false
    content.music.stop()
    // Silence any active popups (no further state changes).
    for (const s of cfg().slots) {
      const st = slotState.get(s.key)
      if (st.active && !st.hit) {
        st.active = false
      }
    }
    const isNew = app.highscores.submit(score)
    app.announce.assertive(app.i18n.t('ann.gameOver', {score}))
    if (_onGameOver) _onGameOver({score, level, isNew})
  }

  function abort() {
    if (!running) return
    running = false
    content.music.stop()
    for (const s of cfg().slots) {
      const st = slotState.get(s.key)
      st.active = false
    }
  }

  reset()

  return {
    start,
    end,
    abort,
    update,
    whack,
    isRunning: () => running,
    score: () => score,
    misses: () => misses,
    level: () => level,
    missesLeft: () => Math.max(0, cfg().MAX_MISSES - misses),
  }
})()
