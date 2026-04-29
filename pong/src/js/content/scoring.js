content.scoring = (() => {
  let playerScore = 0
  let aiScore = 0
  let scoreLimit = 7
  let state = 'idle'
  let servingPlayer = 'player'
  let serveTimer = 0
  let goalPauseTimer = 0
  let nextBeepIndex = 0
  let lastScorer = null

  function startServe(who) {
    servingPlayer = who
    serveTimer = content.table.SERVE_TIMEOUT
    nextBeepIndex = 0
    content.ball.setVelocity(0, 0)
    content.audio.playServeIndicator(who)
    if (who === 'player') {
      content.ball.setPosition(content.player.getX(), 0)
    } else {
      content.ball.setPosition(content.ai.getX(), content.table.LENGTH)
    }
    content.announcer.serveStart(who)
  }

  return {
    getState: () => state,
    setState: (s) => { state = s },
    getServingPlayer: () => servingPlayer,

    start: (limit) => {
      scoreLimit = limit
      playerScore = 0
      aiScore = 0
      state = 'serving'
      startServe(Math.random() < 0.5 ? 'player' : 'ai')
    },

    stop: () => { state = 'idle' },

    updateServeTimer: (dt) => {
      if (state !== 'serving') return
      serveTimer -= dt
      const thresholds = content.table.SERVE_WARN_THRESHOLDS
      while (nextBeepIndex < thresholds.length && serveTimer <= thresholds[nextBeepIndex]) {
        content.audio.playServeBeep()
        nextBeepIndex++
      }
      if (serveTimer <= 0) {
        const next = servingPlayer === 'player' ? 'ai' : 'player'
        startServe(next)
        content.announcer.serveTransfer(next)
      }
    },

    confirmServe: () => {
      serveTimer = Infinity
    },

    onGoal: (scorer) => {
      if (scorer === 'player') playerScore++
      else aiScore++
      lastScorer = scorer
      state = 'goal_pause'
      goalPauseTimer = 2.0
      content.audio.playGoal(scorer)
      content.announcer.goal(scorer, playerScore, aiScore)
    },

    updateGoalPause: (dt) => {
      goalPauseTimer -= dt
      if (goalPauseTimer > 0) return
      if (playerScore >= scoreLimit || aiScore >= scoreLimit) {
        state = 'game_over'
        const winner = playerScore >= scoreLimit ? 'player' : 'ai'
        content.announcer.gameOver(winner, playerScore, aiScore)
      } else {
        state = 'serving'
        const next = lastScorer === 'player' ? 'ai' : 'player'
        startServe(next)
      }
    },

    getLastScorer: () => lastScorer,
  }
})()
