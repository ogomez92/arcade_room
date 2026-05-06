// Top-level game FSM and scoring. The game-screen onFrame calls
// content.game.update(delta); this module updates batteries, outgoing,
// blasts, threats, wave, and the crosshair, plus advances phase
// transitions.
content.game = (() => {
  const STATE_INTRO       = 'intro'        // brief delay before first wave starts
  const STATE_READY       = 'ready'        // tiny "wave N" beat
  const STATE_PLAY        = 'play'
  const STATE_WAVE_CLEAR  = 'waveClear'    // delay so audio finishes
  const STATE_GAME_OVER   = 'gameOver'

  const S = () => content.state

  function startNewGame() {
    S().resetForNewGame()
    content.cities.init()
    content.batteries.init()
    content.threats.clearAll()
    content.outgoing.clear()
    content.blasts.clear()
    content.wave.reset()
    S().wave = 0
    S().phase = STATE_INTRO
    S().phaseTimer = 1.4
  }

  function _beginWave() {
    S().wave += 1
    content.wave.start(S().wave)
    // Refill ammo at the start of every wave.
    content.batteries.init()
    S().phase = STATE_READY
    S().phaseTimer = 1.0
    content.events.emit('wave-start', {wave: S().wave})
  }

  function addScore(n) {
    const before = S().score
    S().score += n
    while (S().score >= S().nextBonusAt) {
      S().nextBonusAt += 10000
      const idx = content.cities.firstDestroyedIndex()
      if (idx >= 0) content.cities.restore(idx)
    }
    content.events.emit('score-change', {score: S().score, delta: S().score - before})
  }

  function update(delta) {
    if (S().paused) return
    S().phaseTimer -= delta

    switch (S().phase) {
      case STATE_INTRO:
        if (S().phaseTimer <= 0) _beginWave()
        break

      case STATE_READY:
        if (S().phaseTimer <= 0) {
          S().phase = STATE_PLAY
          S().phaseTimer = 0
        }
        break

      case STATE_PLAY:
        content.crosshair.tick(delta)
        content.batteries.tick(delta)
        content.outgoing.tick(delta)
        content.blasts.tick(delta)
        content.threats.tick(delta)
        content.wave.tick(delta)

        // Loss: all six cities gone.
        if (content.cities.aliveCount() === 0) {
          // Clear remaining threats audibly.
          content.threats.clearAll()
          content.outgoing.clear()
          S().phase = STATE_WAVE_CLEAR
          S().phaseTimer = 1.6 // let final swoop / blasts finish before transition
          content.events.emit('all-cities-lost')
        }
        // Wave clear (no enemies left).
        else if (content.wave.isCleared()) {
          const survMissiles = content.batteries.totalAmmo()
          const survCities = content.cities.aliveCount()
          const bonus = content.wave.bonus(survMissiles, survCities)
          addScore(bonus)
          content.events.emit('wave-clear', {wave: S().wave, bonus, missiles: survMissiles, cities: survCities})
          S().phase = STATE_WAVE_CLEAR
          S().phaseTimer = 2.0
        }
        break

      case STATE_WAVE_CLEAR:
        if (S().phaseTimer <= 0) {
          if (content.cities.aliveCount() === 0) {
            S().phase = STATE_GAME_OVER
            content.events.emit('game-over', {score: S().score, wave: S().wave})
          } else {
            _beginWave()
          }
        }
        break

      case STATE_GAME_OVER:
        // Held until screen transitions out.
        break
    }
  }

  // Wiring: when threats are killed by blast, score them. Pacman-style
  // wiring lives here so scoring rules are next to the FSM.
  content.events.on('threat-killed', (e) => {
    let pts = 25
    if (e.kind === 'splitter') pts = 75
    else if (e.kind === 'bomber') pts = 100
    else if (e.kind === 'bomb') pts = 50
    addScore(pts)
  })

  return {
    update, startNewGame, addScore,
    setPaused: (v) => S().paused = !!v,
    isPaused: () => S().paused,
    isPlaying: () => S().phase === STATE_PLAY,
    phase: () => S().phase,
    STATE_INTRO, STATE_READY, STATE_PLAY, STATE_WAVE_CLEAR, STATE_GAME_OVER,
  }
})()
