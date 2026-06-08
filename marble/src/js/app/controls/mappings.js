// Marble uses two analog game axes for board tilt:
//   moveAxis  / moveForward+Backward -> input.x  (+1 = tilt north/up)
//   strafeAxis / strafeLeft+Right    -> input.y  (+1 = tilt west/left)
// content.game.readTilt() converts these into a screen-space tilt vector.
// Gamepad axes 0/1 are the left stick (inverted by the gamepad adapter to match
// keyboard sign). Arrows + WASD give digital full tilt. The UI mappings drive
// menu navigation and are unchanged from the template.
app.controls.mappings = {
  // --- game: tilt ---
  moveAxis: [
    {type: 'gamepad', key: 1},
  ],
  moveForward: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'KeyW'},
    {type: 'keyboard', key: 'Numpad8'},
    {type: 'gamepad', key: 12},
  ],
  moveBackward: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'KeyS'},
    {type: 'keyboard', key: 'Numpad2'},
    {type: 'gamepad', key: 13},
  ],
  strafeAxis: [
    {type: 'gamepad', key: 0},
  ],
  strafeLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'KeyA'},
    {type: 'keyboard', key: 'Numpad4'},
    {type: 'gamepad', key: 14},
  ],
  strafeRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'KeyD'},
    {type: 'keyboard', key: 'Numpad6'},
    {type: 'gamepad', key: 15},
  ],

  // Rotation is unused (the board doesn't turn), but the keyboard/gamepad
  // adapters call .reduce() on these every frame, so they must exist. Empty =
  // always inert.
  turnAxis: [],
  turnLeft: [],
  turnRight: [],

  // --- ui: menu navigation ---
  uiAxisVertical: [
    {type: 'gamepad', key: 1},
  ],
  uiAxisHorizontal: [
    {type: 'gamepad', key: 0},
  ],
  uiDown: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'KeyS'},
    {type: 'keyboard', key: 'Numpad5'},
    {type: 'gamepad', key: 13},
  ],
  uiLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'KeyA'},
    {type: 'keyboard', key: 'Numpad4'},
    {type: 'gamepad', key: 14},
  ],
  uiRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'KeyD'},
    {type: 'keyboard', key: 'Numpad6'},
    {type: 'gamepad', key: 15},
  ],
  uiUp: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'KeyW'},
    {type: 'keyboard', key: 'Numpad8'},
    {type: 'gamepad', key: 12},
  ],

  // --- shared ---
  back: [
    {type: 'keyboard', key: 'Escape'},
    {type: 'keyboard', key: 'Backspace'},
    {type: 'gamepad', key: 1},
  ],
  confirm: [
    {type: 'gamepad', key: 0},
  ],
  pause: [
    {type: 'keyboard', key: 'Escape'},
    {type: 'keyboard', key: 'Backspace'},
    {type: 'gamepad', key: 9},
  ],
  start: [
    {type: 'gamepad', key: 9},
  ],
}
