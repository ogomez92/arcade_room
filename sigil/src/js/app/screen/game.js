// Sigil game screen. Orbit the compass ring to select a point, cycle its tone,
// and submit to "try" the sigil; review past tries to deduce. Turns content
// events into audio + screen-reader announcements and renders an aria-hidden
// visual ring. Audio + announcements are the real interface.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    pause: function () { this.change('pause') },
    gameOver: function () { this.change('gameover') },
  },
  state: {
    scoreEl: null, levelEl: null, attemptsEl: null, ringEl: null, gridEl: null,
    actionDown: {}, entryFrames: 0, wired: false,
  },

  onReady: function () {
    const root = this.rootElement
    this.state.scoreEl = root.querySelector('.a-game--score-value')
    this.state.levelEl = root.querySelector('.a-game--level-value')
    this.state.attemptsEl = root.querySelector('.a-game--attempts-value')
    this.state.ringEl = root.querySelector('.a-game--ring-value')
    this.state.gridEl = root.querySelector('.a-game--grid')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['F1', 'F2', 'F3', 'F4'].includes(e.key)) e.preventDefault()
      if ([' ', 'Spacebar', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault()
    })

    this.wireEvents()
  },

  wireEvents: function () {
    if (this.state.wired) return
    this.state.wired = true
    const self = this
    const A = () => content.audio
    const t = (k, p) => app.i18n.t(k, p)

    content.events.on('level-start', (e) => {
      content.audio.setStaticListener()
      A().levelStart()
      self.refreshHud(); self.renderGrid()
      // orient the player: sweep the ring so they hear where the points are
      setTimeout(() => { try { A().ringSweep(content.game.getGuess()) } catch (err) {} }, 420)
      app.announce.assertive(t('ann.levelStart', {level: e.level, positions: e.positions, colors: e.colors, guesses: e.guesses}))
    })
    content.events.on('select', (e) => {
      A().selectCue(e.pos, e.color)
      self.renderGrid()
      app.announce.polite(t('ann.select', {dir: self.dirWord(e.pos), tone: self.toneWord(e.color)}))
    })
    content.events.on('glyph', (e) => {
      A().glyphCue(e.pos, e.color)
      self.renderGrid()
      app.announce.polite(t('ann.glyph', {dir: self.dirWord(e.pos), tone: self.toneWord(e.color)}))
    })
    content.events.on('submit', (e) => {
      A().feedbackCue(e.exact, e.partial, e.positions)
      self.refreshHud()
      app.announce.assertive(t('ann.submit', {exact: e.exact, partial: e.partial, left: e.guessesLeft}))
    })
    content.events.on('play-guess', () => {
      A().ringSweep(content.game.getGuess())
      app.announce.polite(t('ann.guess', {guess: self.guessText(content.game.getGuess())}))
    })
    content.events.on('review', (e) => {
      A().ringSweep(e.guess)
      app.announce.polite(t('ann.review', {index: e.index + 1, total: e.total, guess: self.guessText(e.guess), exact: e.exact, partial: e.partial}))
    })
    content.events.on('review-empty', () => { A().blocked(); app.announce.polite(t('ann.noAttempts')) })
    content.events.on('score-change', () => self.refreshHud())
    content.events.on('level-clear', (e) => {
      A().levelClear(); self.refreshHud()
      app.announce.assertive(t('ann.levelClear', {level: e.level, bonus: e.bonus.total}))
    })
    content.events.on('sigil-failed', (e) => {
      A().gameOver()
      A().reveal(e.code)
      app.announce.assertive(t('ann.revealed', {guess: self.guessText(e.code)}))
    })
    content.events.on('game-over', (e) => {
      const high = app.highscores.qualifies(e.score)
      app.announce.assertive(high ? t('ann.gameOverHigh', {score: e.score}) : t('ann.gameOver', {score: e.score}))
      app.screenManager.dispatch('gameOver')
    })
  },

  onEnter: function () {
    content.audio.setStaticListener()
    content.audio.startAmbient()
    this.state.actionDown = {}
    this.state.entryFrames = 8
    app.utility.focus.setWithin(this.rootElement)
    this.refreshHud(); this.renderGrid()
    try { app.onlineScores.openSession().catch(() => {}) } catch (e) {}
  },

  onExit: function () {
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
  },

  onFrame: function () {
    try {
      content.game.update(1 / 60)
      const k = engine.input.keyboard
      const gp = engine.input.gamepad

      if (this.edge('pause', k.is('Escape') || gp.isDigital(9))) {
        app.announce.assertive(app.i18n.t('ann.paused'))
        app.screenManager.dispatch('pause')
        return
      }
      if (this.state.entryFrames > 0) { this.state.entryFrames--; this.primeInputs(k, gp); return }

      if (this.edge('left', k.is('ArrowLeft') || k.is('KeyA') || k.is('Numpad4') || gp.isDigital(14))) content.game.orbit(-1)
      if (this.edge('right', k.is('ArrowRight') || k.is('KeyD') || k.is('Numpad6') || gp.isDigital(15))) content.game.orbit(1)
      if (this.edge('up', k.is('ArrowUp') || k.is('KeyW') || k.is('Numpad8') || gp.isDigital(12))) content.game.cycle(1)
      if (this.edge('down', k.is('ArrowDown') || k.is('KeyS') || k.is('Numpad2') || k.is('Numpad5') || gp.isDigital(13))) content.game.cycle(-1)
      if (this.edge('submit', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))) content.game.submit()
      if (this.edge('play', k.is('KeyC') || gp.isDigital(2))) content.game.playGuess()
      if (this.edge('revPrev', k.is('KeyQ') || gp.isDigital(4))) content.game.reviewStep(-1)
      if (this.edge('revNext', k.is('KeyE') || gp.isDigital(5))) content.game.reviewStep(1)
      if (this.edge('f1', k.is('F1'))) this.announceStatus()
      if (this.edge('f2', k.is('F2'))) this.announceSelected()
      if (this.edge('f3', k.is('F3'))) this.announceGuess()
      if (this.edge('f4', k.is('F4'))) this.announceLast()
    } catch (err) {
      console.error(err)
    }
  },

  primeInputs: function (k, gp) {
    ['left', 'right', 'up', 'down', 'submit', 'play', 'revPrev', 'revNext', 'f1', 'f2', 'f3', 'f4'].forEach((nm) => { this.state.actionDown[nm] = false })
    // consume whatever is currently held so the entering keypress doesn't fire
    this.edge('submit', k.is('Enter') || k.is('NumpadEnter') || k.is('Space') || gp.isDigital(0))
  },
  edge: function (name, isDown) {
    const was = this.state.actionDown[name]
    this.state.actionDown[name] = isDown
    return isDown && !was
  },

  // ---- spoken text ----
  dirWord: function (pos) { return app.i18n.t('dir.' + content.board.nameOf(pos)) },
  toneWord: function (color) { return app.i18n.t('color.' + content.audio.colorName(color)) },
  guessText: function (guess) {
    const parts = []
    for (let pos = 0; pos < guess.length; pos++) parts.push(this.dirWord(pos) + ' ' + this.toneWord(guess[pos]))
    return parts.join(', ')
  },
  announceStatus: function () {
    const s = content.game.state
    app.announce.polite(app.i18n.t('ann.status', {
      score: s.score, level: s.level, left: Math.max(0, s.guessesLeft),
      positions: s.positions, colors: s.colors,
    }))
  },
  announceSelected: function () {
    const pos = content.game.selected()
    content.audio.selectCue(pos, content.game.getGuess()[pos])
    app.announce.polite(app.i18n.t('ann.selected', {dir: this.dirWord(pos), tone: this.toneWord(content.game.getGuess()[pos])}))
  },
  announceGuess: function () {
    app.announce.polite(app.i18n.t('ann.guess', {guess: this.guessText(content.game.getGuess())}))
  },
  announceLast: function () {
    const fb = content.game.lastFeedback()
    if (!fb) { app.announce.polite(app.i18n.t('ann.noLast')); return }
    app.announce.polite(app.i18n.t('ann.last', {exact: fb.exact, partial: fb.partial}))
  },

  refreshHud: function () {
    if (!this.state.scoreEl) return
    const s = content.game.state
    this.state.scoreEl.textContent = String(s.score)
    this.state.levelEl.textContent = String(s.level)
    this.state.attemptsEl.textContent = String(Math.max(0, s.guessesLeft))
    this.state.ringEl.textContent = s.positions + '·' + s.colors
  },

  // aria-hidden visual ring (sighted players): the current guess around the
  // compass, the selected point highlighted. The hidden sigil is never shown.
  renderGrid: function () {
    const el = this.state.gridEl
    if (!el || !content.board.positions()) return
    const guess = content.game.getGuess()
    const sel = content.game.selected()
    let html = ''
    for (let pos = 0; pos < guess.length; pos++) {
      const here = pos === sel ? ' is-cursor' : ''
      const name = content.board.nameOf(pos)
      html += '<span class="a-game--cell c' + guess[pos] + here + '" title="' + name + '">' +
        name.toUpperCase() + ':' + String.fromCharCode(65 + guess[pos]) + '</span>'
    }
    el.innerHTML = html
  },
})
