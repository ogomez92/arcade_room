app.controls.keyboard = {
  game: (mappings) => {
    const keys = engine.input.keyboard.get(),
      state = {}

    const checkMapping = (value, mapping) => {
      return value || (mapping.type == 'keyboard' && keys[mapping.key])
    }

    // Boolean game inputs (pinball)
    for (const name of ['flipLeft', 'flipRight', 'plunge']) {
      if (mappings[name] && mappings[name].reduce(checkMapping, false)) {
        state[name] = true
      }
    }

    return state
  },
  ui: (mappings) => {
    const keys = engine.input.keyboard.get(),
      state = {}

    const checkMapping = (value, mapping) => {
      return value || (mapping.type == 'keyboard' && keys[mapping.key])
    }

    for (const [mapping, name] of Object.entries({
      back: 'back',
      pause: 'pause',
      uiDown: 'down',
      uiLeft: 'left',
      uiRight: 'right',
      uiUp: 'up',
      position: 'position',
      quit: 'quit',
      help: 'help',
    })) {
      if (mappings[mapping] && mappings[mapping].reduce(checkMapping, false)) {
        state[name] = true
      }
    }

    for (const [key, name] of Object.entries({
      Enter: 'enter',
      Space: 'space',
      Tab: 'tab',
    })) {
      if (keys[key]) {
        state[name] = true
      }
    }

    ;[
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
      'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0',
    ].forEach((key, index) => {
      if (keys[key]) {
        state.focus = index
      }
    })

    return state
  },
}
