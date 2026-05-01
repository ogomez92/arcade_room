/**
 * FIRE! — game logic / scoring / progression.
 *
 * Internal FSM (separate from the screen FSM):
 *   idle → running → levelClear → running (next level)
 *                  → gameOver
 *
 * Per-level rules:
 *   - Spawn fires on a stochastic timer; rate climbs with level.
 *   - Each level has a "quota" of fires the player must extinguish to clear.
 *   - Fire growth and HP-drain accelerate with level.
 *   - Combo: extinguish a fire within COMBO_WINDOW of the previous one for
 *     a multiplier on the score (combo resets to x1 after window).
 *   - Lose condition: lostCount() >= MAX_LOST.
 */
content.game = (() => {
  const F = () => content.fires
  const A = () => content.audio
  const M = () => content.music
  const H = () => content.hose

  const MAX_LOST = 3
  const COMBO_WINDOW = 2.0

  let state = 'idle' // 'idle' | 'running' | 'levelClear' | 'gameOver'
  let level = 1
  let score = 0
  let comboMult = 1
  let comboTimer = 0
  let extinguishedThisLevel = 0
  let nextSpawnAt = 0
  let levelClearAt = 0
  let gameOverAt = 0
  let levelStartTime = 0
  let onStateChange = null

  function levelConfig(L) {
    return {
      quota: 6 + (L - 1) * 2,                       // 6, 8, 10, ...
      growthRate: 0.12 + (L - 1) * 0.04,           // intensity per second
      spawnInterval: Math.max(1.6, 4.0 - (L - 1) * 0.35),
      initialIntensity: Math.min(0.7, 0.35 + (L - 1) * 0.04),
    }
  }

  function setState(next) {
    if (state === next) return
    state = next
    if (onStateChange) onStateChange(state)
  }

  function start() {
    F().start()
    H().start()
    M().start()
    F().reset()
    H().reset()
    score = 0
    level = 1
    comboMult = 1
    comboTimer = 0
    extinguishedThisLevel = 0
    nextSpawnAt = engine.time() + 1.5
    levelStartTime = engine.time()
    setState('running')
    F().onSpread(() => {
      app.announce.urgent(app.i18n.t('ann.spread'))
    })
    F().onLost(() => {
      const remaining = F().aliveCount()
      app.announce.urgent(app.i18n.t('ann.lost', {remaining}))
      if (F().lostCount() >= MAX_LOST) {
        triggerGameOver()
      }
    })
    F().onExtinguish((_b, points) => {
      // Combo logic
      const now = engine.time()
      if (comboTimer > now) {
        comboMult = Math.min(8, comboMult + 1)
      } else {
        comboMult = 1
      }
      comboTimer = now + COMBO_WINDOW
      const award = points * comboMult
      score += award
      extinguishedThisLevel++
      if (comboMult > 1) {
        app.announce.polite(app.i18n.t('ann.extinguishCombo', {points: award, mult: comboMult}))
      } else {
        app.announce.polite(app.i18n.t('ann.extinguish', {points: award}))
      }
      // Level clear?
      const cfg = levelConfig(level)
      if (extinguishedThisLevel >= cfg.quota) {
        triggerLevelClear()
      }
    })
    app.announce.urgent(app.i18n.t('ann.start', {level}))
  }

  function stopAudio() {
    try { F().silenceAll() } catch (_) {}
    try { H().silence() } catch (_) {}
    try { M().setIntensity(0) } catch (_) {}
  }

  function tearDown() {
    try { F().stop() } catch (_) {}
    try { H().stop() } catch (_) {}
    try { M().stop() } catch (_) {}
    setState('idle')
  }

  function triggerLevelClear() {
    if (state !== 'running') return
    setState('levelClear')
    A().emitLevelClear()
    const elapsed = engine.time() - levelStartTime
    // Fast-clear bonus
    const bonus = Math.max(0, Math.round((30 - elapsed) * 8) + level * 50)
    score += bonus
    app.announce.urgent(app.i18n.t('ann.levelClear', {level, bonus}))
    levelClearAt = engine.time() + 3.0
  }

  function triggerGameOver() {
    if (state === 'gameOver') return
    setState('gameOver')
    A().emitGameOver()
    F().silenceAll()
    H().silence()
    M().setIntensity(0)
    app.announce.urgent(app.i18n.t('ann.gameOver', {score}))
    gameOverAt = engine.time() + 1.8
  }

  function nextLevel() {
    level++
    F().reset()
    extinguishedThisLevel = 0
    levelStartTime = engine.time()
    nextSpawnAt = engine.time() + 1.0
    setState('running')
    app.announce.urgent(app.i18n.t('ann.start', {level}))
  }

  function tick(dt) {
    if (state === 'idle') return
    if (state === 'gameOver') {
      // Wait for sting to land before transitioning the screen.
      if (engine.time() >= gameOverAt) {
        if (app.screenManager.dispatch) {
          app.screenManager.dispatch('gameover')
        }
      }
      return
    }
    if (state === 'levelClear') {
      // Fire growth paused; just wait, then advance.
      F().updateAudio()
      H().frame(dt)
      M().setIntensity(Math.max(0.05, F().totalThreat()))
      if (engine.time() >= levelClearAt) nextLevel()
      return
    }
    // running
    const cfg = levelConfig(level)
    const now = engine.time()

    // Combo timer decay
    if (comboTimer && now > comboTimer) {
      comboMult = 1
    }

    // Spawn fires
    if (now >= nextSpawnAt) {
      F().spawnRandom(cfg.initialIntensity)
      nextSpawnAt = now + cfg.spawnInterval * (0.7 + Math.random() * 0.6)
    }

    // Fire growth
    F().tick(dt, cfg.growthRate)

    // Hose / spray
    H().frame(dt)

    // Audio updates
    F().updateAudio()

    // Music intensity follows total threat
    const threat = F().totalThreat()
    M().setIntensity(Math.min(1, 0.15 + threat * 0.95))
  }

  return {
    MAX_LOST, COMBO_WINDOW,
    start, tearDown, stopAudio,
    tick,
    state: () => state,
    level: () => level,
    score: () => score,
    comboMult: () => comboMult,
    extinguishedThisLevel: () => extinguishedThisLevel,
    quota: () => levelConfig(level).quota,
    onStateChange: (fn) => { onStateChange = fn },
  }
})()
