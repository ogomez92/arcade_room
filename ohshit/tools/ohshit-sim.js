// Headless balance sim for OH SHIT! Loads the real content modules and drives
// them with skill-parameterized bots.
//
// Mistake model: each threat gets ONE skill roll when first seen, and the fail
// chance is PRESSURE-SCALED — a lone slow cannonball almost never kills a
// decent player; overlapping threats are what kill (rover/airlift lesson:
// re-rolling per frame or flat per-threat failure makes the gradient lie).
'use strict'
const fs = require('fs')
const path = require('path')

global.content = {}
const SRC = '/home/gst/new/src/js/content'
for (const f of ['constants.js', 'events.js', 'game.js', 'runner.js']) {
  eval(fs.readFileSync(path.join(SRC, f), 'utf8'))
}
const K = content.constants

const DT = 1 / 30

function pressureFactor(n) { return n <= 1 ? 0.35 : n === 2 ? 0.8 : 1.2 }

// ---- main-mode bot ----
function playMain(skill, maxSeconds, log) {
  content.events.clear()
  if (log) for (const ev of ['storm-start', 'storm-survived', 'pickup-power', 'death']) {
    content.events.on(ev, (e) => console.log('  EV', ev, JSON.stringify(e || {})))
  }
  content.game.reset()
  const g = content.game
  const rolls = new Map()

  let t = 0
  while (g.phase() !== 'gameover' && t < maxSeconds) {
    const snap = g.snapshot()
    const px = snap.player.x
    const grounded = !snap.player.airborne

    // pressure = how many things demand attention right now
    let pressure = 0
    for (const b of snap.balls) if ((px - b.x) * b.dir > 0 && Math.abs(b.x - px) < 7) pressure++
    for (const r of snap.rocks) if (Math.abs(r.col - px) < 3 && r.frac > 0.3) pressure++
    for (const p of snap.pits) if (p.state === 'warning' && px > p.lo - 0.6 && px < p.hi + 0.6) pressure++
    const factor = pressureFactor(pressure)
    function roll(key, baseSkill) {
      if (!rolls.has(key)) {
        const fail = Math.min(0.95, (1 - baseSkill) * factor)
        rolls.set(key, Math.random() >= fail)
      }
      return rolls.get(key)
    }

    // 1. rock about to land on us?
    let fleeDir = 0
    for (const r of snap.rocks) {
      if (Math.abs(r.col - px) < 1.4 && r.frac > 0.4) {
        if (roll('rock' + r.id, skill)) fleeDir = px <= r.col ? -1 : 1
      }
    }

    // 2. ball to jump?
    let wantJump = false
    for (const b of snap.balls) {
      const d = Math.abs(b.x - px)
      const closing = (px - b.x) * b.dir > 0
      if (!closing) continue
      if (roll('ball' + b.id, skill)) {
        if (d < 2.6) wantJump = true
      } else if (d < 5 && Math.random() < 0.04) {
        wantJump = true // mistimed panic jump
      }
    }

    // 3. crumbling floor underfoot?
    for (const p of snap.pits) {
      const inside = px > p.lo - 0.6 && px < p.hi + 0.6
      if (p.state === 'warning' && inside) {
        if (roll('warn' + p.id, 0.5 + 0.5 * skill)) fleeDir = fleeDir || (px - p.lo < p.hi - px ? -1 : 1)
      }
    }

    // 4. walk toward the nearest noticed item, jumping open pits on the way
    // (noticing an item under pressure is itself a skill)
    let dir = fleeDir
    if (!dir) {
      let target = null
      for (const it of snap.items) {
        if (!roll('see' + it.id, 0.4 + 0.6 * skill)) continue
        const d = Math.abs(it.col - px)
        if (!target || d < target.d) target = {col: it.col, d}
      }
      if (target && target.d > 0.2) dir = target.col > px ? 1 : -1
      else if (!target) dir = px < 8 ? 1 : px > K.BOARD_W - 8 ? -1 : 0
    }
    if (dir !== 0 && grounded) {
      for (const p of snap.pits) {
        if (p.state !== 'open') continue
        const nearEdge = dir > 0 ? p.lo - px : px - p.hi
        if (nearEdge > 0 && nearEdge < 1.5) {
          if (roll('cross' + p.id + ':' + Math.floor(t / 4), skill)) {
            wantJump = true
            if (nearEdge < 0.9) dir = 0 // stop at the lip so a refused jump can't walk you in
          } else dir = 0 // balk at the edge
        }
      }
    }

    // air control: while airborne, steer so the landing spot is not inside an
    // open pit (a real player hears the wind right under them and corrects)
    if (!grounded && roll('aircontrol', 0.5 + 0.5 * skill)) {
      const spd = K.WALK_SPEED * (snap.player.speed > 0 ? K.SUPER_SPEED_MULT : 1)
      const lands = (d) => px + d * spd * snap.player.airTimer
      const inPit = (x) => snap.pits.some((p) => p.state === 'open' && x > p.lo - 0.5 && x < p.hi + 0.5)
      if (inPit(lands(dir))) {
        for (const alt of [1, -1, 0]) if (!inPit(lands(alt))) { dir = alt; break }
      }
    }

    g.setMove(dir)
    if (wantJump && grounded) g.jump()
    g.update(DT)
    t += DT
  }
  return {
    over: g.phase() === 'gameover',
    score: g.state.score,
    time: Math.floor(g.state.elapsed),
    covers: g.state.covers,
    jumped: g.state.jumpedThisGame,
  }
}

