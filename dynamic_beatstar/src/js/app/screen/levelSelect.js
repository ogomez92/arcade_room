// Level-select screen — pick a starting level capped at the highest
// previously reached. Highest unlocked is persisted to localStorage in
// content.game (key: beatstar.highestLevel) every time pickLevelParams
// runs, so it grows naturally as the player plays.
//
// Stepper input (not a list) because levels can grow unbounded:
//   Up    / Right  / +  : +1
//   Down  / Left   / -  : -1
//   Enter / Space       : start at the chosen level
//   Esc   / Backspace   : back to menu
app.screen.levelSelect = app.screenManager.invent({
  id: 'levelSelect',
  parentSelector: '.a-app--levelSelect',
  rootSelector: '.a-levelSelect',
  transitions: {
    start: function () { this.change('game') },
    back:  function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    selected: 1,
    highest: 1,
  },
  onReady: function () {
    const root = this.rootElement
    root.addEventListener('click', (e) => {
      const adj = e.target.closest('button[data-adjust]')
      if (adj) {
        this.adjust(parseInt(adj.dataset.adjust, 10) || 0)
        return
      }
      const action = e.target.closest('button[data-action]')
      if (!action) return
      if (action.dataset.action === 'start') this.startGame()
      else if (action.dataset.action === 'back') app.screenManager.dispatch('back')
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.highest = content.game.getHighestUnlocked()
    // Default to the highest unlocked so a returning player picks up
    // where they left off; clamp the previously-set start level into
    // the unlocked range.
    const prev = content.game.getStartLevel()
    this.state.selected = Math.min(this.state.highest, Math.max(1, prev))
    this.render()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) { app.screenManager.dispatch('back'); return }
    if (ui.up    || ui.right) this.adjust(+1)
    if (ui.down  || ui.left)  this.adjust(-1)
    if (ui.enter || ui.space || ui.confirm) this.startGame()
  },
  adjust: function (delta) {
    const next = Math.min(this.state.highest, Math.max(1, this.state.selected + delta))
    if (next === this.state.selected) return
    this.state.selected = next
    this.render()
    app.announce.polite(app.i18n.t('levelSelect.announceLevel', {level: next}))
  },
  startGame: function () {
    content.game.setStartLevel(this.state.selected)
    app.screenManager.dispatch('start')
  },
  render: function () {
    const root = this.rootElement
    const selEl = root.querySelector('.a-levelSelect--selected')
    const maxEl = root.querySelector('.a-levelSelect--max')
    const startBtn = root.querySelector('button[data-action="start"]')
    const decBtn = root.querySelector('button[data-adjust="-1"]')
    const incBtn = root.querySelector('button[data-adjust="1"]')
    if (selEl) selEl.textContent = String(this.state.selected)
    if (maxEl) maxEl.textContent = String(this.state.highest)
    if (startBtn) startBtn.textContent = app.i18n.t('levelSelect.start', {level: this.state.selected})
    if (decBtn) decBtn.disabled = this.state.selected <= 1
    if (incBtn) incBtn.disabled = this.state.selected >= this.state.highest
  },
})
