// Game-tunable constants and runtime state for Flappy Bird.
//
// Coordinates: world is 1.0 unit tall (0 = floor, 1 = ceiling) and scrolls
// horizontally. Bird is locked at worldX = 0; pipes start at worldX > 0 and
// scroll towards 0, pass through, and despawn behind the bird.
//
// Audio is purely stereo / non-spatial (no binaural). Bird altitude is
// encoded as pitch; pipe position is encoded as L/R pan + per-pipe edge
// tones. See content/audio.js.
content.state = (() => {
  const TUN = {
    // Physics
    GRAVITY: 2.4,         // units/s^2 downward
    FLAP_VY: 1.15,        // upward velocity set on flap (units/s)
    MAX_VY_UP: 1.5,
    MAX_VY_DOWN: -2.0,
    // World
    BIRD_X: 0,
    BIRD_RADIUS_X: 0.06,  // collision halfwidth (world x units)
    BIRD_RADIUS_Y: 0.04,  // collision halfheight (world y units)
    SCROLL_SPEED_BASE: 0.85,  // units/s — easy practice pace
    SCROLL_SPEED_MAX: 2.2,
    SCROLL_SPEED_GROWTH: 0.05, // per pipe scored beyond TUTORIAL_PIPES
    // Pipes
    PIPE_INTERVAL_BASE: 2.4,   // distance (units) between pipes
    PIPE_INTERVAL_MIN: 1.4,
    PIPE_INTERVAL_GROWTH: 0.03,
    GAP_HEIGHT_BASE: 0.46,     // wide gap to start
    GAP_HEIGHT_MIN: 0.20,
    GAP_HEIGHT_GROWTH: 0.010,
    TUTORIAL_PIPES: 5,         // first N pipes stay at base difficulty
    GAP_CENTER_MIN: 0.20,
    GAP_CENTER_MAX: 0.80,
    SPAWN_DISTANCE: 4.0,        // pipe spawn x (relative to bird)
    DESPAWN_DISTANCE: -1.2,
    // Audio
    PITCH_LOW_HZ: 200,
    PITCH_HIGH_HZ: 800,
  }

  const initialRunState = () => ({
    birdY: 0.5,
    birdVy: 0,
    score: 0,
    pipesPassed: 0,
    distance: 0,         // total world scroll, used to schedule spawns
    nextSpawnAt: 1.5,    // first pipe spawns shortly after start
    over: false,
    started: false,
    overReason: null,    // i18n key
  })

  return {
    TUN,
    run: initialRunState(),
    reset: function () {
      this.run = initialRunState()
    },
    // Difficulty derivatives. The first TUN.TUTORIAL_PIPES are flat-easy so
    // the player can practice the listening loop before the curve ramps.
    rampPipes: function () {
      return Math.max(0, this.run.pipesPassed - TUN.TUTORIAL_PIPES)
    },
    currentSpeed: function () {
      const t = TUN
      return Math.min(t.SCROLL_SPEED_MAX, t.SCROLL_SPEED_BASE + this.rampPipes() * t.SCROLL_SPEED_GROWTH)
    },
    currentGapHeight: function () {
      const t = TUN
      return Math.max(t.GAP_HEIGHT_MIN, t.GAP_HEIGHT_BASE - this.rampPipes() * t.GAP_HEIGHT_GROWTH)
    },
    currentInterval: function () {
      const t = TUN
      return Math.max(t.PIPE_INTERVAL_MIN, t.PIPE_INTERVAL_BASE - this.rampPipes() * t.PIPE_INTERVAL_GROWTH)
    },
    difficulty01: function () {
      // 0 during tutorial, climbs to 1 by ~25 pipes after the ramp begins
      return Math.min(1, this.rampPipes() / 25)
    },
  }
})()
