// Top-level game logic for Marble: an endless run of procedurally generated
// tilt-maze levels. Reaching the exit clears the level and awards points by
// SPEED — the faster you clear, the more points (see levelScore); falling in a
// pit ends the run. Score is the accumulated time bonus; only the high score
// persists.
content.game = (() => {
  const state = {
    phase: 'idle',  // 'idle' | 'play' | 'dead'
    level: 1,
    score: 0,       // accumulated time-bonus points this run
    best: 0,
    levelTime: 0,   // seconds on the current level (play time only — pause-safe)
    parTime: 0,     // expected seconds for the current level's solution
    lastGain: 0,    // points awarded for the most recently cleared level
  }

  let _onGameOver = null
  let _onLevelClear = null

  function loadLevel(level) {
    const cc = content.constants
    const {start, pathLen} = content.maze.generate(level)
    content.player.reset(start)
    state.levelTime = 0
    state.parTime = cc.SCORE_PAR_PER_CELL * pathLen
    state.phase = 'play'
    content.audio.levelStart()
    content.audio.frame() // prime the listener at the new start
  }

  function startRun() {
    state.level = 1
    state.score = 0
    state.lastGain = 0
    state.phase = 'play'
    loadLevel(state.level)
  }

  function nextLevel() {
    state.level += 1
    loadLevel(state.level)
  }

  // Points for clearing a level in `t` seconds. par/time > 1 (beat par) scales
  // the award above SCORE_BASE up to RATIO_MAX; a slow clear floors at
  // RATIO_MIN. Normalised by the level's par so speed, not size, drives score.
  function levelScore(t) {
    const cc = content.constants
    const ratio = cc.clamp(
      state.parTime / Math.max(t, cc.SCORE_MIN_TIME),
      cc.SCORE_RATIO_MIN, cc.SCORE_RATIO_MAX
    )
    return Math.max(1, Math.round(cc.SCORE_BASE * ratio))
  }

  // Map the template's continuous game input onto a board-space tilt vector.
  // app.controls.game(): x = +1 up/north (ArrowUp / stick up), y = +1 left/west
  // (ArrowLeft / stick left). Screen space has +x east, +y south, so:
  //   tilt.x (east)  = -input.y
  //   tilt.y (south) = -input.x
  function readTilt() {
    const g = app.controls.game()
    let tx = -(g.y || 0)
    let ty = -(g.x || 0)
    const m = Math.hypot(tx, ty)
    if (m > 1) { tx /= m; ty /= m }
    return {x: tx, y: ty}
  }

  function update(dt) {
    if (state.phase !== 'play') return
    state.levelTime += dt
    const r = content.physics.step(dt, readTilt())

    if (r.bumped && r.bumpSpeed > 0.8) content.audio.clack(r.bumpSpeed)

    if (r.event === 'goal') {
      const time = state.levelTime
      const gained = levelScore(time)
      state.lastGain = gained
      state.score += gained
      content.audio.goal()
      const clearedLevel = state.level
      nextLevel()
      if (_onLevelClear) _onLevelClear({gained, time, score: state.score, level: state.level, clearedLevel})
      return
    }
    if (r.event === 'fell') {
      state.phase = 'dead'
      content.audio.silenceAll()
      content.audio.fell()
      if (state.score > state.best) state.best = state.score
      if (_onGameOver) _onGameOver()
      return
    }

    content.audio.frame()
  }

  // Direction of a world point relative to the fixed listener orientation, as
  // an i18n key suffix (front/right/behind/left) — matches what the player
  // hears. Front = screen-north, so this stays consistent with the audio since
  // both read content.audio._lastYaw (now constant).
  function relBucketKey(x, y) {
    const p = content.player.getPosition()
    const dx = x - p.x, dy = -(y - p.y)
    const rel = content.constants.angleDelta(Math.atan2(dy, dx), content.audio._lastYaw)
    const a = (rel + Math.PI * 2) % (Math.PI * 2)
    if (a < Math.PI / 4 || a >= Math.PI * 7 / 4) return 'front'
    if (a < Math.PI * 3 / 4) return 'left'
    if (a < Math.PI * 5 / 4) return 'behind'
    return 'right'
  }

  function goalInfo() {
    const p = content.player.getPosition()
    const gp = content.maze.goalPos()
    return {dist: Math.round(Math.hypot(gp.x - p.x, gp.y - p.y)), dir: relBucketKey(gp.x, gp.y)}
  }

  function pitInfo() {
    const p = content.player.getPosition()
    const near = content.maze.nearestPit(p.x, p.y)
    if (!near) return null
    return {dist: Math.round(near.dist), dir: relBucketKey(near.pos.x, near.pos.y)}
  }

  return {
    state,
    startRun, loadLevel, nextLevel, update,
    isPlaying: () => state.phase === 'play',
    onGameOver: (fn) => { _onGameOver = fn },
    onLevelClear: (fn) => { _onLevelClear = fn },
    goalInfo, pitInfo,
  }
})()
