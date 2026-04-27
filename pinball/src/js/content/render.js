// Optional 2D canvas renderer. The game is fully playable by ear; this is
// purely a visual aid for sighted onlookers and debugging.
content.render = (() => {
  // Lazy module refs (load order is alphabetical so siblings may not exist yet).
  const T = () => content.table
  const P = () => content.physics
  const G = () => content.game

  let canvas, ctx

  function ensureCanvas() {
    if (canvas) return true
    canvas = document.querySelector('.a-game--canvas')
    if (!canvas) return false
    ctx = canvas.getContext('2d')
    return true
  }

  // World → canvas: x ∈ [-W/2, W/2] → [0, w]; y ∈ [-2, H] → [h, 0]
  function project(x, y, w, h) {
    const t = T()
    const cx = ((x + t.WIDTH / 2) / t.WIDTH) * w
    const cy = h - ((y + 2) / (t.HEIGHT + 2)) * h
    return [cx, cy]
  }

  function draw() {
    if (!ensureCanvas()) return
    const t = T()
    if (!t) return
    const w = canvas.width, h = canvas.height
    ctx.fillStyle = '#050816'
    ctx.fillRect(0, 0, w, h)

    // Walls
    ctx.strokeStyle = '#446'
    ctx.lineWidth = 2
    for (const seg of t.segments) {
      ctx.beginPath()
      const [ax, ay] = project(seg.a.x, seg.a.y, w, h)
      const [bx, by] = project(seg.b.x, seg.b.y, w, h)
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
      ctx.strokeStyle = seg.kind === 'oneway' ? '#a82' : '#446'
      ctx.stroke()
    }

    // Bumpers
    for (const b of t.BUMPERS) {
      const [cx, cy] = project(b.x, b.y, w, h)
      const r = (b.radius / t.WIDTH) * w
      ctx.fillStyle = '#cc4477'
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    }
    for (const s of t.SLINGS) {
      const [cx, cy] = project(s.x, s.y, w, h)
      const r = (s.radius / t.WIDTH) * w
      ctx.fillStyle = '#447799'
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill()
    }
    // Targets
    const ts = G().state.targetState
    for (const tg of t.TARGETS) {
      const down = ts[tg.id] && ts[tg.id].down
      const [x1, y1] = project(tg.x - tg.w/2, tg.y + tg.h/2, w, h)
      const [x2, y2] = project(tg.x + tg.w/2, tg.y - tg.h/2, w, h)
      ctx.fillStyle = down ? '#334' : '#dd6'
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1)
    }
    // Rollovers
    for (const r of t.ROLLOVERS) {
      const [cx, cy] = project(r.x, r.y, w, h)
      const rad = (r.radius / t.WIDTH) * w
      ctx.strokeStyle = '#88c'
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke()
    }

    // Flippers
    ctx.strokeStyle = '#eef'
    ctx.lineWidth = 6
    for (const k of ['left', 'right', 'upper']) {
      const f = P().flippers[k]
      const tip = P().flipperTipPosition(f)
      const [ax, ay] = project(f.def.pivot.x, f.def.pivot.y, w, h)
      const [bx, by] = project(tip.x, tip.y, w, h)
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke()
    }

    // Ball
    const ball = G().state.ball
    if (ball && ball.live) {
      const [bx, by] = project(ball.x, ball.y, w, h)
      const br = (ball.r / t.WIDTH) * w
      ctx.fillStyle = '#fff'
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill()
    }

    // Listener marker (player)
    const [lx, ly] = project(t.LISTENER.x, t.LISTENER.y, w, h)
    ctx.strokeStyle = '#4f4'
    ctx.beginPath(); ctx.arc(lx, ly, 6, 0, Math.PI * 2); ctx.stroke()
  }

  return {draw}
})()
