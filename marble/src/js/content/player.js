// The marble. Pure state + getters; physics.js mutates it, audio.js reads it.
content.player = (() => {
  const state = {
    x: 1.5, y: 1.5,   // position in cells
    vx: 0, vy: 0,     // velocity in cells/s
    heading: 0,       // last meaningful travel angle (screen space, atan2(vy,vx))
  }

  function reset(pos) {
    state.x = pos.x
    state.y = pos.y
    state.vx = 0
    state.vy = 0
    state.heading = 0
  }

  return {
    state,
    reset,
    getPosition: () => ({x: state.x, y: state.y}),
    getVelocity: () => ({x: state.vx, y: state.vy}),
    getSpeed: () => Math.sqrt(state.vx * state.vx + state.vy * state.vy),
    getHeading: () => state.heading,
  }
})()
