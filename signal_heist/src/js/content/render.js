content.render = (() => {
  const state = {
    canvas: null,
    context: null,
    width: 1,
    height: 1,
    scale: 1,
    ox: 0,
    oy: 0,
  }

  function worldToScreen(x, y) {
    return {
      x: state.ox + x * state.scale,
      y: state.oy + (content.game.state.height - y) * state.scale,
    }
  }

  function drawCone(ctx, entity, range, fov, color) {
    const p = worldToScreen(entity.x, entity.y)
    const a1 = -entity.heading - fov / 2
    const a2 = -entity.heading + fov / 2
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.arc(p.x, p.y, range * state.scale, a1, a2)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  function drawCircle(ctx, point, radius, color) {
    const p = worldToScreen(point.x, point.y)
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius * state.scale, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  return {
    bind: function (root) {
      state.canvas = root.querySelector('.a-game--canvas')
      state.context = state.canvas ? state.canvas.getContext('2d') : null
      window.addEventListener('resize', () => this.resize())
      this.resize()
      return this
    },
    resize: function () {
      if (!state.canvas) return this
      const rect = state.canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      state.canvas.width = Math.max(1, Math.floor(rect.width * ratio))
      state.canvas.height = Math.max(1, Math.floor(rect.height * ratio))
      state.context.setTransform(ratio, 0, 0, ratio, 0, 0)
      state.width = rect.width
      state.height = rect.height
      return this
    },
    draw: function () {
      const ctx = state.context
      const game = content.game.state
      if (!ctx || !game.contract) return this

      ctx.clearRect(0, 0, state.width, state.height)
      ctx.fillStyle = '#050607'
      ctx.fillRect(0, 0, state.width, state.height)

      state.scale = Math.min(
        (state.width - 32) / game.width,
        (state.height - 32) / game.height
      )
      state.ox = (state.width - game.width * state.scale) / 2
      state.oy = (state.height - game.height * state.scale) / 2

      ctx.strokeStyle = '#5d6f6a'
      ctx.lineWidth = 2
      ctx.strokeRect(state.ox, state.oy, game.width * state.scale, game.height * state.scale)

      ctx.fillStyle = '#151a1b'
      for (const obstacle of game.obstacles) {
        const a = worldToScreen(obstacle.x1, obstacle.y2)
        const b = worldToScreen(obstacle.x2, obstacle.y1)
        ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y)
      }

      for (const camera of game.cameras) {
        drawCone(ctx, camera, camera.range, camera.fov, game.time < camera.jammedUntil ? 'rgba(90,160,145,0.08)' : 'rgba(170,25,55,0.12)')
      }

      for (const guard of game.guards) {
        drawCone(ctx, guard, guard.range, guard.fov, game.time < guard.jammedUntil ? 'rgba(90,160,145,0.07)' : 'rgba(195,34,58,0.12)')
      }

      for (const cache of game.caches) {
        if (!cache.collected) drawCircle(ctx, cache, 0.32, '#4ecdc4')
      }

      if (game.cachesTaken >= game.totalCaches) drawCircle(ctx, game.exit, 0.46, '#d4af37')

      for (const camera of game.cameras) {
        drawCircle(ctx, camera, 0.24, game.time < camera.jammedUntil ? '#53b9a8' : '#b3273d')
      }

      for (const guard of game.guards) {
        drawCircle(ctx, guard, 0.28, game.time < guard.jammedUntil ? '#53b9a8' : '#d85f4f')
      }

      const player = game.player
      const p = worldToScreen(player.x, player.y)
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(-player.heading)
      ctx.fillStyle = player.sprinting ? '#f6c85f' : '#f2f7f2'
      ctx.beginPath()
      ctx.moveTo(0.48 * state.scale, 0)
      ctx.lineTo(-0.32 * state.scale, -0.24 * state.scale)
      ctx.lineTo(-0.32 * state.scale, 0.24 * state.scale)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      const heatWidth = Math.min(1, game.heat) * (game.width * state.scale)
      ctx.fillStyle = game.heat > 0.72 ? '#ff325a' : '#4ecdc4'
      ctx.fillRect(state.ox, state.oy + game.height * state.scale + 7, heatWidth, 4)

      return this
    },
  }
})()
