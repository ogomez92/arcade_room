/**
 * TAPPER! — game-events → announcer wiring.
 *
 * Maps content.game events into i18n keys for the polite/assertive
 * aria-live regions. Strings always look up a freshly-translated value
 * at call time — never store rendered text in event payloads.
 */
content.announcer = (() => {
  function I() { return app.i18n }
  function A() { return app.announce }

  function levelStart(snap) {
    const a = A(), i = I()
    if (!a || !i) return
    const themeName = i.t(snap.rules.themeNameKey)
    a.assertive(i.t('ann.start', {theme: themeName, level: snap.level, lives: snap.lives}))
  }

  function levelClear(snap) {
    const a = A(), i = I()
    if (!a || !i) return
    a.assertive(i.t('ann.levelClear', {score: snap.score}))
  }

  function roundUp() {
    const a = A(), i = I()
    if (!a || !i) return
    a.assertive(i.t('ann.roundUp'))
  }

  function loseLife(snap, ev) {
    const a = A(), i = I()
    if (!a || !i) return
    const laneName = ev.lane + 1
    let key
    if (ev.reason === 'breach') key = 'ann.breach'
    else if (ev.reason === 'shatter') key = 'ann.shatter'
    else key = 'ann.waste'
    a.assertive(i.t(key, {lane: laneName}) + ' ' + i.t('ann.life', {lives: snap.lives}))
  }

  function pushOut() {
    // Quiet on routine push-outs — the audio exit chime handles it,
    // and announcing every push would flood the polite region.
  }

  function tip() {
    const a = A(), i = I()
    if (!a || !i) return
    a.polite(i.t('ann.tip'))
  }

  function gameOver(snap) {
    const a = A(), i = I()
    if (!a || !i) return
    a.assertive(i.t('ann.gameOver', {score: snap.score}))
  }

  function pause(paused) {
    const a = A(), i = I()
    if (!a || !i) return
    a.assertive(i.t(paused ? 'ann.pause' : 'ann.unpause'))
  }

  return {
    levelStart, levelClear, roundUp, loseLife, pushOut, tip, gameOver, pause,
  }
})()
