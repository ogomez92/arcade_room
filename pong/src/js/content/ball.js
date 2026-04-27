content.ball = (() => {
  let x = 6, y = 0
  let vx = 0, vy = 0
  let spinAccel = 0

  return {
    getState: () => ({ x, y, vx, vy }),
    getX: () => x,
    getY: () => y,

    setPosition: (nx, ny) => { x = nx; y = ny },
    setVelocity: (nvx, nvy) => { vx = nvx; vy = nvy },
    setSpin: (s) => { spinAccel = s },
    clearSpin: () => { spinAccel = 0 },

    reset: () => { x = 6; y = 0; vx = 0; vy = 0; spinAccel = 0 },

    update: (dt) => {
      vx += spinAccel * dt
      const f = Math.pow(1 - content.table.BALL_FRICTION, dt)
      vx *= f
      vy *= f
      x += vx * dt
      y += vy * dt
    },
  }
})()
