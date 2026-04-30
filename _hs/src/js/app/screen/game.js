/**
 * Game screen — the active race.
 *
 * Owns:
 *   - the throw key (Space / KeyJ; held = isPressing for stamina drain;
 *     edge-trigger = tap)
 *   - F1-F7 status hotkeys, each routed through aria-live (assertive)
 *   - race lifecycle: starts via content.game.startRace on enter, calls
 *     content.audio.silenceAll() on exit
 *
 * Per CLAUDE.md, F1/F3/F5 capture-phase preventDefault to keep browser
 * defaults from stealing them.
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    finish: function (_e, args) {
      this.change('raceResult', args)
    },
    pause: function () {
      this.change('mode')
    },
  },
  state: {
    pendingMode: 'quick',
    keyDownHandler: null,
    keyUpHandler: null,
    statusHandler: null,
    isPressing: false,
    finishArgs: null,
    waitFinishFrames: 0,
  },
  onReady: function () {
    // No DOM clicks to bind — all input is keyboard during the race.
  },
  onEnter: function (_e, args) {
    const mode = (args && args.mode) || 'quick'
    this.state.pendingMode = mode
    this.state.finishArgs = null
    this.state.waitFinishFrames = 0
    this.state.isPressing = false

    const onFinish = (result) => {
      this.state.finishArgs = result
      // Wait a few seconds for the photo-finish line to land before
      // transitioning so the assertive announcement isn't cut off.
      this.state.waitFinishFrames = 180  // ~3s at 60fps
    }

    if (mode === 'mp-host') {
      content.game.startMpHost({lobby: args && args.lobby, onFinish})
    } else if (mode === 'mp-client') {
      content.game.startMpClient({startMsg: args && args.startMsg, onFinish})
    } else {
      content.game.startRace({mode, onFinish})
    }

    bindKeys.call(this)
    try {
      content.commentator.announce(app.i18n.t('game.help'), 'polite')
    } catch (e) {}
  },
  onExit: function () {
    unbindKeys.call(this)
    content.game.endIdle()
    content.audio.startOrgan()
  },
  onFrame: function () {
    try {
      const dt = engine.loop.delta()
      content.game.frame(dt)

      if (this.state.finishArgs) {
        if (this.state.waitFinishFrames > 0) {
          this.state.waitFinishFrames--
        } else {
          const args = this.state.finishArgs
          this.state.finishArgs = null
          app.screenManager.dispatch('finish', args)
          return
        }
      }

      const ui = app.controls.ui()
      if (ui.pause || ui.back) {
        app.screenManager.dispatch('pause')
      }
    } catch (e) {
      // CLAUDE.md: wrap onFrame in try/catch so a single throw doesn't kill
      // the loop. Log only.
      console.error(e)
    }
  },
})

function bindKeys() {
  // Throw key down: edge-trigger tap. In MP-client mode, the tap is
  // forwarded to the host; in all other modes it resolves locally.
  this.state.keyDownHandler = (ev) => {
    if (ev.code === 'Space' || ev.code === 'KeyJ') {
      ev.preventDefault()
      if (content.game.getMode() === 'mp-client') {
        content.game.clientTap()
      } else {
        content.player.tap()
      }
      return
    }
    if (ev.code === 'F1' || ev.code === 'F3' || ev.code === 'F5') {
      ev.preventDefault()
    }
    handleStatus(ev.code)
  }
  window.addEventListener('keydown', this.state.keyDownHandler, true)
}

function unbindKeys() {
  if (this.state.keyDownHandler) {
    window.removeEventListener('keydown', this.state.keyDownHandler, true)
    this.state.keyDownHandler = null
  }
}

function handleStatus(code) {
  // MP-client doesn't run a local race FSM, so prefer game.getHorses() for a
  // mode-agnostic source of truth and synthesize a status object.
  const horses = content.game.getHorses()
  const player = horses.find((h) => h.isPlayer)
  if (!player) return
  const ranked = horses.slice().sort((a, b) => b.distance - a.distance)
  const myIdx = ranked.findIndex((h) => h.isPlayer)
  const total = horses.length
  const isMp = content.game.getMode() === 'mp-host' || content.game.getMode() === 'mp-client'
  const status = isMp
    ? {trackLength: content.race.TRACK_LENGTH, elapsed: 0}
    : content.race.getStatus()

  switch (code) {
    case 'F1': {
      content.commentator.announce(
        app.i18n.t('status.position', {n: myIdx + 1, total}),
        'assertive'
      )
      break
    }
    case 'F2': {
      content.commentator.announce(
        app.i18n.t('status.stamina', {pct: Math.round(player.stamina * 100)}),
        'assertive'
      )
      break
    }
    case 'F3': {
      content.commentator.announce(
        app.i18n.t('status.distance', {
          travelled: Math.round(player.distance),
          total: status.trackLength,
        }),
        'assertive'
      )
      break
    }
    case 'F4': {
      const leader = ranked[0]
      const gap = Math.round(leader.distance - player.distance)
      if (leader.isPlayer) {
        const second = ranked[1]
        const ahead = second ? Math.round(player.distance - second.distance) : 0
        content.commentator.announce(
          app.i18n.t('status.gapLeaderYou', {gap: ahead}),
          'assertive'
        )
      } else {
        content.commentator.announce(
          app.i18n.t('status.gapLeader', {gap}),
          'assertive'
        )
      }
      break
    }
    case 'F5': {
      content.commentator.announce(
        app.i18n.t('status.elapsed', {seconds: status.elapsed.toFixed(1)}),
        'assertive'
      )
      break
    }
    case 'F6': {
      const points = content.championship.getState().points || {}
      const summary = horses.map((h) => content.race.nameOf(h) + ' ' + (points[h.id] || 0)).join(', ')
      content.commentator.announce(
        app.i18n.t('status.standings', {summary}),
        'assertive'
      )
      break
    }
    case 'F7': {
      const cs = content.championship.getState()
      content.commentator.announce(
        app.i18n.t('status.raceIndex', {n: cs.raceIndex + 1, total: cs.raceCount}),
        'assertive'
      )
      break
    }
  }
}
