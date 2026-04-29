// Verbal announcements for the screen-reader live region. Mirrors the
// audio relay pattern in content/audio.js: methods take canonical args
// ('player'/'ai' = team 1/team 2), translate to the local listener's
// own perspective + locale, and (when a relay is set on the host) also
// queue the canonical event so each client can replay it through its
// own announcer with its own perspective + locale.
content.announcer = (() => {
  let _relay = null
  function relay(name, args) {
    if (!_relay) return
    try { _relay(name, args) } catch (e) {}
  }

  function set(message) {
    const el = document.querySelector('.js-announcer')
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = message }, 50)
  }

  function isMultiplayer() {
    return !!(content.teamManager && content.teamManager.isMultiplayer())
  }

  // Map canonical owner ('player'/'ai' = team 1/team 2) to whether it
  // refers to the local listener's own paddle.
  function isOwnerSelf(owner) {
    const isTeam2 = content.teamManager && content.teamManager.isTeam2()
    return isTeam2 ? owner === 'ai' : owner === 'player'
  }

  function opponentLabel() {
    return isMultiplayer() ? app.i18n.t('ann.opponent') : app.i18n.t('ann.computer')
  }
  function opponentLabelLower() {
    return isMultiplayer() ? app.i18n.t('ann.opponentLower') : app.i18n.t('ann.computerLower')
  }

  function localScores(playerScore, aiScore) {
    const isTeam2 = content.teamManager && content.teamManager.isTeam2()
    return isTeam2 ? { you: aiScore, them: playerScore } : { you: playerScore, them: aiScore }
  }

  const POWERUP_KEYS = {
    widePaddle:  ['pup.wide.self',   'pup.wide.other'],
    shield:      ['pup.shield.self', 'pup.shield.other'],
    strongSwing: ['pup.strong.self', 'pup.strong.other'],
    curve:       ['pup.curve.self',  'pup.curve.other'],
    bouncyWalls: ['pup.bouncy.self', 'pup.bouncy.other'],
  }

  return {
    setRelay: (fn) => { _relay = fn },

    serveStart: (who) => {
      relay('serveStart', [who])
      set(isOwnerSelf(who)
        ? app.i18n.t('ann.youServe')
        : app.i18n.t('ann.opponentServes', { opponent: opponentLabel() }))
    },

    serveTransfer: (to) => {
      relay('serveTransfer', [to])
      set(isOwnerSelf(to)
        ? app.i18n.t('ann.serveTransferYou')
        : app.i18n.t('ann.serveTransferOther', {
            opponentLower: opponentLabelLower(),
            opponent: opponentLabel(),
          }))
    },

    goal: (scorer, playerScore, aiScore) => {
      relay('goal', [scorer, playerScore, aiScore])
      const { you, them } = localScores(playerScore, aiScore)
      set(isOwnerSelf(scorer)
        ? app.i18n.t('ann.goalYou', { you, them })
        : app.i18n.t('ann.goalOther', { opponent: opponentLabel(), you, them }))
    },

    gameOver: (winner, playerScore, aiScore) => {
      relay('gameOver', [winner, playerScore, aiScore])
      const { you, them } = localScores(playerScore, aiScore)
      set(isOwnerSelf(winner)
        ? app.i18n.t('ann.gameOverWin', { you, them })
        : app.i18n.t('ann.gameOverLose', { opponent: opponentLabel(), you, them }))
    },

    // owner = canonical picker (the team whose end the powerup spawned
    // on). For freeze, the freeze applies to owner's opponent — sec is
    // the freeze duration on that opponent paddle.
    powerup: (type, owner, sec) => {
      relay('powerup', [type, owner, sec])
      const self = isOwnerSelf(owner)
      const opponent = opponentLabel()
      const opponentLower = opponentLabelLower()

      if (type === 'freeze') {
        const secStr = sec != null ? sec.toFixed(1) : ''
        set(self
          ? app.i18n.t('pup.freeze.selfFroze', { opponentLower, sec: secStr })
          : app.i18n.t('pup.freeze.otherFroze', { opponent, sec: secStr }))
        return
      }

      const keys = POWERUP_KEYS[type]
      if (!keys) return
      const secStr = sec != null ? sec.toFixed(0) : ''
      set(self
        ? app.i18n.t(keys[0], { sec: secStr })
        : app.i18n.t(keys[1], { opponent, sec: secStr }))
    },

    tag: (teamNum, outName, inName) => {
      relay('tag', [teamNum, outName, inName])
      set(app.i18n.t('ann.tag', { out: outName, in: inName, n: teamNum }))
    },
  }
})()
