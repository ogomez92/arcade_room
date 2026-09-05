/**
 * Pipe — core game loop. A single phase machine drives the whole run; the game
 * screen forwards key actions to onKey() and time to frame(). Bonus rounds are
 * delegated to content.bonus while phase === 'bonus'.
 *
 * Phases:
 *   intro       level briefing + jingle (skip with hammer/ctrl)
 *   fit         select + test + hammer the current pipe; water draining
 *   slide       (Canada/Spain only) press the away arrow to reach the next pipe
 *   enemy       an animal approaches; press ctrl in the beep window to avoid
 *   trip        find the grab arrow, then ctrl to regain balance
 *   levelClear  award + jingle, then advance or launch a bonus round
 *   bonus       content.bonus owns input/frame; returns an item count
 *   gameover    run ended (transitions the screen)
 *
 * Cross-module refs (config, audio, bonus, scores) are read through arrow
 * getters so concat order can't bite us (see template CLAUDE.md).
 */
content.game = (() => {
  const cfg = () => content.config
  const audio = () => content.audio
  const bonus = () => content.bonus
  const t = (k, p) => app.i18n.t(k, p)
  const sayP = (k, p) => app.announce.polite(t(k, p))
  const sayA = (k, p) => app.announce.assertive(t(k, p))

  let pendingDiffId = 'usa'

  const s = {}

  function reset() {
    s.diffId = pendingDiffId
    s.diff = cfg().difficulty(s.diffId)
    s.level = 1
    s.lives = s.diff.lives
    s.score = 0
    s.phase = 'none'
    s.paused = false
    s.lastStatus = 0
    s.result = null
  }

  function selectDifficulty(id) {
    if (cfg().difficulty(id)) pendingDiffId = id
    return content.game
  }

  // ---- lifecycle -----------------------------------------------------------

  function start() {
    reset()
    audio().ensureGraph()
    audio().startMusic()
    beginLevel()
  }

  function stop() {
    audio().silenceAll()
    s.phase = 'none'
  }

  function result() { return s.result }

  // ---- level flow ----------------------------------------------------------

  function beginLevel() {
    audio().stopWater(); audio().stopEnemy(); audio().stopBeep()
    s.cfg = cfg().level(s.level)
    s.perfect = true
    s.pipeIndex = 0
    s.currentSide = Math.random() < 0.5 ? 'left' : 'right'
    s.phase = 'intro'
    s.phaseT = 2.2
    audio().levelJingle()
    sayA('ann.levelIntro', {
      city: t(s.diff.labelKey),
      level: s.level,
      pipes: s.cfg.totalPipes,
      hits: s.cfg.hammerHits,
      box: s.cfg.toolboxSize,
    })
  }

  function beginPlay() {
    s.phase = 'fit'
    nextPipe()
  }

  function nextPipe() {
    if (s.pipeIndex >= s.cfg.totalPipes) return levelComplete()
    // Maybe interrupt with an enemy or a trip before this pipe.
    if (Math.random() < s.cfg.eventChance) {
      return Math.random() < s.cfg.tripShare ? enterTrip() : enterEnemy()
    }
    beginPipe(s.cfg.waterTime)
  }

  function beginPipe(water) {
    s.phase = 'fit'
    s.correct = Math.floor(Math.random() * s.cfg.toolboxSize)
    s.selected = Math.floor(Math.random() * s.cfg.toolboxSize)
    s.hammerCount = 0
    s.pipePenalty = 1
    s.pipeElapsed = 0
    s.water = water
    audio().startWater()
    audio().setWaterUrgency(0)
    sayP('ann.pipe', {n: s.pipeIndex + 1, total: s.cfg.totalPipes})
    announceSelected()
  }

  function announceSelected() {
    if (app.settings.computed.speakPipeNumbers) {
      app.announce.assertive(String(s.selected + 1))
    }
    audio().cycleTick(s.selected + 1, s.cfg.toolboxSize)
  }

  function awardPipe() {
    const sc = cfg().scoring
    const drain = s.diff.maxPipePoints / sc.drainSeconds
    let pts = Math.max(0, s.diff.maxPipePoints - s.pipeElapsed * drain)
    if (s.pipeElapsed < sc.speedBonusWindow) pts += sc.speedBonus
    pts *= s.pipePenalty
    s.score += Math.round(pts)
    audio().hammerDone()
    audio().stopWater()
    s.pipeIndex++

    if (s.pipeIndex >= s.cfg.totalPipes) return levelComplete()

    if (s.diff.autoSlide) {
      s.phase = 'autoslide'
      s.phaseT = 0.45
    } else {
      s.phase = 'slide'
      s.slideDir = s.currentSide === 'left' ? 'right' : 'left'
      s.water = s.cfg.waterTime
      audio().startWater()
      audio().setWaterUrgency(0)
      sayP('ann.slide', {dir: t('dir.' + s.slideDir)})
    }
  }

  function levelComplete() {
    audio().stopWater()
    const sc = cfg().scoring
    s.score += sc.levelClear
    if (s.perfect) s.score += sc.perfectLevel
    audio().levelJingle()
    s.phase = 'levelClear'
    s.phaseT = 2.0
    sayA(s.perfect ? 'ann.levelClearPerfect' : 'ann.levelClear', {level: s.level})
  }

  function afterLevelClear() {
    if (cfg().isBonusAfter(s.level)) return startBonus()
    advanceLevel()
  }

  function advanceLevel() {
    if (s.level >= cfg().LEVELS_PER_CITY) return gameComplete()
    s.level++
    beginLevel()
  }

  // ---- bonus round ---------------------------------------------------------

  function startBonus() {
    s.phase = 'bonus'
    audio().stopWater()
    bonus().start(s.diff, onBonusDone)
  }

  function onBonusDone(itemsCollected, bonusPoints) {
    s.score += bonusPoints
    if (itemsCollected >= s.diff.bonusThreshold) {
      s.lives++
      sayA('ann.bonusExtraLife', {items: itemsCollected})
    } else {
      sayA('ann.bonusDone', {items: itemsCollected, points: bonusPoints})
    }
    s.phase = 'levelClear'
    s.phaseT = 1.6
    s._afterBonus = true
  }

  // ---- enemies -------------------------------------------------------------

  const ENEMY_TYPES = ['bee', 'bat', 'dog']

  function enterEnemy() {
    audio().stopWater()
    s.phase = 'enemy'
    s.enemyType = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)]
    s.enemySide = Math.random() < 0.5 ? -1 : 1
    s.enemyPan = s.enemySide
    s.enemyApproach = 1.2
    s.enemyArmed = false
    s.enemyBudget = s.diff.enemyPresses + 2
    s.enemyHits = 0
    audio().startEnemy(s.enemyType, s.enemyPan)
    sayA('ann.enemy.' + s.enemyType)
  }

  function enemyResolved(avoided) {
    audio().stopEnemy(); audio().stopBeep()
    if (avoided) {
      s.score += cfg().scoring.enemyAvoided
      audio().avoidSuccess(s.enemyType)
      sayA('ann.enemyAvoided.' + s.enemyType)
      beginPipe(s.cfg.waterTime)
    } else {
      audio().enemyHit(s.enemyType)
      s.perfect = false
      loseLife('killed', 'ann.enemyHit.' + s.enemyType)
    }
  }

  // ---- trips ---------------------------------------------------------------

  const DIRS = ['up', 'down', 'left', 'right']

  function enterTrip() {
    audio().stopWater()
    s.phase = 'trip'
    s.tripDir = DIRS[Math.floor(Math.random() * DIRS.length)]
    s.tripFound = false
    s.tripT = Math.max(2, s.cfg.enemyReactTime + 1.2)
    audio().trip()
    sayA('ann.trip')
  }

  function tripResolved(ok) {
    if (ok) {
      audio().balanceOk()
      sayA('ann.tripOk')
      beginPipe(s.cfg.waterTime)
    } else {
      audio().fall()
      s.perfect = false
      loseLife('killed', 'ann.fall')
    }
  }

  // ---- life / end ----------------------------------------------------------

  function loseLife(reason, annKey) {
    const sc = cfg().scoring
    s.score += reason === 'drenched' ? sc.drenched : sc.killed
    s.lives--
    sayA(annKey, {lives: s.lives})
    audio().stopWater(); audio().stopEnemy(); audio().stopBeep()
    if (s.lives <= 0) return gameOver(false)
    // Retry the current pipe.
    s.phase = 'respawn'
    s.phaseT = 1.0
  }

  function gameOver(won) {
    audio().silenceAll()
    audio().gameOverDirge()
    s.phase = 'gameover'
    s.result = {
      diffId: s.diffId,
      score: s.score,
      level: s.level,
      won: Boolean(won),
    }
    sayA(won ? 'ann.win' : 'ann.gameover', {score: s.score, level: s.level})
    setTimeout(() => app.screenManager.dispatch('gameover'), 1400)
  }

  function gameComplete() {
    gameOver(true)
  }

  function quit() {
    stop()
    app.screenManager.dispatch('menu')
  }

  // ---- status read-outs ----------------------------------------------------

  function speakStatus() {
    const now = performance.now()
    if (now - s.lastStatus < 400) {
      // double-tap: read the score digit by digit
      const digits = String(s.score).split('').join(' ')
      app.announce.assertive(t('ann.scoreDigits', {digits}))
    } else {
      sayA('ann.status', {level: s.level, score: s.score})
    }
    s.lastStatus = now
  }

  function speakLives() {
    const left = s.phase === 'fit'
      ? (s.cfg.totalPipes - s.pipeIndex)
      : (s.cfg ? s.cfg.totalPipes - s.pipeIndex : 0)
    sayA('ann.lives', {lives: s.lives, pipes: Math.max(0, left)})
  }

  function togglePause() {
    if (s.phase !== 'fit' && s.phase !== 'slide') return
    s.paused = !s.paused
    if (s.paused) { audio().setWaterUrgency(0); sayA('ann.paused') }
    else sayA('ann.resumed')
  }

  // ---- input ---------------------------------------------------------------

  function onKey(action) {
    if (action === 'quit') return quit()
    if (s.phase === 'bonus') return bonus().onKey(action)


    if (action === 'status') return speakStatus()
    if (action === 'lives') return speakLives()
    if (action === 'pause') return togglePause()
    if (s.paused) return

    switch (s.phase) {
      case 'intro':
        if (action === 'hammer' || action === 'test') { s.phaseT = 0; beginPlay() }
        return
      case 'levelClear':
        if (action === 'hammer' || action === 'test') s.phaseT = 0
        return
      case 'fit':
        return onKeyFit(action)
      case 'slide':
        if ((action === 'left' || action === 'right') && action === s.slideDir) {
          s.currentSide = s.slideDir
          audio().stopWater()
          beginPipe(s.water > 0 ? s.water : s.cfg.waterTime)
        }
        return
      case 'enemy':
        if (action === 'hammer') onEnemyPress()
        return
      case 'trip':
        return onKeyTrip(action)
    }
  }

  function onKeyFit(action) {
    switch (action) {
      case 'up':
        s.selected = (s.selected - 1 + s.cfg.toolboxSize) % s.cfg.toolboxSize
        announceSelected(); return
      case 'down':
        s.selected = (s.selected + 1) % s.cfg.toolboxSize
        announceSelected(); return
      case 'test':
        if (s.selected === s.correct) { audio().testFit(); sayP('ann.fits') }
        else { audio().testNoFit(); sayP('ann.noFit') }
        return
      case 'hammer':
        if (s.selected === s.correct) {
          s.hammerCount++
          audio().hammerHit(s.hammerCount, s.cfg.hammerHits)
          if (s.hammerCount >= s.cfg.hammerHits) awardPipe()
        } else {
          // Hammering the wrong pipe: scream + penalty.
          s.score += cfg().scoring.screamPenalty
          s.pipePenalty *= cfg().scoring.screamFactor
          s.perfect = false
          audio().enemyHit('bee') // a short pained clatter
          sayP('ann.scream')
        }
        return
    }
  }

  function onEnemyPress() {
    s.enemyBudget--
    if (s.enemyArmed) {
      s.enemyHits++
      if (s.enemyHits >= s.diff.enemyPresses) return enemyResolved(true)
    }
    if (s.enemyBudget <= 0 && !(s.enemyArmed && s.enemyHits >= s.diff.enemyPresses)) {
      return enemyResolved(false) // trigger-happy: out of presses
    }
  }

  function onKeyTrip(action) {
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      if (action === s.tripDir && !s.tripFound) {
        s.tripFound = true
        audio().handClap()
        sayP('ann.grab', {dir: t('dir.' + s.tripDir)})
      }
      return
    }
    if (action === 'hammer' && s.tripFound) tripResolved(true)
  }

  // ---- frame ---------------------------------------------------------------

  function frame() {
    if (s.phase === 'bonus') return bonus().frame()
    if (s.paused) return
    const dt = engine.loop.delta()

    switch (s.phase) {
      case 'intro':
      case 'levelClear':
        s.phaseT -= dt
        if (s.phaseT <= 0) {
          if (s.phase === 'intro') beginPlay()
          else if (s._afterBonus) { s._afterBonus = false; advanceLevel() }
          else afterLevelClear()
        }
        return

      case 'autoslide':
        s.phaseT -= dt
        if (s.phaseT <= 0) beginPipe(s.cfg.waterTime)
        return

      case 'respawn':
        s.phaseT -= dt
        if (s.phaseT <= 0) beginPipe(s.cfg.waterTime)
        return

      case 'fit':
      case 'slide':
        s.water -= dt
        audio().setWaterUrgency(engine.fn.clamp(1 - s.water / s.cfg.waterTime, 0, 1))
        if (s.water <= 0) { audio().drench(); loseLife('drenched', 'ann.drenched') }
        return

      case 'enemy':
        if (!s.enemyArmed) {
          s.enemyApproach -= dt
          s.enemyPan = s.enemySide * engine.fn.clamp(s.enemyApproach / 1.2, 0, 1)
          audio().setEnemyPan(s.enemyPan)
          if (s.enemyApproach <= 0) {
            s.enemyArmed = true
            s.enemyReact = s.cfg.enemyReactTime
            audio().startBeep(280, 990, 0)
            sayA('ann.now')
          }
        } else {
          s.enemyReact -= dt
          if (s.enemyReact <= 0) enemyResolved(false)
        }
        return

      case 'trip':
        s.tripT -= dt
        if (s.tripT <= 0) tripResolved(false)
        return
    }
  }

  return {
    selectDifficulty,
    start, stop, frame, onKey, quit, result,
    state: s,
  }
})()
