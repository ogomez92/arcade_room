app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    interact: function () { this.change('game') },
    help: function () { this.change('help') },
    learn: function () { this.change('learn') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.querySelector('.a-splash--version').textContent = `v${app.version()}`

    // Each menu button dispatches its own transition. We handle clicks
    // (which fire on Enter and Space too because they're real buttons), so
    // there's no separate keyboard shortcut to maintain.
    root.querySelectorAll('.a-splash--menu-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const event = btn.getAttribute('data-action')
        if (event === 'start') app.screenManager.dispatch('interact')
        else app.screenManager.dispatch(event)
      })
    })
  },
  onEnter: function () {
    app.announce.polite('Audio Pinball main menu. Three options. Use Tab or arrow keys to move, Enter or Space to choose.')
    // Focus the first menu item explicitly (base.focusWithin already does
    // this by selectFocusable, but being explicit is cheap insurance).
    const first = this.rootElement.querySelector('.a-splash--menu-item')
    if (first) app.utility.focus.set(first)
  },
  onFrame: function () {
    const ui = app.controls.ui()
    // Up/Down arrow → move focus between menu items. Enter/Space already
    // activate the focused button via the browser, no extra handling needed.
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
  },
})
