// Learn the sounds. Pins a static listener facing audio-front and auditions
// each cue individually so players can build the vocabulary before playing.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    nav: null,
    sampleProp: null,
    sampleEnd: 0,
  },
  // kind 'prop' loops a spatial voice 3 cells ahead (screen-north); kind 'fn' fires a one-shot.
  items: [
    {key: 'goal', kind: 'prop', prop: 'goal', gain: 0.5},
    {key: 'pit', kind: 'prop', prop: 'pit', gain: 0.6},
    {key: 'wall', kind: 'prop', prop: 'wall', gain: 0.5},
    {key: 'radar', kind: 'fn', fn: () => content.audio.emitTick(0, -3, {freq: 1500, dur: 0.07, gain: 0.5})},
    {key: 'roll', kind: 'fn', fn: () => content.audio.clack(4)},
    {key: 'fell', kind: 'fn', fn: () => content.audio.fell()},
    {key: 'clear', kind: 'fn', fn: () => content.audio.goal()},
    {key: 'start', kind: 'fn', fn: () => content.audio.levelStart()},
  ],
  onReady: function () {
    const root = this.rootElement
    this.state.nav = root.querySelector('.a-learn--nav')

    for (const item of this.items) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'c-menu--button'
      b.dataset.sound = item.key
      b.dataset.i18n = 'learn.' + item.key
      b.textContent = app.i18n.t('learn.' + item.key)
      const li = document.createElement('li')
      li.appendChild(b)
      this.state.nav.appendChild(li)
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') { app.screenManager.dispatch('back'); return }
      if (btn.dataset.sound) this.playSample(btn.dataset.sound)
    })
  },
  onEnter: function () {
    content.audio.start()
    content.audio.silenceAll()
    content.audio.setStaticListener()
    app.announce.polite(app.i18n.t('learn.subtitle'))
  },
  onExit: function () {
    this.stopSample()
  },
  onFrame: function () {
    try {
      const ui = app.controls.ui()
      if (ui.back) { app.screenManager.dispatch('back'); return }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f) {
          if (f.dataset.action === 'back') app.screenManager.dispatch('back')
          else if (f.dataset.sound) this.playSample(f.dataset.sound)
        }
      }
      // Re-pin in case a prior screen moved the listener; keep the loop spatialized.
      content.audio.setStaticListener()
      if (this.state.sampleProp) {
        content.audio.tickProp(this.state.sampleProp)
        if (engine.time() >= this.state.sampleEnd) this.stopSample()
      }
    } catch (e) { console.error(e) }
  },
  playSample: function (key) {
    this.stopSample()
    const item = this.items.find((i) => i.key === key)
    if (!item) return
    app.announce.polite(app.i18n.t('learn.' + key))
    if (item.kind === 'prop') {
      const props = content.audio._props
      if (props && props[item.prop]) {
        props[item.prop].setPosition(0, -3)
        props[item.prop].setGain(item.gain)
        this.state.sampleProp = item.prop
        this.state.sampleEnd = engine.time() + 2.2
      }
      return
    }
    item.fn()
  },
  stopSample: function () {
    const key = this.state.sampleProp
    this.state.sampleProp = null
    this.state.sampleEnd = 0
    const props = content.audio._props
    if (key && props && props[key]) props[key].setGain(0)
  },
})