// ---- runner bot ----
function playRunner(skill, maxSeconds) {
  content.events.clear()
  let dqFlag = false
  content.events.on('r-dq', () => { dqFlag = true })
  content.runner.startRun(false)
  const r = content.runner
  const rolls = new Map()

  let t = 0
  while (r.phase() !== 'over' && t < maxSeconds) {
    const snap = r.snapshot()
    const px = snap.player.x
    const grounded = !snap.player.airborne

    let pressure = 0
    for (const b of snap.balls) if (b.x - px > 0 && b.x - px < 8) pressure++
    for (const p of snap.pits) if (p.lo - px > 0 && p.lo - px < 5) pressure++
    for (const rk of snap.rocks) if (rk.col - px > -0.5 && rk.col - px < 4 && rk.frac > 0.3) pressure++
    const factor = pressureFactor(pressure)
    function roll(key, baseSkill, f) {
      if (!rolls.has(key)) {
        const fail = Math.min(0.95, (1 - baseSkill) * (f != null ? f : factor))
        rolls.set(key, Math.random() >= fail)
      }
      return rolls.get(key)
    }

    let dir = 1
    let wantJump = false

    // pits ahead (the wind is audible early — base fail is low). The skilled
    // move: if an oncoming ball would catch you in jump-recovery, STOP and let
    // it pass before committing to the pit jump (unless the chaser is on you).
    const chaserGap = px - snap.chaser.x
    for (const p of snap.pits) {
      const d = p.lo - px
      if (d > 0 && d < 4 && grounded) {
        const ballNear = snap.balls.some((b) => b.x - px > 0 && b.x - px < 6)
        if (ballNear && chaserGap > 3 && roll('wait' + p.lo + 'L' + r.state.level, skill, 0.5)) {
          dir = 0 // hold short of the pit until the ball is dealt with
        }
      }
      if (d > 0 && d < 1.4 && grounded) {
        if (roll('pit' + p.lo + 'L' + r.state.level, skill, factor * 0.6)) wantJump = true
        else if (Math.random() < 0.5) wantJump = true // late scramble
        if (wantJump && d < 0.9) dir = 0 // stop at the lip; a refused jump must not walk you in
      }
    }
    // air control: don't run mid-air into a pit you can land short of
    if (!grounded && roll('aircontrolL' + r.state.level, 0.5 + 0.5 * skill)) {
      const lands = (d) => px + d * K.RUNNER_SPEED * snap.player.airTimer
      const inPit = (x) => snap.pits.some((p) => x > p.lo - 0.5 && x < p.hi + 0.5)
      if (inPit(lands(dir))) {
        for (const alt of [1, 0, -1]) if (!inPit(lands(alt))) { dir = alt; break }
      }
    }
    // oncoming balls
    for (const b of snap.balls) {
      const d = b.x - px
      if (d > 0 && d < 2.4) {
        if (roll('ball' + b.id, skill)) wantJump = true
      }
    }
    // rocks ahead: stop and wait out the impact
    for (const rk of snap.rocks) {
      const d = rk.col - px
      if (d > -0.5 && d < 2.6 && rk.frac > 0.45) {
        if (roll('rock' + rk.id, skill)) dir = 0
      }
    }

    r.setMove(dir)
    if (wantJump && grounded) r.jump()
    r.update(DT)
    t += DT
  }
  return {
    over: r.phase() === 'over',
    steps: Math.floor(r.state.steps),
    level: r.state.level,
    dq: dqFlag,
    time: Math.floor(r.state.elapsed),
  }
}

// ---- experiments ----
function stats(arr) {
  const a = arr.slice().sort((x, y) => x - y)
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length
  return {mean: Math.round(mean), med: a[Math.floor(a.length / 2)], min: a[0], max: a[a.length - 1]}
}

