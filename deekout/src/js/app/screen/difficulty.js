// Difficulty picker. Persists the choice to localStorage (read by the game
// screen) and starts a new game. All difficulties are unlocked.
app.screen.difficulty = app.screenManager.invent({
  id: 'difficulty',
  parentSelector: '.a-app--difficulty',
  rootSelector: '.a-difficulty',
  transitions: {
    easy: function () { setDifficultyChoice('easy'); this.change('game') },
    normal: function () { setDifficultyChoice('normal'); this.change('game') },
    crazy: function () { setDifficultyChoice('crazy'); this.change('game') },
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (btn) app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    // Reflect the saved choice as pressed.
    const saved = getDifficultyChoice()
    this.rootElement.querySelectorAll('button[data-action]').forEach((b) => {
      if (b.dataset.action === saved) b.setAttribute('aria-pressed', 'true')
      else b.removeAttribute('aria-pressed')
    })
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
    const ui = app.controls.ui()
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
    if (ui.back) app.screenManager.dispatch('back')
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
    }
  },
})

function setDifficultyChoice(d) {
  try { localStorage.setItem('deekout.difficulty', d) } catch (e) {}
}
function getDifficultyChoice() {
  try { return localStorage.getItem('deekout.difficulty') || 'normal' } catch (e) { return 'normal' }
}
