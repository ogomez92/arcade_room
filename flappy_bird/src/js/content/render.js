// Optional visual renderer for sighted players.
//
// This game is audio-first — every cue the player NEEDS is in content/audio.js
// and the screen-reader announcer. This module is supplementary "HUD chrome":
// a 2D canvas that draws the same world the audio describes (bird altitude,
// pipe positions/gaps, scroll) so sighted players can also play by sight.
//
// It reads live world state every frame (like audio.js does) and never mutates
// it. Drawing the bird/pipes slightly larger/wider than their hitboxes is
// intentional: it makes the visuals forgiving (you only collide when clearly
// overlapping), never punishing.
content.render = (() => {
  // Lazy sibling refs (Gulp concat order is not guaranteed — resolve per call).
  const S = () => content.state
  const W = () => content.world

  let canvas = null
  let ctx = null
  let dpr = 1
  let cssW = 0
  let cssH = 0

  // Animation / transient visual state (rebuilt cheaply, never authoritative).
  let animT = 0          // seconds since mount, drives idle bobbing/clouds
  let displayAngle = 0   // smoothed bird tilt
  let flapPulse = 0      // 0..1, spikes on flap, drives wing up-stroke
  let flashT = 0         // red collision flash, decays
  let wasOver = false
  let clouds = []
  let cloudsReady = false

  // --- Layout constants -----------------------------------------------------
  const GROUND_FRAC = 0.13      // bottom slice reserved for ground
  const BIRD_X_FRAC = 0.27      // bird's fixed horizontal screen position
  const VISIBLE_WORLD_X = 3.3   // world units of pipe runway shown to the right

  // --- Small helpers ---------------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v) }
  function lerp(a, b, t) { return a + (b - a) * t }
  function mix(c1, c2, t) {
    return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`
  }

  // Geometry derived from current css size (recomputed each frame — cheap).
  function geom() {
    const w = cssW, h = cssH
    const groundH = Math.max(36, h * GROUND_FRAC)
    const playBottom = h - groundH
    const playH = playBottom
    const birdX = w * BIRD_X_FRAC
    const ppuX = (w - birdX) / VISIBLE_WORLD_X
    return {
      w, h, groundH, playBottom, playH, birdX, ppuX,
      yToPx: (wy) => playBottom - wy * playH,
      xToPx: (wx) => birdX + wx * ppuX,
    }
  }

  function ensureClouds() {
    if (cloudsReady) return
    clouds = []
    for (let i = 0; i < 6; i++) {
      clouds.push({
        fx: Math.random() * 1.3,
        fy: 0.04 + Math.random() * 0.42,
        s: 0.6 + Math.random() * 0.9,
        v: 0.012 + Math.random() * 0.022,
      })
    }
    cloudsReady = true
  }

  // --- Canvas sizing ---------------------------------------------------------
  function syncSize() {
    if (!canvas) return false
    const w = canvas.clientWidth | 0
    const h = canvas.clientHeight | 0
    if (!w || !h) return false
    if (w === cssW && h === cssH && canvas.width) return true
    cssW = w
    cssH = h
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    return true
  }

  // --- Drawing layers --------------------------------------------------------
  function drawSky(g, diff) {
    // Day → dusk as difficulty climbs (capped so it stays readable).
    const t = clamp(diff, 0, 1) * 0.8
    const top = mix([92, 198, 255], [30, 38, 86], t)
    const horizon = mix([186, 235, 255], [240, 156, 96], t)
    const grad = ctx.createLinearGradient(0, 0, 0, g.playBottom)
    grad.addColorStop(0, top)
    grad.addColorStop(1, horizon)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, g.w, g.playBottom)

    // Sun, drifting subtly with difficulty toward the horizon.
    const sunR = Math.max(24, g.h * 0.06)
    const sunX = g.w * 0.78
    const sunY = lerp(g.h * 0.18, g.h * 0.42, t)
    const sg = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 2.2)
    sg.addColorStop(0, 'rgba(255,247,214,0.95)')
    sg.addColorStop(0.4, 'rgba(255,236,170,0.45)')
    sg.addColorStop(1, 'rgba(255,236,170,0)')
    ctx.fillStyle = sg
    ctx.beginPath()
    ctx.arc(sunX, sunY, sunR * 2.2, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawClouds(g, delta) {
    ensureClouds()
    ctx.save()
    for (const c of clouds) {
      c.fx -= delta * c.v
      if (c.fx < -0.25) {
        c.fx = 1.25
        c.fy = 0.04 + Math.random() * 0.42
        c.s = 0.6 + Math.random() * 0.9
        c.v = 0.012 + Math.random() * 0.022
      }
      const x = c.fx * g.w
      const y = c.fy * g.playH
      const r = Math.max(14, g.h * 0.045) * c.s
      ctx.fillStyle = 'rgba(255,255,255,0.82)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.arc(x + r * 0.9, y + r * 0.15, r * 0.78, 0, Math.PI * 2)
      ctx.arc(x - r * 0.9, y + r * 0.18, r * 0.7, 0, Math.PI * 2)
      ctx.arc(x + r * 0.2, y - r * 0.45, r * 0.62, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  function drawPipe(g, p) {
    const sx = g.xToPx(p.x)
    const bodyHalf = Math.max(11, g.ppuX * 0.09)
    if (sx < -bodyHalf * 3 || sx > g.w + bodyHalf * 3) return

    const gapTop = p.gapCenter + p.gapHeight / 2     // higher worldY
    const gapBottom = p.gapCenter - p.gapHeight / 2   // lower worldY
    const yTop = g.yToPx(gapTop)        // pixel where the top pipe ends
    const yBottom = g.yToPx(gapBottom)  // pixel where the bottom pipe starts
    const lipH = Math.max(12, bodyHalf * 0.7)
    const lipOver = bodyHalf * 0.28
    const left = sx - bodyHalf

    const body = ctx.createLinearGradient(left, 0, left + bodyHalf * 2, 0)
    body.addColorStop(0, '#3c9a2e')
    body.addColorStop(0.18, '#7bd35a')
    body.addColorStop(0.5, '#5fb83f')
    body.addColorStop(0.85, '#3f9a2c')
    body.addColorStop(1, '#2e7a20')

    ctx.lineWidth = Math.max(2, bodyHalf * 0.12)
    ctx.strokeStyle = '#1f5416'
    ctx.fillStyle = body

    // Top pipe: ceiling (y=0) down to the gap's upper edge.
    ctx.beginPath()
    ctx.rect(left, 0, bodyHalf * 2, yTop)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.rect(left - lipOver, yTop - lipH, bodyHalf * 2 + lipOver * 2, lipH)
    ctx.fill(); ctx.stroke()

    // Bottom pipe: gap's lower edge down to the ground.
    ctx.beginPath()
    ctx.rect(left, yBottom, bodyHalf * 2, g.playBottom - yBottom)
    ctx.fill(); ctx.stroke()
    ctx.beginPath()
    ctx.rect(left - lipOver, yBottom, bodyHalf * 2 + lipOver * 2, lipH)
    ctx.fill(); ctx.stroke()

    // Glossy highlight stripe.
    ctx.fillStyle = 'rgba(255,255,255,0.22)'
    ctx.fillRect(left + bodyHalf * 0.32, 0, bodyHalf * 0.34, yTop)
    ctx.fillRect(left + bodyHalf * 0.32, yBottom, bodyHalf * 0.34, g.playBottom - yBottom)
  }

  function drawGround(g, distance) {
    const top = g.playBottom
    // Grass cap.
    ctx.fillStyle = '#6fbf3b'
    ctx.fillRect(0, top, g.w, g.h - top)
    ctx.fillStyle = '#8fd957'
    ctx.fillRect(0, top, g.w, Math.max(4, g.groundH * 0.22))
    // Dirt.
    ctx.fillStyle = '#caa45a'
    ctx.fillRect(0, top + g.groundH * 0.34, g.w, g.h - (top + g.groundH * 0.34))

    // Scrolling diagonal hatch on the dirt for a sense of motion.
    const tile = Math.max(28, g.groundH * 0.9)
    const off = (distance * g.ppuX) % tile
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, top + g.groundH * 0.34, g.w, g.h)
    ctx.clip()
    ctx.strokeStyle = 'rgba(120,86,40,0.5)'
    ctx.lineWidth = Math.max(2, tile * 0.08)
    for (let x = -tile - off; x < g.w + tile; x += tile) {
      ctx.beginPath()
      ctx.moveTo(x, g.h)
      ctx.lineTo(x + tile * 0.6, top + g.groundH * 0.34)
      ctx.stroke()
    }
    ctx.restore()

    // Thin shadow line under the grass cap.
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    ctx.fillRect(0, top + g.groundH * 0.32, g.w, Math.max(2, g.groundH * 0.04))
  }

  function drawBird(g, run, delta) {
    // Size so the drawn body always covers the collision hitbox in BOTH axes
    // (rx = R*1.12 ≥ 0.06 world wide, ry = R*0.92 ≥ 0.04 world tall, plus
    // margin) — the bird then only ever looks like it should collide when it
    // actually does, never the reverse.
    const R = Math.max(16, g.playH * 0.048, g.ppuX * 0.06)
    let by = g.yToPx(run.birdY)

    // Tilt: rising → nose up, falling → nose down.
    const t = S().TUN
    const vn = clamp((run.birdVy - t.MAX_VY_DOWN) / (t.MAX_VY_UP - t.MAX_VY_DOWN), 0, 1)
    let targetAngle = lerp(0.95, -0.5, vn)
    if (!run.started) {
      targetAngle = 0
      by += Math.sin(animT * 3) * g.playH * 0.014   // gentle pre-flap bob
    }
    displayAngle += (targetAngle - displayAngle) * clamp(delta * 9, 0, 1)

    const idle = Math.sin(animT * 9) * 0.18
    const wingAng = -1.05 * flapPulse + idle

    ctx.save()
    ctx.translate(g.birdX, by)
    ctx.rotate(displayAngle)

    // Soft shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    ctx.beginPath()
    ctx.ellipse(0, R * 0.95, R * 1.05, R * 0.4, 0, 0, Math.PI * 2)
    ctx.fill()

    // Body.
    const bg = ctx.createLinearGradient(0, -R, 0, R)
    bg.addColorStop(0, '#ffe27a')
    bg.addColorStop(0.55, '#ffcb35')
    bg.addColorStop(1, '#f4a81f')
    ctx.fillStyle = bg
    ctx.strokeStyle = '#a35e10'
    ctx.lineWidth = Math.max(1.5, R * 0.08)
    ctx.beginPath()
    ctx.ellipse(0, 0, R * 1.12, R * 0.92, 0, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()

    // Belly highlight.
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.beginPath()
    ctx.ellipse(-R * 0.1, R * 0.28, R * 0.7, R * 0.5, 0, 0, Math.PI * 2)
    ctx.fill()

    // Wing (animated).
    ctx.save()
    ctx.translate(-R * 0.12, R * 0.05)
    ctx.rotate(wingAng)
    const wg = ctx.createLinearGradient(0, -R * 0.4, 0, R * 0.4)
    wg.addColorStop(0, '#ffd24d')
    wg.addColorStop(1, '#e8901a')
    ctx.fillStyle = wg
    ctx.strokeStyle = '#a35e10'
    ctx.beginPath()
    ctx.ellipse(-R * 0.05, 0, R * 0.62, R * 0.34, 0, 0, Math.PI * 2)
    ctx.fill(); ctx.stroke()
    ctx.restore()

    // Eye.
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(R * 0.46, -R * 0.34, R * 0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#7a4a0c'
    ctx.lineWidth = Math.max(1, R * 0.05)
    ctx.stroke()
    ctx.fillStyle = '#1a1a1a'
    const dead = run.over
    if (dead) {
      // X_X eye on death.
      ctx.lineWidth = Math.max(1.5, R * 0.09)
      ctx.strokeStyle = '#1a1a1a'
      const ex = R * 0.46, ey = -R * 0.34, e = R * 0.18
      ctx.beginPath()
      ctx.moveTo(ex - e, ey - e); ctx.lineTo(ex + e, ey + e)
      ctx.moveTo(ex + e, ey - e); ctx.lineTo(ex - e, ey + e)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(R * 0.54, -R * 0.34, R * 0.14, 0, Math.PI * 2)
      ctx.fill()
    }

    // Beak.
    ctx.fillStyle = '#ff7a1a'
    ctx.strokeStyle = '#c4530a'
    ctx.lineWidth = Math.max(1, R * 0.05)
    ctx.beginPath()
    ctx.moveTo(R * 0.85, -R * 0.12)
    ctx.lineTo(R * 1.5, R * 0.02)
    ctx.lineTo(R * 0.85, R * 0.2)
    ctx.closePath()
    ctx.fill(); ctx.stroke()

    ctx.restore()
  }

  function drawScore(g, run) {
    if (!run.started) return
    const txt = String(run.score)
    ctx.save()
    ctx.font = `700 ${Math.max(28, g.h * 0.1)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const x = g.w * 0.5, y = g.h * 0.14
    ctx.lineWidth = Math.max(3, g.h * 0.01)
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.strokeText(txt, x, y)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(txt, x, y)
    ctx.restore()
  }

  function drawPrompt(g) {
    const line1 = (app.i18n && app.i18n.t) ? app.i18n.t('game.getReady') : 'Get ready'
    const line2 = (app.i18n && app.i18n.t) ? app.i18n.t('game.flapToStart') : 'Flap to start!'
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const cx = g.w * 0.5, cy = g.playH * 0.42
    const f1 = Math.max(20, g.h * 0.055)
    const f2 = Math.max(14, g.h * 0.032)
    // Backing pill.
    ctx.font = `700 ${f1}px sans-serif`
    const wText = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width)
    const padX = f1 * 0.9, boxW = wText + padX * 2, boxH = f1 + f2 + f1 * 1.1
    ctx.fillStyle = 'rgba(0,0,0,0.32)'
    roundRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH, f1 * 0.4)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line1, cx, cy - f2 * 0.5)
    ctx.font = `600 ${f2}px sans-serif`
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillText(line2, cx, cy + f1 * 0.7)
    ctx.restore()
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  // --- Public API ------------------------------------------------------------
  function mount(el) {
    if (!el || canvas === el) return
    canvas = el
    ctx = canvas.getContext('2d')
    // Wing up-stroke whenever the bird flaps.
    if (content.events && content.events.on) {
      content.events.on('flap', () => { flapPulse = 1 })
    }
  }

  // Reset transient visual state (call on screen enter).
  function reset() {
    displayAngle = 0
    flapPulse = 0
    flashT = 0
    wasOver = false
    cssW = 0  // force a size re-sync on next frame
  }

  function frame(delta) {
    if (!canvas || !ctx) return
    if (!syncSize()) return
    const d = (typeof delta === 'number' && delta > 0 && delta < 0.5) ? delta : 1 / 60
    animT += d
    flapPulse = Math.max(0, flapPulse - d * 4)

    const run = S().run
    const g = geom()
    const diff = S().difficulty01 ? S().difficulty01() : 0

    if (run.over && !wasOver) flashT = 0.45
    wasOver = run.over
    if (flashT > 0) flashT = Math.max(0, flashT - d * 1.5)

    ctx.clearRect(0, 0, g.w, g.h)
    drawSky(g, diff)
    drawClouds(g, d)

    for (const p of W().pipes()) drawPipe(g, p)

    drawGround(g, run.distance)
    drawBird(g, run, d)
    drawScore(g, run)

    if (!run.started) drawPrompt(g)

    if (flashT > 0) {
      ctx.fillStyle = `rgba(220,40,40,${(flashT * 0.6).toFixed(3)})`
      ctx.fillRect(0, 0, g.w, g.h)
    }
  }

  return { mount, reset, frame }
})()
