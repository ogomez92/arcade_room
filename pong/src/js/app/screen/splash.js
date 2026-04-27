app.screen.splash = app.screenManager.invent({
  id: 'splash',
  parentSelector: '.a-app--splash',
  rootSelector: '.a-splash',
  transitions: {
    play: function () { this.change('game') },
    learnSounds: function () { this.change('learnSounds') },
    multiplayer: function () { this.change('lobby') },
    language: function () { this.change('language') },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement

    root.querySelector('.a-splash--version').innerHTML = `v${app.version()}`

    root.querySelector('.a-splash--play').addEventListener('click', () => {
      app.screenManager.dispatch('play')
    })

    root.querySelector('.a-splash--learn').addEventListener('click', () => {
      app.screenManager.dispatch('learnSounds')
    })

    root.querySelector('.a-splash--multiplayer').addEventListener('click', () => {
      app.screenManager.dispatch('multiplayer')
    })

    root.querySelector('.a-splash--language').addEventListener('click', () => {
      app.screenManager.dispatch('language')
    })
  },
  onEnter: function () {},
  onFrame: function () {},
})
