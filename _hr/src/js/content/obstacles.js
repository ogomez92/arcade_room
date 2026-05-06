// Obstacles — fences/jumps placed at fixed track positions for this
// race. The host generates them deterministically from a seed and
// every horse encounters the same obstacle layout. Clients learn the
// layout from the snapshot's seed (or from the start message) so we
// don't need to replicate per-obstacle messages.
//
// Each obstacle has a single forward x position and is "wide enough"
// to span all lanes — every horse must clear it.
content.obstacles = (() => {
  const FIRST_OBSTACLE = 90        // meters before first fence
  const LAST_OBSTACLE_BUFFER = 80  // meters before finish to keep clear
  const MIN_GAP = 70
  const MAX_GAP = 140

  // Jump physics (mirrors content/race HORSE.JUMP_DURATION).
  const JUMP_DURATION = 0.75
  // Player must leap so the air phase straddles the fence. Acceptable
  // window expressed as time-to-fence at jump-start.
  const PERFECT_LEAD_TIME = 0.42   // seconds before fence — peak right over it
  const CLEAN_WINDOW = 0.32        // ± window around the perfect lead
  const PERFECT_WINDOW = 0.10      // tight inner window for "perfect"

  let obstacles = []   // [{x, id}]
  let seed = 1

  function rand() {
    // mulberry32
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  function generate(s, trackLength) {
    seed = (s | 0) || 1
    obstacles = []
    let x = FIRST_OBSTACLE + rand() * 25
    let id = 0
    while (x < trackLength - LAST_OBSTACLE_BUFFER) {
      obstacles.push({id: id++, x})
      x += MIN_GAP + rand() * (MAX_GAP - MIN_GAP)
    }
    return obstacles
  }

  function all() { return obstacles }

  // The next obstacle ahead of `x` that the horse hasn't crossed.
  // Returns null if none remain.
  function nextAhead(x) {
    for (const o of obstacles) {
      if (o.x > x) return o
    }
    return null
  }

  // Was this obstacle crossed (passed without crash) by this horse?
  // Tracked on the horse via `crossedObstacles` set lazily.
  function ensureCrossedSet(h) {
    if (!h._crossed) h._crossed = new Set()
    return h._crossed
  }

  // Resolve a jump attempt at the moment the player presses the jump
  // key. Returns 'perfect' | 'clean' | 'early' | 'late' | 'none'.
  // Doesn't mutate horse state — caller does that based on result.
  function evaluateJump(h, speedAtJump) {
    const next = nextAhead(h.x)
    if (!next) return {kind: 'none', obstacle: null, leadTime: null}
    const distance = next.x - h.x
    const leadTime = distance / Math.max(2, speedAtJump)
    const delta = leadTime - PERFECT_LEAD_TIME
    if (Math.abs(delta) <= PERFECT_WINDOW) {
      return {kind: 'perfect', obstacle: next, leadTime}
    }
    if (Math.abs(delta) <= CLEAN_WINDOW) {
      return {kind: 'clean', obstacle: next, leadTime}
    }
    if (leadTime > PERFECT_LEAD_TIME + CLEAN_WINDOW) {
      return {kind: 'early', obstacle: next, leadTime}
    }
    return {kind: 'late', obstacle: next, leadTime}
  }

  // For a horse that's not airborne crossing an obstacle: crash.
  // Mark the obstacle crossed (so we don't re-trigger). Caller emits
  // the audio + announcer hooks.
  function checkGroundCrossing(h) {
    if (h.airborne) return null
    const crossed = ensureCrossedSet(h)
    for (const o of obstacles) {
      if (crossed.has(o.id)) continue
      if (h.x >= o.x) {
        // Horse ran straight into the fence.
        crossed.add(o.id)
        return o
      }
    }
    return null
  }

  // For a horse that's airborne and lands past an obstacle: count it
  // as cleared. Returns array of just-cleared obstacles.
  function markClearedByJump(h) {
    const crossed = ensureCrossedSet(h)
    const cleared = []
    for (const o of obstacles) {
      if (crossed.has(o.id)) continue
      if (h.x >= o.x) {
        crossed.add(o.id)
        cleared.push(o)
      }
    }
    return cleared
  }

  return {
    JUMP_DURATION, PERFECT_LEAD_TIME, CLEAN_WINDOW, PERFECT_WINDOW,
    generate, all, nextAhead, evaluateJump,
    checkGroundCrossing, markClearedByJump,
  }
})()
