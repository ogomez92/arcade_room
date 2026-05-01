app.controls.mappings = {
  // The flap action is wired via `ui` deltas (Space / ArrowUp); see game screen.
  flap: [
    {type: 'keyboard', key: 'Space'},
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'KeyW'},
    {type: 'gamepad', key: 0},
  ],
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
  // Stubs the controls.js gameDefaults expects but this game doesn't use.
  moveAxis: [], moveBackward: [], moveForward: [],
  strafeAxis: [], strafeLeft: [], strafeRight: [],
  turnAxis: [], turnLeft: [], turnRight: [],
  uiAxisVertical: [], uiAxisHorizontal: [],
}
