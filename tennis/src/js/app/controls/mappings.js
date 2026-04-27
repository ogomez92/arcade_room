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
  strafeLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'Numpad4'},
  ],
  strafeRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'Numpad6'},
  ],
  turnAxis: [
    {type: 'gamepad', key: 2},
  ],
  turnLeft: [
    {type: 'keyboard', key: 'KeyQ'},
    {type: 'keyboard', key: 'Numpad7'},
  ],
  turnRight: [
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
    {type: 'keyboard', key: 'Numpad5'},
    {type: 'gamepad', key: 13},
  ],
  uiLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'keyboard', key: 'Numpad4'},
    {type: 'gamepad', key: 14},
  ],
  uiRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'keyboard', key: 'Numpad6'},
    {type: 'gamepad', key: 15},
  ],
  uiUp: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'keyboard', key: 'Numpad8'},
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
    {type: 'keyboard', key: 'Backspace'},
    {type: 'gamepad', key: 9},
  ],
  start: [
    {type: 'gamepad', key: 9},
  ],
  // Tennis action keys: D forehand, A backhand, S smash. We define
  // them as additional named bindings so the game screen can poll
  // them without colliding with movement keys.
  forehand: [
    {type: 'keyboard', key: 'KeyD'},
    {type: 'gamepad', key: 0},  // A button
  ],
  backhand: [
    {type: 'keyboard', key: 'KeyA'},
    {type: 'gamepad', key: 2},  // X button
  ],
  smash: [
    {type: 'keyboard', key: 'KeyS'},
    {type: 'gamepad', key: 3},  // Y button
  ],
}
