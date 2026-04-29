content.ai = (() => {
  let step = 6
  let cooldown = 0
  let moveTimer = 0
  let manualMode = false
  let manualKeys = { left: false, right: false }
  let manualLeftWas = false
  let manualRightWas = false
  let manualLeftHeld = 0
  let manualRightHeld = 0

  function tryManualMove(dir) {
    const next = step + dir
    if (next < 0 || next >= content.table.NUM_STEPS) return
    step = next
    content.audio.playAiStepClick(step + 0.5)
  }

  function processManualKey(held, wasHeld, heldTime, dir, dt) {
    if (!held) return { wasHeld: false, heldTime: 0 }
    if (!wasHeld) {
      tryManualMove(dir)
      return { wasHeld: true, heldTime: 0 }
    }
    const nextTime = heldTime + dt
    const DELAY = content.table.MOVE_HOLD_DELAY
    const REPEAT = content.table.MOVE_HOLD_REPEAT
    if (nextTime >= DELAY) {
      const prevRepeats = heldTime < DELAY ? 0 : Math.floor((heldTime - DELAY) / REPEAT)
      const nextRepeats = Math.floor((nextTime - DELAY) / REPEAT)
      if (nextRepeats > prevRepeats) tryManualMove(dir)
    }
    return { wasHeld: true, heldTime: nextTime }
  }

  const BUFFER_SIZE = 180
  const xBuffer = new Array(BUFFER_SIZE).fill(6)
  let bufferHead = 0
  let bufferCount = 0

  function pushX(x) {
    xBuffer[bufferHead] = x
    bufferHead = (bufferHead + 1) % BUFFER_SIZE
    if (bufferCount < BUFFER_SIZE) bufferCount++
  }

  function getDelayedX() {
    if (bufferCount === 0) return 6
    const delayFrames = Math.min(
      Math.floor(content.table.AI_REACTION_DELAY * 60),
      bufferCount - 1
    )
    const readIdx = (bufferHead - 1 - delayFrames + BUFFER_SIZE) % BUFFER_SIZE
    return xBuffer[readIdx]
  }

  return {
    getStep: () => step,
    getX: () => step + 0.5,
    setStep: (n) => { step = n },

    reset: () => {
      step = 6
      cooldown = 0
      moveTimer = 0
      bufferHead = 0
      bufferCount = 0
      xBuffer.fill(6)
    },

    update: (dt, ballState) => {
      if (manualMode) {
        if (cooldown > 0) {
          cooldown = Math.max(0, cooldown - dt)
          manualLeftWas = false
          manualRightWas = false
          manualLeftHeld = 0
          manualRightHeld = 0
          return
        }
        if (content.powerup.hasEffect('ai', 'freeze')) return
        const left = processManualKey(!!manualKeys.left, manualLeftWas, manualLeftHeld, -1, dt)
        manualLeftWas = left.wasHeld
        manualLeftHeld = left.heldTime
        const right = processManualKey(!!manualKeys.right, manualRightWas, manualRightHeld, 1, dt)
        manualRightWas = right.wasHeld
        manualRightHeld = right.heldTime
        return
      }
      if (content.powerup.hasEffect('ai', 'freeze')) return

      pushX(ballState.x)

      if (cooldown > 0) {
        cooldown = Math.max(0, cooldown - dt)
        return
      }

      const targetX = getDelayedX()
      const targetStep = Math.max(0, Math.min(
        content.table.NUM_STEPS - 1,
        Math.floor(targetX)
      ))

      if (targetStep !== step) {
        moveTimer += dt
        if (moveTimer >= content.table.MOVE_HOLD_REPEAT) {
          moveTimer -= content.table.MOVE_HOLD_REPEAT
          step += targetStep > step ? 1 : -1
          content.audio.playAiStepClick(step + 0.5)
        }
      } else {
        moveTimer = 0
      }

      // Check swing opportunity
      const aiX = step + 0.5
      const aiHalf = content.table.PADDLE_HALF *
        (content.powerup.hasEffect('ai', 'widePaddle') ? content.table.POWERUP_WIDEN_MULT : 1)
      const inRange = Math.abs(ballState.x - aiX) < aiHalf
      const inZone = ballState.y >= content.table.LENGTH - content.table.SWING_ZONE
      const ballApproaching = ballState.vy > 0

      if (inRange && inZone && ballApproaching) {
        cooldown = content.table.SWING_COOLDOWN
        const r = Math.random()
        const dir = r < 0.5 ? 's' : r < 0.75 ? 'a' : 'd'
        const forceMult = content.powerup.getSwingMult('ai')
        content.powerup.checkSwingHit(aiX, 'ai')
        const powerVar = 1 + (Math.random() - 0.5) * content.table.SWING_POWER_VARIANCE
        const sideVar  = 1 + (Math.random() - 0.5) * content.table.SWING_SIDE_VARIANCE
        let vx = ballState.vx + (Math.random() - 0.5) * content.table.SWING_STRAIGHT_NOISE
        let vy = -content.table.SWING_POWER * forceMult * powerVar
        if (dir === 'a') vx = -content.table.SWING_SIDE * forceMult * sideVar
        if (dir === 'd') vx = content.table.SWING_SIDE * forceMult * sideVar
        content.ball.setVelocity(vx, vy)
        const hasCurve = content.powerup.hasEffect('ai', 'curve')
        if (hasCurve) {
          content.powerup.consumeEffect('curve', 'ai')
          const spinDir = dir === 'a' ? -1 : dir === 'd' ? 1 : (Math.random() < 0.5 ? -1 : 1)
          content.ball.setSpin(spinDir * content.table.POWERUP_CURVE_SPIN)
        }
        content.audio.playSwingHit(step + 0.5, content.table.LENGTH, forceMult)
      }
    },

    setManualMode: (on) => {
      manualMode = on
      manualKeys = { left: false, right: false }
      manualLeftWas = false
      manualRightWas = false
      manualLeftHeld = 0
      manualRightHeld = 0
    },

    setManualKeys: (keys) => { manualKeys = keys },

    triggerManualSwing: (dir) => {
      const aiX = step + 0.5
      const aiHalf = content.table.PADDLE_HALF *
        (content.powerup.hasEffect('ai', 'widePaddle') ? content.table.POWERUP_WIDEN_MULT : 1)
      const ballState = content.ball.getState()
      const inRange = Math.abs(ballState.x - aiX) < aiHalf
      const inZone = ballState.y >= content.table.LENGTH - content.table.SWING_ZONE
      const forceMult = content.powerup.getSwingMult('ai')
      const hasCurve = content.powerup.hasEffect('ai', 'curve')
      if (hasCurve) content.powerup.consumeEffect('curve', 'ai')
      content.audio.playSwing(aiX, content.table.LENGTH, forceMult)
      if (inRange && inZone) {
        content.powerup.checkSwingHit(aiX, 'ai')
        cooldown = content.table.SWING_COOLDOWN
        const powerVar = 1 + (Math.random() - 0.5) * content.table.SWING_POWER_VARIANCE
        const sideVar  = 1 + (Math.random() - 0.5) * content.table.SWING_SIDE_VARIANCE
        let vx = ballState.vx + (Math.random() - 0.5) * content.table.SWING_STRAIGHT_NOISE
        let vy = -content.table.SWING_POWER * forceMult * powerVar
        if (dir === 'a') vx = -content.table.SWING_SIDE * forceMult * sideVar
        if (dir === 'd') vx = content.table.SWING_SIDE * forceMult * sideVar
        content.ball.setVelocity(vx, vy)
        if (hasCurve) {
          const spinDir = dir === 'a' ? -1 : dir === 'd' ? 1 : (Math.random() < 0.5 ? -1 : 1)
          content.ball.setSpin(spinDir * content.table.POWERUP_CURVE_SPIN)
        }
        content.audio.playSwingHit(step + 0.5, content.table.LENGTH, forceMult)
      } else {
        content.audio.playSwingMiss(aiX, content.table.LENGTH)
      }
    },
  }
})()
