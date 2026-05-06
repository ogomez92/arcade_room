// Wave scheduling. Linear-ish escalation; on each wave we precompute a
// shuffled queue of N spawn events spaced over the wave duration, with
// per-spawn jitter.
content.wave = (() => {
  // Per-wave parameters. Indexed by wave number (1-based); waves above
  // the table cap.
  const TABLE = [
    null,
    {count: 8,  splitterRate: 0.00, bomberRate: 0.00, speedMul: 1.00, duration: 30},
    {count: 10, splitterRate: 0.10, bomberRate: 0.00, speedMul: 1.05, duration: 29},
    {count: 12, splitterRate: 0.20, bomberRate: 0.00, speedMul: 1.10, duration: 28},
    {count: 14, splitterRate: 0.25, bomberRate: 0.10, speedMul: 1.20, duration: 26},
    {count: 16, splitterRate: 0.30, bomberRate: 0.15, speedMul: 1.30, duration: 25},
    {count: 18, splitterRate: 0.35, bomberRate: 0.20, speedMul: 1.40, duration: 24},
    {count: 20, splitterRate: 0.40, bomberRate: 0.20, speedMul: 1.50, duration: 23},
    {count: 22, splitterRate: 0.45, bomberRate: 0.25, speedMul: 1.65, duration: 22},
    {count: 24, splitterRate: 0.50, bomberRate: 0.25, speedMul: 1.80, duration: 22},
  ]

  function paramsForWave(n) {
    if (n < 1) n = 1
    if (n < TABLE.length) return TABLE[n]
    // 10+
    return {
      count: 26 + 2 * (n - 10),
      splitterRate: 0.55,
      bomberRate: 0.30,
      speedMul: 2.00,
      duration: 22,
    }
  }

  let queue = []
  let active = false
  let elapsed = 0
  let totalSpawned = 0
  let waveNumber = 0
  let cleared = false

  function start(n) {
    waveNumber = n
    const p = paramsForWave(n)
    queue = []
    elapsed = 0
    totalSpawned = 0
    cleared = false
    active = true

    const interval = p.duration / p.count
    let t = 0.5  // brief grace before first spawn
    for (let i = 0; i < p.count; i++) {
      const r = Math.random()
      let kind = 'icbm'
      if (r < p.bomberRate) kind = 'bomber'
      else if (r < p.bomberRate + p.splitterRate) kind = 'splitter'
      const jit = (Math.random() - 0.5) * 0.5 * interval
      queue.push({when: t + jit, kind, speedMul: p.speedMul})
      t += interval
    }
    queue.sort((a, b) => a.when - b.when)
    return p
  }

  function _spawn(kind, speedMul) {
    if (kind === 'bomber') {
      const fromLeft = Math.random() < 0.5
      const startX = fromLeft ? -1.1 : 1.1
      const speed = (0.18 + Math.random() * 0.06) * speedMul
      content.threats.spawn({
        kind: 'bomber',
        x: startX,
        y: 0.7 + Math.random() * 0.2,
        vx: fromLeft ? speed : -speed,
        vy: 0,
      })
    } else {
      const startX = (Math.random() * 1.6) - 0.8
      const targetX = (Math.random() * 1.6) - 0.8
      const baseDescent = 0.18 * speedMul * (kind === 'splitter' ? 0.92 : 1.0)
      const flightTime = 1.0 / baseDescent
      const vx = (targetX - startX) / flightTime
      content.threats.spawn({
        kind,
        x: startX,
        y: 1.0,
        vx,
        vy: -baseDescent,
      })
    }
    totalSpawned++
  }

  function tick(dt) {
    if (!active) return
    elapsed += dt
    while (queue.length && queue[0].when <= elapsed) {
      const e = queue.shift()
      _spawn(e.kind, e.speedMul)
    }
    // Cleared = no queued spawns AND no live threats.
    if (!cleared && queue.length === 0 && content.threats.aliveCount() === 0) {
      cleared = true
      active = false
      content.events.emit('wave-cleared', {wave: waveNumber})
    }
  }

  function isCleared() { return cleared }
  function isActive() { return active }
  function remaining() { return queue.length + content.threats.aliveCount() }

  // Wave-clear bonus: surviving missiles × 5 + surviving cities × 100.
  function bonus(survivingMissiles, survivingCities) {
    return survivingMissiles * 5 + survivingCities * 100
  }

  function reset() {
    queue = []
    active = false
    elapsed = 0
    totalSpawned = 0
    waveNumber = 0
    cleared = false
  }

  return {start, tick, isCleared, isActive, remaining, bonus, reset, paramsForWave}
})()
