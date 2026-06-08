// The play screen. Owns RAW keydown/keyup so movement supports held arrows
// (diagonals) and the full action keymap; app.controls.game() is unused for
// gameplay. content.game runs its own internal FSM; this screen just feeds
// it input and calls frame().
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    held: null,
    keydown: null,
    keyup: null,
    capture: null,
    lastShiftAt: 0,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    const self = this
    self.state.entryFrames = 8
    self.state.held = new Set()

    const difficulty = readDifficulty()
    const nickname = readNickname()
    content.game.startCareer({difficulty, nickname})

    function syncHeld() {
      const h = self.state.held
      content.player.setHeld({
        up: h.has('ArrowUp') || h.has('Numpad8'),
        down: h.has('ArrowDown') || h.has('Numpad2'),
        left: h.has('ArrowLeft') || h.has('Numpad4'),
        right: h.has('ArrowRight') || h.has('Numpad6'),
      })
    }

    // Capture-phase preventDefault for browser-reserved F-keys.
    self.state.capture = (e) => {
      if (e.code === 'F1' || e.code === 'F2' || e.code === 'F3' || e.code === 'F4' || e.code === 'F5') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', self.state.capture, true)

    self.state.keydown = (e) => {
      const code = e.code
      content.player.setCtrl(e.ctrlKey)

      // Movement (held).
      if (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight' ||
          code === 'Numpad8' || code === 'Numpad2' || code === 'Numpad4' || code === 'Numpad6') {
        e.preventDefault()
        self.state.held.add(code)
        syncHeld()
        return
      }

      if (e.repeat) return

      switch (code) {
        case 'KeyE': content.experiment && content.experiment.useInventory('E'); break
        case 'KeyC': content.experiment && content.experiment.useInventory('C'); break
        case 'KeyW': content.experiment && content.experiment.useInventory('W'); break
        case 'KeyS': content.experiment && content.experiment.useInventory('S'); break
        case 'KeyI': content.announcer.inventory(); break
        case 'KeyH': content.announcer.highScore(); break
        case 'KeyT': content.announcer.time(); break
        case 'KeyM': content.coins.toggleMode(); break
        case 'KeyP': content.game.pauseToggle(); break
        case 'Digit1': content.coins.setNearestCount(1); break
        case 'Digit2': content.coins.setNearestCount(2); break
        case 'Digit3': content.coins.setNearestCount(3); break
        case 'Digit4': content.coins.setNearestCount(4); break
        case 'Digit5': content.coins.setNearestCount(5); break
        case 'Digit0':
        case 'Numpad0': content.game.debugSkipLevel(); break // debug: skip to next level
        case 'Enter': e.preventDefault(); content.announcer.coinsAndHealth(); break
        case 'Space': e.preventDefault(); content.game.requestEarlyEnd(); break
        case 'ShiftLeft':
        case 'ShiftRight': {
          const now = engine.time()
          const dbl = (now - self.state.lastShiftAt) < 0.4
          self.state.lastShiftAt = now
          content.announcer.scoreAndLevel(dbl)
          break
        }
        case 'F1': e.preventDefault(); content.announcer.coinsAndHealth(); break
        case 'F2': e.preventDefault(); content.announcer.scoreAndLevel(false); break
        case 'F3': e.preventDefault(); content.announcer.time(); break
        case 'F4': e.preventDefault(); content.announcer.inventory(); break
        case 'Escape': e.preventDefault(); app.screenManager.dispatch('menu'); break
      }
    }
    window.addEventListener('keydown', self.state.keydown)

    self.state.keyup = (e) => {
      content.player.setCtrl(e.ctrlKey)
      if (self.state.held.has(e.code)) {
        self.state.held.delete(e.code)
        syncHeld()
      }
    }
    window.addEventListener('keyup', self.state.keyup)

    app.utility.focus.setWithin(self.rootElement)
  },
  onExit: function () {
    const s = this.state
    if (s.keydown) window.removeEventListener('keydown', s.keydown)
    if (s.keyup) window.removeEventListener('keyup', s.keyup)
    if (s.capture) window.removeEventListener('keydown', s.capture, true)
    s.keydown = s.keyup = s.capture = null
    if (s.held) s.held.clear()
    content.player.clearHeld()
    content.game.silenceAll()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      content.game.frame()
    } catch (e) { console.error(e) }
  },
})

function readDifficulty() {
  try {
    const d = localStorage.getItem('deekout.difficulty')
    if (d === 'easy' || d === 'normal' || d === 'crazy') return d
  } catch (e) {}
  return 'normal'
}

function readNickname() {
  try {
    const n = localStorage.getItem('deekout.nickname')
    if (n) return n
  } catch (e) {}
  return app.i18n.t('player.you')
}
