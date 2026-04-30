app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    playAi: function () { this.change('mech', { mode: 'ai' }) },
    playOnlineHost: function () { this.change('multiplayer', { action: 'host' }) },
    playOnlineJoin: function () { this.change('multiplayer', { action: 'join' }) },
    learnSounds: function () { this.change('learn') },
    language: function () { this.change('language') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.getAttribute('data-action')
      handle(action)
    })
    function handle(action) {
      content.sfx.uiBeep(600, 0.08, 'sine', 0.08)
      switch (action) {
        case 'play-ai': app.screenManager.dispatch('playAi'); break
        case 'play-online-host': app.screenManager.dispatch('playOnlineHost'); break
        case 'play-online-join': app.screenManager.dispatch('playOnlineJoin'); break
        case 'learn-sounds': app.screenManager.dispatch('learnSounds'); break
        case 'language': app.screenManager.dispatch('language'); break
        case 'manual':
          content.util.announce(app.i18n.t('menu.helpRead'), true)
          break
      }
    }
  },
  onEnter: function () {
    content.util.announce(app.i18n.t('menu.welcome'), true)
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      // No back from main menu
    }
  },
})
