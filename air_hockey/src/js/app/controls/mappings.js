// Air Hockey movement: the mallet moves in 2D, so the arrow keys / left stick
// drive forward-back (x) and left-right (y). There is no "turn" — the listener
// yaw is fixed. keyboard.game() maps moveForward→x=+1, moveBackward→x=-1,
// strafeLeft→y=+1, strafeRight→y=-1; the game screen translates that control
// frame into screen space (forward = toward the opponent = screen-north).
app.controls.mappings = {
  // Forward / backward (toward opponent / toward your goal)
  moveAxis: [
    {type: 'gamepad', key: 1},
  ],
  moveForward: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'KeyW'},
    {type: 'keyboard', key: 'Numpad8'},
  ],
  moveBackward: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'KeyS'},
    {type: 'keyboard', key: 'Numpad2'},
  ],
  // Left / right
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
  // No turn in Air Hockey — kept empty so the generic adapters don't choke.
  turnAxis: [],
  turnLeft: [],
  turnRight: [],

  // UI navigation
  uiAxisVertical: [
    {type: 'gamepad', key: 1},
  ],
  uiAxisHorizontal: [
    {type: 'gamepad', key: 0},
  ],
  uiDown: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'keyboard', key: 'KeyS'},
    {type: 'keyboard', key: 'Numpad2'},
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
