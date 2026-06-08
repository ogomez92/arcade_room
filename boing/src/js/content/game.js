// Real-time bounce logic for ALOFT.
//
// You bounce upward forever; gravity hauls you back down. The ONLY steering is
// left/right — you slide sideways to line up with the platform you're about to
// fall onto, so you land on it and bounce higher. Land aligned -> boing, climb
// on. Drift off and fall past every platform below the trailing floor -> you
// plummet and the run ends. Springs launch you far; moving pads drift; breakable
// pads vanish after one use; floating sentinels guard the air above some pads —
// shoot them or steer wide. Score is the height you climb plus what you shoot.
//
// This module owns state and emits events; the game screen turns events into
// audio + screen-reader announcements. Audio is the source of truth.
content.game = (() => {
  const K = () => content.constants
  const E = () => content.events

  const state = {
    phase: 'play', // play | gameover-pending | gameover
    score: 0,
    level: 1,
    combo: 0,
    bestCombo: 0,
    height: 0,     // greatest y reached (the base score)
    elapsed: 0,
    bounces: 0, shot: 0,
  }

  let platforms = []
  let enemies = []
  let nextId = 1
  let nextEnemyId = 1
  let lastGen = null

  let px = 0, py = 0, vx = 0, vy = 0
  let steerDir = 0
  let shootCd = 0
  let floor = 0
  let targetId = -1
  let distScored = 0
  let guideAt = 0, sentinelAt = 0
  let phaseTimer = 0, overDone = false

  const G = () => K().GRAVITY
  const HW = () => K().HALF_WIDTH
  function clampX(x) { return Math.max(-HW(), Math.min(HW(), x)) }
  function mult() { return K().comboMultiplier(state.combo) }
  function byId(id) { for (const p of platforms) if (p.id === id) return p; return null }

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.level = 1
    state.combo = 0
    state.bestCombo = 0
    state.height = 0
    state.elapsed = 0
    state.bounces = 0; state.shot = 0
    platforms = []
    enemies = []
    nextId = 1; nextEnemyId = 1
    px = 0; py = 0; vx = 0; vy = K().BOUNCE_VEL // launch off the start pad
    steerDir = 0; shootCd = 0
    distScored = 0
    guideAt = 0; sentinelAt = 0
    phaseTimer = 0; overDone = false

    // start pad under the player, then a chain of platforms above
    const start = {id: nextId++, baseX: 0, x: 0, y: 0, type: 'normal', half: 1.1, broken: false, moveAmp: 0, movePhase: 0, moveSpeed: 0}
    platforms.push(start)
    lastGen = start
    for (let i = 0; i < 9; i++) genNext()
    floor = -K().FALL_MARGIN
    retarget(true)
    E().emit('run-start', {})
  }

  // ---- field generation ------------------------------------------------------
  function genNext() {
    const c = K().levelConfig(K().levelFor(lastGen.y))
    const gap = c.rungGap * (0.86 + Math.random() * 0.14)
    const ny = lastGen.y + gap
    const off = (Math.random() * 2 - 1) * c.maxOffset
    const nx = clampX(lastGen.baseX + off)
    const r = Math.random()
    let type = 'normal'
    if (r < c.springChance) type = 'spring'
    else if (r < c.springChance + c.movingChance) type = 'moving'
    else if (r < c.springChance + c.movingChance + c.breakChance) type = 'breakable'
    const pad = {
      id: nextId++, baseX: nx, x: nx, y: ny, type,
      half: c.padHalf, broken: false,
      moveAmp: type === 'moving' ? (0.6 + Math.random() * 0.7) : 0,
      movePhase: Math.random() * 6.283,
      moveSpeed: c.moveSpeed,
    }
    platforms.push(pad)
    lastGen = pad
    // a sentinel may guard the air just above this pad (not on the first rungs)
    if (ny > 11 && type !== 'spring' && Math.random() < c.enemyChance) {
      enemies.push({id: nextEnemyId++, x: nx, y: ny + 1.3, alive: true})
    }
  }

  function cull() {
    const low = floor - 6
    platforms = platforms.filter((p) => p.y >= low || p === lastGen)
    enemies = enemies.filter((e) => e.alive && e.y >= low)
  }

  // ---- targeting -------------------------------------------------------------
  // After a bounce: aim for the highest platform reachable below this apex (so a
  // spring is used to climb far). On a miss (fallen below the target unaligned):
  // re-acquire the best pad at or below you to recover.
  function setTargetByApex() {
    const apexY = py + (vy * vy) / (2 * G())
    let best = null
    for (const p of platforms) {
      if (p.broken) continue
      if (p.y > py + 0.05 && p.y <= apexY - 0.05) {
        if (!best || p.y > best.y) best = p
      }
    }
    if (!best) { // fallback: nearest above
      for (const p of platforms) {
        if (p.broken || p.y <= py + 0.05) continue
        if (!best || p.y < best.y) best = p
      }
    }
    targetId = best ? best.id : -1
  }

  function retarget(force) {
    let tp = byId(targetId)
    if (force || !tp || (vy < 0 && py < tp.y - 0.2)) {
      // recover: catch the highest pad at or below us (above the floor)
      let best = null
      for (const p of platforms) {
        if (p.broken) continue
        if (p.y <= py + 0.1 && p.y > floor) {
          if (!best || p.y > best.y) best = p
        }
      }
      if (best) targetId = best.id
      else if (!tp) { // nothing below either; keep nearest above so audio still points somewhere
        for (const p of platforms) {
          if (p.broken || p.y <= py) continue
          if (!best || p.y < best.y) best = p
        }
        if (best) targetId = best.id
      }
    }
  }

  // ---- player actions --------------------------------------------------------
  function setSteer(dir) { steerDir = dir < 0 ? -1 : (dir > 0 ? 1 : 0) }

  function shoot() {
    if (state.phase !== 'play') return
    if (shootCd > 0) return
    shootCd = K().SHOOT_COOLDOWN
    let target = null
    for (const e of enemies) {
      if (!e.alive) continue
      if (e.y > py - 1 && e.y - py < 6 && Math.abs(e.x - px) <= K().SHOOT_PAN_TOL) {
        if (!target || e.y < target.y) target = e // nearest above
      }
    }
    if (target) {
      target.alive = false
      const gained = Math.round(K().ENEMY_SCORE * mult())
      state.score += gained
      state.shot++
      E().emit('shoot', {hit: true, dx: target.x - px, gained})
    } else {
      E().emit('shoot', {hit: false, dx: 0})
    }
  }

  // ---- bounce ----------------------------------------------------------------
  function land(p) {
    py = p.y
    state.combo++
    if (state.combo > state.bestCombo) state.bestCombo = state.combo
    state.bounces++
    let spring = false
    if (p.type === 'spring') {
      vy = K().BOUNCE_VEL * K().SPRING_MULT
      const gained = Math.round(K().SPRING_BONUS * mult())
      state.score += gained
      spring = true
    } else {
      vy = K().BOUNCE_VEL
    }
    E().emit('bounce', {type: p.type, dx: p.x - px, combo: state.combo, spring})
    if (p.type === 'breakable') { p.broken = true; E().emit('break', {dx: p.x - px}) }
    if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
    setTargetByApex()
  }

  function beginGameOver(reason) {
    if (state.phase !== 'play') return
    state.phase = 'gameover-pending'
    phaseTimer = 1.3
    overDone = false
    E().emit('doom', {reason})
  }

  function bumpLevel() {
    const target = K().levelFor(state.height)
    if (target > state.level) {
      state.level = target
      const bonus = K().levelBonus(state.level)
      state.score += bonus
      E().emit('level-up', {level: state.level, bonus})
    }
  }

  // time until py next reaches a given y under current ballistics (for tick rate)
  function timeToY(ty) {
    const a = 0.5 * G(), b = -vy, cc = (ty - py)
    const disc = b * b - 4 * a * cc
    if (disc < 0) return 1.2
    const sq = Math.sqrt(disc)
    const t = Math.max((-b - sq) / (2 * a), (-b + sq) / (2 * a))
    if (t <= 0) return 1.2
    return Math.min(1.2, t)
  }

  function update(delta) {
    if (state.phase === 'play') {
      state.elapsed += delta
      bumpLevel()

      // moving pads drift; refresh their x before landing + audio use it
      for (const p of platforms) {
        if (p.moveAmp) p.x = clampX(p.baseX + Math.sin(state.elapsed * p.moveSpeed + p.movePhase) * p.moveAmp)
      }

      // steering: ease vx toward dir*STEER_MAX
      const targetVx = steerDir * K().STEER_MAX
      vx += (targetVx - vx) * Math.min(1, K().STEER_RESPONSE * delta)
      // gravity
      vy -= G() * delta

      const prevY = py
      const newY = py + vy * delta
      const newX = clampX(px + vx * delta)

      // landing: only while descending, on the highest aligned pad we cross
      let landed = null
      if (vy < 0) {
        const lo = newY, hi = prevY + 0.001
        let best = null
        for (const p of platforms) {
          if (p.broken) continue
          if (p.y >= lo && p.y <= hi && Math.abs(newX - p.x) <= p.half) {
            if (!best || p.y > best.y) best = p
          }
        }
        landed = best
      }

      px = newX
      if (landed) { land(landed) } // sets py + vy
      else { py = newY }

      // sentinel collisions (you flew into a live one)
      for (const e of enemies) {
        if (!e.alive) continue
        const dx = e.x - px, dy = e.y - py
        if (dx * dx + dy * dy < K().ENEMY_RADIUS * K().ENEMY_RADIUS) {
          beginGameOver('hit')
          E().emit('enemy-hit', {dx})
          break
        }
      }
      if (state.phase !== 'play') return

      // height / score / floor
      if (py > state.height) state.height = py
      const whole = Math.floor(state.height)
      if (whole > distScored) { state.score += (whole - distScored); distScored = whole }
      // rising void: creeps up at floorRate, snaps to FALL_MARGIN below your peak
      // when you climb — so dwelling at a height is fatal within a few seconds.
      floor = Math.max(floor + K().floorRate(state.level) * delta, state.height - K().FALL_MARGIN)

      // fell past everything
      if (py < floor) { beginGameOver('fell'); E().emit('fall', {}); return }

      // keep the chain stocked above and prune below
      while (lastGen.y < py + 16) genNext()
      cull()

      // re-acquire target on a miss / cull
      retarget(false)

      // guidance tick for the platform you're aiming at
      const tp = byId(targetId)
      if (tp && state.elapsed >= guideAt) {
        const ttl = timeToY(tp.y)
        E().emit('guide', {dx: tp.x - px, ttl, type: tp.type, dy: tp.y - py})
        guideAt = state.elapsed + K().tickInterval(ttl)
      }

      // sentinel tick for the nearest live one above within range
      let near = null
      for (const e of enemies) {
        if (!e.alive) continue
        if (e.y > py - 1 && e.y - py < 5) { if (!near || e.y < near.y) near = e }
      }
      if (near && state.elapsed >= sentinelAt) {
        E().emit('sentinel', {dx: near.x - px, dy: near.y - py})
        sentinelAt = state.elapsed + 0.18
      }
      return
    }

    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) {
        overDone = true
        state.phase = 'gameover'
        E().emit('game-over', {score: state.score, height: Math.floor(state.height), level: state.level})
      }
    }
  }

  // ---- readouts for the screen (F2 scan + viz) -------------------------------
  function guidance() {
    const tp = byId(targetId)
    if (!tp) return null
    return {dx: tp.x - px, dy: tp.y - py, ttl: timeToY(tp.y), type: tp.type}
  }

  function nearestEnemy() {
    let near = null
    for (const e of enemies) {
      if (!e.alive) continue
      if (e.y > py - 1 && e.y - py < 8) { if (!near || e.y < near.y) near = e }
    }
    return near ? {dx: near.x - px, dy: near.y - py} : null
  }

  return {
    state,
    reset,
    update,
    setSteer,
    shoot,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    getPlayerX: () => px,
    getPlayerY: () => py,
    getVy: () => vy,
    guidance,
    nearestEnemy,
    // nearby platforms relative to player for the aria-hidden viz
    nearbyPlatforms: () => platforms
      .filter((p) => !p.broken && p.y > floor && Math.abs(p.y - py) < 8)
      .map((p) => ({dx: p.x - px, dy: p.y - py, type: p.type, isTarget: p.id === targetId}))
      .sort((a, b) => Math.abs(a.dy) - Math.abs(b.dy)),
  }
})()
