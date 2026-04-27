content.player = (() => {
  let step = 5
  let cooldown = 0
  let leftHeldTime = 0
  let rightHeldTime = 0
  let leftWasHeld = false
  let rightWasHeld = false

  function tryMove(dir) {
    const next = step + dir
    if (next < 0 || next >= content.table.NUM_STEPS) return
    step = next
    content.audio.playStepClick()
  }

  function processKey(held, wasHeld, heldTime, dir, dt) {
    if (!held) {
      return { wasHeld: false, heldTime: 0 }
    }
    if (!wasHeld) {
      tryMove(dir)
      return { wasHeld: true, heldTime: 0 }
    }
    const nextTime = heldTime + dt
    const DELAY = content.table.MOVE_HOLD_DELAY
    const REPEAT = content.table.MOVE_HOLD_REPEAT
    if (nextTime >= DELAY) {
      const prevRepeats = heldTime < DELAY ? 0 : Math.floor((heldTime - DELAY) / REPEAT)
      const nextRepeats = Math.floor((nextTime - DELAY) / REPEAT)
      if (nextRepeats > prevRepeats) tryMove(dir)
    }
    return { wasHeld: true, heldTime: nextTime }
  }

  return {
    getStep: () => step,
    getX: () => step + 0.5,

    reset: () => {
      step = 5
      cooldown = 0
      leftHeldTime = 0
      rightHeldTime = 0
      leftWasHeld = false
      rightWasHeld = false
    },

    startCooldown: () => { cooldown = content.table.SWING_COOLDOWN },
    isOnCooldown: () => cooldown > 0,

    update: (dt) => {
      if (content.powerup.hasEffect('player', 'freeze')) return

      if (cooldown > 0) {
        cooldown = Math.max(0, cooldown - dt)
        leftWasHeld = false
        rightWasHeld = false
        leftHeldTime = 0
        rightHeldTime = 0
        return
      }

      const keys = engine.input.keyboard.get()
      const leftHeld = !!keys['ArrowLeft']
      const rightHeld = !!keys['ArrowRight']

      const left = processKey(leftHeld, leftWasHeld, leftHeldTime, -1, dt)
      leftWasHeld = left.wasHeld
      leftHeldTime = left.heldTime

      const right = processKey(rightHeld, rightWasHeld, rightHeldTime, 1, dt)
      rightWasHeld = right.wasHeld
      rightHeldTime = right.heldTime
    },
  }
})()
