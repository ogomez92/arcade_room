// AI controller for the computer opponent. Reads ball state, predicts
// the bounce point on its side, and walks toward it. When the ball is
// in its strike zone (post-bounce, on its side, within reach) it
// swings — picking shot type by ball height and position relative to
// its body so the trajectory is plausible.
//
// The AI is driven by content.match each frame; it doesn't read input
// devices. Difficulty is one knob: reaction lag and footwork speed.
content.ai = (() => {
  // content.court is defined by court.js, which loads after ai.js in
  // the alphabetical concat order — so we defer the lookup to call
  // time instead of capturing it at IIFE time.
  const COURT = () => content.court

  function create(player, opts = {}) {
    const difficulty = opts.difficulty || 'normal'  // 'easy' | 'normal' | 'hard'
    const reactionLag = difficulty === 'easy' ? 0.4 : difficulty === 'hard' ? 0.12 : 0.22
    const footworkScale = difficulty === 'easy' ? 0.78 : difficulty === 'hard' ? 1.05 : 0.92
    const aimErrorM = difficulty === 'easy' ? 1.4 : difficulty === 'hard' ? 0.4 : 0.8

    const ai = {
      player,
      difficulty,
      reactionLag,
      footworkScale,
      aimErrorM,
      pendingDecision: null,    // {action: 'serve'|'swing', at: timestamp}
      cooldown: 0,
    }

    return ai
  }

  // Predict where the ball will land on the AI's side (z = 0). Returns
  // {x, y, t} where t is seconds until that landing, or null if it
  // won't reach the AI's side.
  function predictLanding(side) {
    const ball = content.ball.getPosition()
    const v = content.ball.getVelocity()
    if (Math.abs(v.x) < 1e-3 && Math.abs(v.y) < 1e-3 && Math.abs(v.z) < 1e-3) return null

    // Iterative: step the same physics forward until z ≤ ball radius
    // and the ball is on the AI's side (sign(y) matches side).
    let p = {x: ball.x, y: ball.y, z: ball.z}
    let vel = {x: v.x, y: v.y, z: v.z}
    const dt = 0.02
    let t = 0
    for (let i = 0; i < 200; i++) {
      // Integrate (no drag for prediction — simpler, close enough)
      vel.z -= 9.81 * dt
      p.x += vel.x * dt
      p.y += vel.y * dt
      p.z += vel.z * dt
      t += dt
      const onSide = side === 'south' ? p.y > 0 : p.y < 0
      if (p.z <= 0 && onSide) {
        return {x: p.x, y: p.y, t}
      }
      if (Math.abs(p.x) > 30 || Math.abs(p.y) > 30) break
    }
    return null
  }

  function update(ai, dt) {
    const player = ai.player
    const ballState = content.ball.getState()

    if (ai.cooldown > 0) ai.cooldown -= dt

    const onMySide = ai.player.side === 'south'
      ? content.ball.getPosition().y > 0
      : content.ball.getPosition().y < 0

    // Move toward predicted landing if the ball is heading our way.
    let target = null
    const pred = predictLanding(player.side)
    if (pred) {
      // Add some aim noise so the AI isn't pixel-perfect.
      target = {
        x: pred.x + (Math.random() - 0.5) * ai.aimErrorM,
        y: pred.y + (Math.random() - 0.5) * 0.6,
      }
    }

    // Fallback: hold middle baseline.
    if (!target) {
      target = {
        x: 0,
        y: player.side === 'south' ? COURT().COURT_HALF_LENGTH - 1.0 : -COURT().COURT_HALF_LENGTH + 1.0,
      }
    }

    // Move toward target.
    const dx = target.x - player.x
    const dy = target.y - player.y
    const dist = Math.sqrt(dx*dx + dy*dy)
    if (dist > 0.15) {
      const ux = dx / dist, uy = dy / dist
      // Footwork scaling — easier AIs run slower.
      player.move(ux * ai.footworkScale, uy * ai.footworkScale, dt)
    } else {
      // Idle small jitter
      player.move(0, 0, dt)
    }

    // Swing the moment the ball enters the strike zone. The ball
    // crosses the zone in a fraction of a second at rally pace; any
    // pre-scheduled lag means it's already past us when the swing
    // actually fires. The "reaction" is already absorbed by walking
    // toward the prediction, so once it's in reach we commit.
    if (onMySide && (ballState === 'inFlight' || ballState === 'bounced')
        && ai.cooldown <= 0
        && content.ball.getBouncesSinceHit() <= 1
        && player.distanceToBall() < content.player.STRIKE_RADIUS) {
      const b = content.ball.getPosition()
      const xRel = b.x - player.x
      const z = b.z
      let kind = xRel >= 0 ? 'forehand' : 'backhand'
      if (z > 1.5 && Math.abs(b.y) < 5) kind = 'smash'
      content.match.requestSwing(player.side, kind)
      ai.cooldown = 0.25
      return
    }

    // Serve when waiting on it (kept on a small delay so it doesn't
    // feel robotic).
    if (ballState === 'idle' && content.scoring.getServer() === player.side && ai.cooldown <= 0) {
      if (!ai.pendingDecision) {
        ai.pendingDecision = {action: 'serve', at: engine.time() + 0.6 + Math.random() * 0.7}
      }
    }

    if (ai.pendingDecision && engine.time() >= ai.pendingDecision.at) {
      const action = ai.pendingDecision.action
      ai.pendingDecision = null
      if (action === 'serve') {
        content.match.requestServe(player.side)
        ai.cooldown = 0.5
      }
    }
  }

  return {
    create,
    update,
    predictLanding,
  }
})()
