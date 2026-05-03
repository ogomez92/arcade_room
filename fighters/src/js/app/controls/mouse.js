app.controls.mouse = {
  game: () => ({}),
  ui: (mappings) => {
    const mouse = engine.input.mouse.get(),
      state = {}
    const has = (name) => (mappings[name] || []).some(
      (m) => m.type == 'mouse' && mouse.button && mouse.button[m.key]
    )
    if (has('back')) state.back = true
    if (has('pause')) state.pause = true
    return state
  },
}
