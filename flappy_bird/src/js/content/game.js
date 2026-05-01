// Top-level game logic: orchestrates state, world, audio, sfx around the
// content.events bus. The game screen calls update() each frame; collide
// transitions to gameover via the events bus.
content.game = (() => {
  let collideUnsub = null
  let pendingGameOver = false
  let gameOverDelay = 0

  function S() { return content.state }

  function bindEvents() {
    if (collideUnsub) return
    collideUnsub = content.events.on('collide', (e) => {
      const s = S()
      if (s.run.over) return
      s.run.over = true
      s.run.overReason = e.kind === 'floor' ? 'reason.floor' : (e.kind === 'ceiling' ? 'reason.ceiling' : 'reason.pipe')
      content.sfx.collide()
      // Schedule the gameover transition slightly after the crash sound
      pendingGameOver = true
      gameOverDelay = 0.85
    })
    content.events.on('pipe-passed', () => {
      content.sfx.score()
    })
  }

  function startNewGame() {
    bindEvents()
    S().reset()
    content.world.reset()
    pendingGameOver = false
    gameOverDelay = 0
    if (content.audio && content.audio.unsilence) content.audio.unsilence()
  }

  function flap() {
    const s = S()
    if (s.run.over) return
    if (!s.run.started) s.run.started = true
    s.run.birdVy = s.TUN.FLAP_VY
    content.sfx.flap()
    content.events.emit('flap', {})
  }

  function update(delta) {
    bindEvents()
    const s = S()

    if (!s.run.started) return  // bird waits in the air pre-flap

    if (!s.run.over) {
      // Integrate bird physics
      s.run.birdVy -= s.TUN.GRAVITY * delta
      if (s.run.birdVy > s.TUN.MAX_VY_UP) s.run.birdVy = s.TUN.MAX_VY_UP
      if (s.run.birdVy < s.TUN.MAX_VY_DOWN) s.run.birdVy = s.TUN.MAX_VY_DOWN
      s.run.birdY += s.run.birdVy * delta
      // Soft clamp top of world (ceiling collision is fired by world.update)
      if (s.run.birdY > 1) s.run.birdY = 1

      // Step the world (handles spawning, scrolling, scoring, collision)
      content.world.update(delta)
    }

    // Delay-driven gameover transition
    if (pendingGameOver) {
      gameOverDelay -= delta
      if (gameOverDelay <= 0) {
        pendingGameOver = false
        content.events.emit('game-over', {score: s.run.score, reason: s.run.overReason})
      }
    }
  }

  return {
    startNewGame,
    flap,
    update,
    isOver: () => S().run.over,
    score: () => S().run.score,
  }
})()
