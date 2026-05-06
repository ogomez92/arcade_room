// Sound learning screen. One button per voice; each plays once at a
// canonical position. Static listener, fixed for the whole screen so that
// stereo and binaural cues stay consistent across previews.
app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    nav: null,
    entryFrames: 0,
    activeVoice: null,
    activeVoiceEnd: 0,
  },
  onReady: function () {
    const root = this.rootElement
    this.state.nav = root.querySelector('.a-learn--nav')

    const items = [
      {key: 'icbm', label: 'learn.icbm', play: () => this.previewIcbm()},
      {key: 'splitter', label: 'learn.splitter', play: () => this.previewSplitter()},
      {key: 'bomber', label: 'learn.bomber', play: () => this.previewBomber()},
      {key: 'bomberDrop', label: 'learn.bomberDrop', play: () => this.previewBomberDrop()},
      {key: 'outgoingL', label: 'learn.outgoingL', play: () => content.audio.emitOutgoingWhistle(-0.95, 0, 0, 0.7, 0.9, 'L')},
      {key: 'outgoingC', label: 'learn.outgoingC', play: () => content.audio.emitOutgoingWhistle(0, 0, 0, 0.7, 0.9, 'C')},
      {key: 'outgoingR', label: 'learn.outgoingR', play: () => content.audio.emitOutgoingWhistle(0.95, 0, 0, 0.7, 0.9, 'R')},
      {key: 'blast', label: 'learn.blast', play: () => content.audio.emitBlast(0, 0.6, 1.15)},
      {key: 'cityMadrid',    label: 'learn.cityMadrid',    play: () => this.previewCity(0)},
      {key: 'cityBarcelona', label: 'learn.cityBarcelona', play: () => this.previewCity(1)},
      {key: 'citySevilla',   label: 'learn.citySevilla',   play: () => this.previewCity(2)},
      {key: 'cityValencia',  label: 'learn.cityValencia',  play: () => this.previewCity(3)},
      {key: 'cityZaragoza',  label: 'learn.cityZaragoza',  play: () => this.previewCity(4)},
      {key: 'cityBilbao',    label: 'learn.cityBilbao',    play: () => this.previewCity(5)},
      {key: 'crosshairPing', label: 'learn.crosshairPing', play: () => this.previewCrosshairPing()},
      {key: 'lockTone',      label: 'learn.lockTone',      play: () => this.previewLockTone()},
      {key: 'thunkL', label: 'learn.thunkL', play: () => content.audio.batteryThunk('L')},
      {key: 'thunkC', label: 'learn.thunkC', play: () => content.audio.batteryThunk('C')},
      {key: 'thunkR', label: 'learn.thunkR', play: () => content.audio.batteryThunk('R')},
      {key: 'depleted', label: 'learn.depleted', play: () => content.audio.emitDepletion()},
      {key: 'cityDestroy', label: 'learn.cityDestroy', play: () => content.audio.emitCityDestroy(0, content.audio.getCityPitch(0) || 130)},
      {key: 'bonusCity', label: 'learn.bonusCity', play: () => content.audio.emitBonusCity(0, content.audio.getCityPitch(0) || 130)},
    ]

    this._items = items
    for (const it of items) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'c-menu--button'
      btn.dataset.sound = it.key
      btn.dataset.i18n = it.label
      btn.textContent = app.i18n.t(it.label)
      li.appendChild(btn)
      this.state.nav.appendChild(li)
    }

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      if (btn.dataset.action === 'back') {
        app.screenManager.dispatch('back')
      } else if (btn.dataset.sound) {
        this.playByKey(btn.dataset.sound)
      }
    })
  },
  onEnter: function () {
    this.state.entryFrames = 6
    content.audio.start()
    content.audio.silenceAll()
    content.audio.setStaticListener(content.world.LISTENER_YAW)
    app.announce.polite(app.i18n.t('ann.learnHello'))
    app.utility.focus.setWithin(this.rootElement)
  },
  onExit: function () {
    this.stopActiveVoice()
    content.audio.silenceAll()
  },
  onFrame: function () {
    try {
      if (this.state.entryFrames > 0) {
        this.state.entryFrames--
        app.controls.ui()
        return
      }
      const ui = app.controls.ui()
      if (ui.back) {
        app.screenManager.dispatch('back')
        return
      }
      if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
      if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
      if (ui.enter || ui.space || ui.confirm) {
        const f = app.utility.focus.get(this.rootElement)
        if (f && f.dataset && f.dataset.sound) this.playByKey(f.dataset.sound)
      }
      // Auto-stop active voice
      if (this.state.activeVoice && engine.time() >= this.state.activeVoiceEnd) {
        this.stopActiveVoice()
      }
      // Tick city props (so binaural updates render even on this screen)
      content.audio.frameCities()
    } catch (e) { console.error(e) }
  },
  playByKey: function (key) {
    this.stopActiveVoice()
    const item = (this._items || []).find((x) => x.key === key)
    if (!item) return
    app.announce.polite(app.i18n.t('ann.playing', {label: app.i18n.t(item.label)}))
    item.play()
  },
  stopActiveVoice: function () {
    if (this.state.activeVoice) {
      try { this.state.activeVoice.destroy() } catch (_) {}
      this.state.activeVoice = null
    }
    this.state.activeVoiceEnd = 0
  },
  previewIcbm: function () {
    // Spawn an isolated incoming-whistle voice 2.5s long, sweep its
    // frequency to mimic a falling missile.
    const v = content.audio.makeProp({
      build: (out) => {
        const ctl = content.audio.buildIncomingWhistle(out, {baseHz: 700, level: 0.2})
        this._lastCtl = ctl
        return ctl.stop
      },
      x: 0,
      y: 0.85,
      gain: 0.9,
    })
    this.state.activeVoice = v
    this.state.activeVoiceEnd = engine.time() + 2.4
    let t = 0
    const id = setInterval(() => {
      t += 0.05
      if (!this.state.activeVoice || !this._lastCtl) { clearInterval(id); return }
      const yc = Math.max(0, 0.85 - t * 0.4)
      v.setPosition(0, yc)
      v._update()
      this._lastCtl.setFreq(380 + (1 - yc) * 1100)
      this._lastCtl.setCutoff(900 + (1 - yc) * 4000)
      if (t > 2.4) clearInterval(id)
    }, 50)
  },
  previewSplitter: function () {
    const v = content.audio.makeProp({
      build: (out) => {
        const ctl = content.audio.buildSplitterVoice(out)
        this._lastCtl = ctl
        return ctl.stop
      },
      x: 0,
      y: 0.85,
      gain: 0.9,
    })
    this.state.activeVoice = v
    this.state.activeVoiceEnd = engine.time() + 2.4
    let t = 0
    const id = setInterval(() => {
      t += 0.05
      if (!this.state.activeVoice || !this._lastCtl) { clearInterval(id); return }
      const yc = Math.max(0.4, 0.85 - t * 0.2)
      v.setPosition(0, yc)
      v._update()
      this._lastCtl.setFreq(520 + (1 - yc) * 700)
      if (t > 2.4) clearInterval(id)
    }, 50)
  },
  previewBomber: function () {
    const v = content.audio.makeProp({
      build: (out) => {
        const ctl = content.audio.buildBomberDrone(out)
        this._lastCtl = ctl
        return ctl.stop
      },
      x: -0.9,
      y: 0.7,
      gain: 0.85,
    })
    this.state.activeVoice = v
    this.state.activeVoiceEnd = engine.time() + 2.6
    let t = 0
    const id = setInterval(() => {
      t += 0.05
      if (!this.state.activeVoice) { clearInterval(id); return }
      const x = -0.9 + t * 0.7
      v.setPosition(x, 0.7)
      v._update()
      if (t > 2.6) clearInterval(id)
    }, 50)
  },
  previewBomberDrop: function () {
    this.previewBomber()
    setTimeout(() => {
      if (this._lastCtl && this._lastCtl.setHighpass) this._lastCtl.setHighpass(true)
    }, 1000)
    setTimeout(() => {
      if (this._lastCtl && this._lastCtl.setHighpass) this._lastCtl.setHighpass(false)
      content.audio.emitBlast(0.0, 0.0, 0.6)
    }, 1500)
  },
  previewCity: function (i) {
    // Solo the requested city ambient briefly. We use the existing prop —
    // the game-screen exit doesn't destroy them — so just bump its gain.
    const prop = content.audio.getCityProp(i)
    if (!prop) return
    prop.setGainImmediate(0.7)
    setTimeout(() => prop.setGainImmediate(0), 1800)
  },
  previewCrosshairPing: function () {
    const v = content.audio.makeProp({
      build: (out) => {
        const ctl = content.audio.buildCrosshairPing(out)
        this._lastCtl = ctl
        return ctl.stop
      },
      x: 0, y: 0.5, gain: 1.0,
    })
    this.state.activeVoice = v
    this.state.activeVoiceEnd = engine.time() + 2.8
    let t = 0
    const id = setInterval(() => {
      t += 0.06
      if (!this.state.activeVoice || !this._lastCtl) { clearInterval(id); return }
      const yc = (Math.sin(t * 1.4) + 1) * 0.5
      v.setPosition(0, yc); v._update()
      this._lastCtl.setFreq(660 + 1320 * yc)
      this._lastCtl.pulse(0.12, 0.18)
      if (t > 2.6) clearInterval(id)
    }, 230)
  },
  previewLockTone: function () {
    const v = content.audio.makeProp({
      build: (out) => {
        const ctl = content.audio.buildLockTone(out)
        this._lastCtl = ctl
        return ctl.stop
      },
      x: 0, y: 0.5, gain: 1.0,
    })
    this.state.activeVoice = v
    this.state.activeVoiceEnd = engine.time() + 3.6
    // Sweep both gain and tremolo from 0 to 1 across 3 seconds, simulating
    // the crosshair sliding in toward a perfect lock. By t=3s the wobble
    // should be unmistakable (deep amplitude tremolo + pitch vibrato).
    let t = 0
    const id = setInterval(() => {
      t += 0.06
      if (!this.state.activeVoice || !this._lastCtl) { clearInterval(id); return }
      const k = Math.min(1, t / 3.0)
      this._lastCtl.setGain(0.28 * k)
      this._lastCtl.setTremolo(k * k)
      if (t > 3.6) clearInterval(id)
    }, 60)
  },
})
