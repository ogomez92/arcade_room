// Local player movement. NO momentum: the robot rolls at a constant speed
// while arrows are held (diagonals from two held arrows) and stops the
// instant they are released. The player makes NO movement/footstep sound of
// its own (deliberately silent) — wall-approach warnings live in field.js.
// References siblings lazily.
content.player = (() => {
  const C = () => content.constants
  const S = () => content.state

  const held = {up: false, down: false, left: false, right: false}
  let ctrl = false

  function setHeld(next) {
    held.up = !!next.up; held.down = !!next.down
    held.left = !!next.left; held.right = !!next.right
  }
  function setCtrl(on) { ctrl = !!on }
  function clearHeld() { held.up = held.down = held.left = held.right = false }

  function frame() {
    const p = S().player()
    const car = S().career()
    if (!p || !car) return
    const dt = engine.loop.delta()

    let dx = 0, dy = 0
    if (held.up) dy -= 1
    if (held.down) dy += 1
    if (held.left) dx -= 1
    if (held.right) dx += 1

    const moving = (dx !== 0 || dy !== 0)
    let speed = 0
    if (moving) {
      const len = Math.hypot(dx, dy) || 1
      dx /= len; dy /= len
      speed = S().currentMoveSpeed(ctrl)
      p.lastMoveDir = {dx, dy}

      const params = C().levelParams(car.difficulty, car.level)
      const newCol = p.col + dx * speed * dt
      const newRow = p.row + dy * speed * dt
      const res = content.field.resolveMove(p, newCol, newRow, dx, dy, params, {fusion: p.fusionArmed})
      p.col = res.col
      p.row = res.row
      if (res.warped) p.fusionArmed = false // one-shot Wall Fusion charge
      if (res.damage > 0) applyDamage(res.damage)
    }

    p.speed = speed
    p.rolling = moving
  }

  // Environmental damage (walls, bombs, hazards). `cause` is recorded so a
  // fatal scrape/blast can be attributed at game over (health is the only
  // resource now — no lives).
  function applyDamage(amount, cause) {
    const car = S().career()
    if (!car) return
    car.health -= amount
    S().level().damageTaken = true
    if (content.game && content.game.noteHitCause) content.game.noteHitCause(cause || C().DEATH.HAZARD)
    if (app.haptics) app.haptics.enqueue({duration: 120, strongMagnitude: 0.6, weakMagnitude: 0.4})
  }

  function reset() {
    clearHeld()
    ctrl = false
  }

  function silenceAll() {
    // No player movement voice to silence — kept for the screen/game FSM.
  }

  return {
    setHeld,
    setCtrl,
    clearHeld,
    frame,
    applyDamage,
    reset,
    silenceAll,
    lastMoveDir: () => (S().player() ? S().player().lastMoveDir : {dx: 0, dy: -1}),
  }
})()
