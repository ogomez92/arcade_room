app.screen.settings = app.screenManager.invent({
  id: 'settings',
  parentSelector: '.a-app--settings',
  rootSelector: '.a-settings',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: { listEl: null },
  onReady: function () {
    const root = this.rootElement
    this.state.listEl = root.querySelector('.a-settings--list')
    this.render()

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
      } else if (btn.dataset.setting && btn.dataset.value) {
        this.setSetting(btn.dataset.setting, btn.dataset.value)
      } else if (btn.dataset.adjust) {
        this.adjust(btn.dataset.adjust, Number(btn.dataset.delta))
      }
    })
  },
  render: function () {
    const list = this.state.listEl
    list.innerHTML = ''
    const diffMap = { easy: 'settings.diffEasy', normal: 'settings.diffNormal', hard: 'settings.diffHard' }

    const diff = document.createElement('fieldset')
    diff.innerHTML = `<legend>${app.i18n.t('settings.difficulty')}</legend>` +
      ['easy', 'normal', 'hard'].map((d) => {
        const sel = app.settings.computed.difficulty === d ? 'aria-pressed="true"' : 'aria-pressed="false"'
        return `<button type="button" data-setting="difficulty" data-value="${d}" ${sel}>${app.i18n.t(diffMap[d])}</button>`
      }).join(' ')
    list.appendChild(diff)

    const vol = document.createElement('fieldset')
    const v = Math.round(app.settings.computed.volume * 100)
    vol.innerHTML = `<legend>${app.i18n.t('settings.masterVolume')}: <span class="a-settings--volume">${v}%</span></legend>` +
      `<button type="button" data-adjust="volume" data-delta="-0.1" aria-label="${app.i18n.t('settings.volumeDown')}">−</button> ` +
      `<button type="button" data-adjust="volume" data-delta="0.1" aria-label="${app.i18n.t('settings.volumeUp')}">+</button>`
    list.appendChild(vol)
  },
  onEnter: function () {
    this.render()
    app.announce.polite(app.i18n.t('ann.settings'))
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) { content.sfx.menuBack(); app.screenManager.dispatch('back'); return }
    if (ui.up) { content.sfx.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
    if (ui.down) { content.sfx.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
    if (ui.enter || ui.space || ui.confirm) {
      const f = app.utility.focus.get(this.rootElement)
      if (!f) return
      if (f.dataset.action === 'back') app.screenManager.dispatch('back')
      else if (f.dataset.setting) this.setSetting(f.dataset.setting, f.dataset.value)
      else if (f.dataset.adjust) this.adjust(f.dataset.adjust, Number(f.dataset.delta))
    }
  },
  setSetting: function (key, value) {
    if (key === 'difficulty') {
      app.settings.setDifficulty(value)
      app.settings.save()
      const diffMap = { easy: 'settings.diffEasy', normal: 'settings.diffNormal', hard: 'settings.diffHard' }
      app.announce.polite(app.i18n.t('ann.difficulty', {value: app.i18n.t(diffMap[value] || value)}))
    }
    this.render()
  },
  adjust: function (key, delta) {
    if (key === 'volume') {
      const next = Math.max(0, Math.min(1, (app.settings.computed.volume || 0) + delta))
      app.settings.setVolume(next)
      app.settings.save()
      app.announce.polite(app.i18n.t('ann.volume', {value: Math.round(next * 100)}))
    }
    this.render()
  },
})
