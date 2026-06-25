// The puck: position, velocity, and serve placement. The puck is the one
// always-live spatial voice in the game, but this module is pure state — audio
// reads getState() each frame. `live` gates physics integration: it goes false
// the instant a goal is detected (puck frozen for the celebration) and true
// again when the next serve goes live.
content.puck = (() => {
  let x = 0, y = 0
  let vx = 0, vy = 0
  let live = false

  return {
    getState: () => ({ x, y, vx, vy, live }),
    getPosition: () => ({ x, y }),
    getSpeed: () => Math.hypot(vx, vy),
    isLive: () => live,

    setPosition: (nx, ny) => { x = nx; y = ny },
    setVelocity: (nvx, nvy) => { vx = nvx; vy = nvy },
    setLive: (v) => { live = !!v },

    // Body view consumed by physics: a mutable-by-reference shape kept in sync
    // via the setters below so physics can integrate in place without churning
    // closures. We expose primitives, not the closure vars, so physics writes
    // back through setBody().
    getBody: () => ({ x, y, vx, vy, r: content.constants.PUCK_RADIUS }),
    setBody: (b) => { x = b.x; y = b.y; vx = b.vx; vy = b.vy },

    // Place the puck on the conceding side's half, a little in front of their
    // goal line, at rest. `who` is who must serve ('you' serves from your half
    // near y=LENGTH; 'opp' serves from the far half near y=0).
    placeServe: (who) => {
      const k = content.constants
      x = k.WIDTH / 2
      y = who === 'you'
        ? k.LENGTH - k.SERVE_PLACE_BACK
        : k.SERVE_PLACE_BACK
      vx = 0; vy = 0
      live = false
    },

    reset: () => {
      const k = content.constants
      x = k.WIDTH / 2
      y = k.LENGTH / 2
      vx = 0; vy = 0
      live = false
    },
  }
})()
