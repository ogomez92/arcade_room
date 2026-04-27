app.screen.learnSounds = app.screenManager.invent({
  id: 'learnSounds',
  parentSelector: '.a-app--learnSounds',
  rootSelector: '.a-learnSounds',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    items: null,
  },
  onReady: function () {
    const root = this.rootElement

    // Build button list once. Labels are stored as i18n keys (and optional
    // params) so the list can be re-rendered on language change.
    const items = [
      {key: 'learn.uiFocus', play: () => content.sounds.uiFocus()},
      {key: 'learn.uiBack', play: () => content.sounds.uiBack()},
      {key: 'learn.roundStart', play: () => content.sounds.roundStart()},
      {key: 'learn.roundEndWin', play: () => content.sounds.roundEnd(true)},
      {key: 'learn.roundEndLose', play: () => content.sounds.roundEnd(false)},
      {key: 'learn.collisionLight', play: () => content.sounds.collision({x: 0, y: 0}, 0.25)},
      {key: 'learn.collisionHeavy', play: () => content.sounds.collision({x: 0, y: 0}, 1)},
      {key: 'learn.scoringSmall', play: () => content.sounds.scoring(0.15)},
      {key: 'learn.scoringBig', play: () => content.sounds.scoring(1.0)},
      {key: 'learn.buzzerLight', play: () => content.sounds.buzzer({x: 0, y: 0}, 0.3)},
      {key: 'learn.buzzerHard', play: () => content.sounds.buzzer({x: 0, y: 0}, 1.0)},
      {key: 'learn.wallScrape', play: () => content.sounds.wallScrape({x: 0, y: 0}, 3)},
      {key: 'learn.elimination', play: () => content.sounds.eliminate({x: 0, y: 0})},
      {key: 'learn.heartbeat', play: () => content.sounds.heartbeat()},
      // Pickup *loops* — the continuous sound each pickup makes sitting
      // on the ground waiting to be grabbed, not the one-shot chime
      // played when you actually drive over it. The loop is what the
      // player needs to learn to navigate to.
      {key: 'learn.pickupHealth', play: () => content.pickups.previewVoice('health')},
      {key: 'learn.pickupShield', play: () => content.pickups.previewVoice('shield')},
      {key: 'learn.pickupBullets', play: () => content.pickups.previewVoice('bullets')},
      {key: 'learn.pickupMine', play: () => content.pickups.previewVoice('mine')},
      {key: 'learn.pickupSpeed', play: () => content.pickups.previewVoice('speed')},
      {key: 'learn.pickupTeleport', play: () => content.pickups.previewVoice('teleport')},
      {key: 'learn.teleport', play: () => content.sounds.teleport({x: 0, y: 0})},
      {key: 'learn.boostActivated', play: () => content.sounds.boostActivated({x: 0, y: 0})},
      {key: 'learn.boostExpired', play: () => content.sounds.boostExpired({x: 0, y: 0})},
      {key: 'learn.shieldBlock', play: () => content.sounds.shieldBlock({x: 0, y: 0})},
      {key: 'learn.explosion', play: () => content.sounds.explosion({x: 0, y: 0}, 1)},
      {key: 'learn.proximityFront', play: () => playProximity(true)},
      {key: 'learn.proximityBehind', play: () => playProximity(false)},
      {key: 'learn.wallProximity', play: () => playWallProximity()},
    ]

    // Each engine timbre
    for (let i = 0; i < content.carEngine.profileCount; i++) {
      const idx = i
      items.push({
        key: 'learn.engine',
        params: {color: app.i18n.t('color.' + content.carEngine.profileName(idx))},
        colorId: content.carEngine.profileName(idx),
        play: () => previewEngine(idx),
      })
    }

    this.state.items = items
    this.renderList()
    app.i18n.onChange(() => this.renderList())

    root.addEventListener('click', (e) => {
      const back = e.target.closest('button[data-action="back"]')
      if (back) {
        content.sounds.uiBack()
        app.screenManager.dispatch('back')
      }
    })
    root.addEventListener('focusin', (e) => {
      if (e.target.matches('button')) {
        content.sounds.uiFocus()
      }
    })

    function playProximity(front) {
      const c = engine.context()
      const t0 = engine.time()
      const out = c.createGain()
      out.gain.value = 0
      out.connect(engine.mixer.output())

      // Three beeps speeding up.
      const intervals = [0.5, 0.3, 0.15, 0.08]
      let t = t0
      for (const dt of intervals) {
        const o = c.createOscillator()
        o.type = 'sine'
        o.frequency.value = front ? 1400 : 520
        const g = c.createGain()
        g.gain.value = 0
        o.connect(g).connect(out)
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.4, t + 0.005)
        g.gain.linearRampToValueAtTime(0, t + 0.08)
        o.start(t)
        o.stop(t + 0.1)
        t += dt
      }
      out.gain.value = 1
      setTimeout(() => out.disconnect(), 1500)
    }

    function playWallProximity() {
      // Demo: filtered-noise whoosh ramping from far-quiet to near-loud
      // and back. Mirrors the in-game continuous wall voice.
      const c = engine.context()
      const t0 = engine.time()
      const dur = 3.0

      const out = c.createGain()
      out.gain.value = 0
      out.connect(engine.mixer.output())

      const noise = c.createBufferSource()
      noise.buffer = engine.buffer.pinkNoise({channels: 1, duration: dur + 0.2})
      noise.loop = false

      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 180
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 950

      noise.connect(hp).connect(lp).connect(out)

      // Quartic ramp in, hold, quartic ramp out — mirrors the in-game
      // curve so this is what walls actually sound like as you approach
      // and leave.
      const peak = 0.16
      const steps = 24
      for (let i = 0; i <= steps; i++) {
        const phase = i / steps                         // 0..1
        const tri = 1 - Math.abs(phase * 2 - 1)         // 0→1→0 triangle
        const g = Math.max(0.0005, Math.pow(tri, 4) * peak)
        out.gain.linearRampToValueAtTime(g, t0 + phase * dur)
      }

      noise.start(t0)
      noise.stop(t0 + dur + 0.1)
      noise.onended = () => { try { out.disconnect() } catch (e) {} }
    }

    function previewEngine(idx) {
      const sound = content.carEngine.create(idx)
      let phase = 0
      const interval = setInterval(() => {
        phase += 0.1
        sound.update({
          position: {x: 0, y: 0},
          listener: {x: 0, y: 0},
          listenerYaw: 0,
          speed: 2 + Math.sin(phase * 2) * 1.5,
          throttle: 0.7,
          scrapeSpeed: 0,
          eliminated: false,
        })
      }, 100)
      setTimeout(() => {
        clearInterval(interval)
        sound.destroy()
      }, 2200)
    }
  },
  renderList: function () {
    const list = this.rootElement.querySelector('.a-learnSounds--list')
    list.innerHTML = ''
    for (const it of this.state.items) {
      const li = document.createElement('li')
      const btn = document.createElement('button')
      btn.className = 'c-menu--button'
      // For engine entries, recompute colour name from the current locale.
      const params = it.colorId
        ? {color: app.i18n.t('color.' + it.colorId)}
        : it.params
      btn.textContent = app.i18n.t(it.key, params)
      btn.addEventListener('click', () => {
        it.play()
      })
      li.appendChild(btn)
      list.appendChild(li)
    }
  },
  onEnter: function () {
    // No live-region chatter — semantic markup announces the screen.
  },
  onFrame: function () {
    const ui = app.controls.ui()
    if (ui.back) {
      content.sounds.uiBack()
      app.screenManager.dispatch('back')
      return
    }
    app.utility.menuNav.handle(this.rootElement)
  },
})
