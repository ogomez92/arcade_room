// High-level game state machine: score/lives/level, collision, intro/death/level-clear timing.
content.game = (() => {
  const STATE_INTRO = 'intro'
  const STATE_PLAY = 'play'
  const STATE_DEATH = 'death'
  const STATE_LEVEL_CLEAR = 'levelClear'
  const STATE_GAME_OVER = 'gameOver'
  const STATE_READY = 'ready'

  const state = {
    phase: STATE_INTRO,
    phaseTimer: 0,
    score: 0,
    lives: 3,
    level: 1,
    totalDots: 0,
    ghostPointsChain: 200,
    paused: false,
    difficulty: 'normal', // easy | normal | hard
  }

  function difficultyMultiplier() {
    if (state.difficulty === 'easy') return {pac: 0.85, ghost: 0.7}
    if (state.difficulty === 'hard') return {pac: 1.05, ghost: 1.15}
    return {pac: 1.0, ghost: 1.0}
  }

  // Power-pellet duration per level, from the Pac-Man Dossier table.
  // L19+ is 0 — power pellets stop frightening ghosts in the arcade too.
  const FRIGHTEN_BY_LEVEL = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 2, 1, 3, 1, 1, 1, 1]
  function frightenDuration() {
    const i = state.level - 1
    if (i < 0) return FRIGHTEN_BY_LEVEL[0]
    if (i >= FRIGHTEN_BY_LEVEL.length) return 0
    return FRIGHTEN_BY_LEVEL[i]
  }

  function applySpeeds() {
    // Per-level scaling now lives in pacman.pacmanFactor() and the ghost
    // speed-factor tables. This just applies the difficulty knob on top.
    const m = difficultyMultiplier()
    content.pacman.setSpeedMultiplier(m.pac)
    content.ghosts.setSpeedMultiplier(m.ghost)
  }

  function startNewGame() {
    state.score = 0
    state.lives = 3
    state.level = 1
    startLevel()
  }

  function startLevel() {
    content.maze.reset()
    state.totalDots = content.maze.dotsRemaining()
    content.fruit.reset()
    content.pacman.reset()
    content.ghosts.reset(state.level)
    applySpeeds()
    state.phase = STATE_INTRO
    // Hold long enough for the intro jingle to finish before play starts.
    // The jingle runs ~3.1s (8 beats at 168 BPM + held tonic tail).
    state.phaseTimer = 3.2
    state.ghostPointsChain = 200
    content.events.emit('level-start', {level: state.level})
  }

  function ready() {
    state.phase = STATE_READY
    state.phaseTimer = 0.4
  }

  function play() {
    state.phase = STATE_PLAY
    state.phaseTimer = 0
  }

  function checkCollisions() {
    const p = content.pacman.getPosition()
    // Fruit
    const fp = content.fruit.getPosition()
    if (fp) {
      const dx = p.x - fp.x, dy = p.y - fp.y
      if (dx*dx + dy*dy < 0.36) {
        const r = content.fruit.consume()
        if (r) addScore(r.points)
      }
    }
    // Ghosts
    for (const g of content.ghosts.getAll()) {
      if (g.inHouse || g.mode === 'leavingHouse') continue
      const dx = p.x - g.x, dy = p.y - g.y
      if (dx*dx + dy*dy < 0.36) {
        if (g.mode === 'frightened') {
          content.ghosts.consume(g)
          addScore(state.ghostPointsChain)
          content.events.emit('ghost-eaten', {name: g.name, points: state.ghostPointsChain, x: g.x, y: g.y})
          state.ghostPointsChain *= 2
        } else if (g.mode === 'eaten') {
          // ignore
        } else {
          // Death
          content.pacman.die()
          state.phase = STATE_DEATH
          state.phaseTimer = 2.5
          content.events.emit('life-lost')
          return
        }
      }
    }
  }

  function addScore(n) {
    const before = state.score
    state.score += n
    // Extra life at 10000
    if (before < 10000 && state.score >= 10000) {
      state.lives++
      content.events.emit('extra-life')
    }
    content.events.emit('score-change', {score: state.score})
  }

  function update(delta) {
    if (state.paused) return
    state.phaseTimer -= delta

    switch (state.phase) {
      case STATE_INTRO:
        if (state.phaseTimer <= 0) ready()
        break
      case STATE_READY:
        if (state.phaseTimer <= 0) play()
        break
      case STATE_PLAY:
        content.pacman.update(delta)
        content.ghosts.update(delta)
        content.fruit.update(delta)
        content.fruit.tryTriggerSpawn(state.level, state.totalDots, content.maze.dotsRemaining())
        checkCollisions()
        // End frightened reset chain
        if (!content.ghosts.isAnyFrightened() && state.ghostPointsChain > 200) {
          state.ghostPointsChain = 200
        }
        // Level clear
        if (content.maze.dotsRemaining() === 0) {
          state.phase = STATE_LEVEL_CLEAR
          state.phaseTimer = 2.5
          content.events.emit('level-clear', {level: state.level})
        }
        break
      case STATE_DEATH:
        if (state.phaseTimer <= 0) {
          state.lives--
          if (state.lives < 0) {
            state.phase = STATE_GAME_OVER
            content.events.emit('game-over', {score: state.score})
          } else {
            content.pacman.reset()
            content.ghosts.reset(state.level)
            content.fruit.reset()
            ready()
          }
        }
        break
      case STATE_LEVEL_CLEAR:
        if (state.phaseTimer <= 0) {
          state.level++
          startLevel()
        }
        break
      case STATE_GAME_OVER:
        // wait for screen transition
        break
    }
  }

  // Wire pellet/power events to scoring
  content.events.on('eat-pellet', () => addScore(10))
  content.events.on('eat-power', () => {
    addScore(50)
    content.ghosts.frighten()
    state.ghostPointsChain = 200
  })

  return {
    state,
    update,
    startNewGame,
    addScore,
    setPaused: (v) => state.paused = v,
    isPaused: () => state.paused,
    setDifficulty: (d) => { state.difficulty = d; applySpeeds() },
    frightenDuration,
    isPlaying: () => state.phase === STATE_PLAY,
    phase: () => state.phase,
    STATE_INTRO, STATE_PLAY, STATE_DEATH, STATE_LEVEL_CLEAR, STATE_GAME_OVER, STATE_READY,
  }
})()
