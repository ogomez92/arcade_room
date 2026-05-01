/**
 * Learn Sounds screen. Lets the player audition every cue the game uses so
 * they can learn what each sound represents before (or during) play.
 *
 * One-shot sounds fire once. Continuous loops play for a few seconds and
 * auto-stop. The engine has its own three-step preview (start at idle, ramp
 * to full throttle, stop) so the chuff-rate cue is obvious.
 */
app.screen.sounds = app.screenManager.invent({
  id: 'sounds',
  parentSelector: '.a-app--sounds',
  rootSelector: '.a-sounds',
  transitions: {
    back: function () { this.change('menu') },
  },
  state: {
    entryFrames: 0,
    activeLoop: null,         // {stop} for in-flight enemy/genesis-danger loops
    activeLoopTimer: 0,       // setTimeout id that auto-stops it
    engineTimers: [],         // setTimeout ids for the engine demo sweep
  },

  // Authored once at build time; localized via i18n.
  catalog: function () {
    const a = content.audio
    // Loop preview: stop any prior loop, start the requested one, schedule
    // an auto-stop, and remember the handle so back/replay can cancel it.
    const previewLoop = (kind, ms = 2800, peak = 0.35) => () => {
      this.stopActiveLoop()
      const h = a.loop({kind, ex: 5, ey: 0, py: 0, peak})
      this.state.activeLoop = h
      this.state.activeLoopTimer = setTimeout(() => {
        if (this.state.activeLoop === h) {
          try { h.stop() } catch (_) {}
          this.state.activeLoop = null
          this.state.activeLoopTimer = 0
        }
      }, ms)
    }
    const explode = (kind) => () => a.explode(kind, 5, 0, 0)

    return [
      {header: true, label: 'sounds.cat.player'},
      {label: 'sounds.engineDemo', play: () => this.playEngineDemo()},
      {label: 'sounds.beam',       play: () => a.beam(5, 0, 0)},
      {label: 'sounds.bomb',       play: () => a.bomb(5, 0, 0)},
      {label: 'sounds.beamHit',    play: () => a.beamHit(5, 0, 0)},
      {label: 'sounds.bombHit',    play: () => a.bombHit(5, 0, 0)},
      {label: 'sounds.burst',      play: () => a.burst()},
      {label: 'sounds.shieldHit',  play: () => a.shieldHit(5, 0, 0)},
      {label: 'sounds.shieldExp',  play: () => a.shieldExp()},
      {label: 'sounds.die',        play: () => a.die()},
      {label: 'sounds.extend',     play: () => a.extend()},
      {label: 'sounds.combo',      play: () => a.combo(4)},
      {label: 'sounds.thrustLeft',  play: () => this.playThrust(true)},
      {label: 'sounds.thrustRight', play: () => this.playThrust(false)},
      {label: 'sounds.speedUp',    play: () => a.speedShift(true)},
      {label: 'sounds.speedDown',  play: () => a.speedShift(false)},
      {label: 'sounds.edgeWarn',   play: () => a.edgeWarn()},
      {label: 'sounds.avoid',      play: () => a.avoid()},
      {label: 'sounds.pause',      play: () => a.pauseTone()},

      {header: true, label: 'sounds.cat.enemyLoops'},
      {label: 'sounds.loopFlierLight',   play: previewLoop('flier-light')},
      {label: 'sounds.loopFlierHeavy',   play: previewLoop('flier-heavy')},
      {label: 'sounds.loopGroundBase',   play: previewLoop('ground-base')},
      {label: 'sounds.loopTower',        play: previewLoop('tower')},
      {label: 'sounds.loopSphere',       play: previewLoop('sphere')},
      {label: 'sounds.loopPorter',       play: previewLoop('porter')},
      {label: 'sounds.loopSliderAir',    play: previewLoop('slider-air')},
      {label: 'sounds.loopSliderGround', play: previewLoop('slider-ground')},
      {label: 'sounds.loopBouncer',      play: previewLoop('bouncer')},

      {header: true, label: 'sounds.cat.enemyActions'},
      {label: 'sounds.enemyShot',      play: () => a.enemyShot(5, 0, 0)},
      {label: 'sounds.enemyShootWarn', play: () => a.enemyShootWarn(5, 0, 0)},
      {label: 'sounds.sphereWarn',     play: () => a.sphereWarn(5, 0, 0)},
      {label: 'sounds.sphereExp',      play: () => a.sphereExp(5, 0, 0)},

      {header: true, label: 'sounds.cat.hits'},
      {label: 'sounds.hitFlierLight',     play: () => a.enemyHit('flier-light',   5, 0, 0, false)},
      {label: 'sounds.hitFlierHeavy',     play: () => a.enemyHit('flier-heavy',   5, 0, 0, false)},
      {label: 'sounds.hitGroundBase',     play: () => a.enemyHit('ground-base',   5, 0, 0, false)},
      {label: 'sounds.hitSphere',         play: () => a.enemyHit('sphere',        5, 0, 0, false)},
      {label: 'sounds.hitPorter',         play: () => a.enemyHit('porter',        5, 0, 0, false)},
      {label: 'sounds.hitSliderAir',      play: () => a.enemyHit('slider-air',    5, 0, 0, false)},
      {label: 'sounds.hitSliderGround',   play: () => a.enemyHit('slider-ground', 5, 0, 0, false)},
      {label: 'sounds.hitBouncerAlive',   play: () => a.enemyHit('bouncer',       5, 0, 0, false)},
      {label: 'sounds.hitBouncerKill',    play: () => a.enemyHit('bouncer',       5, 0, 0, true)},
      {label: 'sounds.hitTower',          play: () => a.enemyHit('tower',         5, 0, 0, false)},

      {header: true, label: 'sounds.cat.explosions'},
      {label: 'sounds.expFlierLight',   play: explode('flier-light')},
      {label: 'sounds.expFlierHeavy',   play: explode('flier-heavy')},
      {label: 'sounds.expGroundBase',   play: explode('ground-base')},
      {label: 'sounds.expSphere',       play: explode('sphere')},
      {label: 'sounds.expPorter',       play: explode('porter')},
      {label: 'sounds.expSliderAir',    play: explode('slider-air')},
      {label: 'sounds.expSliderGround', play: explode('slider-ground')},
      {label: 'sounds.expBouncer',      play: explode('bouncer')},

      {header: true, label: 'sounds.cat.tower'},
      {label: 'sounds.towerAlarm',   play: () => a.towerAlarm()},
      {label: 'sounds.towerAppear',  play: () => a.towerAppear(5, 0, 0)},
      {label: 'sounds.towerDestroy', play: () => a.towerDestroy(5, 0, 0)},

      {header: true, label: 'sounds.cat.genesis'},
      {label: 'sounds.genesisAppear', play: () => a.genesisAppear()},
      {label: 'sounds.genesisDanger', play: previewLoop('genesis-danger', 3500, 0.22)},
      {label: 'sounds.genesisDie',    play: () => a.genesisDie()},

      {header: true, label: 'sounds.cat.items'},
      {label: 'sounds.itemAppear', play: () => a.itemAppear(5, 0, 0)},
      {label: 'sounds.itemObtain', play: () => a.itemObtain()},
      {label: 'sounds.itemPop',    play: () => a.itemPop()},

      {header: true, label: 'sounds.cat.flow'},
      {label: 'sounds.levelUp',  play: () => a.levelUp()},
      {label: 'sounds.ready',    play: () => a.ready()},
      {label: 'sounds.levelEnd', play: () => a.levelEnd(5, 0, 0)},
    ]
  },

  onReady: function () {
    this.list = this.rootElement.querySelector('.a-sounds--list')
    this.now = this.rootElement.querySelector('[data-sounds="now"]')
    this.renderList()

    this.rootElement.addEventListener('click', (e) => {
      const item = e.target.closest('button[data-sound-i]')
      if (item) {
        this.playIndex(parseInt(item.dataset.soundI, 10))
        return
      }
      const back = e.target.closest('button[data-action="back"]')
      if (back) this.exit()
    })
    this.rootElement.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.exit()
      }
    })
  },

  renderList: function () {
    if (!this.list) return
    const items = this.catalog()
    this.items = items
    this.list.innerHTML = ''
    items.forEach((it, i) => {
      const li = document.createElement('li')
      if (it.header) {
        const h = document.createElement('h2')
        h.className = 'a-sounds--header'
        h.textContent = app.i18n.t(it.label) || it.label
        li.appendChild(h)
      } else {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'c-menu--button'
        btn.dataset.soundI = String(i)
        btn.textContent = app.i18n.t(it.label) || it.label
        li.appendChild(btn)
      }
      this.list.appendChild(li)
    })
  },

  playIndex: function (i) {
    const item = this.items && this.items[i]
    if (!item || !item.play) return
    if (this.now) this.now.textContent = app.i18n.t(item.label) || item.label
    try { item.play() } catch (e) { /* keep navigation responsive on error */ }
  },

  playThrust: function (left) {
    // Hold the hydraulic loop for 800ms so the listener hears the sustained
    // pressurized character, not just the attack.
    this.stopThrustPreview()
    content.audio.startThrust(left)
    this.state.thrustTimer = setTimeout(() => {
      content.audio.stopThrust()
      this.state.thrustTimer = 0
    }, 800)
  },

  stopThrustPreview: function () {
    if (this.state.thrustTimer) {
      clearTimeout(this.state.thrustTimer)
      this.state.thrustTimer = 0
    }
    try { content.audio.stopThrust() } catch (_) {}
  },

  playEngineDemo: function () {
    // Show off the chuff-rate sweep: idle -> full throttle -> stop. This is
    // the cue players need to recognize the engine in flight.
    this.stopEngineDemo()
    content.audio.startEngine()
    content.audio.setEnginePitch(700)               // idle
    const t1 = setTimeout(() => content.audio.setEnginePitch(500), 1200)
    const t2 = setTimeout(() => content.audio.setEnginePitch(300), 2400)
    const t3 = setTimeout(() => content.audio.stopEngine(),         4200)
    this.state.engineTimers = [t1, t2, t3]
  },

  stopActiveLoop: function () {
    if (this.state.activeLoopTimer) {
      clearTimeout(this.state.activeLoopTimer)
      this.state.activeLoopTimer = 0
    }
    if (this.state.activeLoop) {
      try { this.state.activeLoop.stop() } catch (_) {}
      this.state.activeLoop = null
    }
  },

  stopEngineDemo: function () {
    for (const t of this.state.engineTimers) clearTimeout(t)
    this.state.engineTimers = []
    try { content.audio.stopEngine() } catch (_) {}
  },

  exit: function () {
    this.stopActiveLoop()
    this.stopEngineDemo()
    this.stopThrustPreview()
    app.screenManager.dispatch('back')
  },

  onEnter: function () {
    this.state.entryFrames = 6
    this.renderList()
    const first = this.rootElement.querySelector('button[data-sound-i]')
    if (first) first.focus()
  },

  onExit: function () {
    this.stopActiveLoop()
    this.stopEngineDemo()
    this.stopThrustPreview()
  },

  onFrame: function () {
    if (this.state.entryFrames > 0) {
      this.state.entryFrames--
      app.controls.ui()
      return
    }
    const ui = app.controls.ui()
    if (ui.back) this.exit()
  },
})
