content.render = (() => {
  let canvas, ctx, width = 1, height = 1, pixelRatio = 1

  const COLORS = {
    tube: 'rgba(92, 245, 255, 0.34)',
    tubeDim: 'rgba(92, 245, 255, 0.12)',
    player: '#FFFFFF',
    shot: '#B8FBFF',
    flipper: '#54F5FF',
    tanker: '#FFB84D',
    spiker: '#A3FF66',
    spark: '#FF5AC8',
    fuseball: '#FF4C4C',
    spike: '#B8FF66',
  }

  function bind(root) {
    canvas = root && root.querySelector('.a-game--canvas')
    ctx = canvas && canvas.getContext('2d')
    resize()
    window.addEventListener('resize', resize)
  }

  function resize() {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1))
    width = Math.max(1, Math.floor(rect.width * pixelRatio))
    height = Math.max(1, Math.floor(rect.height * pixelRatio))
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }
  }

  function center() {
    return {x: width / 2, y: height / 2}
  }

  function radii() {
    const min = Math.min(width, height)
    return {
      outer: min * 0.43,
      inner: min * 0.10,
    }
  }

  function lanePoint(lane, depth) {
    const n = content.constants.LANE_COUNT
    const c = center()
    const r = radii()
    const angle = (-Math.PI / 2) + (lane / n) * Math.PI * 2
    const radius = r.outer - (r.outer - r.inner) * depth
    return {
      x: c.x + Math.cos(angle) * radius,
      y: c.y + Math.sin(angle) * radius,
    }
  }

  function drawTube() {
    const n = content.constants.LANE_COUNT
    ctx.save()
    ctx.lineWidth = Math.max(1, pixelRatio)
    for (let i = 0; i < n; i++) {
      const a = lanePoint(i, 0)
      const b = lanePoint(i, 1)
      ctx.strokeStyle = i === content.game.state.playerLane ? COLORS.tube : COLORS.tubeDim
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    for (const depth of [0, 0.25, 0.5, 0.75, 1]) {
      ctx.strokeStyle = depth === 0 ? COLORS.tube : COLORS.tubeDim
      ctx.beginPath()
      for (let i = 0; i <= n; i++) {
        const p = lanePoint(i % n, depth)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawPlayer() {
    const lane = content.game.state.playerLane
    const p = lanePoint(lane, 0)
    const p2 = lanePoint(lane, 0.1)
    ctx.save()
    ctx.strokeStyle = COLORS.player
    ctx.fillStyle = COLORS.player
    ctx.lineWidth = Math.max(2, 2 * pixelRatio)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(p.x, p.y, Math.max(4, 5 * pixelRatio), 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function drawShots() {
    ctx.save()
    ctx.strokeStyle = COLORS.shot
    ctx.fillStyle = COLORS.shot
    ctx.lineWidth = Math.max(2, 2 * pixelRatio)
    for (const shot of content.game.state.shots) {
      const a = lanePoint(shot.lane, Math.max(0, shot.depth - 0.08))
      const b = lanePoint(shot.lane, shot.depth)
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(b.x, b.y, Math.max(2, 3 * pixelRatio), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function drawEnemies() {
    ctx.save()
    for (const enemy of content.game.state.enemies) {
      const p = lanePoint(enemy.lane, enemy.depth)
      const size = Math.max(4, (8 - enemy.depth * 3) * pixelRatio)
      ctx.fillStyle = COLORS[enemy.kind] || COLORS.flipper
      ctx.strokeStyle = ctx.fillStyle
      ctx.lineWidth = Math.max(1, 1.5 * pixelRatio)
      if (enemy.kind === 'tanker') {
        ctx.strokeRect(p.x - size, p.y - size, size * 2, size * 2)
      } else if (enemy.kind === 'spiker') {
        ctx.beginPath()
        ctx.moveTo(p.x, p.y - size)
        ctx.lineTo(p.x + size, p.y + size)
        ctx.lineTo(p.x - size, p.y + size)
        ctx.closePath()
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        if (enemy.kind === 'spark' || enemy.kind === 'fuseball') ctx.fill()
        else ctx.stroke()
      }
    }
    ctx.restore()
  }

  function drawSpikes() {
    ctx.save()
    ctx.strokeStyle = COLORS.spike
    ctx.lineWidth = Math.max(2, 2 * pixelRatio)
    for (let lane = 0; lane < content.game.state.spikes.length; lane++) {
      const spike = content.game.state.spikes[lane]
      if (spike >= 0.99) continue
      const a = lanePoint(lane, 1)
      const b = lanePoint(lane, spike)
      ctx.globalAlpha = spike < content.constants.SPIKE_DANGER_DEPTH ? 0.95 : 0.55
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawBackground() {
    const grd = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.55)
    grd.addColorStop(0, '#121223')
    grd.addColorStop(0.45, '#05070B')
    grd.addColorStop(1, '#000000')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, width, height)
  }

  function draw() {
    if (!ctx) return
    resize()
    drawBackground()
    drawTube()
    drawSpikes()
    drawShots()
    drawEnemies()
    drawPlayer()
  }

  return {
    bind,
    resize,
    draw,
    lanePoint,
  }
})()
