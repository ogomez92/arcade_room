// The opponent mallet. Symmetric to your mallet but confined to the far half
// (north of the centre line), driven by a small state machine instead of input.
//
// It reads the puck through a REACTION-DELAY ring buffer — it sees the puck N
// frames in the past (N per difficulty), so a fast shot beats a slow reader.
// Defends by tracking the puck's projected crossing of a defensive line;
// attacks with a TELEGRAPHED strike: an audible wind-up (it pulls in behind the
// puck, emitting 'telegraph') then a drive that scripts the puck toward your
// goal at the difficulty's shot power. The wind-up length shrinks with
// difficulty, so a higher CPU gives you less warning.
//
// Why the strike scripts the puck instead of relying on momentum transfer: the
// mallet's top speed (≤ 2.8 m/s) can't impart the 4.6–6.6 m/s shots the design
// calls for through a (1+e) bounce alone. The player's shots ARE pure momentum
// (drive through, no button); the CPU's are a telegraphed scripted strike —
// matching the design's asymmetry. Non-strike contacts (the puck glancing off a
// defending mallet) still go through physics' momentum transfer normally.
content.ai = (() => {
  const K = () => content.constants

  let x = 0, y = 0
  let vx = 0, vy = 0
  let mode = 'defend'        // 'defend' | 'windup' | 'drive'
  let windupTimer = 0
  let driveTimer = 0
  let cooldown = 0
  let aimX = 0               // committed strike aim (x on your goal line), set at windup
  let defenseError = 0       // per-shot defensive mis-read (scaled by mistake)
  let lastVyNeg = false      // edge-detect a fresh shot toward the AI goal

  // Reaction-delay ring buffer of recent puck states.
  const BUF = 240
  const buf = new Array(BUF)
  let head = 0, count = 0

  function pushPuck(s) {
    buf[head] = { x: s.x, y: s.y, vx: s.vx, vy: s.vy }
    head = (head + 1) % BUF
    if (count < BUF) count++
  }
  function delayedPuck() {
    const params = content.game.difficultyParams()
    const d = Math.min(params.reactionFrames, count - 1)
    if (count === 0) return content.puck.getState()
    const idx = (head - 1 - d + BUF) % BUF
    return buf[idx]
  }

  function approach(cur, target, maxDelta) {
    if (cur < target) return Math.min(cur + maxDelta, target)
    if (cur > target) return Math.max(cur - maxDelta, target)
    return cur
  }

  // Move the mallet toward a target point at this difficulty's kinematics, with
  // displacement-reconciled velocity (so a wall kills the into-wall component
  // and momentum transfer stays honest), confined to the opponent half.
  function moveToward(tx, ty, dt, gain) {
    const k = K()
    const params = content.game.difficultyParams()
    const maxSpeed = params.malletMaxSpeed
    const accel = params.malletAccel
    let dx = tx - x, dy = ty - y
    const dl = Math.hypot(dx, dy)
    // Ease within 4 cm so it settles instead of jittering on the target.
    const mag = Math.min(1, dl / 0.04) * (gain == null ? 1 : gain)
    const ux = dl > 1e-6 ? dx / dl : 0
    const uy = dl > 1e-6 ? dy / dl : 0
    const targetVx = ux * maxSpeed * mag
    const targetVy = uy * maxSpeed * mag
    const rate = accel * dt
    vx = approach(vx, targetVx, rate)
    vy = approach(vy, targetVy, rate)
    const sp = Math.hypot(vx, vy)
    if (sp > maxSpeed) { const f = maxSpeed / sp; vx *= f; vy *= f }
    const ox = x, oy = y
    const cand = content.table.clampToOppHalf(x + vx * dt, y + vy * dt, k.MALLET_RADIUS)
    x = cand.x; y = cand.y
    vx = (x - ox) / dt
    vy = (y - oy) / dt
  }

  function defensiveLineY() {
    const k = K()
    const params = content.game.difficultyParams()
    // interceptBias 0 → at own goal, 1 → at the centre line.
    return k.MALLET_RADIUS + params.interceptBias * (k.LENGTH / 2 - 2 * k.MALLET_RADIUS)
  }

  // Predicted puck x where it crosses the defensive line, folded for side-wall
  // banks. Adds aim error scaled by the difficulty's mistake rate.
  function predictDefenseX(dp) {
    const k = K()
    const lineY = defensiveLineY()
    let px = k.WIDTH / 2
    if (dp.vy < -1e-3 && dp.y > lineY) {
      const t = (dp.y - lineY) / (-dp.vy)
      const raw = dp.x + dp.vx * t
      const W = k.WIDTH
      const m = ((raw % (2 * W)) + 2 * W) % (2 * W)
      px = m <= W ? m : 2 * W - m
    } else {
      px = dp.x // shadow the puck's x while it dawdles on the AI half
    }
    return px + defenseError
  }

  // Reroll the defensive mis-read whenever a fresh shot starts toward the AI
  // goal. Higher mistake → larger offset → the AI concedes more (most on Easy).
  function updateDefenseError(dp) {
    const neg = dp.vy < -0.05
    if (neg && !lastVyNeg) {
      const params = content.game.difficultyParams()
      // Magnitude scaled so even Hard occasionally mis-reads beyond mallet reach
      // (giving the player scoring chances); Easy concedes often.
      defenseError = (Math.random() - 0.5) * params.mistake * 1.7
    }
    lastVyNeg = neg
  }

  function strikeReachX() { return (K().MALLET_RADIUS + K().PUCK_RADIUS) + 0.14 }

  // Decide whether to commit to a strike THIS frame. The wind-up is timed so it
  // completes just as the puck arrives at the defensive line: commit when the
  // puck is ~telegraphTime away (and we're roughly x-aligned), or immediately
  // for a slow puck dawdling on the AI half (a serve). All off the delayed read,
  // so a high reaction delay mis-times the commit → whiffs → you score.
  function wantsStrike(dp) {
    const k = K()
    if (cooldown > 0) return false
    const params = content.game.difficultyParams()
    const tele = params.telegraphFrames / 60
    const reach = strikeReachX()
    const tx = predictDefenseX(dp)
    const aligned = Math.abs(tx - x) < reach + 0.12
    if (dp.vy < -0.05) { // incoming toward the AI goal
      const T = (dp.y - defensiveLineY()) / (-dp.vy)
      return T > 0 && T <= tele + 0.04 && dp.y < k.LENGTH / 2 + 0.06 && aligned
    }
    // Slow / outgoing on the AI half — strike the sitting puck (serve).
    return dp.y < k.LENGTH / 2 - k.PUCK_RADIUS && Math.hypot(dp.vx, dp.vy) < 1.3 &&
      Math.abs(dp.x - x) < reach + 0.12
  }

  function beginWindup() {
    const k = K()
    const params = content.game.difficultyParams()
    mode = 'windup'
    windupTimer = params.telegraphFrames / 60
    // Aim at the OPEN side of your goal — the corner away from your mallet —
    // because shooting where the defender sits never scores. Mistake can flip
    // the read to the wrong side or scatter it toward centre.
    const { x0, x1 } = content.table.goalX()
    const margin = k.PUCK_RADIUS * 1.3
    const playerX = content.mallet.getPosition().x
    let aim
    if (Math.random() < params.mistake) {
      aim = k.WIDTH / 2 + (Math.random() - 0.5) * (x1 - x0) // misjudge
    } else {
      aim = playerX < k.WIDTH / 2 ? (x1 - margin) : (x0 + margin)
    }
    aim += (Math.random() - 0.5) * (x1 - x0) * params.mistake
    aimX = Math.max(x0 + margin * 0.5, Math.min(x1 - margin * 0.5, aim))
    content.events.emit('telegraph', { x, y, level: 1 - params.telegraphFrames / 40 })
  }

  function doStrike() {
    const k = K()
    const params = content.game.difficultyParams()
    const p = content.puck.getState()
    // Aim from the puck toward the committed point on your goal line.
    let dx = aimX - p.x
    let dy = k.LENGTH - p.y
    const dl = Math.hypot(dx, dy) || 1
    const ux = dx / dl, uy = dy / dl
    // Lift the puck clear of the mallet so physics doesn't re-collide this frame.
    const sep = k.MALLET_RADIUS + k.PUCK_RADIUS + 1e-3
    content.puck.setPosition(x + ux * sep, y + uy * sep)
    content.puck.setVelocity(ux * params.shotPower, uy * params.shotPower)
    content.events.emit('malletHit', { who: 'opp', x: p.x, y: p.y, speed: params.shotPower, drive: params.shotPower })
    cooldown = 0.45
    mode = 'defend'
  }

  return {
    getPosition: () => ({ x, y }),
    getBody: () => ({ x, y, vx, vy, r: content.constants.MALLET_RADIUS }),
    getMode: () => mode,
    // The committed strike target on your goal line, exposed only while the
    // strike is telegraphing/driving. A skilled player reads this "tell" from
    // the CPU's wind-up; nulls otherwise.
    getAimX: () => (mode === 'windup' || mode === 'drive') ? aimX : null,

    update: (dt) => {
      const k = K()
      const live = content.puck.isLive()
      const cur = content.puck.getState()
      pushPuck(cur)
      if (cooldown > 0) cooldown = Math.max(0, cooldown - dt)
      const dp = delayedPuck()
      updateDefenseError(dp)

      if (!live) {
        // Between points: drift home (centre of the AI half, near the goal).
        moveToward(k.WIDTH / 2, defensiveLineY(), dt, 0.6)
        mode = 'defend'
        return
      }

      if (mode === 'defend') {
        if (wantsStrike(dp)) { beginWindup(); return }
        // Track the puck's projected crossing of the defensive line.
        moveToward(predictDefenseX(dp), defensiveLineY(), dt)
        return
      }

      if (mode === 'windup') {
        // Hold on the crossing x at the line so the puck arrives onto the mallet
        // as the wind-up ends.
        moveToward(predictDefenseX(dp), defensiveLineY(), dt)
        windupTimer -= dt
        if (windupTimer <= 0) { mode = 'drive'; driveTimer = 0.3 }
        return
      }

      if (mode === 'drive') {
        // Chase the REAL puck to ensure contact, then script the strike.
        moveToward(cur.x, cur.y, dt)
        const reach = (k.MALLET_RADIUS + k.PUCK_RADIUS) * 1.2
        if (Math.hypot(cur.x - x, cur.y - y) <= reach) { doStrike(); return }
        driveTimer -= dt
        if (driveTimer <= 0) { mode = 'defend'; cooldown = 0.15 } // whiffed — beatable
        return
      }
    },

    reset: () => {
      const k = content.constants
      x = k.WIDTH / 2
      y = k.LENGTH * 0.18
      vx = 0; vy = 0
      mode = 'defend'
      windupTimer = 0; driveTimer = 0; cooldown = 0
      head = 0; count = 0
    },
  }
})()
