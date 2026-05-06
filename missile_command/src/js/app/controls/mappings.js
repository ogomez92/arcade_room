// Missile Command bindings: arrow keys (or WASD) for crosshair X/Y;
// Z X C to fire from L/C/R battery (handled directly in game-screen
// onFrame); Space fires from nearest battery with ammo. Esc/P pauses.
//
// keyboard.js returns:
//   state.x from forward/backward (ArrowUp/Down or W/S)
//   state.y from strafe (ArrowLeft/Right or A/D)
//   state.rotate from turn (unused here)
// crosshair.js maps state.x → crosshair.y and state.y → crosshair.x.
app.controls.mappings = {
  // Crosshair Y axis
  moveAxis: [
    {type: 'gamepad', key: 1},
  ],
  moveBackward: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'KeyS'},
    {type: 'keyboard', key: 'Numpad5'},
    {type: 'gamepad', key: 6},
  ],
  moveForward: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'KeyW'},
    {type: 'keyboard', key: 'Numpad8'},
    {type: 'gamepad', key: 7},
  ],

  // Crosshair X axis
  strafeAxis: [
    {type: 'gamepad', key: 0},
  ],
  strafeLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'KeyA'},
    {type: 'keyboard', key: 'Numpad4'},
  ],
  strafeRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'KeyD'},
    {type: 'keyboard', key: 'Numpad6'},
  ],

  // Unused, but defined to keep app.controls.update() happy.
  turnAxis: [
    {type: 'gamepad', key: 2},
  ],
  turnLeft: [],
  turnRight: [],

  // Menu navigation
  uiAxisVertical:   [{type: 'gamepad', key: 1}],
  uiAxisHorizontal: [{type: 'gamepad', key: 0}],
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
  back: [
    {type: 'keyboard', key: 'Escape'},
    {type: 'keyboard', key: 'Backspace'},
    {type: 'gamepad', key: 1},
    {type: 'mouse', key: 3},
  ],
  confirm: [
    {type: 'gamepad', key: 0},
  ],
  pause: [
    {type: 'keyboard', key: 'Escape'},
    {type: 'gamepad', key: 9},
  ],
  start: [
    {type: 'gamepad', key: 9},
  ],
}
