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

  function opponentLabel() {
    return (content.teamManager && content.teamManager.isMultiplayer()) ? 'Opponent' : 'Computer'
  }

  function announce(message) {
    const el = document.querySelector('.js-announcer')
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = message }, 50)
  }

  function startServe(who) {
    servingPlayer = who
    serveTimer = content.table.SERVE_TIMEOUT
    nextBeepIndex = 0
    content.ball.setVelocity(0, 0)
    content.audio.playServeIndicator(who)
    if (who === 'player') {
      content.ball.setPosition(content.player.getX(), 0)
      announce('You serve. You have 3 seconds.')
    } else {
      content.ball.setPosition(content.ai.getX(), content.table.LENGTH)
      announce(`${opponentLabel()} serves.`)
    }
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
        announce(
          next === 'player'
            ? 'Serve transferred to you. You serve.'
            : `Serve transferred to ${opponentLabel().toLowerCase()}. ${opponentLabel()} serves.`
        )
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
      const msg = scorer === 'player'
        ? `Goal! You score. Score: ${playerScore} to ${aiScore}.`
        : `Goal! ${opponentLabel()} scores. Score: ${playerScore} to ${aiScore}.`
      announce(msg)
    },

    updateGoalPause: (dt) => {
      goalPauseTimer -= dt
      if (goalPauseTimer > 0) return
      if (playerScore >= scoreLimit || aiScore >= scoreLimit) {
        state = 'game_over'
        const msg = playerScore >= scoreLimit
          ? `Game over. You win ${playerScore} to ${aiScore}.`
          : `Game over. ${opponentLabel()} wins ${aiScore} to ${playerScore}.`
        announce(msg)
      } else {
        state = 'serving'
        const next = lastScorer === 'player' ? 'ai' : 'player'
        startServe(next)
      }
    },

    getLastScorer: () => lastScorer,
  }
})()
