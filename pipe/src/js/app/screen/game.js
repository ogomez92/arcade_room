/**
 * Game screen. Pipe's gameplay keys (arrows, Enter / "/", Ctrl, Shift, Tab,
 * Alt, Escape) don't map onto the template's movement model, so this screen
 * installs its own window-level keydown/keyup handler while active and forwards
 * edge-triggered actions to content.game.onKey(). content.game owns all state;
 * onFrame just drives its timers.
 *
 * Edge detection uses a held-codes Set so browser auto-repeat fires each action
 * once per physical press (see template CLAUDE.md "Browser auto-repeat").
 * F1/F3/F5 are captured so the browser's Help/Find/Reload don't steal them.
 */
app.screen.game = app.screenManager.invent({
  id: 'game',
  parentSelector: '.a-app--game',
  rootSelector: '.a-game',
  transitions: {
    gameover: function () { this.change('gameover') },
    menu: function () { this.change('menu') },
  },
  state: {held: null, keydown: null, keyup: null},

  // Physical key code -> game action.
  keymap: {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    Enter: 'test', NumpadEnter: 'test', Slash: 'test',
    ControlLeft: 'hammer', ControlRight: 'hammer',
    ShiftLeft: 'status', ShiftRight: 'status',
    Tab: 'lives',
    AltLeft: 'pause', AltRight: 'pause',
    Escape: 'quit',
  },

  onReady: function () {
    this.state.held = new Set()

    this.state.keydown = (e) => {
      const action = this.keymap[e.code]
      if (action) e.preventDefault()
      // Stop the browser hijacking Help/Find/Reload.
      if (e.code === 'F1' || e.code === 'F3' || e.code === 'F5') e.preventDefault()
      if (!action) return
      if (this.state.held.has(e.code)) return // ignore auto-repeat
      this.state.held.add(e.code)
      try { content.game.onKey(action) } catch (err) { console.error(err) }
    }

    this.state.keyup = (e) => {
      this.state.held.delete(e.code)
    }
  },

  onEnter: function () {
    this.state.held.clear()
    window.addEventListener('keydown', this.state.keydown, {capture: true})
    window.addEventListener('keyup', this.state.keyup, {capture: true})
    content.game.start()
  },

  onExit: function () {
    window.removeEventListener('keydown', this.state.keydown, {capture: true})
    window.removeEventListener('keyup', this.state.keyup, {capture: true})
    content.game.stop()
  },

  onFrame: function () {
    try { content.game.frame() } catch (e) { console.error(e) }
  },
})
