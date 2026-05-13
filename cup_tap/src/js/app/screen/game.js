/**
 * TAPPER! — game screen.
 *
 * Reads input via app.controls.game() each frame, plus a window-level
 * keydown for Space (action), Escape (pause), and F1–F4 (status).
 *
 * Wraps the per-frame body in try/catch to avoid bricking the syngen
 * loop on a stray throw. Hands the snapshot to content.audio.frame()
 * so continuous voices stay synced.
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause:    function () {},
    gameover: function () { this.change('gameover') },
  },
  state: {
    entryFrames: 0,
    paused: false,
    pendingGameOver: false,
    keys: null,           // {ArrowUp:bool, ArrowDown:bool, ArrowLeft:bool, ArrowRight:bool, action:bool, ...}
    keyHandler: null,
    lastTime: 0,
    hudCache: {},
  },
  onReady: function () {
    const root = this.rootElement
    this.state.hudCache.theme = root.querySelector('.a-game--theme')
    this.state.hudCache.level = root.querySelector('.a-game--level')
    this.state.hudCache.score = root.querySelector('.a-game--score')
    this.state.hudCache.lives = root.querySelector('.a-game--lives')
    this.state.hudCache.lanes = root.querySelector('.a-game--lanes')
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.paused = false
    this.state.pendingGameOver = false
    this.state.keys = {}
    this.state.lastTime = performance.now() / 1000
    app.utility.focus.setWithin(this.rootElement)
    if (app.announce) app.announce.clear()

    content.game.start()
    // Open the online leaderboard session at run start so play_seconds
    // is measured from "pressed Play" per /home/scores/INTEGRATION.md.
    // Drop any stale session from a previous run that quit without
    // submitting, so the new run's timer starts fresh.
    // Fire-and-forget — local highscores are the authoritative fallback.
    if (app.scores) {
      app.scores.dropSession()
      app.scores.openSession()
    }
    content.game.setCallbacks({
      onLifeLost: () => {},
      onGameOver: (info) => this.handleGameOver(info),
      onLevelClear: () => {},
    })

    // Window-level keydown so arrow-key navigation can't be lost to focus
    // weirdness. We read all gameplay keys directly here instead of going
    // through app.controls.game() — its axis semantics (forward = +x,
    // strafe = ±y, ArrowLeft/Right = rotate) don't fit a lane-walker.
    const ACTION_CODES = {Space: 1, Enter: 1, KeyJ: 1, KeyK: 1}
    const STATUS_CODES = {F1: 1, F2: 1, F3: 1, F4: 1}
    const GAMEPLAY_CODES = {
      ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1,
      KeyW: 1, KeyS: 1, KeyA: 1, KeyD: 1,
      Space: 1, Enter: 1, KeyJ: 1, KeyK: 1,
    }
    const onKey = (e) => {
      const code = e.code
      if (STATUS_CODES[code]) {
        e.preventDefault()
        if (e.type === 'keydown' && !e.repeat) this.readStatus(code)
        return
      }
      if (code === 'F5') {
        e.preventDefault()
        return
      }
      if (e.type === 'keydown') {
        if (code === 'Escape' || code === 'Backspace') {
          e.preventDefault()
          this.togglePause()
          return
        }
        if (GAMEPLAY_CODES[code]) {
          e.preventDefault()
          // Set held flag — auto-repeat re-enters the same path harmlessly.
          if (ACTION_CODES[code]) this.state.keys.action = true
          else this.state.keys[code] = true
        }
      } else if (e.type === 'keyup') {
        if (GAMEPLAY_CODES[code]) {
          e.preventDefault()
          if (ACTION_CODES[code]) {
            // Only clear action if no other action key is held — but tracking
            // each one separately is cheaper: clear only the released key,
            // and recompute action.
            this.state.keys[code] = false
            // If any action key still pressed, action stays true.
            this.state.keys.action = !!(
              this.state.keys.Space || this.state.keys.Enter ||
              this.state.keys.KeyJ || this.state.keys.KeyK
            )
          } else {
            this.state.keys[code] = false
          }
        }
      }
    }
    this.state.keyHandler = onKey
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('keyup', onKey, true)

    if (engine.loop.isPaused()) engine.loop.resume()
  },
  onExit: function () {
    if (this.state.keyHandler) {
      window.removeEventListener('keydown', this.state.keyHandler, true)
      window.removeEventListener('keyup', this.state.keyHandler, true)
      this.state.keyHandler = null
    }
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },
  togglePause: function () {
    this.state.paused = !this.state.paused
    content.game.setPaused(this.state.paused)
    if (content.announcer && content.announcer.pause) content.announcer.pause(this.state.paused)
    if (this.state.paused) {
      if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    }
  },
  readStatus: function (code) {
    const snap = content.game.snapshot()
    const i = app.i18n
    if (!snap || !i) return
    if (code === 'F1') {
      const ln = snap.lanes[snap.player.lane]
      const len = ln ? ln.length : 1
      const x = snap.player.x
      let posKey = 'ann.posMid'
      if (x <= 0.5) posKey = 'ann.posKegs'
      else if (x >= len - 1.2) posKey = 'ann.posDoor'
      app.announce.polite(i.t('ann.statusPos', {lane: snap.player.lane + 1, pos: i.t(posKey)}))
    } else if (code === 'F2') {
      app.announce.polite(i.t('ann.statusScore', {score: snap.score, level: snap.level, lives: snap.lives}))
    } else if (code === 'F3') {
      let best = null
      for (let li = 0; li < snap.lanes.length; li++) {
        const ln = snap.lanes[li]
        for (const c of ln.customers) {
          if (c.leaving) continue
          const dist = c.x // distance from kegs
          if (best == null || dist < best.dist) {
            best = {dist, lane: li + 1, x: c.x, len: ln.length}
          }
        }
      }
      if (best) {
        const pct = Math.round(100 * (1 - best.x / Math.max(1, best.len - 1)))
        app.announce.polite(i.t('ann.statusNearest', {lane: best.lane, pct}))
      } else {
        app.announce.polite(i.t('ann.statusNoCustomers'))
      }
    } else if (code === 'F4') {
      const lanes = []
      let count = 0
      for (let li = 0; li < snap.lanes.length; li++) {
        const ln = snap.lanes[li]
        let any = false
        for (const m of ln.mugs) if (m.kind === 'empty') { any = true; count++ }
        if (any) lanes.push(li + 1)
      }
      if (count > 0) {
        app.announce.polite(i.t('ann.statusEmpties', {count, lanes: lanes.join(', ')}))
      } else {
        app.announce.polite(i.t('ann.statusNoEmpties'))
      }
    }
  },
  handleGameOver: function (info) {
    if (this.state.pendingGameOver) return
    this.state.pendingGameOver = true
    app._lastGameOverInfo = info
    setTimeout(() => {
      app.screenManager.dispatch('gameover')
    }, 350)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        // First frame may have a 0 dt; refresh time anchor.
        this.state.lastTime = performance.now() / 1000
        return
      }
      const now = performance.now() / 1000
      let dt = now - this.state.lastTime
      this.state.lastTime = now
      // Clamp dt so a tab-switch doesn't teleport everything.
      if (!isFinite(dt) || dt < 0) dt = 1 / 60
      if (dt > 0.1) dt = 0.1

      // Drain any UI delta so it doesn't pile up — we don't use it here
      // (the game screen reads keys directly through window listeners).
      app.controls.ui()

      const k = this.state.keys || {}
      // Up/Down arrows or W/S → lane delta. Lane delta is rising-edge-only
      // inside content.game, so holding the key won't repeat-swap.
      const up = !!(k.ArrowUp || k.KeyW)
      const dn = !!(k.ArrowDown || k.KeyS)
      let laneDelta = 0
      if (up && !dn) laneDelta = -1
      else if (dn && !up) laneDelta = 1

      // Left/Right arrows or A/D → walk. Continuous.
      const left = !!(k.ArrowLeft || k.KeyA)
      const right = !!(k.ArrowRight || k.KeyD)
      let walk = 0
      if (left && !right) walk = -1
      else if (right && !left) walk = 1

      // Gamepad fallback: read the analog axes from app.controls.game()
      // and use them when the keyboard is idle. Forward/backward (g.x) →
      // lane; strafe (g.y) → walk, with the adapter's sign convention.
      if (laneDelta === 0 && walk === 0) {
        const g = app.controls.game()
        if (g.x > 0.5) laneDelta = -1
        else if (g.x < -0.5) laneDelta = 1
        if (g.y > 0.5) walk = -1
        else if (g.y < -0.5) walk = 1
      }

      const action = !!k.action
      content.game.setInput({laneDelta, walk, action})
      content.game.frame(dt)

      const snap = content.game.snapshot()
      content.audio.frame(snap, dt)
      this.renderHud(snap)
    } catch (e) { console.error(e) }
  },
  renderHud: function (snap) {
    const c = this.state.hudCache
    const i = app.i18n
    if (c.theme) c.theme.textContent = i.t('game.hudTheme', {name: i.t(snap.rules.themeNameKey)})
    if (c.level) c.level.textContent = i.t('game.hudLevel', {n: snap.level})
    if (c.score) c.score.textContent = i.t('game.hudScore', {n: snap.score})
    if (c.lives) c.lives.textContent = i.t('game.hudLives', {n: snap.lives})
    if (c.lanes) c.lanes.textContent = this.renderLanes(snap)
  },
  renderLanes: function (snap) {
    // ASCII layout, longest lane shown at maximum width and shorter lanes
    // padded so the kegs (left) and door (right) align meaningfully.
    const W = Math.max(...snap.lanes.map((l) => l.length))
    const lines = []
    for (let i = 0; i < snap.lanes.length; i++) {
      const ln = snap.lanes[i]
      const cells = new Array(W).fill(' ')
      // bar surface
      for (let x = 0; x < ln.length; x++) cells[x] = '·'
      // tips
      for (const t of ln.tips) {
        const ix = clampInt(Math.round(t.x), 0, ln.length - 1)
        cells[ix] = '$'
      }
      // mugs
      for (const m of ln.mugs) {
        const ix = clampInt(Math.round(m.x), 0, ln.length - 1)
        cells[ix] = m.kind === 'full' ? '>' : '<'
      }
      // customers
      for (const c of ln.customers) {
        const ix = clampInt(Math.round(c.x), 0, ln.length - 1)
        cells[ix] = c.dwell > 0 ? 'd' : 'C'
      }
      // player on this lane
      if (i === snap.player.lane) {
        const px = clampInt(Math.round(snap.player.x), 0, ln.length - 1)
        cells[px] = '*'
      }
      // kegs and door brackets
      cells[0] = '|' // kegs (left edge)
      cells[ln.length - 1] = ']' // door (right edge of this lane)
      lines.push((i + 1) + ' ' + cells.join(''))
    }
    return lines.join('\n')
  },
})

function clampInt(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
