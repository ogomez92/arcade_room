// Translates content.events into accessible announcements. Subscribes
// once on module init; the same code path serves single-player and
// multiplayer (events that originated on the host are replayed on
// the client through content.events.emit('netEvent', ev)).
//
// The announcer is the bridge to app.announce.polite/assertive. It
// resolves "you" vs "opponent" using content.match.getLocalSide().
content.announcer = (() => {
  function localSide() { return content.match.getLocalSide ? content.match.getLocalSide() : 'south' }
  function opponentSide() { return localSide() === 'south' ? 'north' : 'south' }
  function isYou(side) { return side === localSide() }
  function opponentName() {
    return content.match.getOpponentName ? content.match.getOpponentName() : app.i18n.t('ann.opponent')
  }

  function pointSummaryText() {
    const sum = content.scoring.pointsSummary()
    if (sum.key === 'ann.scoreDeuce') return app.i18n.t('ann.scoreDeuce')
    if (sum.key === 'ann.scoreAdServer') {
      const server = content.scoring.getServer()
      return isYou(server) ? app.i18n.t('ann.scoreAdYou')
        : app.i18n.t('ann.scoreAdThem', {opponent: opponentName()})
    }
    if (sum.key === 'ann.scoreAdReceiver') {
      const recv = content.scoring.getReceiver()
      return isYou(recv) ? app.i18n.t('ann.scoreAdYou')
        : app.i18n.t('ann.scoreAdThem', {opponent: opponentName()})
    }
    const server = content.scoring.getServer()
    const sLabel = app.i18n.t(sum.serverKey)
    const rLabel = app.i18n.t(sum.receiverKey)
    const serverWord = isYou(server) ? app.i18n.t('ann.you') : opponentName()
    return app.i18n.t('ann.scoreCall', {
      server: serverWord,
      serverScore: sLabel,
      receiverScore: rLabel,
    })
  }

  function gameSummaryText(scorer, score) {
    const oppName = opponentName()
    if (isYou(scorer)) {
      return app.i18n.t('ann.gameYou', {gameYou: score.games[localSide()], gameThem: score.games[opponentSide()]})
    }
    return app.i18n.t('ann.gameThem', {opponent: oppName, gameYou: score.games[localSide()], gameThem: score.games[opponentSide()]})
  }

  function setSummaryText(scorer, score) {
    const oppName = opponentName()
    if (isYou(scorer)) {
      return app.i18n.t('ann.setYou', {setYou: score.sets[localSide()], setThem: score.sets[opponentSide()]})
    }
    return app.i18n.t('ann.setThem', {opponent: oppName, setYou: score.sets[localSide()], setThem: score.sets[opponentSide()]})
  }

  function handleEvent(ev) {
    switch (ev.kind) {
      case 'matchStart':
        app.announce.assertive(app.i18n.t('ann.matchStart'))
        break

      case 'serveSetup': {
        const server = ev.server
        if (isYou(server)) {
          app.announce.polite(app.i18n.t('ann.youServe') + ' ' + pointSummaryText())
        } else {
          app.announce.polite(
            app.i18n.t('ann.opponentServes', {opponent: opponentName()}) + ' ' + pointSummaryText()
          )
        }
        break
      }

      case 'fault': {
        const msg = ev.reason === 'net' ? app.i18n.t('ann.serveNet') : app.i18n.t('ann.serveOut')
        app.announce.polite(msg + ' ' + app.i18n.t('ann.serveFault'))
        break
      }

      case 'point': {
        const score = ev.score || content.scoring.getScore()
        const lines = []
        const oppName = opponentName()

        if (ev.reason === 'doubleFault') {
          lines.push(app.i18n.t('ann.doubleFault', {scorer: isYou(ev.scorer) ? app.i18n.t('ann.you') : oppName}))
        } else if (ev.reason === 'out') {
          lines.push(app.i18n.t('ann.outOfBounds'))
        } else if (ev.reason === 'net') {
          lines.push(app.i18n.t('ann.intoNet'))
        }

        // Did this point also win a game / set / match?
        // We can detect by checking whether the game count went up vs the
        // previous snapshot. Since the score in the event already reflects
        // the new game/set, compare with our cached "prior" via a heuristic:
        // if any set entry exists for this set and games are 0/0, a set
        // was just won.
        const games = score.games[ev.scorer] || 0
        const sets = score.sets[ev.scorer] || 0
        const wonGame = (score.points.south === 0 && score.points.north === 0)
        const wonSet = wonGame && (games === 0 && sets > 0)

        if (score.state === 'matchEnd' && score.matchWinner === ev.scorer) {
          lines.push(isYou(ev.scorer) ? app.i18n.t('ann.matchYou') : app.i18n.t('ann.matchThem', {opponent: oppName}))
        } else if (wonSet) {
          lines.push(setSummaryText(ev.scorer, score))
        } else if (wonGame) {
          lines.push(gameSummaryText(ev.scorer, score))
        } else {
          lines.push(isYou(ev.scorer)
            ? app.i18n.t('ann.pointYou')
            : app.i18n.t('ann.pointThem', {opponent: oppName}))
        }

        app.announce.assertive(lines.join(' '))
        break
      }

      case 'disconnect':
        app.announce.assertive(app.i18n.t('ann.disconnect'))
        break
    }
  }

  // Subscribe — but allow re-subscription idempotently.
  let attached = false
  function attach() {
    if (attached) return
    attached = true
    content.events.on('netEvent', handleEvent)
    content.events.on('serveSetup', (ev) => handleEvent({kind: 'serveSetup', ...ev}))
  }

  // For host: after each tick, walk the events the match emitted and
  // hand them to handleEvent. Also dispatch them through the netEvent
  // channel so the snapshot-replay path on the client uses the same
  // code (it already calls content.events.emit('netEvent', ev)).
  function processHostEvents(events) {
    for (const ev of events) handleEvent(ev)
  }

  return {
    attach,
    handleEvent,
    processHostEvents,
  }
})()