const N = parseInt(process.argv[2] || '40', 10)

console.log('=== STORM SANITY (forced early storms) ===')
{
  const savedMin = K.STORM_MIN_ELAPSED, savedChance = K.POWERUP_CHANCE, savedW = {...K.POWERUP_WEIGHTS}
  K.STORM_MIN_ELAPSED = 5
  K.POWERUP_CHANCE = 0.6
  K.POWERUP_WEIGHTS.superSpeed = 0; K.POWERUP_WEIGHTS.invincibility = 0; K.POWERUP_WEIGHTS.pitCover = 0; K.POWERUP_WEIGHTS.rockStorm = 1
  let starts = 0, survives = 0
  content.events.clear()
  for (let i = 0; i < 10; i++) {
    content.events.clear()
    content.events.on('storm-start', () => starts++)
    content.events.on('storm-survived', () => survives++)
    playMainQuiet(0.95, 240)
  }
  console.log(`storms started ${starts}, survived ${survives}`)
  K.STORM_MIN_ELAPSED = savedMin
  K.POWERUP_CHANCE = savedChance
  Object.assign(K.POWERUP_WEIGHTS, savedW)
}
function playMainQuiet(skill, maxSeconds) {
  // same bot, but without clearing listeners registered by the caller
  const g = content.game
  g.reset()
  const rolls = new Map()
  let t = 0
  while (g.phase() !== 'gameover' && t < maxSeconds) {
    const snap = g.snapshot()
    const px = snap.player.x
    const grounded = !snap.player.airborne
    let pressure = 0
    for (const b of snap.balls) if ((px - b.x) * b.dir > 0 && Math.abs(b.x - px) < 7) pressure++
    for (const r of snap.rocks) if (Math.abs(r.col - px) < 3 && r.frac > 0.3) pressure++
    const factor = pressureFactor(pressure)
    function roll(key, baseSkill) {
      if (!rolls.has(key)) rolls.set(key, Math.random() >= Math.min(0.95, (1 - baseSkill) * factor))
      return rolls.get(key)
    }
    let fleeDir = 0
    for (const r of snap.rocks) if (Math.abs(r.col - px) < 1.4 && r.frac > 0.4 && roll('rock' + r.id, skill)) fleeDir = px <= r.col ? -1 : 1
    let wantJump = false
    for (const b of snap.balls) {
      const d = Math.abs(b.x - px)
      if ((px - b.x) * b.dir > 0 && roll('ball' + b.id, skill) && d < 2.6) wantJump = true
    }
    let dir = fleeDir
    if (!dir) {
      let target = null
      for (const it of snap.items) { const d = Math.abs(it.col - px); if (!target || d < target.d) target = {col: it.col, d} }
      if (target && target.d > 0.2) dir = target.col > px ? 1 : -1
    }
    if (dir !== 0 && grounded) {
      for (const p of snap.pits) {
        if (p.state !== 'open') continue
        const nearEdge = dir > 0 ? p.lo - px : px - p.hi
        if (nearEdge > 0 && nearEdge < 1.5) { if (roll('cross' + p.id, skill)) wantJump = true; else dir = 0 }
      }
    }
    g.setMove(dir)
    if (wantJump && grounded) g.jump()
    g.update(DT)
    t += DT
  }
}

console.log('=== MAIN MODE (cap 30 min) ===')
for (const skill of [0.3, 0.5, 0.7, 0.85, 0.95]) {
  const scores = [], times = []
  let unbounded = 0
  for (let i = 0; i < N; i++) {
    const res = playMain(skill, 1800)
    if (!res.over) unbounded++
    scores.push(res.score); times.push(res.time)
  }
  console.log(`skill ${skill}: score ${JSON.stringify(stats(scores))} time ${JSON.stringify(stats(times))} unbounded ${unbounded}/${N}`)
}

console.log('=== RUNNER (cap 20 min) ===')
for (const skill of [0.3, 0.5, 0.7, 0.85, 0.95]) {
  const steps = [], levels = []
  let unbounded = 0, dqs = 0, lvl1 = 0
  for (let i = 0; i < N; i++) {
    const res = playRunner(skill, 1200)
    if (!res.over) unbounded++
    if (res.dq) dqs++
    if (res.level >= 2) lvl1++
    steps.push(res.steps); levels.push(res.level)
  }
  console.log(`skill ${skill}: steps ${JSON.stringify(stats(steps))} level ${JSON.stringify(stats(levels))} clearedL1 ${lvl1}/${N} unbounded ${unbounded}/${N} dq ${dqs}`)
}
