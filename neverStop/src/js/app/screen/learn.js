app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    built: false,
  },
  onReady: function () {
    const root = this.rootElement
    root.querySelectorAll('[data-learn-action="back"]').forEach(btn => {
      btn.addEventListener('click', () => app.screenManager.dispatch('back'))
    })
  },
  buildList: function () {
    if (this.state.built) return
    const list = this.rootElement.querySelector('.a-learn--list')
    if (!list) return
    for (const sound of content.audio.SOUNDS) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.setAttribute('data-learn-sound', sound.id)
      btn.innerHTML = `<span class="a-learn--name">${sound.name}</span><span class="a-learn--desc">${sound.desc}</span>`
      btn.addEventListener('click', () => {
        const ctx = engine.context()
        if (ctx && ctx.state === 'suspended') ctx.resume()
        sound.play()
      })
      btn.addEventListener('focus', () => {
        const ctx = engine.context()
        if (ctx && ctx.state === 'suspended') ctx.resume()
        sound.play()
      })
      li.appendChild(btn)
      list.appendChild(li)
    }
    this.state.built = true
  },
  onEnter: function () {
    this.buildList()
    this.state.entryFrames = 6
    const first = this.rootElement.querySelector('[data-learn-sound]')
    if (first) app.utility.focus.set(first)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames -= 1
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.up) {
      app.utility.focus.setPreviousFocusable(this.rootElement)
    } else if (ui.down) {
      app.utility.focus.setNextFocusable(this.rootElement)
    }
    if (ui.back) app.screenManager.dispatch('back')
  },
})
