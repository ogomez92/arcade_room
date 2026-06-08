// Orientation diagnostic. Listener fixed at origin facing north. Cycles a
// tick at front (north), right (east), behind (south), left (west) every
// 700 ms so the user can verify the screen->audio coordinate flip by ear.
// Ticks are placed in WORLD coords around the grid centre, going through
// the same relAudio() mapping gameplay uses.
app.screen.test = app.screenManager.invent({
  id: 'test',
  parentSelector: '.a-app--test',
  rootSelector: '.a-test',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0, ticker: null, idx: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.idx = 0
    content.audio.setStaticListener()

    const g = content.constants.GRID
    const cx = (g.cols - 1) / 2
    const cy = (g.rows - 1) / 2
    const positions = [
      {col: cx, row: cy - 4, key: 'test.front'},
      {col: cx + 4, row: cy, key: 'test.right'},
      {col: cx, row: cy + 4, key: 'test.behind'},
      {col: cx - 4, row: cy, key: 'test.left'},
    ]

    this.state.ticker = setInterval(() => {
      const p = positions[this.state.idx % positions.length]
      this.state.idx++
      content.audio.tick({col: p.col, row: p.row})
      app.announce.polite(app.i18n.t(p.key))
    }, 700)

    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    if (this.state.ticker) { clearInterval(this.state.ticker); this.state.ticker = null }
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) app.screenManager.dispatch('back')
  },
})
