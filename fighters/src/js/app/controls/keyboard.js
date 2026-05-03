app.controls.keyboard = {
  game: (mappings) => {
    const keys = engine.input.keyboard.get(),
      state = {}

    const held = (name) => mappings[name].some(
      (m) => m.type == 'keyboard' && keys[m.key]
    )

    // 2D movement axes
    if (held('moveLeft') && !held('moveRight')) state.x = -1
    else if (held('moveRight') && !held('moveLeft')) state.x = 1
    else state.x = 0

    if (held('moveUp') && !held('moveDown')) state.y = -1
    else if (held('moveDown') && !held('moveUp')) state.y = 1
    else state.y = 0

    state.highPunch = held('highPunch')
    state.lowPunch  = held('lowPunch')
    state.highKick  = held('highKick')
    state.lowKick   = held('lowKick')
    state.block     = held('block')
    state.duck      = held('duck')
    state.jump      = held('jump')

    return state
  },
  ui: (mappings) => {
    const keys = engine.input.keyboard.get(),
      state = {}

    const held = (name) => (mappings[name] || []).some(
      (m) => m.type == 'keyboard' && keys[m.key]
    )

    if (held('back')) state.back = true
    if (held('pause')) state.pause = true
    if (held('uiUp') || held('moveUp')) state.up = true
    if (held('uiDown') || held('moveDown')) state.down = true
    if (held('uiLeft') || held('moveLeft')) state.left = true
    if (held('uiRight') || held('moveRight')) state.right = true
    if (keys.Enter) state.enter = true
    if (keys.Space) state.space = true
    if (keys.Tab)   state.tab = true

    // Attack edges so the menu doesn't catch them as something else.
    if (held('highPunch')) state.highPunch = true
    if (held('lowPunch'))  state.lowPunch  = true
    if (held('highKick'))  state.highKick  = true
    if (held('lowKick'))   state.lowKick   = true
    if (held('block'))     state.block     = true
    if (held('duck'))      state.duck      = true
    if (held('jump'))      state.jump      = true

    ;[
      'Digit1','Digit2','Digit3','Digit4','Digit5',
      'Digit6','Digit7','Digit8','Digit9','Digit0',
    ].forEach((key, index) => {
      if (keys[key]) state.focus = index
    })

    return state
  },
}
