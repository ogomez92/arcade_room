app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    chill:    function () { this.change('setup', {mode: 'chill'}) },
    arcade:   function () { this.change('setup', {mode: 'arcade'}) },
    learn:    function () { this.change('learnSounds') },
    help:     function () { this.change('help') },
    multi:    function () { this.change('multiplayer') },
    language: function () { this.change('language') },
  },
  onReady: function () {
    const root = this.rootElement
    root.querySelector('.a-menu--version').textContent = `v${app.version()}`

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      app.screenManager.dispatch(btn.dataset.action)
    })

    root.addEventListener('focusin', (e) => {
      if (e.target.matches('button')) {
        content.sounds.uiFocus()
        // Screen reader announces the focused button's accessible name
        // automatically. Don't double-up via the live region.
      }
    })
  },
  onEnter: function () {
    // If the user opened the app with a ?room=CODE invite link, jump
    // straight to the multiplayer screen — its own onEnter consumes the
    // param and prefills the join form. We only PEEK here; the param is
    // stripped by the multiplayer screen so further menu visits no-op.
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.has('room')) {
        app.screenManager.dispatch('multi')
      }
    } catch (e) { /* ignore — bad URL state shouldn't break menu */ }
  },
  // Override the base focus behaviour: the menu's section has
  // tabindex="-1" (so it can be programmatically focused for screen
  // readers), but landing focus on the section just announces the
  // heading. We want the player on the first action button so that an
  // immediate Enter / Space starts a chill round, and arrow-key nav
  // works without an extra Tab.
  focusWithin: function () {
    const first = this.rootElement.querySelector('.c-menu--button')
    if (first) {
      app.utility.focus.set(first)
    } else {
      app.utility.focus.set(this.rootElement)
    }
    return this
  },
  onFrame: function () {
    app.utility.menuNav.handle(this.rootElement)
  },
})
