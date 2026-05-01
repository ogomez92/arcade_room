// Pipe spawning, scrolling, scoring, collision.
content.world = (() => {
  let nextPipeId = 1
  let pipes = []  // {id, x, gapCenter, gapHeight, scored}

  function S() { return content.state }
  function rand(min, max) { return min + Math.random() * (max - min) }

  function spawnPipe() {
    const s = S()
    const t = s.TUN
    // Avoid back-to-back near-identical centers — bias the new center away
    // from the previous pipe's center for variety.
    const prev = pipes[pipes.length - 1]
    let center
    if (prev) {
      const oppositeBias = prev.gapCenter < 0.5 ? rand(0.5, t.GAP_CENTER_MAX) : rand(t.GAP_CENTER_MIN, 0.5)
      // 60% of the time pick an opposite-side center for variety, 40% wholly random
      center = Math.random() < 0.6 ? oppositeBias : rand(t.GAP_CENTER_MIN, t.GAP_CENTER_MAX)
    } else {
      center = 0.5
    }
    const gapHeight = s.currentGapHeight()
    pipes.push({
      id: nextPipeId++,
      x: t.SPAWN_DISTANCE,
      gapCenter: center,
      gapHeight,
      scored: false,
    })
    content.events.emit('pipe-spawn', {x: t.SPAWN_DISTANCE, gapCenter: center, gapHeight})
  }

  function reset() {
    pipes.length = 0
    nextPipeId = 1
  }

  function update(delta) {
    const s = S()
    if (s.run.over || !s.run.started) return

    const speed = s.currentSpeed()
    const dx = speed * delta

    // Scroll all pipes left (subtract dx from their x)
    for (const p of pipes) p.x -= dx
    s.run.distance += dx

    // Spawn next pipe at spawn rhythm (interval based on current difficulty)
    if (s.run.distance >= s.run.nextSpawnAt) {
      spawnPipe()
      s.run.nextSpawnAt += s.currentInterval()
    }

    // Remove pipes that have moved well past the bird
    while (pipes.length && pipes[0].x < s.TUN.DESPAWN_DISTANCE) {
      pipes.shift()
    }

    // Score and collision
    const t = s.TUN
    const birdY = s.run.birdY
    for (const p of pipes) {
      // Score: pipe centerline crosses bird's x going leftward
      if (!p.scored && p.x <= t.BIRD_X) {
        p.scored = true
        s.run.score += 1
        s.run.pipesPassed += 1
        content.events.emit('pipe-passed', {score: s.run.score, pipesPassed: s.run.pipesPassed})
      }
      // Collision: bird AABB overlaps pipe column AND outside the gap
      const dxToPipe = Math.abs(p.x - t.BIRD_X)
      if (dxToPipe < t.BIRD_RADIUS_X + 0.06) {  // pipe column halfwidth ~0.06
        const gapTop = p.gapCenter + p.gapHeight / 2
        const gapBottom = p.gapCenter - p.gapHeight / 2
        // Bird AABB y range
        const birdTop = birdY + t.BIRD_RADIUS_Y
        const birdBottom = birdY - t.BIRD_RADIUS_Y
        if (birdTop > gapTop || birdBottom < gapBottom) {
          content.events.emit('collide', {kind: 'pipe'})
          return
        }
      }
    }

    // Floor / ceiling collision
    if (birdY <= 0) {
      s.run.birdY = 0
      content.events.emit('collide', {kind: 'floor'})
    } else if (birdY >= 1) {
      s.run.birdY = 1
      content.events.emit('collide', {kind: 'ceiling'})
    }
  }

  return {
    pipes: () => pipes,
    nearest: function () {
      // Closest pipe with x >= bird, i.e. the next one to navigate.
      for (const p of pipes) if (p.x >= S().TUN.BIRD_X - 0.05) return p
      return null
    },
    update,
    reset,
  }
})()
