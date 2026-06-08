// Top-level orchestrator + game FSM. Driven by app.screen.game's onFrame.
// The internal FSM (state.data.fsm) sequences a single play session;
// only GAME_OVER hands control back to the app screen layer. Sibling
// modules are referenced lazily and guarded so partial builds still run.
content.game = (() => {
  const C = () => content.constants
  const S = () => content.state

  const READY_S = 1.6
  const HIT_S = 0.6        // brief recovery beat after a non-fatal hit
  const HIT_INVULN_S = 1.3 // mercy window after a hit (prevents chain-draining)
  const KNOCKBACK = 9      // cells the enemies are shoved back on a hit
  const GAMEOVER_TAIL_S = 2.4

  let phaseUntil = 0       // engine-time deadline for timed phases
  let bonusKind = null
  let earlyEndRequested = false
  let pendingBonuses = null
  let lastHitCause = null  // most recent damage cause, for game-over attribution

  function setPhase(fsm) {
    S().data.prevFsm = S().data.fsm
    S().data.fsm = fsm
  }
  function fsm() { return S().data.fsm }

  // ----- lifecycle -----

  function startCareer({difficulty = 'normal', nickname = 'Player'} = {}) {
    S().resetCareer({difficulty, nickname})
    content.field.reset()
    content.player.reset()
    content.announcer.reset()
    if (content.enemies) content.enemies.initCareer(difficulty)
    if (content.music) content.music.start({difficulty})
    earlyEndRequested = false
    lastHitCause = null
    S().data.pendingGameOver = false
    beginLevel(true, {skipReady: true})
  }

  // Build a fresh level. `first` skips the resetLevel (career already did it)
  // and skips the enemy speed scaling on level 1. `opts.skipReady` starts the
  // level directly in PLAY (no READY freeze) — used when raising level so the
  // player keeps rolling without an interruption.
  function beginLevel(first, opts = {}) {
    const car = S().career()
    if (!first) S().resetLevel()
    content.field.reset()
    const params = C().levelParams(car.difficulty, car.level)

    content.coins.spawnLevel(params.coinCount)
    if (content.experiment) content.experiment.init(car.level)
    // Items persist across a level change (resetLevel carries them over), so
    // only wipe them when starting a brand-new career.
    if (first && content.items) content.items.reset()
    if (content.enemies) content.enemies.scaleToLevel(car.level)

    // First nasty item appears after firstAtS seconds; shrinks thereafter.
    S().level().nastyNextAt = params.nasty.firstAtS

    if (content.music) content.music.setLevel(car.level)
    earlyEndRequested = false

    // Spawn mercy: enemies persist their positions across levels, so a bot
    // sitting near the centre spawn could insta-catch. Keep the same total
    // window whether or not we freeze on READY.
    S().player().invisibleUntil = engine.time() + READY_S + 1.0

    content.announcer.levelReady(car.level)
    if (opts.skipReady) {
      setPhase(C().STATE.PLAY)
    } else {
      setPhase(C().STATE.READY)
      phaseUntil = engine.time() + READY_S
    }
  }

  function advanceLevel() {
    const car = S().career()
    car.level++
    beginLevel(false, {skipReady: true})
  }

  // ----- per-frame -----

  function frame() {
    try {
      const now = engine.time()
      const state = fsm()

      if (S().data.pendingGameOver) {
        // Only keep audio listener alive while the tail finishes.
        content.audio.frame()
        if (now >= S().data.endAt) finishGameOver()
        return
      }

      switch (state) {
        case C().STATE.READY:
          content.audio.frame()
          if (now >= phaseUntil) setPhase(C().STATE.PLAY)
          break
        case C().STATE.PLAY:
          play()
          break
        case C().STATE.LEVEL_CLEAR:
          content.audio.frame()
          if (now >= phaseUntil) afterClear()
          break
        case C().STATE.BONUS:
          if (content.bonus) {
            content.bonus.frame()
            if (content.bonus.isComplete()) {
              const r = content.bonus.result && content.bonus.result()
              if (r && content.scoring) content.scoring.awardRaw(r.points || 0)
              content.bonus.silenceAll()
              advanceLevel()
            }
          } else {
            advanceLevel()
          }
          break
        case C().STATE.HIT:
          // Brief recovery beat: frozen, audio ticking, then back to play.
          content.audio.frame()
          if (now >= phaseUntil) setPhase(C().STATE.PLAY)
          break
        case C().STATE.PAUSED:
          // frozen
          break
      }
    } catch (e) { console.error(e) }
  }

  function play() {
    const dt = engine.loop.delta()
    const lvl = S().level()
    const car = S().career()

    if (content.music) content.music.frame()
    content.player.frame()
    if (content.enemies) content.enemies.frame()
    if (content.bullets) content.bullets.frame()
    if (content.items) content.items.frame()
    if (content.experiment) content.experiment.frame()
    content.coins.frame()

    // Contact hits (robot/rocket catch, bullet, oil slip) subtract health.
    // items.checkCollisions handles grabs + applies its own hazard/bomb damage
    // (no cause returned); any resulting game over is caught by the health
    // check below.
    let hit = null
    if (content.enemies && content.enemies.checkCollisions) hit = hit || content.enemies.checkCollisions()
    if (content.bullets && content.bullets.checkCollisions) hit = hit || content.bullets.checkCollisions()
    if (content.experiment && content.experiment.checkCollisions) hit = hit || content.experiment.checkCollisions()
    if (content.items && content.items.checkCollisions) content.items.checkCollisions()

    content.audio.frame()
    lvl.timer += dt

    if (hit && !S().isInvisible()) { hitPlayer(hit); return }
    if (car.health <= 0) { gameOver(lastHitCause || C().DEATH.HAZARD); return }

    // Win: all coins gone, or an allowed early end.
    const remaining = S().coinsRemaining()
    const allowEarly = earlyEndRequested && (remaining <= 2 || lvl.earlyEndAllowed)
    if (remaining === 0 || allowEarly) clearLevel(remaining === 0 || lvl.earlyEndAllowed)
  }

  // ----- level clear -----

  function clearLevel(fullBonus) {
    const car = S().career()
    pendingBonuses = null
    if (content.scoring) {
      pendingBonuses = content.scoring.computeLevelBonuses(fullBonus)
      content.scoring.applyLevelBonuses(pendingBonuses)
    } else {
      pendingBonuses = {time: 0, health: 0, item: 0, total: 0}
    }
    content.coins.silenceAll()
    // Items are NOT silenced — they carry over into the next level (resetLevel
    // preserves the arrays, so their voices must keep playing).
    if (content.bullets) content.bullets.silenceAll()
    if (content.music) content.music.sting('levelClear')
    content.announcer.levelClear(pendingBonuses, car.level)
    // No freeze on clear: the sting + bonus tally are non-blocking (audio /
    // aria-live), so move straight into the next level or the bonus round.
    afterClear()
  }

  function afterClear() {
    const car = S().career()
    if (C().isBonusLevel(car.level) && content.bonus) {
      bonusKind = content.bonus.pickKind(car.level)
      content.bonus.start(bonusKind)
      if (content.music) content.music.duck(0.4)
      content.announcer.bonusIntro(bonusKind)
      setPhase(C().STATE.BONUS)
    } else {
      advanceLevel()
    }
  }

  // ----- hits / game over -----

  // Record the most recent damage cause (used to attribute a game over that
  // happens via accumulated environmental damage, e.g. walls/hazards/bombs).
  function noteHitCause(cause) { if (cause) lastHitCause = cause }

  // A contact hit (robot/rocket/bullet/oil). Health is the only resource: the
  // hit subtracts health and, if that empties it, ends the game. Otherwise the
  // player survives — enemies are knocked back, a brief mercy window opens, and
  // a short recovery beat plays before control resumes.
  function hitPlayer(cause) {
    const car = S().career()
    lastHitCause = cause
    car.health -= (C().HIT_DAMAGE[cause] || 30)
    S().level().damageTaken = true
    if (app.haptics) app.haptics.enqueue({duration: 240, strongMagnitude: 0.9, weakMagnitude: 0.7})

    if (car.health <= 0) { gameOver(cause); return }

    content.audio.deathSound(cause) // doubles as the "ouch" hit sting
    content.announcer.hit(cause)
    knockbackEnemies()
    S().player().invisibleUntil = engine.time() + HIT_INVULN_S
    setPhase(C().STATE.HIT)
    phaseUntil = engine.time() + HIT_S
  }

  // Shove every enemy directly away from the player so it isn't still on top of
  // you when the mercy window ends.
  function knockbackEnemies() {
    if (!content.enemies) return
    const p = S().player()
    const g = C().GRID
    const mid = (g.min + g.max) / 2
    for (const e of content.enemies.list()) {
      let dx = e.col - p.col, dy = e.row - p.row
      let len = Math.hypot(dx, dy)
      if (len < 1e-3) {
        // Enemy sitting exactly on the player: shove it toward the corner
        // opposite the player's half so it always ends up clear of them.
        dx = p.col <= mid ? 1 : -1
        dy = p.row <= mid ? 1 : -1
        len = Math.hypot(dx, dy)
      }
      e.col = content.field.clamp(p.col + (dx / len) * KNOCKBACK)
      e.row = content.field.clamp(p.row + (dy / len) * KNOCKBACK)
    }
  }

  function gameOver(cause) {
    content.audio.deathSound(cause)
    content.announcer.death(cause)
    if (app.haptics) app.haptics.enqueue({duration: 300, strongMagnitude: 1, weakMagnitude: 1})
    content.coins.silenceAll()
    if (content.items) content.items.silenceAll()
    if (content.bullets) content.bullets.silenceAll()
    if (content.enemies) content.enemies.silenceAll()
    if (content.experiment) content.experiment.silenceAll()
    content.player.silenceAll()
    enterGameOver()
  }

  function enterGameOver() {
    const car = S().career()
    if (content.music) content.music.sting('gameOver')
    content.announcer.gameOver(car.score, car.level)
    S().data.pendingGameOver = true
    S().data.endAt = engine.time() + GAMEOVER_TAIL_S
    setPhase(C().STATE.GAME_OVER)
  }

  function finishGameOver() {
    S().data.pendingGameOver = false
    silenceAll()
    if (app.screen.gameover) app.screenManager.dispatch('gameover')
  }

  // ----- inputs from the screen -----

  function requestEarlyEnd() {
    if (fsm() !== C().STATE.PLAY) return
    earlyEndRequested = true
  }

  // Debug: jump straight to the next level regardless of coins remaining, to
  // test later-level mechanics (the rocket joins from level 3, etc.).
  function debugSkipLevel() {
    if (fsm() !== C().STATE.PLAY) return
    advanceLevel()
  }

  // Nasty "level drop": go down a level for parameter purposes, but enemy
  // speed is NOT lowered (enemies.scaleToLevel only ever raises). Rebuilds
  // the current level's coins/items at the lower level.
  function requestLevelDrop() {
    const car = S().career()
    if (car.level <= 1) return
    car.level--
    content.announcer.alert(app.i18n.t('ann.levelDrop', {level: car.level}))
    beginLevel(false, {skipReady: true})
  }

  function pauseToggle() {
    const st = fsm()
    if (st === C().STATE.PAUSED) {
      setPhase(S().data.prevFsm || C().STATE.PLAY)
      if (content.music) content.music.setPaused(false)
      content.announcer.paused(false)
    } else if (st === C().STATE.PLAY || st === C().STATE.READY || st === C().STATE.BONUS) {
      setPhase(C().STATE.PAUSED)
      if (content.music) content.music.setPaused(true)
      content.player.silenceAll()
      content.announcer.paused(true)
    }
  }

  function isPlaying() { return fsm() === C().STATE.PLAY }

  function silenceAll() {
    content.coins.silenceAll()
    content.player.silenceAll()
    if (content.items) content.items.silenceAll()
    if (content.bullets) content.bullets.silenceAll()
    if (content.enemies) content.enemies.silenceAll()
    if (content.experiment) content.experiment.silenceAll()
    if (content.bonus) content.bonus.silenceAll()
    if (content.music) content.music.stop()
    content.audio.silenceAll()
  }

  function summary() {
    const car = S().career()
    return {score: Math.round(car.score), level: car.level, difficulty: car.difficulty, nickname: car.nickname}
  }

  return {
    startCareer,
    frame,
    fsm,
    isPlaying,
    advanceLevel,
    requestEarlyEnd,
    requestLevelDrop,
    debugSkipLevel,
    pauseToggle,
    noteHitCause,
    silenceAll,
    summary,
  }
})()
