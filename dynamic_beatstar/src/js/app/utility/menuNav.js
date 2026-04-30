// Arrow-key navigation for menu screens. Reads the per-frame UI delta
// (from app.controls.ui()) and translates Up/Down arrow presses into
// focus moves through the focusable buttons inside `root`. Enter/Space
// already activate a focused button via browser default, so nothing else
// is needed for "select".
//
// Use from a screen's onFrame:
//   const ui = app.controls.ui()
//   app.utility.menuNav.handle(ui, this.rootElement)
//
// Tab still works (focus.trap handles it) — this just adds arrow keys
// as a more discoverable alternative.
app.utility.menuNav = {
  handle: function (ui, root) {
    if (!ui || !root) return
    if (ui.up)   app.utility.focus.setPreviousFocusable(root)
    if (ui.down) app.utility.focus.setNextFocusable(root)
  },
}
