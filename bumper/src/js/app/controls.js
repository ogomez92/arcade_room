app.controls = (() => {
  const gameDefaults = {
    rotate: 0,
    x: 0,
    y: 0,
    z: 0,
  }

  let gameCache = {...gameDefaults},
    uiCache = {},
    uiDelta = {}

  function updateGame() {
    const mappings = app.controls.mappings

    gameCache = {
      ...gameDefaults,
      ...app.controls.gamepad.game(mappings),
      ...app.controls.keyboard.game(mappings),
      ...app.controls.mouse.game(mappings),
    }
  }

  function updateUi() {
    const mappings = app.controls.mappings

    const values = {
      ...app.controls.gamepad.ui(mappings),
      ...app.controls.keyboard.ui(mappings),
      ...app.controls.mouse.ui(mappings),
    }

    uiDelta = {}

    for (const key in values) {
      if (!(key in uiCache)) {
        uiDelta[key] = values[key]
      }
    }

    uiCache = values
  }

  return {
    game: () => ({...gameCache}),
    ui: () => ({...uiDelta}),
    reset: function () {
      gameCache = {}
      uiCache = {}
      uiDelta = {}

      return this
    },
    update: function () {
      updateGame()
      updateUi()

      return this
    },
    /**
     * Snapshot the current input state into the cache without producing
     * any deltas, and clear pending deltas. Used by the screen manager
     * after a transition so a key still held from the previous screen
     * (e.g. Enter on the Back button that triggered the transition)
     * isn't misread as "newly pressed" on the new screen's first frame
     * — which would otherwise cause that screen's first focusable
     * button to get auto-clicked.
     */
    consume: function () {
      const mappings = app.controls.mappings
      uiCache = {
        ...app.controls.gamepad.ui(mappings),
        ...app.controls.keyboard.ui(mappings),
        ...app.controls.mouse.ui(mappings),
      }
      uiDelta = {}
      return this
    },
  }
})()

engine.loop.on('frame', () => app.controls.update())
