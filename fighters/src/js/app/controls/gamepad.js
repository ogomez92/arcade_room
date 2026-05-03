app.controls.gamepad = {
  game: function (mappings) {
    const state = {}

    const isDigital = (value, mapping) => {
      return value || (mapping.type == 'gamepad' && engine.input.gamepad.isDigital(mapping.key))
    }

    // Pull movement from D-pad / face buttons. Left stick analog axes
    // also count when pushed past a threshold.
    const left  = mappings.moveLeft.reduce(isDigital, false)
    const right = mappings.moveRight.reduce(isDigital, false)
    const up    = mappings.moveUp.reduce(isDigital, false)
    const down  = mappings.moveDown.reduce(isDigital, false)

    const ax = engine.input.gamepad.getAxis(0) || 0
    const ay = engine.input.gamepad.getAxis(1) || 0

    let x = 0, y = 0
    if (Math.abs(ax) > 0.2) x = ax
    if (Math.abs(ay) > 0.2) y = ay
    if (left) x = -1
    if (right) x = 1
    if (up) y = -1
    if (down) y = 1

    state.x = x
    state.y = y

    state.highPunch = mappings.highPunch.reduce(isDigital, false)
    state.lowPunch  = mappings.lowPunch.reduce(isDigital, false)
    state.highKick  = mappings.highKick.reduce(isDigital, false)
    state.lowKick   = mappings.lowKick.reduce(isDigital, false)

    return state
  },
  ui: function (mappings) {
    const state = {}

    const isDigital = (value, mapping) => {
      return value || (mapping.type == 'gamepad' && engine.input.gamepad.isDigital(mapping.key))
    }

    // D-pad / sticks for menu navigation.
    const ax = engine.input.gamepad.getAxis(0) || 0
    const ay = engine.input.gamepad.getAxis(1) || 0
    let x = 0, y = 0
    if (Math.abs(ax) > 0.5) x = ax > 0 ? 1 : -1
    if (Math.abs(ay) > 0.5) y = ay > 0 ? 1 : -1

    if (mappings.uiLeft.reduce(isDigital, false)) x = -1
    if (mappings.uiRight.reduce(isDigital, false)) x = 1
    if (mappings.uiUp.reduce(isDigital, false)) y = -1
    if (mappings.uiDown.reduce(isDigital, false)) y = 1

    if (x === -1) state.left = true
    if (x ===  1) state.right = true
    if (y === -1) state.up = true
    if (y ===  1) state.down = true

    for (const [mapping, name] of Object.entries({
      back: 'back',
      confirm: 'confirm',
      pause: 'pause',
      start: 'start',
    })) {
      if ((mappings[mapping] || []).reduce(isDigital, false)) {
        state[name] = true
      }
    }

    return state
  },
}
