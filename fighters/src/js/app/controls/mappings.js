app.controls.mappings = {
  // Movement on the top-down arena. WASD; arrows mirror.
  moveUp: [
    {type: 'keyboard', key: 'KeyW'},
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'gamepad', key: 12},
  ],
  moveDown: [
    {type: 'keyboard', key: 'KeyS'},
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'gamepad', key: 13},
  ],
  moveLeft: [
    {type: 'keyboard', key: 'KeyA'},
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'gamepad', key: 14},
  ],
  moveRight: [
    {type: 'keyboard', key: 'KeyD'},
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'gamepad', key: 15},
  ],
  // Punches
  highPunch: [
    {type: 'keyboard', key: 'KeyT'},
    {type: 'gamepad', key: 2},
  ],
  lowPunch: [
    {type: 'keyboard', key: 'KeyG'},
    {type: 'gamepad', key: 1},
  ],
  // Kicks
  highKick: [
    {type: 'keyboard', key: 'KeyU'},
    {type: 'gamepad', key: 3},
  ],
  lowKick: [
    {type: 'keyboard', key: 'KeyJ'},
    {type: 'gamepad', key: 5},
  ],
  // Defense / mobility — short, edge-triggered actions.
  jump: [
    {type: 'keyboard', key: 'KeyO'},
    {type: 'gamepad', key: 0},
  ],
  duck: [
    {type: 'keyboard', key: 'KeyL'},
    {type: 'gamepad', key: 4},
  ],
  block: [
    {type: 'keyboard', key: 'Period'},
    {type: 'gamepad', key: 6},
  ],
  // UI navigation
  uiUp: [
    {type: 'keyboard', key: 'ArrowUp'},
    {type: 'gamepad', key: 12},
  ],
  uiDown: [
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'gamepad', key: 13},
  ],
  uiLeft: [
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'gamepad', key: 14},
  ],
  uiRight: [
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'gamepad', key: 15},
  ],
  back: [
    {type: 'keyboard', key: 'Escape'},
    {type: 'keyboard', key: 'Backspace'},
    {type: 'gamepad', key: 1},
  ],
  pause: [
    {type: 'keyboard', key: 'Escape'},
    {type: 'gamepad', key: 9},
  ],
  start: [
    {type: 'gamepad', key: 9},
  ],
  confirm: [
    {type: 'gamepad', key: 0},
  ],
}
