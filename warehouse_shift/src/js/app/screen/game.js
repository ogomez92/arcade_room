app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    levelClear: function () { this.change('levelclear') },
    pause: function () { this.change('pause') },
  },
  state: {
    boardEl: null,
    keyDown: {},
    levelEl: null,
    movesEl: null,
    placedEl: null,
    pushesEl: null,
    statusEl: null,
    timeEl: null,
  },
  onReady: function () {
    const root = this.rootElement

    this.state.boardEl = root.querySelector('.a-game--board')
    this.state.levelEl = root.querySelector('.a-game--level')
    this.state.movesEl = root.querySelector('.a-game--moves')
    this.state.placedEl = root.querySelector('.a-game--placed')
    this.state.pushesEl = root.querySelector('.a-game--pushes')
    this.state.statusEl = root.querySelector('.a-game--status')
    this.state.timeEl = root.querySelector('.a-game--time')

    window.addEventListener('keydown', (e) => {
      if (!app.screenManager.is('game')) return
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F1', 'F2', 'F3', 'F4', 'F5', ' ', 'Tab'].includes(e.key)) {
        e.preventDefault()
      }
    }, true)

    content.events.on('blocked', (e) => {
      content.audio.blocked(e.x, e.y)
      app.announce.polite(app.i18n.t(e.reason == 'crate' ? 'ann.blockedCrate' : 'ann.blockedWall'))
    })

    content.events.on('crate-pushed', (e) => {
      content.audio.cratePush(e.x, e.y, e.onGoal)
      const placed = this.countPlaced()
      app.announce.polite(app.i18n.t(e.onGoal ? 'ann.cratePlaced' : 'ann.crateMoved', {
        placed,
        total: content.game.state.crates.length,
      }))
      this.refresh()
    })

    content.events.on('deadlock-warning', (e) => {
      content.audio.deadlock(e.crate.x, e.crate.y)
      app.announce.assertive(app.i18n.t('ann.deadlock'))
    })

    content.events.on('level-solved', (e) => {
      content.audio.levelClear()
      app.announce.assertive(app.i18n.t(e.result.isNewBest ? 'ann.levelSolvedBest' : 'ann.levelSolved', {
        level: content.game.state.level.name,
        moves: content.game.state.moves,
        pushes: content.game.state.pushes,
        time: content.game.formatTime(content.game.state.seconds),
      }))
      this.refresh()
      app.screenManager.dispatch('levelClear')
    })

    content.events.on('level-start', () => {
      content.audio.levelStart()
      this.refresh()
      app.announce.assertive(app.i18n.t('ann.levelStart', {
        level: content.game.state.level.name,
        number: content.game.state.levelIndex + 1,
      }))
      window.setTimeout(() => app.announce.polite(content.game.targetAnnouncement()), 400)
    })

    content.events.on('moved', (e) => {
      if (content.game.isGoal(e.x, e.y)) {
        content.audio.goalStep(e.x, e.y)
        app.announce.polite(app.i18n.t('ann.cursorGoal'))
      } else {
        content.audio.moved(e.x, e.y)
      }
      this.refresh()
    })

    content.events.on('target-change', () => {
      content.audio.focusPing()
      app.announce.polite(content.game.targetAnnouncement())
    })

    content.events.on('undo', () => {
      content.audio.undo()
      app.announce.polite(app.i18n.t('ann.undo', {moves: content.game.state.moves}))
      this.refresh()
    })

    content.events.on('undo-empty', () => {
      content.audio.blocked(content.game.state.player.x, content.game.state.player.y)
      app.announce.polite(app.i18n.t('ann.undoEmpty'))
    })
  },
  onEnter: function () {
    if (!content.game.state.level) {
      content.game.start(app.progress.nextLevel())
    }

    engine.loop.resume()
    content.audio.start()
    this.state.keyDown = {}
    this.refresh()
    app.utility.focus.set(this.rootElement)
  },
  onExit: function () {
    content.audio.stop()
  },
  onFrame: function (e) {
    const delta = e && e.delta ? e.delta : 1 / 60
    content.game.tick(delta)
    content.audio.frame(delta)

    const ui = app.controls.ui()
    if (ui.pause || ui.back) {
      content.audio.menuBack()
      app.screenManager.dispatch('pause')
      return
    }

    if (ui.up) this.move(0, -1)
    else if (ui.down) this.move(0, 1)
    else if (ui.left) this.move(-1, 0)
    else if (ui.right) this.move(1, 0)

    if (ui.tab) this.cycleTarget()
    if (ui.space || ui.confirm) this.scanAll()

    this.handleHotkeys()
    this.refreshHud()
  },
  handleHotkeys: function () {
    const k = engine.input.keyboard

    const pressed = (key) => {
      const isDown = k.is(key)
      if (isDown && !this.state.keyDown[key]) {
        this.state.keyDown[key] = true
        return true
      }
      if (!isDown) this.state.keyDown[key] = false
      return false
    }

    if (pressed('KeyU') || pressed('KeyZ')) content.game.undo()
    if (pressed('KeyR')) {
      content.audio.restart()
      content.game.restart()
      app.announce.assertive(app.i18n.t('ann.restart', {level: content.game.state.level.name}))
    }
    if (pressed('F1')) this.announceStatus()
    if (pressed('F2')) this.cycleTarget()
    if (pressed('F3')) this.scanAll()
    if (pressed('F4')) this.announceMap()
  },
  move: function (x, y) {
    content.game.move(x, y)
  },
  cycleTarget: function () {
    content.game.cycleTarget()
  },
  scanAll: function () {
    ;['north', 'east', 'south', 'west'].forEach((dir, index) => {
      const result = content.game.scanRaw(dir)
      if (result) {
        window.setTimeout(() => content.audio.scan(
          result.first ? result.first.x : result.x,
          result.first ? result.first.y : result.y,
          result.first ? result.first.type : result.type
        ), index * 120)
      }
    })

    app.announce.polite(content.game.scanAll().join(' '))
  },
  announceMap: function () {
    app.announce.polite(app.i18n.t('ann.map', {
      crates: content.game.state.crates.length,
      height: content.game.state.height,
      level: content.game.state.level.name,
      open: content.game.openSummary(),
      width: content.game.state.width,
    }))
  },
  announceStatus: function () {
    app.announce.polite(app.i18n.t('ann.status', {
      level: content.game.state.level.name,
      moves: content.game.state.moves,
      placed: this.countPlaced(),
      pushes: content.game.state.pushes,
      time: content.game.formatTime(content.game.state.seconds),
      total: content.game.state.crates.length,
      undos: content.game.state.undos,
    }))
  },
  countPlaced: function () {
    return content.game.state.crates.filter((crate) => content.game.isGoal(crate.x, crate.y)).length
  },
  refresh: function () {
    this.refreshHud()
    this.renderBoard()
  },
  refreshHud: function () {
    if (!this.state.levelEl || !content.game.state.level) return

    this.state.levelEl.textContent = app.i18n.t('hud.levelValue', {
      number: content.game.state.levelIndex + 1,
      name: content.game.state.level.name,
    })
    this.state.movesEl.textContent = String(content.game.state.moves)
    this.state.pushesEl.textContent = String(content.game.state.pushes)
    this.state.placedEl.textContent = app.i18n.t('hud.placedValue', {
      placed: this.countPlaced(),
      total: content.game.state.crates.length,
    })
    this.state.timeEl.textContent = content.game.formatTime(content.game.state.seconds)
    this.state.statusEl.textContent = content.game.targetAnnouncement()
  },
  renderBoard: function () {
    const board = this.state.boardEl,
      state = content.game.state

    if (!board || !state.level) return

    board.innerHTML = ''
    board.style.gridTemplateColumns = 'repeat(' + state.width + ', minmax(0, 1fr))'

    const target = content.game.currentTarget()

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const cell = document.createElement('div'),
          crate = content.game.getCrateAt(x, y),
          isPlayer = state.player.x == x && state.player.y == y,
          isGoal = content.game.isGoal(x, y),
          isTarget = target && target.x == x && target.y == y

        cell.className = 'a-game--cell'
        cell.setAttribute('aria-hidden', 'true')

        if (!content.game.isFloor(x, y)) cell.classList.add('a-game--cell-wall')
        else cell.classList.add('a-game--cell-floor')
        if (isGoal) cell.classList.add('a-game--cell-goal')
        if (crate) cell.classList.add('a-game--cell-crate')
        if (crate && isGoal) cell.classList.add('a-game--cell-crate-goal')
        if (isPlayer) cell.classList.add('a-game--cell-player')
        if (isTarget) cell.classList.add('a-game--cell-target')

        cell.textContent = isPlayer ? '@' : crate ? '■' : isGoal ? '×' : ''
        board.appendChild(cell)
      }
    }
  },
})
