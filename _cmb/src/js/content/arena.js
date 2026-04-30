content.arena = (() => {
  function bounds() {
    const half = content.constants.arena.size / 2
    return { minX: -half, maxX: half, minY: -half, maxY: half }
  }

  function clampTo(pos) {
    const b = bounds()
    return {
      x: Math.max(b.minX, Math.min(b.maxX, pos.x)),
      y: Math.max(b.minY, Math.min(b.maxY, pos.y)),
      z: Math.max(0, pos.z),
    }
  }

  // Given a position, return the nearest wall direction in absolute (world) radians and distance.
  // Also returns list of {yaw, distance} for all four walls, and distances.
  function wallSensors(pos) {
    const b = bounds()
    return [
      { yaw: 0,           distance: b.maxX - pos.x, normal: { x: -1, y: 0 } }, // east wall at maxX
      { yaw: Math.PI * 0.5, distance: b.maxY - pos.y, normal: { x: 0, y: -1 } }, // north wall
      { yaw: Math.PI,       distance: pos.x - b.minX, normal: { x: 1, y: 0 } }, // west wall
      { yaw: -Math.PI * 0.5, distance: pos.y - b.minY, normal: { x: 0, y: 1 } }, // south wall
    ]
  }

  return {
    bounds,
    clampTo,
    wallSensors,
    contains: (pos) => {
      const b = bounds()
      return pos.x > b.minX && pos.x < b.maxX && pos.y > b.minY && pos.y < b.maxY
    },
  }
})()
