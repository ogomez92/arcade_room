/**
 * Arena geometry. The walls are axis-aligned; physics knows how to bounce
 * cars off them. Spawn points are evenly spaced around the perimeter so
 * cars never start inside one another.
 */
content.arena = (() => {
  // 100 × 70 arena: ~20 s straight-across at maxSpeed (5 m/s), ~24 s
  // diagonal. Big enough to give blind players time to listen, drive,
  // and react before walls become a concern.
  const config = {
    width: 100,
    height: 70,
  }

  const bounds = {
    minX: -config.width / 2,
    maxX: config.width / 2,
    minY: -config.height / 2,
    maxY: config.height / 2,
  }

  function spawnPoints(count) {
    // Distribute around an inner ellipse so cars face the centre.
    const points = []
    const inset = 7
    const rx = (config.width / 2) - inset,
      ry = (config.height / 2) - inset

    for (let i = 0; i < count; i++) {
      const t = (i / count) * engine.const.tau
      const x = Math.cos(t) * rx
      const y = Math.sin(t) * ry
      // Heading faces toward arena centre with a small jitter
      const heading = Math.atan2(-y, -x) + (Math.random() - 0.5) * 0.4
      points.push({x, y, heading})
    }

    return points
  }

  function bearingDescription(dx, dy) {
    // dx,dy are listener-local: +x forward, +y left
    const dist = Math.hypot(dx, dy)
    const t = (k, p) => (app.i18n ? app.i18n.t(k, p) : k)
    if (dist < 0.001) return t('arena.onTopOfYou')

    const angle = Math.atan2(dy, dx) // 0 = front, +pi/2 = left
    const deg = angle * 180 / Math.PI

    let bearingKey
    if (deg > -22.5 && deg <= 22.5) bearingKey = 'arena.bearing.front'
    else if (deg > 22.5 && deg <= 67.5) bearingKey = 'arena.bearing.frontLeft'
    else if (deg > 67.5 && deg <= 112.5) bearingKey = 'arena.bearing.left'
    else if (deg > 112.5 && deg <= 157.5) bearingKey = 'arena.bearing.behindLeft'
    else if (deg > 157.5 || deg <= -157.5) bearingKey = 'arena.bearing.behind'
    else if (deg > -157.5 && deg <= -112.5) bearingKey = 'arena.bearing.behindRight'
    else if (deg > -112.5 && deg <= -67.5) bearingKey = 'arena.bearing.right'
    else bearingKey = 'arena.bearing.frontRight'

    const rangeKey = dist < 4 ? 'arena.range.veryClose'
      : dist < 12 ? 'arena.range.close'
      : dist < 25 ? 'arena.range.midRange'
      : 'arena.range.far'
    return t('arena.bearingFmt', {bearing: t(bearingKey), range: t(rangeKey)})
  }

  return {
    config,
    bounds,
    spawnPoints,
    bearingDescription,
  }
})()
