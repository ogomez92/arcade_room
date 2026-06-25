// Touch thumb-stick adapter (net-new — the template ships only the mouse /
// pointer-lock adapter). There is no on-screen joystick widget: the first touch
// anywhere on the game surface becomes the stick's origin, and dragging away
// from it gives a direction + magnitude. Releasing stops the mallet. This keeps
// the screen visually empty (it's an audio game) while giving sighted-assist
// and mobile players analog control.
//
// Output matches the keyboard/gamepad control frame: {x, y} with x = forward
// (+1) / backward (-1) and y = left (+1) / right (-1). The game screen does the
// control→screen mapping, same as for every other adapter.
app.controls.touch = (() => {
  let surface = null
  let activeId = null
  let originX = 0, originY = 0
  let vecX = 0, vecY = 0 // current control-frame vector

  // Pixels of drag that equal full deflection. Generous so small thumb moves
  // give fine control and a firm drag pins the mallet at full speed.
  const RADIUS = 64

  function reset() {
    activeId = null
    vecX = 0; vecY = 0
  }

  function onStart(e) {
    if (activeId !== null) return
    const t = e.changedTouches[0]
    if (!t) return
    activeId = t.identifier
    originX = t.clientX
    originY = t.clientY
    vecX = 0; vecY = 0
    e.preventDefault()
  }

  function findTouch(list) {
    for (let i = 0; i < list.length; i++) if (list[i].identifier === activeId) return list[i]
    return null
  }

  function onMove(e) {
    if (activeId === null) return
    const t = findTouch(e.changedTouches)
    if (!t) return
    const dx = t.clientX - originX
    const dy = t.clientY - originY
    // Screen drag → control frame: drag up (dy<0) = forward (x=+1);
    // drag right (dx>0) = right (y=-1).
    let cx = engine.fn.clamp(-dy / RADIUS, -1, 1)
    let cy = engine.fn.clamp(-dx / RADIUS, -1, 1)
    vecX = cx; vecY = cy
    e.preventDefault()
  }

  function onEnd(e) {
    if (activeId === null) return
    const t = findTouch(e.changedTouches)
    if (!t) return
    reset()
    e.preventDefault()
  }

  engine.ready(() => {
    surface = document.querySelector('.a-game')
    if (!surface) return
    surface.addEventListener('touchstart', onStart, { passive: false })
    surface.addEventListener('touchmove', onMove, { passive: false })
    surface.addEventListener('touchend', onEnd, { passive: false })
    surface.addEventListener('touchcancel', onEnd, { passive: false })
    // Drop the stick when leaving the game so a stale touch can't keep driving.
    if (app.screenManager && app.screenManager.on) {
      app.screenManager.on('exit-game', reset)
    }
  })

  return {
    game: () => {
      if (activeId === null) return {}
      const state = {}
      if (vecX) state.x = vecX
      if (vecY) state.y = vecY
      return state
    },
    ui: () => ({}),
    isActive: () => activeId !== null,
    reset,
  }
})()
