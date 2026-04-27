app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    play: function () { this.change('game') },
    learn: function () { this.change('learn') },
    settings: function () { this.change('settings') },
    highscores: function () { this.change('highscores') },
    help: function () { this.change('help') },
    test: function () { this.change('test') },
    music: function () { this.change('music') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      this.action(btn.dataset.action)
    })
  },
  onEnter: function () {
    app.announce.polite('Main Menu. Use arrow keys to navigate, Enter to select.')
    content.sfx.menuMove()
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset && f.dataset.action) {
        this.action(f.dataset.action)
      }
    }
    // Hidden hotkeys for the diagnostic screens.
    const k = engine.input.keyboard
    if (k.is('KeyT')) { app.screenManager.dispatch('test') }
    if (k.is('KeyM')) { app.screenManager.dispatch('music') }
  },
  action: function (name) {
    content.sfx.menuSelect()
    if (name === 'play') {
      content.game.startNewGame()
      app.screenManager.dispatch('play')
    } else if (name === 'learn') {
      app.screenManager.dispatch('learn')
    } else if (name === 'settings') {
      app.screenManager.dispatch('settings')
    } else if (name === 'highscores') {
      app.screenManager.dispatch('highscores')
    } else if (name === 'help') {
      app.screenManager.dispatch('help')
    }
  },
})
