content.config = (() => {
  const RADIUS = 4

  // Six lairs around the player at the centre. Screen coords: +x = right,
  // +y = down (south). The audio module flips y when handing to syngen.
  // Layout matches the qweRTY-row keys on a real keyboard:
  //   q  e  t      (front)
  //   z  c  b      (back)
  // 'd' is the listener (player) — empty, never whacked.
  const slots = [
    {key: 'q', code: 'KeyQ', x: -RADIUS * 0.85, y: -RADIUS * 0.55, dir: 'q', critter: 'q'},
    {key: 'e', code: 'KeyE', x:  0,             y: -RADIUS,        dir: 'e', critter: 'e'},
    {key: 't', code: 'KeyT', x:  RADIUS * 0.85, y: -RADIUS * 0.55, dir: 't', critter: 't'},
    {key: 'z', code: 'KeyZ', x: -RADIUS * 0.85, y:  RADIUS * 0.55, dir: 'z', critter: 'z'},
    {key: 'c', code: 'KeyC', x:  0,             y:  RADIUS,        dir: 'c', critter: 'c'},
    {key: 'b', code: 'KeyB', x:  RADIUS * 0.85, y:  RADIUS * 0.55, dir: 'b', critter: 'b'},
  ]

  const slotByKey = new Map(slots.map((s) => [s.key, s]))
  const slotByCode = new Map(slots.map((s) => [s.code, s]))

  return {
    RADIUS,
    slots,
    slotByKey: (k) => slotByKey.get(k),
    slotByCode: (c) => slotByCode.get(c),
    MAX_MISSES: 5,
  }
})()
