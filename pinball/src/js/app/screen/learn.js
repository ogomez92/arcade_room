app.screen.learn = app.screenManager.invent({
  id: 'learn',
  parentSelector: '.a-app--learn',
  rootSelector: '.a-learn',
  transitions: {
    back: function () { this.change('splash') },
  },
  state: {
    entryFrames: 0,
  },
  onReady: function () {
    const root = this.rootElement

    root.querySelectorAll('button[data-sound]').forEach((btn) => {
      btn.addEventListener('click', () => {
        playSample(btn.getAttribute('data-sound'))
        // Re-announce the label so screen readers confirm the click landed.
        app.announce.polite(btn.textContent)
      })
    })

    const back = root.querySelector('.a-learn--back')
    if (back) back.addEventListener('click', () => app.screenManager.dispatch('back'))
  },
  onEnter: function () {
    this.state.entryFrames = 8
    app.announce.assertive(app.i18n.t('ann.learnEnter'))
    const first = this.rootElement.querySelector('button[data-sound]')
    if (first) app.utility.focus.set(first)
  },
  onExit: function () {
    // Stop any preview rolling sound that might still be running.
    if (content.audio && content.audio.rollStop) content.audio.rollStop()
  },
  onFrame: function () {
    if (this.state.entryFrames > 0) { this.state.entryFrames--; return }
    const ui = app.controls.ui()
    if (ui.back || ui.pause) {
      app.screenManager.dispatch('back')
      return
    }
    if (ui.up) app.utility.focus.setPreviousFocusable(this.rootElement)
    if (ui.down) app.utility.focus.setNextFocusable(this.rootElement)
  },
})

// Local sample player. Maps a button id ("bumper-alpha", "target-t2", etc.)
// to an actual call into content.audio at a meaningful table position so the
// player learns both the timbre and the spatial cue at once.
function playSample(name) {
  const A = content.audio
  const T = content.table
  if (!A || !T) return

  // Make sure the listener is parked at its game-time position before each
  // preview, since other screens (or none) may have left it elsewhere.
  A.setListener()

  // For rolling-sound previews, simulate a moving ball for a brief window.
  const rollPreview = (ball, dur = 1.2) => {
    A.rollStart()
    const start = engine.time()
    const tick = () => {
      const t = engine.time() - start
      if (t >= dur) {
        A.rollStop()
        return
      }
      A.rollUpdate(ball)
      requestAnimationFrame(tick)
    }
    tick()
  }

  if (name.startsWith('roll-')) {
    const sub = name.slice(5)
    const tableW = T.WIDTH, tableH = T.HEIGHT
    let ball
    if (sub === 'slow') {
      ball = {x: 0, y: tableH * 0.4, vx: 1, vy: 0, live: true, onPlunger: false}
    } else if (sub === 'fast') {
      ball = {x: 0, y: tableH * 0.4, vx: 18, vy: 6, live: true, onPlunger: false}
    } else if (sub === 'left') {
      ball = {x: -tableW * 0.4, y: tableH * 0.4, vx: 12, vy: 0, live: true, onPlunger: false}
    } else if (sub === 'right') {
      ball = {x:  tableW * 0.4, y: tableH * 0.4, vx: 12, vy: 0, live: true, onPlunger: false}
    } else if (sub === 'far') {
      ball = {x: 0, y: tableH * 0.9, vx: 12, vy: 0, live: true, onPlunger: false}
    }
    rollPreview(ball)
    return
  }

  if (name === 'ballReady') { A.ballReady(); return }

  if (name.startsWith('bumper-')) {
    const id = name.slice(7)
    const b = T.BUMPERS.find(x => x.id === id)
    if (b) A.bumper(b.x, b.y, b.id)
    return
  }

  if (name.startsWith('sling-')) {
    const which = name.slice(6) === 'left' ? 'leftSling' : 'rightSling'
    const s = T.SLINGS.find(x => x.id === which)
    if (s) A.sling(s.x, s.y)
    return
  }

  if (name.startsWith('target-')) {
    const id = name.slice(7)
    const t = T.TARGETS.find(x => x.id === id)
    if (t) A.target(t.x, t.y, t.id)
    return
  }

  if (name.startsWith('rollover-')) {
    const id = name.slice(9)
    const r = T.ROLLOVERS.find(x => x.id === id)
    if (r) A.rollover(r.x, r.y, r.id)
    return
  }

  if (name === 'flap-left')  { A.flipperFlap('left');  return }
  if (name === 'flap-right') { A.flipperFlap('right'); return }
  if (name.startsWith('prox-')) {
    const which = name.slice(5)   // 'left' | 'right' | 'upper'
    const f = which === 'left'  ? T.LEFT_FLIPPER
            : which === 'right' ? T.RIGHT_FLIPPER
            :                     T.UPPER_FLIPPER
    const tipX = f.pivot.x + Math.cos(f.restAngle) * f.length
    const tipY = f.pivot.y + Math.sin(f.restAngle) * f.length
    // Animate a fake ball moving toward the flipper tip over ~2.5 s. The
    // ball starts ~4.5 units away (matches PROX_RANGE) and ends right at
    // the tip; the audio module's proximityUpdate emits the beeps.
    const start = engine.time()
    const dur = 2.5
    A.resetProximity()
    const startX = tipX + 0   // approach straight from above
    const startY = tipY + 4.0
    const tick = () => {
      const t = (engine.time() - start) / dur
      if (t >= 1) return
      const ball = {
        x: startX + (tipX - startX) * t,
        y: startY + (tipY - startY) * t,
        vx: (tipX - startX) / dur,
        vy: (tipY - startY) / dur,
        live: true, onPlunger: false,
      }
      A.proximityUpdate(ball)
      requestAnimationFrame(tick)
    }
    tick()
    return
  }
  if (name === 'flipperHit-left') {
    const f = T.LEFT_FLIPPER
    A.flipperHit(f.pivot.x + 0.6, f.pivot.y + 0.2, 14)
    return
  }
  if (name === 'flipperHit-right') {
    const f = T.RIGHT_FLIPPER
    A.flipperHit(f.pivot.x - 0.6, f.pivot.y + 0.2, 14)
    return
  }

  if (name === 'plunger-charge') { A.plungerCharge(0.6); return }
  if (name === 'plunger-launch') { A.plungerLaunch(0.85); return }
  if (name === 'wall')           { A.wall(0, T.HEIGHT * 0.5, 18); return }

  if (name === 'missionComplete') { A.missionComplete(); return }
  if (name === 'rankUp')          { A.rankUp(); return }
  if (name === 'drain')           { A.drain(); return }
  if (name === 'gameOver')        { A.gameOver(); return }
}
