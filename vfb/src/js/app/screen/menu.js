app.screen.menu = app.screenManager.invent({
  id: 'menu',
  parentSelector: '.a-app--menu',
  rootSelector: '.a-menu',
  transitions: {
    start: function () {
      this.change('game')
    },
    language: function () {
      this.change('language')
    },
  },
  state: {},
  onReady: function () {
    const root = this.rootElement
    this.howto = root.querySelector('.a-menu--howto')
    this.buttons = Array.from(root.querySelectorAll('button[data-action]'))

    for (const btn of this.buttons) {
      btn.addEventListener('click', () => this.handle(btn.dataset.action))
    }

    root.addEventListener('keydown', (e) => {
      if (e.key == 'ArrowDown') {
        e.preventDefault()
        this.move(1)
      } else if (e.key == 'ArrowUp') {
        e.preventDefault()
        this.move(-1)
      } else if (e.key == 'Enter') {
        e.preventDefault()
        const focused = document.activeElement
        if (focused && focused.dataset && focused.dataset.action) {
          this.handle(focused.dataset.action)
        }
      } else if (e.key == 'Escape') {
        this.handle('quit')
      }
    })
  },
  onEnter: function () {
    this.howto.hidden = true
    if (this.buttons[0]) this.buttons[0].focus()
    // Resume audio context (browsers require user gesture).
    if (content.audio && content.audio.init) {
      content.audio.init()
      try { content.audio.ctx.resume && content.audio.ctx.resume() } catch (_) {}
    }
  },
  onFrame: function () {},
  move: function (delta) {
    const i = this.buttons.indexOf(document.activeElement)
    const next = ((i < 0 ? 0 : i + delta) + this.buttons.length) % this.buttons.length
    this.buttons[next].focus()
  },
  handle: function (action) {
    if (action == 'start') {
      app.screenManager.dispatch('start')
    } else if (action == 'howto') {
      this.howto.hidden = !this.howto.hidden
    } else if (action == 'language') {
      app.screenManager.dispatch('language')
    } else if (action == 'quit') {
      if (app.isElectron()) app.quit()
    }
  },
})
