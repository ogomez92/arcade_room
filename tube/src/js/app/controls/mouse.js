// Tempest Tube is keyboard + gamepad only. Keep the adapter shape so
// app.controls can merge it, but do not request pointer lock or report input.
app.controls.mouse = {
  game: () => ({}),
  getInput: () => ({button: {}}),
  ui: () => ({}),
}
