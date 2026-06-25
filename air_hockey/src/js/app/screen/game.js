// The game screen: the only place that reads raw input, drives the continuous
// audio voices each frame, fires F1–F4 status hotkeys, announces (polite score,
// assertive goals + danger), runs the rising-edge wall-bump probe, and drives
// haptics. The sim (content.game) stays audio- and DOM-free; this layer bridges.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    back: function () { this.change('menu') },
    gameover: function (payload) { this.change('gameover', payload) },
  },
  state: {
    unsubs: [],
    opts: {},
    dangerAnnounced: false,
    wasBlocked: false,
    lastBumpAt: 0,
    elapsed: 0,
    pendingResult: null,
  },
  onReady: function () {
    this._onKey = (e) => { try { this._handleHotkey(e) } catch (err) { console.error(err) } }
  },

  onEnter: function (e) {
    this.state.opts = e || {}
    this.state.dangerAnnounced = false
    this.state.wasBlocked = false
    this.state.lastBumpAt = 0
    this.state.elapsed = 0
    this.state.pendingResult = null

    content.audio.start()
    this._bindEvents()
    content.game.start({
      difficulty: this.state.opts.difficulty || 'medium',
      target: this.state.opts.target || content.constants.MATCH_TARGET_DEFAULT,
    })
    window.addEventListener('keydown', this._onKey, true)
    engine.loop.resume()
  },

  onExit: function () {
    window.removeEventListener('keydown', this._onKey, true)
    for (const u of this.state.unsubs) { try { u() } catch (e) {} }
    this.state.unsubs = []
    content.game.stop()
    content.audio.silenceAll()
    content.audio.stop()
    engine.loop.pause()
  },

  _bindEvents: function () {
    const on = (n, fn) => this.state.unsubs.push(content.events.on(n, fn))
    on('serve', (e) => {
      app.announce.polite(app.i18n.t(e.who === 'you' ? 'ann.serveYou' : 'ann.serveOpp'))
    })
    on('scored', (e) => {
      const mine = e.scorer === 'you'
      app.announce.assertive(app.i18n.t(mine ? 'ann.youScore' : 'ann.oppScore', { you: e.you, opp: e.opp }))
      if (e.you === e.target - 1 || e.opp === e.target - 1) {
        app.announce.polite(app.i18n.t('ann.matchPoint'))
      }
      if (app.haptics) app.haptics.enqueue({ duration: mine ? 200 : 120, strongMagnitude: mine ? 0.5 : 0.3, weakMagnitude: 0.3 })
    })
    on('threat', (e) => {
      if (e.bucket >= 4 && !this.state.dangerAnnounced) {
        this.state.dangerAnnounced = true
        app.announce.assertive(app.i18n.t('ann.danger'))
      }
    })
    on('threatClear', () => { this.state.dangerAnnounced = false })
    on('malletHit', (e) => {
      if (e.who === 'you' && app.haptics) app.haptics.enqueue({ duration: 70, strongMagnitude: 0.2, weakMagnitude: 0.45 })
    })
    on('matchOver', (e) => {
      this.state.pendingResult = { winner: e.winner, you: e.you, opp: e.opp, difficulty: e.difficulty, target: content.game.getTarget() }
    })
  },

  onFrame: function (e) {
    try {
      const dt = Math.min(0.05, e && e.delta || 1 / 60)
      this.state.elapsed += dt

      const ui = app.controls.ui()
      if (ui.back || ui.pause) { app.screenManager.dispatch('back'); return }

      // Control frame → screen space. controls.game(): x = forward(+1)/back(-1),
      // y = left(+1)/right(-1). Screen: forward = north = -y, left = -x.
      const c = app.controls.game()
      const inX = -(c.y || 0), inY = -(c.x || 0)
      content.mallet.setInput({ x: inX, y: inY })

      const before = content.mallet.getPosition()
      content.game.update(dt)
      content.audio.frame()
      this._wallBumpProbe(before, inX, inY)

      if (app.haptics) app.haptics.update(dt)

      if (this.state.pendingResult) {
        const r = this.state.pendingResult
        this.state.pendingResult = null
        app.screenManager.dispatch('gameover', r)
      }
    } catch (err) { console.error(err) }
  },

  // Rising-edge "you hit a wall" cue: if you're pressing into a boundary (a rail
  // or the centre line) and the mallet didn't move, play a soft mallet-bump
  // sound (distinct from the puck's rail thunk) + a buzz — otherwise a blind
  // player thinks input was lost. Throttled so holding against a rail doesn't
  // spam, and no spoken "wall".
  _wallBumpProbe: function (before, inX, inY) {
    const pressing = inX !== 0 || inY !== 0
    const after = content.mallet.getPosition()
    const moved = Math.hypot(after.x - before.x, after.y - before.y)
    const blocked = pressing && moved < 0.0004
    if (blocked && !this.state.wasBlocked && this.state.elapsed - this.state.lastBumpAt > 0.4) {
      this.state.lastBumpAt = this.state.elapsed
      content.audio.malletBump(after.x, after.y)
      if (app.haptics) app.haptics.enqueue({ duration: 90, strongMagnitude: 0.35, weakMagnitude: 0.15 })
    }
    this.state.wasBlocked = blocked
  },

  // ---- status hotkeys ----
  _handleHotkey: function (e) {
    if (e.code === 'F1' || e.code === 'F3' || e.code === 'F5') e.preventDefault()
    const v = content.game.view()
    if (e.code === 'F1') {
      app.announce.assertive(app.i18n.t('ann.score', { you: v.you, opp: v.opp }))
    } else if (e.code === 'F2') {
      app.announce.assertive(this._puckBearing(v))
    } else if (e.code === 'F3') {
      app.announce.assertive(this._malletPosition(v))
    } else if (e.code === 'F4') {
      app.announce.assertive(app.i18n.t('ann.state', {
        diff: app.i18n.t('diff.' + v.difficulty),
        target: v.target,
        serve: app.i18n.t(v.server === 'you' ? 'ann.serveYou' : 'ann.serveOpp'),
      }))
    }
  },

  // Puck bearing relative to your facing (north = ahead) + distance.
  _puckBearing: function (v) {
    const dx = v.puck.x - v.mallet.x
    const dy = v.puck.y - v.mallet.y // screen +y = behind you (south)
    const vert = dy < -0.12 ? app.i18n.t('dir.ahead') : dy > 0.12 ? app.i18n.t('dir.behind') : app.i18n.t('dir.level')
    const horiz = dx > 0.08 ? app.i18n.t('dir.right') : dx < -0.08 ? app.i18n.t('dir.left') : app.i18n.t('dir.centre')
    const dist = Math.hypot(dx, dy)
    return app.i18n.t('ann.puck', { vert, horiz, dist: this._dist(dist) })
  },

  _malletPosition: function (v) {
    const k = content.constants
    const hx = v.mallet.x / k.WIDTH
    const horiz = hx < 0.38 ? app.i18n.t('dir.left') : hx > 0.62 ? app.i18n.t('dir.right') : app.i18n.t('dir.centre')
    // y within your half: LENGTH/2 (forward, at centre line) → LENGTH (deep, at your goal)
    const t = (v.mallet.y - k.LENGTH / 2) / (k.LENGTH / 2)
    const depth = t > 0.6 ? app.i18n.t('dir.deep') : t < 0.3 ? app.i18n.t('dir.forward') : app.i18n.t('dir.mid')
    return app.i18n.t('ann.mallet', { horiz, depth })
  },

  _dist: function (m) {
    if (m < 1) return app.i18n.t('ann.cm', { n: Math.round(m * 100) })
    return app.i18n.t('ann.m', { n: m.toFixed(1) })
  },
})
