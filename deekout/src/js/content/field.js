// Grid geometry + walls. Cell/bounds math, the 4-tone wall-approach
// warning, wall-hit damage (with per-difficulty forgiveness), Wall-Fusion
// warp-to-opposite-side, and free-cell spawning. Stateless except for a
// little wall-approach tracking, reset each level via reset().
content.field = (() => {
  const C = () => content.constants

  // Wall-approach state.
  let lastZone = -1     // 0..3 escalating proximity zone; -1 = clear
  let inContact = false // currently pressed against a wall

  const PROX_ZONES = [4, 3, 2, 1] // cell distances -> tone index 0..3

  function reset() {
    lastZone = -1
    inContact = false
  }

  function inBounds(col, row) {
    const g = C().GRID
    return col >= g.min && col <= g.max && row >= g.min && row <= g.max
  }

  function clamp(v) {
    const g = C().GRID
    return Math.max(g.min, Math.min(g.max, v))
  }

  // Distance (in cells) from a position to the nearest wall along the axis
  // it is moving toward. Returns Infinity when not moving.
  function distanceToWallAhead(col, row, dx, dy) {
    const g = C().GRID
    let d = Infinity
    if (dx > 0) d = Math.min(d, g.max - col)
    else if (dx < 0) d = Math.min(d, col - g.min)
    if (dy > 0) d = Math.min(d, g.max - row)
    else if (dy < 0) d = Math.min(d, row - g.min)
    return d
  }

  // Drive the 4-tone approach warning. Fires a tone (escalating pitch) each
  // time the player crosses into a closer zone while heading at a wall.
  function updateApproach(col, row, dx, dy) {
    if (!dx && !dy) { lastZone = -1; return }
    const d = distanceToWallAhead(col, row, dx, dy)
    let zone = -1
    for (let i = 0; i < PROX_ZONES.length; i++) {
      if (d <= PROX_ZONES[i]) zone = i
    }
    if (zone > lastZone && zone >= 0) {
      content.audio.wallTone(zone)
    }
    lastZone = zone
  }

  // Resolve an attempted move. Returns the final {col,row} plus whether a
  // fresh wall contact happened and how much damage it should cost. The
  // caller (player.js) applies the damage to career.health.
  //   opts.fusion = true  -> warp to the opposite wall instead of stopping
  function resolveMove(player, newCol, newRow, dx, dy, params, opts = {}) {
    const g = C().GRID
    let col = newCol, row = newRow
    let hitWall = false
    let warped = false

    if (!inBounds(newCol, newRow)) {
      if (opts.fusion) {
        // Warp to the opposite side along whichever axis breached.
        if (newCol < g.min) col = g.max - 0.5
        else if (newCol > g.max) col = g.min + 0.5
        else col = clamp(newCol)
        if (newRow < g.min) row = g.max - 0.5
        else if (newRow > g.max) row = g.min + 0.5
        else row = clamp(newRow)
        warped = true
      } else {
        col = clamp(newCol)
        row = clamp(newRow)
        hitWall = true
      }
    }

    updateApproach(col, row, dx, dy)

    let damage = 0
    if (warped) {
      inContact = false
      content.audio.warp()
    } else if (hitWall) {
      // Only count a hit on a fresh contact (debounced) so a held key into
      // a wall doesn't drain health every frame.
      if (!inContact) {
        inContact = true
        player.wallHits++
        if (player.wallHits > (params.wallForgiveness || 0) && !content.state.hasArmor()) {
          damage = params.wallDamage || 0
        }
        content.audio.wallHit(damage > 0)
      }
    } else {
      inContact = false
    }

    return {col, row, hitWall, warped, damage}
  }

  // Warp the player to the opposite side from their current edge (used by a
  // bare Wall-Fusion activation, independent of a wall hit).
  function warpOpposite(player) {
    const g = C().GRID
    player.col = g.max - player.col
    player.row = g.max - player.row
    inContact = false
    content.audio.warp()
  }

  // Random integer cell satisfying `free(col,row)` (defaults to any cell),
  // biased away from the player. Returns {col,row} or null. `opts.margin`
  // (default 1) keeps spawns off the boundary ring so nothing lands on/behind
  // a wall where the player would have to press into it to reach.
  function randomFreeCell(free, opts = {}) {
    const g = C().GRID
    const test = free || (() => true)
    const minFromPlayer = opts.minFromPlayer || 0
    const margin = opts.margin != null ? opts.margin : 1
    const lo = g.min + margin
    const span = (g.max - margin) - lo + 1
    const p = content.state.player()
    for (let attempt = 0; attempt < 60; attempt++) {
      const col = lo + Math.floor(Math.random() * span)
      const row = lo + Math.floor(Math.random() * span)
      if (!test(col, row)) continue
      if (p && minFromPlayer > 0 && Math.hypot(col - p.col, row - p.row) < minFromPlayer) continue
      return {col, row}
    }
    return null
  }

  function distance(a, b) {
    return Math.hypot(a.col - b.col, a.row - b.row)
  }

  return {
    reset,
    inBounds,
    clamp,
    distanceToWallAhead,
    resolveMove,
    warpOpposite,
    randomFreeCell,
    distance,
  }
})()
