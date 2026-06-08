// Speech routing. Wraps app.announce (polite/assertive) with a per-channel
// spam window so routine events don't flood the screen reader, and exposes
// one method per status hotkey. Optional TTS fallback (off by default) for
// players without a screen reader. References siblings lazily.
content.announcer = (() => {
  const I = () => app.i18n
  const S = () => content.state

  let useTts = false
  const lastAt = new Map()   // key -> engine.time() of last polite emit

  function setUseTts(on) { useTts = !!on }

  function tts(msg) {
    if (!useTts || !window.speechSynthesis) return
    try {
      const u = new SpeechSynthesisUtterance(msg)
      const loc = I().locale && I().locale()
      if (loc) u.lang = loc
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch (e) {}
  }

  function polite(msg, key, minGapS = 0) {
    if (key && minGapS > 0) {
      const now = engine.time()
      const prev = lastAt.get(key) || -Infinity
      if (now - prev < minGapS) return
      lastAt.set(key, now)
    }
    app.announce.polite(msg)
    tts(msg)
  }

  function assertive(msg) {
    app.announce.assertive(msg)
    tts(msg)
  }

  function reset() {
    lastAt.clear()
  }

  function t(key, params) { return I().t(key, params) }

  // ----- status hotkeys -----

  function coinsAndHealth() {
    const car = S().career()
    if (!car) return
    assertive(t('ann.coinsHealth', {
      coins: S().coinsRemaining(),
      health: Math.max(0, Math.round(car.health)),
    }))
  }

  function scoreAndLevel(digitByDigit) {
    const car = S().career()
    if (!car) return
    if (digitByDigit) {
      const digits = String(Math.round(car.score)).split('').join(' ')
      assertive(t('ann.scoreDigits', {digits}))
    } else {
      assertive(t('ann.scoreLevel', {score: Math.round(car.score), level: car.level}))
    }
  }

  function inventory() {
    const car = S().career()
    if (!car) return
    const inv = car.inventory
    assertive(t('ann.inventory', {
      neutralizers: inv.E, collectors: inv.C, fusions: inv.W, oils: inv.S,
    }))
  }

  function time() {
    const lvl = S().level()
    if (!lvl) return
    assertive(t('ann.time', {seconds: Math.floor(lvl.timer)}))
  }

  function highScore() {
    const car = S().career()
    if (!car) return
    const top = app.highscores.list(car.difficulty)[0]
    assertive(t('ann.highScore', {score: top ? top.score : 0}))
  }

  function coinMode(mode, n) {
    if (mode === content.constants.COIN_MODE.SINGLE) {
      polite(t('ann.modeSingle', {n}))
    } else {
      polite(t('ann.modeAll'))
    }
  }

  // ----- gameplay events -----

  function info(msg) { polite(msg) }
  function alert(msg) { assertive(msg) }

  function experimentNumber(n) {
    polite(t('ann.experiment', {n}), 'exp', 0)
  }

  function itemSpawned() { polite(t('ann.goodItem'), 'good', 0.5) }
  function itemGot(effectKey) { assertive(t('ann.gotItem', {item: t(effectKey)})) }
  function nastySpawned() { polite(t('ann.nastyItem'), 'nasty', 0.5) }

  function death(causeId) {
    assertive(t('ann.death.' + causeId))
  }

  // Non-fatal hit: report the remaining health so the player gauges danger.
  function hit(causeId) {
    const car = S().career()
    const health = car ? Math.max(0, Math.round(car.health)) : 0
    assertive(t('ann.hit', {cause: t('ann.death.' + causeId), health}))
  }

  function levelClear(bonuses, level) {
    assertive(t('ann.levelClear', {level, points: Math.round(bonuses.total)}))
  }

  function levelReady(level) {
    assertive(t('ann.ready', {level}))
  }

  function bonusIntro(kind) {
    assertive(t('ann.bonus.' + kind))
  }

  function gameOver(score, level) {
    assertive(t('ann.gameOver', {score: Math.round(score), level}))
  }

  function paused(on) {
    assertive(t(on ? 'ann.paused' : 'ann.resumed'))
  }

  function warn(kind) {
    polite(t('ann.warn.' + kind), 'warn.' + kind, 1.5)
  }

  return {
    setUseTts,
    reset,
    coinsAndHealth,
    scoreAndLevel,
    inventory,
    time,
    highScore,
    coinMode,
    info,
    alert,
    experimentNumber,
    itemSpawned,
    itemGot,
    nastySpawned,
    death,
    hit,
    levelClear,
    levelReady,
    bonusIntro,
    gameOver,
    paused,
    warn,
  }
})()
