app.controls.mappings = {
  // Aim left/right uses turnLeft/turnRight (the keyboard adapter only
  // recognizes the canonical mapping names — we lean on `state.rotate`
  // returned from app.controls.game()).
  turnLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'KeyA'},
    {type: 'keyboard', key: 'KeyQ'},
    {type: 'keyboard', key: 'Numpad4'},
  ],
  turnRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'KeyD'},
    {type: 'keyboard', key: 'KeyE'},
    {type: 'keyboard', key: 'Numpad6'},
  ],
  turnAxis: [
    {type: 'gamepad', key: 0},
  ],
  // Spray is read directly from engine.input.* in content/hose.js.
  moveForward: [],
  moveBackward: [],
  strafeLeft: [],
  strafeRight: [],
  moveAxis: [{type: 'gamepad', key: 1}],
  strafeAxis: [{type: 'gamepad', key: 0}],

  uiAxisVertical: [{type: 'gamepad', key: 1}],
  uiAxisHorizontal: [{type: 'gamepad', key: 0}],
  uiDown: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'KeyS'},
    {type: 'gamepad', key: 13},
  ],
  uiLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'KeyA'},
    {type: 'gamepad', key: 14},
  ],
  uiRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'KeyD'},
    {type: 'gamepad', key: 15},
  ],
  uiUp: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'KeyW'},
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
  ],
  start: [
    {type: 'gamepad', key: 9},
  ],
}
