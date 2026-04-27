app.screen.learnSounds = app.screenManager.invent({
  id: 'learnSounds',
  parentSelector: '.a-app--learn-sounds',
  rootSelector: '.a-learn-sounds',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    demoActive: false,
  },
  onReady: function () {
    const root = this.rootElement

    const ballBtn = root.querySelector('.a-learn-sounds--ball-rolling')
    const warnBtn = root.querySelector('.a-learn-sounds--serve-warning')
    const backBtn = root.querySelector('.a-learn-sounds--back')

    const withDemo = (btn, fn) => {
      btn.addEventListener('click', () => {
        if (this.state.demoActive) return
        this.state.demoActive = true
        const orig = btn.textContent
        btn.setAttribute('aria-label', 'Playing…')
        btn.textContent = 'Playing…'
        fn(() => {
          btn.textContent = orig
          btn.removeAttribute('aria-label')
          this.state.demoActive = false
          btn.focus()
        })
      })
    }

    withDemo(ballBtn, (done) => content.audio.demoBallRolling(done))
    withDemo(warnBtn, (done) => content.audio.demoServeWarning(done))

    backBtn.addEventListener('click', () => {
      app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.demoActive = false
    engine.loop.resume()
  },
  onExit: function () {
    content.audio.stopDemos()
    engine.loop.pause()
    this.state.demoActive = false
  },
  onFrame: function () {},
})
