// CADENCE level select. Lists every sector; the ones you have unlocked
// (app.progress) are playable buttons, the rest are shown locked. Choosing a
// sector starts a fresh run (score/lives reset) from that sector's briefing —
// handy for practising a hard stretch or hearing the Act II offbeats again.
app.screen.levels = app.screenManager.invent({
  id: 'levels',
  parentSelector: '.a-app--levels',
  rootSelector: '.a-levels',
  transitions: {
    play: function () { this.change('briefing') },
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    listEl: null,
  },

  onReady: function () {
    this.state.listEl = this.rootElement.querySelector('.a-levels--list')
    this.rootElement.addEventListener('click', (e) => {
      const lvlBtn = e.target.closest('button[data-level]')
      if (lvlBtn) { this.choose(parseInt(lvlBtn.dataset.level, 10)); return }
      const back = e.target.closest('button[data-action="back"]')
      if (back) { content.audio.menuBack(); app.screenManager.dispatch('back') }
    })
  },

  // Build the list: unlocked sectors are buttons, locked sectors are inert text.
  renderList: function () {
    const t = (k, p) => app.i18n.t(k, p)
    const ul = this.state.listEl
    ul.innerHTML = ''
    const unlocked = app.progress.unlocked()
    const count = content.levels.count()
    for (let lvl = 1; lvl <= count; lvl++) {
      const name = t('level.' + lvl + '.name')
      const li = document.createElement('li')
      if (lvl <= unlocked) {
        const btn = document.createElement('button')
        btn.className = 'c-menu--button'
        btn.dataset.level = String(lvl)
        btn.textContent = t('levels.entry', {level: lvl, name})
        li.appendChild(btn)
      } else {
        const span = document.createElement('span')
        span.className = 'c-menu--button a-levels--locked'
        span.textContent = t('levels.locked', {level: lvl})
        li.appendChild(span)
      }
      ul.appendChild(li)
    }
  },

  choose: function (level) {
    if (!app.progress.isUnlocked(level)) { content.audio.menuBack(); return }
    content.audio.menuSelect()
    content.game.reset()
    content.game.state.level = level
    app.screenManager.dispatch('play')
  },

  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
    app.announce.assertive(app.i18n.t('levels.title'))
    app.utility.focus.setWithin(this.rootElement)
  },

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) { content.audio.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
      if (ui.down) { content.audio.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
      if (ui.back) { content.audio.menuBack(); app.screenManager.dispatch('back'); return }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.level) { this.choose(parseInt(f.dataset.level, 10)); return }
        if (f && f.dataset.action === 'back') { content.audio.menuBack(); app.screenManager.dispatch('back') }
      }
    } catch (e) { console.error(e) }
  },
})
