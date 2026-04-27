const Render = (() => {
  const DRAW_DISTANCE = 130
  const CAMERA_HEIGHT = 1500
  const CAMERA_DEPTH = 1 / Math.tan((100 / 2) * Math.PI / 180)
  const FOG_DENSITY = 5

  let canvas, ctx, width, height

  function init() {
    canvas = document.getElementById('canvas')
    ctx = canvas.getContext('2d')
    resize()
    window.addEventListener('resize', resize)
  }

  function resize() {
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    // Render at fixed internal resolution but scale by dpr, capped
    const targetW = Math.min(1600, Math.floor(rect.width * dpr))
    const targetH = Math.min(900, Math.floor(rect.height * dpr))
    canvas.width = targetW
    canvas.height = targetH
    width = canvas.width
    height = canvas.height
  }

  function project(p, cameraX, cameraY, cameraZ, cameraDepth, w, h, roadWidth) {
    p.camera.x = (p.world.x || 0) - cameraX
    p.camera.y = (p.world.y || 0) - cameraY
    p.camera.z = (p.world.z || 0) - cameraZ
    p.screen.scale = cameraDepth / Math.max(0.1, p.camera.z)
    p.screen.x = Math.round(w / 2 + (p.screen.scale * p.camera.x * w / 2))
    p.screen.y = Math.round(h / 2 - (p.screen.scale * p.camera.y * h / 2))
    p.screen.w = Math.round(p.screen.scale * roadWidth * w / 2)
  }

  function drawSky(horizonY, bgShiftX, bgShiftY) {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY)
    g.addColorStop(0, '#0a0020')
    g.addColorStop(0.5, '#1a0038')
    g.addColorStop(1, '#55064e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, horizonY)

    // Neon sun
    const sunX = width * 0.5 - bgShiftX * 0.25
    const sunY = horizonY - 80
    const sunR = Math.min(width, height) * 0.13
    const sunG = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR)
    sunG.addColorStop(0, 'rgba(255, 140, 60, 1)')
    sunG.addColorStop(0.55, 'rgba(255, 47, 160, 0.85)')
    sunG.addColorStop(1, 'rgba(255, 47, 160, 0)')
    ctx.fillStyle = sunG
    ctx.beginPath()
    ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2)
    ctx.fill()

    // Horizontal sun scan lines
    ctx.fillStyle = '#05010f'
    for (let i = 0; i < 6; i++) {
      const y = sunY - sunR + (i / 6) * sunR * 1.8 + 10
      ctx.fillRect(sunX - sunR - 4, y, sunR * 2 + 8, 2)
    }

    // Distant grid on horizon (static lines)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.2)'
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) {
      const y = horizonY - 2 - i * 2
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  }

  function drawSegment(s, lanes, roadWidth) {
    const p1 = s.p1.screen, p2 = s.p2.screen
    if (p2.y >= p1.y) return
    if (p1.y > height) return

    const dark = s.color === 'dark'

    // Road (trapezoid)
    ctx.fillStyle = dark ? '#14012a' : '#1c0342'
    polygon(p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y)

    // Rumble edges
    const rumbleW1 = p1.w / 20
    const rumbleW2 = p2.w / 20
    ctx.fillStyle = dark ? '#ff2fa0' : '#00e5ff'
    polygon(p1.x - p1.w - rumbleW1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - rumbleW2, p2.y)
    polygon(p1.x + p1.w + rumbleW1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + rumbleW2, p2.y)

    // Center dashed line (only on light segments)
    if (!dark) {
      const lw1 = p1.w / 90, lw2 = p2.w / 90
      ctx.fillStyle = '#e4faff'
      polygon(p1.x - lw1, p1.y, p1.x + lw1, p1.y, p2.x + lw2, p2.y, p2.x - lw2, p2.y)
    }

    // Glow top edge of segment
    if (s.index % 3 === 0) {
      ctx.fillStyle = 'rgba(255, 47, 160, 0.18)'
      ctx.fillRect(p2.x - p2.w, p2.y - 1, p2.w * 2, 2)
    }
  }

  function polygon(x1, y1, x2, y2, x3, y3, x4, y4) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.lineTo(x3, y3)
    ctx.lineTo(x4, y4)
    ctx.closePath()
    ctx.fill()
  }

  function drawGround(horizonY, scrollX, scrollZ) {
    // Magenta/cyan grid below horizon using perspective lines
    ctx.save()
    ctx.fillStyle = '#080018'
    ctx.fillRect(0, horizonY, width, height - horizonY)

    // Horizontal grid lines receding
    ctx.strokeStyle = 'rgba(255, 47, 160, 0.35)'
    ctx.lineWidth = 1
    const lines = 18
    const offset = ((scrollZ * 0.0015) % 1)
    for (let i = 1; i <= lines; i++) {
      const t = Math.pow((i - offset) / lines, 2.2)
      const y = horizonY + t * (height - horizonY)
      ctx.globalAlpha = Math.min(1, (i - offset) / lines) * 0.7
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Vertical lines (fake vanishing)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)'
    const vanishX = width / 2 - scrollX * 0.3
    for (let i = -8; i <= 8; i++) {
      const x0 = vanishX + i * (width / 16)
      ctx.beginPath()
      ctx.moveTo(width / 2, horizonY)
      ctx.lineTo(x0, height)
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawShip(car, screenX, screenY) {
    const size = Math.min(width, height) * 0.12
    const bank = car.bank
    ctx.save()
    ctx.translate(screenX, screenY)
    ctx.rotate(bank * 0.35)

    // Ship shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.beginPath()
    ctx.ellipse(0, size * 0.32, size * 0.55, size * 0.12, 0, 0, Math.PI * 2)
    ctx.fill()

    // Body (bank squishes horizontally)
    const bodyW = size * (1 - Math.abs(bank) * 0.25)
    const bodyH = size * 0.38

    // Under-glow
    const glowGrad = ctx.createLinearGradient(0, -bodyH, 0, bodyH * 1.5)
    glowGrad.addColorStop(0, 'rgba(0, 229, 255, 0)')
    glowGrad.addColorStop(1, 'rgba(0, 229, 255, 0.8)')
    ctx.fillStyle = glowGrad
    ctx.beginPath()
    ctx.ellipse(0, bodyH * 0.4, bodyW * 0.7, bodyH * 0.6, 0, 0, Math.PI * 2)
    ctx.fill()

    // Chassis
    ctx.fillStyle = '#ff2fa0'
    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-bodyW * 0.5, bodyH * 0.3)
    ctx.lineTo(-bodyW * 0.35, -bodyH * 0.3)
    ctx.lineTo(bodyW * 0.35, -bodyH * 0.3)
    ctx.lineTo(bodyW * 0.5, bodyH * 0.3)
    ctx.lineTo(bodyW * 0.25, bodyH * 0.55)
    ctx.lineTo(-bodyW * 0.25, bodyH * 0.55)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Cockpit
    ctx.fillStyle = '#e4faff'
    ctx.beginPath()
    ctx.moveTo(-bodyW * 0.15, -bodyH * 0.1)
    ctx.lineTo(bodyW * 0.15, -bodyH * 0.1)
    ctx.lineTo(bodyW * 0.08, -bodyH * 0.28)
    ctx.lineTo(-bodyW * 0.08, -bodyH * 0.28)
    ctx.closePath()
    ctx.fill()

    // Exhaust flames (bigger on boost)
    const flame = car.boosting ? 1.8 : 1
    const flameGrad = ctx.createLinearGradient(0, bodyH * 0.5, 0, bodyH * (0.9 + 0.5 * flame))
    flameGrad.addColorStop(0, '#ffffff')
    flameGrad.addColorStop(0.4, '#00e5ff')
    flameGrad.addColorStop(1, 'rgba(255, 47, 160, 0)')
    ctx.fillStyle = flameGrad
    ctx.beginPath()
    ctx.moveTo(-bodyW * 0.18, bodyH * 0.5)
    ctx.lineTo(bodyW * 0.18, bodyH * 0.5)
    ctx.lineTo(0, bodyH * (0.9 + 0.5 * flame) + size * 0.08 * flame * Math.random())
    ctx.closePath()
    ctx.fill()

    ctx.restore()
  }

  function drawPickup(pickup, car, baseIndex) {
    const playerAbs = (car.lap - 1) * Track.length + car.z
    const distAhead = pickup.zAbs - playerAbs
    if (distAhead < -30 || distAhead > 5000) return
    const pickupZ = Track.wrap(car.z + distAhead)
    const seg = Track.findSegment(pickupZ)
    const segCount = Track.segments.length
    let indexDiff = seg.index - baseIndex
    if (indexDiff < 0) indexDiff += segCount
    if (indexDiff < 0 || indexDiff >= DRAW_DISTANCE) return
    if (!seg.p1.screen || !isFinite(seg.p1.screen.scale)) return
    const scale = seg.p1.screen.scale
    if (scale <= 0) return
    const sx = seg.p1.screen.x + scale * pickup.x * Track.ROAD_WIDTH * width / 2
    const sy = seg.p1.screen.y - scale * 600 * height / 2  // hover above road
    const size = scale * 900 * width / 2
    if (size < 2 || size > width) return

    const pulse = 0.6 + 0.4 * Math.sin(pickup.age * 8)
    const color = pickup.type === 'health' ? '#55ff88' : '#ffb400'
    const glow = pickup.type === 'health' ? 'rgba(85, 255, 136, 0.8)' : 'rgba(255, 180, 0, 0.8)'

    ctx.save()
    // Outer glow
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 1.6 * pulse)
    grad.addColorStop(0, glow)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(sx, sy, size * 1.6 * pulse, 0, Math.PI * 2)
    ctx.fill()
    // Core
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(sx, sy, size * 0.45 * (0.85 + 0.15 * pulse), 0, Math.PI * 2)
    ctx.fill()
    // Symbol
    ctx.strokeStyle = '#051018'
    ctx.lineWidth = Math.max(1, size * 0.08)
    if (pickup.type === 'health') {
      ctx.beginPath()
      ctx.moveTo(sx - size * 0.22, sy); ctx.lineTo(sx + size * 0.22, sy)
      ctx.moveTo(sx, sy - size * 0.22); ctx.lineTo(sx, sy + size * 0.22)
      ctx.stroke()
    } else {
      // Bullet icon: vertical rect with pointed tip
      ctx.beginPath()
      ctx.moveTo(sx, sy - size * 0.3)
      ctx.lineTo(sx + size * 0.12, sy - size * 0.1)
      ctx.lineTo(sx + size * 0.12, sy + size * 0.22)
      ctx.lineTo(sx - size * 0.12, sy + size * 0.22)
      ctx.lineTo(sx - size * 0.12, sy - size * 0.1)
      ctx.closePath()
      ctx.stroke()
    }
    ctx.restore()
  }

  function drawBullet(bullet, car, baseIndex) {
    const playerAbs = (car.lap - 1) * Track.length + car.z
    const distAhead = bullet.zAbs - playerAbs
    if (distAhead < -20 || distAhead > 3500) return
    const bz = Track.wrap(car.z + distAhead)
    const seg = Track.findSegment(bz)
    const segCount = Track.segments.length
    let indexDiff = seg.index - baseIndex
    if (indexDiff < 0) indexDiff += segCount
    if (indexDiff < 0 || indexDiff >= DRAW_DISTANCE) return
    if (!seg.p1.screen || !isFinite(seg.p1.screen.scale)) return
    const scale = seg.p1.screen.scale
    if (scale <= 0) return
    const sx = seg.p1.screen.x + scale * bullet.x * Track.ROAD_WIDTH * width / 2
    const sy = seg.p1.screen.y - scale * 400 * height / 2
    const size = scale * 500 * width / 2
    if (size < 1) return

    ctx.save()
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, size * 1.5)
    g.addColorStop(0, 'rgba(255, 255, 200, 1)')
    g.addColorStop(0.4, 'rgba(255, 180, 0, 0.9)')
    g.addColorStop(1, 'rgba(255, 60, 0, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(sx, sy, size * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffe0'
    ctx.beginPath()
    ctx.arc(sx, sy, size * 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  function drawOpponent(ai, car, baseIndex) {
    const seg = Track.findSegment(ai.z)
    // Distance in indices from base; must fall within draw window
    const segCount = Track.segments.length
    let indexDiff = seg.index - baseIndex
    if (indexDiff < 0) indexDiff += segCount
    if (indexDiff < 0 || indexDiff >= DRAW_DISTANCE) return

    if (!seg.p1.screen || !isFinite(seg.p1.screen.scale)) return

    const scale = seg.p1.screen.scale
    if (scale <= 0) return
    const sx = seg.p1.screen.x + scale * ai.x * Track.ROAD_WIDTH * width / 2
    const sy = seg.p1.screen.y
    const size = scale * 1200 * width / 2
    if (size < 2 || size > width) return

    ctx.save()
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.beginPath()
    ctx.ellipse(sx, sy + size * 0.1, size * 0.4, size * 0.1, 0, 0, Math.PI * 2)
    ctx.fill()
    // Body
    const hit = ai._slowT && ai._slowT > 0
    ctx.fillStyle = hit ? '#ff3050' : ai.color
    ctx.strokeStyle = '#e4faff'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(sx - size * 0.35, sy)
    ctx.lineTo(sx - size * 0.2, sy - size * 0.25)
    ctx.lineTo(sx + size * 0.2, sy - size * 0.25)
    ctx.lineTo(sx + size * 0.35, sy)
    ctx.lineTo(sx + size * 0.2, sy + size * 0.1)
    ctx.lineTo(sx - size * 0.2, sy + size * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Engine glow
    ctx.fillStyle = 'rgba(255, 180, 0, 0.6)'
    ctx.fillRect(sx - size * 0.12, sy + size * 0.07, size * 0.24, size * 0.04)
    ctx.restore()
  }

  function render(car, ais, pickups, bullets) {
    const segs = Track.segments
    const baseSegment = Track.findSegment(car.z)
    const basePercent = (car.z % Track.SEGMENT_LENGTH) / Track.SEGMENT_LENGTH

    let maxY = height
    let x = 0
    let dx = -(baseSegment.curve * basePercent)

    const cameraX = car.x * Track.ROAD_WIDTH
    const cameraY = CAMERA_HEIGHT + (baseSegment.p1.world.y + (baseSegment.p2.world.y - baseSegment.p1.world.y) * basePercent)
    const cameraZ = car.z - Track.SEGMENT_LENGTH * basePercent
    const roadWidth = Track.ROAD_WIDTH

    // Compute horizon based on avg projected far point
    const horizonY = Math.floor(height * (0.45 + car.pitch * 0.3))

    // Draw sky + ground first
    ctx.clearRect(0, 0, width, height)
    const bgShiftX = (car.z % 2000) * (baseSegment.curve) * 0.25
    drawSky(horizonY, bgShiftX, 0)
    drawGround(horizonY, cameraX * 0.002 + baseSegment.curve * 200, car.z)

    // Project segments
    for (let n = 0; n < DRAW_DISTANCE; n++) {
      const seg = segs[(baseSegment.index + n) % segs.length]
      const loops = Math.floor((baseSegment.index + n) / segs.length)
      seg._loop = loops

      project(seg.p1,
        cameraX - x,
        cameraY,
        cameraZ - loops * Track.length,
        CAMERA_DEPTH,
        width, height, roadWidth)

      project(seg.p2,
        cameraX - x - dx,
        cameraY,
        cameraZ - loops * Track.length,
        CAMERA_DEPTH,
        width, height, roadWidth)

      x += dx
      dx += seg.curve

      if (seg.p1.camera.z <= CAMERA_DEPTH ||
          seg.p2.screen.y >= maxY ||
          seg.p2.screen.y >= seg.p1.screen.y) continue

      drawSegment(seg, 3, roadWidth)
      maxY = seg.p2.screen.y
    }

    // Draw opponents (sort far → near)
    const sorted = [...ais].sort((a, b) => {
      const ga = Track.wrap(a.z - car.z), gb = Track.wrap(b.z - car.z)
      const na = ga > Track.length / 2 ? ga - Track.length : ga
      const nb = gb > Track.length / 2 ? gb - Track.length : gb
      return nb - na
    })
    for (const ai of sorted) drawOpponent(ai, car, baseSegment.index)

    // Pickups & bullets (draw after opponents so they overlay)
    if (pickups) {
      for (const p of pickups) drawPickup(p, car, baseSegment.index)
    }
    if (bullets) {
      for (const b of bullets) drawBullet(b, car, baseSegment.index)
    }

    // Speed lines during boost
    if (car.boosting || car.speed > Car.MAX_SPEED * 0.9) {
      ctx.save()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.lineWidth = 1
      const n = 20
      for (let i = 0; i < n; i++) {
        const ang = (Math.random() - 0.5) * 0.6
        const sx = width / 2 + Math.cos(ang) * width * 0.05
        const sy = height * 0.55 + Math.sin(ang) * height * 0.05
        const ex = width / 2 + Math.cos(ang) * width * (0.5 + Math.random() * 0.5)
        const ey = height * 0.55 + Math.sin(ang) * height * (0.5 + Math.random() * 0.5)
        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Draw player ship at fixed screen position
    drawShip(car, width / 2, height * 0.82)
  }

  return { init, render }
})()
