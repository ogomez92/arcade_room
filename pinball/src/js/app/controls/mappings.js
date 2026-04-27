app.controls.mappings = {
  // Pinball-specific game inputs (booleans)
  flipLeft: [
    {type: 'keyboard', key: 'KeyZ'},
    {type: 'keyboard', key: 'ShiftLeft'},
    {type: 'keyboard', key: 'ArrowLeft'},
    {type: 'gamepad', key: 4},   // L1
    {type: 'gamepad', key: 6},   // L2
  ],
  flipRight: [
    {type: 'keyboard', key: 'KeyM'},
    {type: 'keyboard', key: 'ShiftRight'},
    {type: 'keyboard', key: 'ArrowRight'},
    {type: 'gamepad', key: 5},   // R1
    {type: 'gamepad', key: 7},   // R2
  ],
  plunge: [
    {type: 'keyboard', key: 'Space'},
    {type: 'keyboard', key: 'ArrowDown'},
    {type: 'gamepad', key: 0},   // A
  ],
  // UI / menu controls (single-shot deltas)
  position: [
    {type: 'keyboard', key: 'KeyP'},
  ],
  help: [
    {type: 'keyboard', key: 'KeyH'},
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
  quit: [
    {type: 'keyboard', key: 'KeyQ'},
  ],
  // Legacy mappings the gamepad adapter still reads via reduce(); empty arrays
  // are safe (they reduce to the initial value).
  moveAxis: [], strafeAxis: [], turnAxis: [],
  moveForward: [], moveBackward: [],
  uiAxisHorizontal: [], uiAxisVertical: [],
}
