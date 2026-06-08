// CADENCE briefing — shown before EVERY sector. It speaks the next story beat on
// load, then lets the player REHEARSE exactly the obstacles this sector throws:
// each cue button's accessible name says what it is + how to beat it, and
// activating it plays the threat→response sound demo back to back. Only the
// mechanics active this sector are listed. Then Begin starts the count-in.
// Reached from the menu (sector 1), the level select, and after each clear.
app.screen.briefing = app.screenManager.invent({
  id: 'briefing',
  parentSelector: '.a-app--briefing',
  rootSelector: '.a-briefing',
  transitions: {
    begin: function () { this.change('game') },
    menu: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    titleEl: null, storyEl: null, tutEl: null, cuesEl: null,
  },

  // Every rehearsable cue + the mechanic flag that gates it (so only the
  // obstacles you'll actually face this sector are shown). `key` is the short
  // button label; `how` is the spoken "what it is + how to beat it" line — it
  // becomes the button's aria-label (read as you move to it) and is re-spoken
  // when you activate it (which also plays the threat→response sound demo).
  CUES: [
    {sound: 'step', gate: null, key: 'cue.step', how: 'rehearse.step'},
    {sound: 'enemyL', gate: 'enemy', key: 'cue.enemyL', how: 'rehearse.enemyL'},
    {sound: 'enemyR', gate: 'enemy', key: 'cue.enemyR', how: 'rehearse.enemyR'},
    {sound: 'drone', gate: 'drone', key: 'cue.drone', how: 'rehearse.drone'},
    {sound: 'hurdle', gate: 'hurdle', key: 'cue.hurdle', how: 'rehearse.hurdle'},
    {sound: 'beam', gate: 'beam', key: 'cue.beam', how: 'rehearse.beam'},
    {sound: 'synco', gate: 'off', key: 'cue.synco', how: 'rehearse.synco'},
  ],

  onReady: function () {
    const root = this.rootElement
    this.state.titleEl = root.querySelector('.a-briefing--title')
    this.state.storyEl = root.querySelector('.a-briefing--story')
    this.state.tutEl = root.querySelector('.a-briefing--tut')
    this.state.cuesEl = root.querySelector('.a-briefing--cues')
    root.addEventListener('click', (e) => {
      const cue = e.target.closest('button[data-sound]')
      if (cue) { this.playCue(cue); return }
      const act = e.target.closest('button[data-action]')
      if (act) {
        if (act.dataset.action === 'begin') content.audio.menuSelect()
        else content.audio.menuBack()
        app.screenManager.dispatch(act.dataset.action)
      }
    })
  },

  // Rehearse one obstacle: speak how to beat it, then play the threat→response
  // demo so the player hears the cue and the correct answer back to back.
  playCue: function (btn) {
    if (btn.dataset.how) app.announce.polite(app.i18n.t(btn.dataset.how))
    content.audio.sample(btn.dataset.sound)
  },

  render: function () {
    const level = content.game.state.level
    const def = content.levels.get(level)
    const t = (k, p) => app.i18n.t(k, p)
    this.state.titleEl.textContent = t('briefing.sector', {level, name: t('level.' + level + '.name')})
    this.state.storyEl.textContent = t('story.' + level)
    this.state.tutEl.textContent = t(def.tutorialKey)
    // build the cue buttons for this sector's active mechanics
    const ul = this.state.cuesEl
    ul.innerHTML = ''
    for (const c of this.CUES) {
      if (c.gate && !def.mech[c.gate]) continue
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button a-briefing--cue'
      btn.dataset.sound = c.sound
      btn.dataset.how = c.how
      btn.textContent = t(c.key)
      // the accessible name is the full how-to, so arrowing to the button reads
      // "what it is + how to beat it" before you even play the sound.
      btn.setAttribute('aria-label', t(c.how))
      li.appendChild(btn)
      ul.appendChild(li)
    }
    const liBegin = document.createElement('li')
    const begin = document.createElement('button')
    begin.className = 'c-menu--button a-briefing--begin'
    begin.dataset.action = 'begin'
    begin.textContent = t('briefing.begin')
    liBegin.appendChild(begin)
    ul.appendChild(liBegin)
    const liMenu = document.createElement('li')
    const menu = document.createElement('button')
    menu.className = 'c-menu--button'
    menu.dataset.action = 'menu'
    menu.textContent = t('briefing.abort')
    liMenu.appendChild(menu)
    ul.appendChild(liMenu)
  },

  onEnter: function () {
    this.state.entryFrames = 8
    this.render()
    // Speak the whole briefing on load through the live region: sector title,
    // the next story beat, then this sector's tutorial line.
    const level = content.game.state.level
    const title = app.i18n.t('briefing.sector', {level, name: app.i18n.t('level.' + level + '.name')})
    const story = app.i18n.t('story.' + level)
    const tut = app.i18n.t(content.levels.get(level).tutorialKey)
    const hint = app.i18n.t('briefing.cueHint')
    app.announce.assertive(title + '. ' + story + ' ' + tut + ' ' + hint)
    app.utility.focus.setWithin(this.rootElement)
  },

  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) { this.state.entryFrames--; app.controls.ui(); return }
      const ui = app.controls.ui()
      if (ui.up) { content.audio.menuMove(); app.utility.focus.setPreviousFocusable(this.rootElement) }
      if (ui.down) { content.audio.menuMove(); app.utility.focus.setNextFocusable(this.rootElement) }
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset.sound) { this.playCue(f); return }
        if (f && f.dataset.action) {
          if (f.dataset.action === 'begin') content.audio.menuSelect(); else content.audio.menuBack()
          app.screenManager.dispatch(f.dataset.action)
        }
      }
    } catch (e) { console.error(e) }
  },
})
