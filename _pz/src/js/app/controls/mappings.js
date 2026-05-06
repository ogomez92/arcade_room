app.controls.mappings = {
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
  strafeAxis: [
    {type: 'gamepad', key: 0},
  ],
  strafeLeft: [
    {type: 'keyboard', key: 'KeyA'},
    {type: 'keyboard', key: 'Numpad4'},
  ],
  strafeRight: [
    {type: 'keyboard', key: 'KeyD'},
    {type: 'keyboard', key: 'Numpad6'},
  ],
  turnAxis: [
    {type: 'gamepad', key: 2},
  ],
  turnLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'KeyQ'},
    {type: 'keyboard', key: 'Numpad7'},
  ],
  turnRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'KeyE'},
    {type: 'keyboard', key: 'Numpad9'},
  ],
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
  // Pizza! — selected pizza (1–9), throw (Space).
  // The driving screen reads these directly from window keydown for the
  // status hotkeys (F1–F4) so browser default actions (Help/Find/Reload)
  // can be cancelled in the capture phase.
  throw: [
    {type: 'keyboard', key: 'Space'},
    {type: 'gamepad', key: 0},
  ],
  selectPizza1: [{type: 'keyboard', key: 'Digit1'}],
  selectPizza2: [{type: 'keyboard', key: 'Digit2'}],
  selectPizza3: [{type: 'keyboard', key: 'Digit3'}],
  selectPizza4: [{type: 'keyboard', key: 'Digit4'}],
  selectPizza5: [{type: 'keyboard', key: 'Digit5'}],
  selectPizza6: [{type: 'keyboard', key: 'Digit6'}],
  selectPizza7: [{type: 'keyboard', key: 'Digit7'}],
  selectPizza8: [{type: 'keyboard', key: 'Digit8'}],
  selectPizza9: [{type: 'keyboard', key: 'Digit9'}],
}
