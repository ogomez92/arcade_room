// The control screen. Owns RAW keydown so the full ATC command set works
// regardless of focus. content.game runs its own internal FSM; this screen
// just feeds it commands and calls frame().
//
// Command model (cycle + command): Tab / Shift+Tab cycles the selected plane;
// arrows turn or vector it; L/Enter clears it to land; H holds it. Status
// keys speak the selected plane or the session summary.
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {entryFrames: 0, keydown: null, capture: null},
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

    const difficulty = readDifficulty()
    const nickname = readNickname()
    content.game.startCareer({difficulty, nickname})

    // Capture-phase preventDefault for Tab + browser-reserved F-keys.
    self.state.capture = (e) => {
      if (e.code === 'Tab' || e.code === 'F1' || e.code === 'F2' || e.code === 'F3' || e.code === 'F5') {
        e.preventDefault()
      }
    }
    window.addEventListener('keydown', self.state.capture, true)

    self.state.keydown = (e) => {
      const code = e.code
      const STEP = content.constants.TURN_STEP

      if (code === 'Tab') {
        e.preventDefault()
        content.game.selectNext(e.shiftKey ? -1 : 1)
        return
      }
      if (e.repeat) return

      switch (code) {
        case 'ArrowLeft': case 'Numpad4': e.preventDefault(); content.game.turn(-STEP); break
        case 'ArrowRight': case 'Numpad6': e.preventDefault(); content.game.turn(STEP); break
        case 'ArrowUp': case 'Numpad8': e.preventDefault(); content.game.directToTower(); break
        case 'KeyL': case 'Enter': e.preventDefault(); content.game.clearToLand(); break
        case 'KeyH': content.game.hold(); break
        case 'Space': e.preventDefault(); content.game.describeSelected(); break
        case 'KeyR': content.game.status(); break
        case 'KeyP': content.game.pauseToggle(); break
        case 'F1': e.preventDefault(); content.game.describeSelected(); break
        case 'F2': e.preventDefault(); content.game.status(); break
        case 'Escape': e.preventDefault(); app.screenManager.dispatch('menu'); break
      }
    }
    window.addEventListener('keydown', self.state.keydown)

    app.utility.focus.setWithin(self.rootElement)
  },
  onExit: function () {
    const s = this.state
    if (s.keydown) window.removeEventListener('keydown', s.keydown)
    if (s.capture) window.removeEventListener('keydown', s.capture, true)
    s.keydown = s.capture = null
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
    const d = localStorage.getItem('approach.difficulty')
    if (d === 'cadet' || d === 'controller' || d === 'nightmare') return d
  } catch (e) {}
  return 'controller'
}

function readNickname() {
  try {
    const n = localStorage.getItem('approach.nickname')
    if (n) return n
  } catch (e) {}
  return app.i18n.t('player.you')
}
