/**
 * City picker = difficulty select. The three cities are listed in order of
 * difficulty (USA easy, Canada normal, Spain insane), matching the original.
 * Choosing one sets content.game's difficulty and starts the run.
 */
app.screen.city = app.screenManager.invent({
  id: 'city',
  parentSelector: '.a-app--city',
  rootSelector: '.a-city',
  transitions: {
    play: function () { this.change('game') },
    back: function () { this.change('menu') },
  },
  state: {entryFrames: 0},
  onReady: function () {
    const root = this.rootElement
    this.renderList()
    root.addEventListener('click', (e) => {
      const cityBtn = e.target.closest('button[data-city]')
      if (cityBtn) return this.choose(cityBtn.dataset.city)
      const back = e.target.closest('button[data-action="back"]')
      if (back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
    })
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-city--list')
    list.innerHTML = ''
    for (const d of content.config.difficultyList()) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      btn.dataset.city = d.id
      btn.textContent = app.i18n.t('city.button.' + d.id, {lives: d.lives})
      li.appendChild(btn)
      list.appendChild(li)
    }
  },
  choose: function (id) {
    content.audio.menuBlip()
    content.game.selectDifficulty(id)
    app.screenManager.dispatch('play')
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
    app.utility.focus.setWithin(this.rootElement)
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.back) { content.audio.menuBlip(); app.screenManager.dispatch('back') }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.city) this.choose(f.dataset.city)
        else if (f && f.dataset.action === 'back') app.screenManager.dispatch('back')
      }
    } catch (e) { console.error(e) }
  },
})
