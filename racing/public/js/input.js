const Input = (() => {
  const held = Object.create(null)
  const pressed = Object.create(null)

  function onDown(e) {
    if (held[e.code]) return
    held[e.code] = true
    pressed[e.code] = true
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','F1','F2','F3','F4'].includes(e.code)) {
      e.preventDefault()
    }
  }
  function onUp(e) { held[e.code] = false }

  window.addEventListener('keydown', onDown)
  window.addEventListener('keyup', onUp)
  window.addEventListener('blur', () => {
    for (const k in held) held[k] = false
  })

  return {
    held,
    wasPressed(code) {
      if (pressed[code]) { pressed[code] = false; return true }
      return false
    },
    clear() {
      for (const k in held) held[k] = false
      for (const k in pressed) pressed[k] = false
    },
    steer() {
      const left = held.ArrowLeft
      const right = held.ArrowRight
      return (right ? 1 : 0) - (left ? 1 : 0)
    },
    boost() { return held.ShiftLeft || held.ShiftRight },
    brake() { return held.ArrowDown },
    accel() { return !held.ArrowDown },
  }
})()
