// Game screen. Per frame:
//   1. Read movement (arrows) + action keys (D/A/S) from the keyboard.
//   2. In single-player or multiplayer-host: tick the match locally
//      with those inputs and (in mphost) broadcast the snapshot to
//      the client.
//   3. In multiplayer-client: send local inputs to host instead of
//      simulating; rely on the snapshot stream to drive state.
//
// The action keys (D/A/S) are edge-detected — we only fire on the
// frame they go from up→down so a held key doesn't spam swings.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    matchEnd: function () { this.change('gameover') },
    leave: function () { this.change('splash') },
  },
  state: {
    entryFrames: 0,
    prevActionKeys: {},
    prevInfoKey: false,
    netListeners: null,
    arrowPreventer: null,
    snapAccumulator: 0,
    inputAccumulator: 0,
    lastTime: 0,
  },
  onReady: function () {
    content.announcer.attach()
    content.wiring.attach()
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.prevActionKeys = {}
    this.state.snapAccumulator = 0
    this.state.inputAccumulator = 0
    this.state.lastTime = engine.time()

    // Some browsers swallow simultaneous arrow keydowns for page
    // scrolling, which can break diagonal movement. Block the default
    // for arrows while the game screen owns input.
    this.state.arrowPreventer = (e) => {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown'
          || e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', this.state.arrowPreventer)

    content.audio.start()

    const mode = content.match.getMode()
    if (mode === 'mphost' || mode === 'mpclient') {
      this.attachNetListeners()
    }

    this.renderHud()
  },
  onExit: function () {
    this.detachNetListeners()
    if (this.state.arrowPreventer) {
      window.removeEventListener('keydown', this.state.arrowPreventer)
      this.state.arrowPreventer = null
    }
    content.audio.stop()
    content.match.reset()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }

    const now = engine.time()
    const dt = Math.min(0.05, Math.max(0, now - this.state.lastTime))
    this.state.lastTime = now

    // Debug key (I = "info"): announce coordinates assertively.
    const dbgKeys = engine.input.keyboard.get()
    const infoDown = !!dbgKeys.KeyI
    if (infoDown && !this.state.prevInfoKey) this.announceDebug()
    this.state.prevInfoKey = infoDown

    const ui = app.controls.ui()
    if (ui.back) {
      // Exit to menu (and disconnect if multiplayer).
      if (content.match.getMode() === 'mphost' || content.match.getMode() === 'mpclient') {
        app.net.disconnect('left')
      }
      app.screenManager.dispatch('leave')
      return
    }

    const controls = this.readControls()
    const mode = content.match.getMode()

    if (mode === 'single') {
      this.actOnLocalControls(controls)
      content.match.tick(dt, this.toMatchInput(controls))
      // Process events for announcer / replay path.
      const events = content.match.drainEvents()
      for (const ev of events) content.events.emit('netEvent', ev)
    } else if (mode === 'mphost') {
      this.actOnLocalControls(controls)
      content.match.tick(dt, this.toMatchInput(controls))
      const events = content.match.drainEvents()
      for (const ev of events) content.events.emit('netEvent', ev)
      // 30 Hz snapshot rate.
      this.state.snapAccumulator += dt
      if (this.state.snapAccumulator >= 1 / 30) {
        this.state.snapAccumulator = 0
        const snap = content.match.snapshot()
        snap.events = (snap.events || []).concat(events)
        app.net.broadcast({type: 'snap', ...snap})
      }
    } else if (mode === 'mpclient') {
      // Send inputs ~30 Hz.
      this.state.inputAccumulator += dt
      if (this.state.inputAccumulator >= 1 / 30) {
        this.state.inputAccumulator = 0
        const input = this.toMatchInput(controls)
        app.net.sendToHost({
          type: 'input',
          t: now,
          moveX: input.moveX,
          moveY: input.moveY,
          swing: this.consumeSwingEdge(controls),
          serve: this.consumeServeEdge(controls),
        })
      }
      // Tick: just run audio + local interpolation. Position is set
      // by snapshot; we still want footsteps and ball whoosh to play.
      content.match.tick(dt, {moveX: 0, moveY: 0})
    }

    if (content.match.isMatchEnd() && !content.match.isMatchEndAcknowledged()) {
      content.match.ackMatchEnd()
      // Brief delay handled by match's pointEndTimer; transition now.
      app.screenManager.dispatch('matchEnd')
      return
    }

    this.renderHud()
  },

  readControls: function () {
    const game = app.controls.game()
    // Movement: game.x = +1 ArrowUp / -1 ArrowDown; game.y = +1 ArrowLeft, -1 ArrowRight.
    // Action keys are not in the standard ui()/game() shape, so read raw.
    const keys = engine.input.keyboard.get()
    const actions = {
      forehand: !!keys.KeyD,
      backhand: !!keys.KeyA,
      smash: !!keys.KeyS,
    }
    return {
      x: game.x || 0,
      y: game.y || 0,
      actions,
    }
  },

  // Translate raw adapter axes into court directions for the local
  // side. Adapter convention: c.x = +1 ArrowUp / -1 ArrowDown,
  // c.y = +1 ArrowLeft / -1 ArrowRight. Court convention: +moveX =
  // east, +moveY = south. "Forward" (toward the net) means -y for the
  // south player and +y for the north player.
  toMatchInput: function (c) {
    const localSide = content.match.getLocalSide()
    const forwardSign = localSide === 'south' ? -1 : +1
    return {
      moveX: -c.y,
      moveY: c.x * forwardSign,
      actions: c.actions,
    }
  },

  // Edge-detect swing keys for the local player. Returns 'forehand' |
  // 'backhand' | 'smash' | null.
  consumeSwingEdge: function (controls) {
    const a = controls.actions
    const prev = this.state.prevActionKeys
    let kind = null
    if (a.forehand && !prev.forehand) kind = 'forehand'
    else if (a.backhand && !prev.backhand) kind = 'backhand'
    else if (a.smash && !prev.smash) kind = 'smash'
    this.state.prevActionKeys = {...a}
    return kind
  },

  // The action keys also serve as serve initiation, but it's the same
  // edge — we just call the right path locally and let the host route.
  consumeServeEdge: function () {
    return false
  },

  // Apply the local-side swing/serve action. In single-player and
  // mphost mode the local player is south; in mpclient mode this is
  // never called because we send to host instead.
  actOnLocalControls: function (controls) {
    const localSide = content.match.getLocalSide()
    const swing = this.consumeSwingEdge(controls)
    if (!swing) return
    const ballState = content.ball.getState()
    const isServer = content.scoring.getServer() === localSide
    if (ballState === 'idle' && isServer) {
      content.match.requestServe(localSide)
    } else if (ballState !== 'idle') {
      content.match.requestSwing(localSide, swing)
    }
  },

  // Spoken debug dump for the I key. Reports coordinates in court
  // units (metres) using compass directions so they're readable by
  // ear: +y = south, -y = north, +x = east, -x = west.
  announceDebug: function () {
    const players = content.match.getPlayers()
    const localSide = content.match.getLocalSide()
    const me = localSide === 'south' ? players.south : players.north
    if (!me) return
    const ball = content.ball.getPosition()
    const ballV = content.ball.getVelocity()
    const ballSp = Math.sqrt(ballV.x*ballV.x + ballV.y*ballV.y + ballV.z*ballV.z)
    const dist = me.distanceToBall()
    const ns = (v) => v >= 0 ? `${v.toFixed(1)} south` : `${(-v).toFixed(1)} north`
    const ew = (v) => v >= 0 ? `${v.toFixed(1)} east` : `${(-v).toFixed(1)} west`
    const msg = [
      `You ${ew(me.x)}, ${ns(me.y)}.`,
      `Ball ${ew(ball.x)}, ${ns(ball.y)}, height ${ball.z.toFixed(1)}.`,
      `${content.ball.getState()}, ${ballSp.toFixed(0)} metres per second.`,
      `Distance ${dist.toFixed(1)}.`,
    ].join(' ')
    app.announce.assertive(msg)
  },

  attachNetListeners: function () {
    if (this.state.netListeners) return
    const onMessage = (entry) => {
      const msg = entry && entry.msg
      if (!msg || typeof msg !== 'object') return
      if (content.match.getMode() === 'mphost' && msg.type === 'input') {
        const dt = 1 / 30  // we apply at the input rate
        content.match.applyRemoteInput('north', msg, dt)
        if (msg.swing) content.match.requestSwing('north', msg.swing)
        if (msg.serve) content.match.requestServe('north')
      } else if (content.match.getMode() === 'mpclient' && msg.type === 'snap') {
        content.match.applySnapshot(msg)
        if (content.match.isMatchEnd() && !content.match.isMatchEndAcknowledged()) {
          // Snapshot path also detects match end.
        }
      }
    }
    const onClose = () => {
      // Opponent disconnected.
      content.events.emit('netEvent', {kind: 'disconnect'})
      // In mphost mode this is a forfeit; in mpclient mode it's the host leaving.
      app.screenManager.dispatch('leave')
    }
    app.net.on('message', onMessage)
    app.net.on('close', onClose)
    this.state.netListeners = {onMessage, onClose}
  },
  detachNetListeners: function () {
    const ls = this.state.netListeners
    if (!ls) return
    app.net.off('message', ls.onMessage)
    app.net.off('close', ls.onClose)
    this.state.netListeners = null
  },

  renderHud: function () {
    const score = content.scoring.getScore()
    const localSide = content.match.getLocalSide()
    const oppSide = localSide === 'south' ? 'north' : 'south'
    const setNum = score.setHistory.length + 1
    const text = app.i18n.t('game.score', {
      set: setNum,
      you: score.sets[localSide],
      them: score.sets[oppSide],
      gameYou: score.games[localSide],
      gameThem: score.games[oppSide],
    })
    const el = this.rootElement.querySelector('.a-game--score')
    if (el && el.textContent !== text) el.textContent = text
  },
})
