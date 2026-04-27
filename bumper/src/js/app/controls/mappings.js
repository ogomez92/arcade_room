app.controls.mappings = {
  moveAxis: [
    {type: 'gamepad', key: 1},
  ],
  moveBackward: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'Numpad5'},
    {type: 'gamepad', key: 6},
  ],
  moveForward: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'Numpad8'},
    {type: 'gamepad', key: 7},
  ],
  strafeAxis: [
    {type: 'gamepad', key: 0},
  ],
  // Strafe is gamepad-only now. WASD is reserved for arcade actions.
  strafeLeft: [
    {type: 'keyboard', key: 'Numpad4'},
  ],
  strafeRight: [
    {type: 'keyboard', key: 'Numpad6'},
  ],
  turnAxis: [
    {type: 'gamepad', key: 2},
  ],
  turnLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'Numpad7'},
  ],
  turnRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'Numpad9'},
  ],
  uiAxisVertical: [
    {type: 'gamepad', key: 1},
  ],
  uiAxisHorizontal: [
    {type: 'gamepad', key: 0},
  ],
  // Menu navigation keeps WASD as an alternative to arrows so menu
  // ergonomics aren't disrupted by freeing WASD from in-game driving.
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
    {type: 'keyboard', key: 'Backspace'},
    {type: 'gamepad', key: 9},
    {type: 'mouse', key: 3},
  ],
  start: [
    {type: 'gamepad', key: 9},
  ],
}
