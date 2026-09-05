/**
 * Stage 1 — pizza shop briefing. Reads the job aloud (each pizza with its
 * ingredients and address), lets the player re-read any pizza with 1–9,
 * hear the city map with M, and starts driving on Space / Enter.
 */
app.screen.briefing = app.screenManager.invent({
  id: 'briefing',
  parentSelector: '.a-app--briefing',
  rootSelector: '.a-briefing',
  transitions: {
    start: function () { this.change('game') },
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    list: null,
    subtitle: null,
    intro: null,
    digitWasDown: {},
    mapWasDown: false,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.list = root.querySelector('.a-briefing--list')
    this.state.subtitle = root.querySelector('.a-briefing--subtitle')
    this.state.intro = root.querySelector('.a-briefing--intro')

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      if (btn.dataset.action === 'map') { this.announceMap(); return }
      app.screenManager.dispatch(btn.dataset.action)
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    this.state.digitWasDown = {}
    this.state.mapWasDown = false
    if (content.audio && content.audio.silenceAll) content.audio.silenceAll()
    if (content.game) content.game.beginBriefing()
    this.render()
    this.announceIntro()
  },
  onExit: function () {},
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) { app.screenManager.dispatch('back'); return }
      const k = engine.input.keyboard
      for (let i = 1; i <= 9; i++) {
        const key = 'Digit' + i
        const isDown = k.is(key)
        if (isDown && !this.state.digitWasDown[key]) this.announcePizza(i - 1)
        this.state.digitWasDown[key] = isDown
      }
      const mDown = k.is('KeyM')
      if (mDown && !this.state.mapWasDown) this.announceMap()
      this.state.mapWasDown = mDown

      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.action === 'map') this.announceMap()
        else if (f && f.dataset.action) app.screenManager.dispatch(f.dataset.action)
        else app.screenManager.dispatch('start')
      }
    } catch (e) { console.error(e) }
  },
  render: function () {
    if (!content.game) return
    const job = content.game.currentJob()
    if (!job) return
    const count = job.pizzas.length
    if (this.state.subtitle) {
      const key = count === 1 ? 'briefing.subtitleOne' : 'briefing.subtitleMany'
      this.state.subtitle.textContent = app.i18n.t(key, {n: job.number, count})
    }
    if (this.state.intro) this.state.intro.textContent = app.cityText.briefingIntro()
    this.state.list.innerHTML = ''
    job.pizzas.forEach((p, i) => {
      const li = document.createElement('li')
      li.textContent = app.i18n.t('briefing.pizzaLine', {n: i + 1, ingredients: p.ingredients.join(', '), address: p.address})
      this.state.list.appendChild(li)
    })
  },
  announceIntro: function () {
    if (!content.game) return
    const job = content.game.currentJob()
    if (!job) return
    const subKey = job.pizzas.length === 1 ? 'briefing.subtitleOne' : 'briefing.subtitleMany'
    let speech = app.i18n.t(subKey, {n: job.number, count: job.pizzas.length}) + '. '
    if (job.number === 1) speech += app.cityText.briefingIntro() + ' '
    job.pizzas.forEach((p, i) => {
      speech += app.i18n.t('briefing.pizzaLine', {n: i + 1, ingredients: p.ingredients.join(', '), address: p.address}) + ' '
    })
    speech += app.i18n.t('briefing.numberHint')
    app.announce.polite(speech)
  },
  announcePizza: function (idx) {
    if (!content.game) return
    const job = content.game.currentJob()
    if (!job || !job.pizzas[idx]) return
    const p = job.pizzas[idx]
    app.announce.polite(app.i18n.t('briefing.pizzaLine', {n: idx + 1, ingredients: p.ingredients.join(', '), address: p.address}))
  },
  announceMap: function () {
    app.announce.polite(app.cityText.mapLines().join(' '))
  },
})
