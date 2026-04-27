/**
 * Shared menu navigation helper. Each screen calls
 * `app.utility.menuNav.handle(rootElement)` from `onFrame()`.
 *
 * Up/Down (or Left/Right) move focus, Enter/Space click the focused
 * button. The native focus trap is provided by the screen `base`.
 */
app.utility.menuNav = (() => {
  function move(parentElement, direction) {
    if (!parentElement) return
    if (direction > 0) {
      app.utility.focus.setNextFocusable(parentElement)
    } else {
      app.utility.focus.setPreviousFocusable(parentElement)
    }
  }

  return {
    handle: function (parentElement) {
      const ui = app.controls.ui()

      if (ui.up || ui.left) {
        move(parentElement, -1)
      } else if (ui.down || ui.right) {
        move(parentElement, +1)
      }

      if (ui.enter || ui.space || ui.confirm) {
        const focused = app.utility.focus.get(parentElement)
        if (focused && typeof focused.click === 'function') {
          focused.click()
        }
      }
    },
  }
})()
