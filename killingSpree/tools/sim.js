// Headless balance sim for KILLING SPREE. Loads the real content modules and
// drives them with skill-parameterised bots that only "know" what a blind
// player can hear: the engine pan (their own lateral offset), the pacenote
// callouts (a curve's direction/tier a few seconds out), the road voice
// (current curvature) and pedestrians' relative lateral position + distance.
//
//   node tools/sim.js [--seeds N] [--skill 0.7] [--max 900] [--verbose] [--trace] [--seed S]
//
// Skill in [0,1] controls: preferred cruising speed, corner-speed judgement
// error (per curve, one roll), reaction time, aim error, and how greedy the
// bot is about pedestrians in awkward spots.
'use strict'
const fs = require('fs')
const path = require('path')

global.content = {}
const SRC = path.join(__dirname, '..', 'src', 'js', 'content')
for (const f of ['constants.js', 'events.js', 'rng.js', 'road.js', 'car.js', 'peds.js', 'game.js']) {
  eval(fs.readFileSync(path.join(SRC, f), 'utf8'))
}
const K = content.constants

const args = process.argv.slice(2)
function arg(name, def) {
  const i = args.indexOf('--' + name)
  if (i < 0) return def
  const v = args[i + 1]
  return v == null || v.startsWith('--') ? true : v
}
const SEEDS = +arg('seeds', 12)
const MAX_T = +arg('max', 900)
const VERBOSE = !!arg('verbose', false)
const TRACE = !!arg('trace', false)
const ONE_SKILL = arg('skill', null)
const ONE_SEED = arg('seed', null)
const ANALOG = !!arg('analog', false)
const DT = 1 / 60
// --set KEY=val,KEY=val overrides constants for quick tuning passes
const SET = arg('set', null)
if (SET && SET !== true) for (const pair of SET.split(',')) { const [k, v] = pair.split('='); K[k] = +v; console.log('override', k, '=', +v) }

// deterministic bot noise separate from the road RNG
let botSeed = 7
function brand() {
  botSeed = (botSeed * 1664525 + 1013904223) >>> 0
  return botSeed / 4294967296
}
function gauss() { return (brand() + brand() + brand() + brand() - 2) * 1.7 }

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }

function play(skill, seed, log) {
  content.events.clear()
  const known = new Map()   // curve id -> {tier, dir, radius, s0, s1, margin, seenAt}
  const events = []
  const counts = {impacts: 0, callouts: 0, crossers: 0}
  content.events.on('curve-callout', (e) => {
    counts.callouts++
    // a callout can be missed outright (didn't parse it under pressure); the
    // bot then only reacts to the road voice once it is already in the curve
    const heard = brand() >= (1 - skill) * 0.45
    known.set(e.id, {...e, heard, seenAt: content.game.state.t + 0.2 + (1 - skill) * 0.45,
      margin: 0.84 + 0.14 * skill + gauss() * (1 - skill) * 0.3})
  })
  content.events.on('wall-impact', (e) => { counts.impacts++; if (log) events.push(['impact', content.game.state.t.toFixed(1), e.vLat.toFixed(1), e.damage.toFixed(0), e.health.toFixed(0)]) })
  content.events.on('ped-hit', (e) => { if (log) events.push(['hit', content.game.state.t.toFixed(1), e.type, e.combo, e.points, e.health.toFixed(0)]) })
  content.events.on('ped-missed', (e) => { if (log) events.push(['miss', content.game.state.t.toFixed(1), e.type, e.rel.toFixed(1)]) })
  content.events.on('level-up', (e) => { if (log) events.push(['level', content.game.state.t.toFixed(1), e.level]) })
  content.events.on('death', (e) => { if (log) events.push(['death', content.game.state.t.toFixed(1), e.cause]) })
  content.events.on('ped-crossing', () => counts.crossers++)

  content.game.reset(seed)
  const g = content.game
  const car = content.car.state

  const vPrefBase = 30 + 26 * skill
  const reaction = 0.12 + (1 - skill) * 0.28
  let nextDecision = 0
  let steerCmd = 0, throttleCmd = 1
  let target = null
  const aimErr = new Map()
  const greed = 0.45 + 0.55 * skill
  const skipRoll = new Map()
  let t = 0
  let lastLog = 0
  let scrapeT = 0, vSum = 0, vN = 0

  while (g.phase() !== 'gameover' && t < MAX_T) {
    if (t >= nextDecision) {
      nextDecision = t + reaction
      const snap = g.snapshot()
      const c = snap.car
      const now = snap.t

      // ---- speed: next curve the bot knows about ----
      // a driver who is bleeding out pushes harder
      const vPref = vPrefBase + (snap.health < 35 ? 18 : snap.health < 60 ? 10 : 0)
      let vTarget = vPref
      for (const cv of snap.curves) {
        const kn = known.get(cv.id)
        if (cv.s1 < c.s) continue
        const inIt = c.s >= cv.s0
        if (!kn) continue
        if (!inIt && (!kn.heard || now < kn.seenAt)) continue
        if (inIt && now < kn.seenAt) continue
        // inside the curve everyone hears the road voice, but judging the
        // speed it implies is the same skill roll as the callout
        const vSafe = cv.safeSpeed * kn.margin
        if (inIt) { vTarget = Math.min(vTarget, vSafe); continue }
        const brakeDist = Math.max(0, (c.v * c.v - vSafe * vSafe) / (2 * K.BRAKE * 0.8)) + c.v * reaction
        if (cv.dist <= brakeDist + 6) vTarget = Math.min(vTarget, vSafe)
      }
      // tyres screaming: a decent driver lifts, a novice keeps the foot in
      // (a keyboard tap at full lock always chirps; only a real slide in a
      // curve is the signal a driver reacts to)
      let lift = false
      if (c.slip > 0.06 && snap.inCurve && brand() < 0.3 + 0.6 * skill) lift = true
      throttleCmd = lift ? 0 : c.v < vTarget - 1 ? 1 : c.v > vTarget + 1 ? -1 : 0.25

      // ---- target pedestrian ----
      target = null
      for (const p of snap.peds) {
        if (p.dist < 1) continue
        if (p.dist > snap.hearDist) break
        if (!skipRoll.has(p.id)) skipRoll.set(p.id, brand() < greed)
        if (!skipRoll.get(p.id)) continue
        const lateralNeed = Math.abs(p.rel)
        const tta = p.dist / Math.max(c.v, 3)
        const lateralAbility = Math.max(c.v, 3) * 0.22 * tta
        if (lateralNeed > lateralAbility + 0.8) continue
        // the "tough spot" judgement: on the wall side inside a curve, low skill hesitates
        if (Math.abs(p.x) > 3.0 && snap.inCurve && brand() > skill) continue
        target = p
        break
      }
      let xTarget = 0
      if (target) {
        if (!aimErr.has(target.id)) aimErr.set(target.id, gauss() * (1 - skill) * 0.9)
        let px = target.x
        if (target.type === 'crosser') {
          // predict where the crosser will be when we get there
          const tta = target.dist / Math.max(c.v, 3)
          px = target.state === 'crossing' ? target.x + target.vx * tta * (0.6 + 0.4 * skill) : target.x
        }
        xTarget = clamp(px + aimErr.get(target.id), -K.PED_MAX_X, K.PED_MAX_X)
      }

      // ---- steering: track xTarget (the engine pan), feedforward the road
      // voice only as well as skill allows (a novice steers by pan alone) ----
      const v = Math.max(c.v, 3)
      const vxDes = clamp((xTarget - c.x) * 1.4, -0.28 * v, 0.28 * v)
      const psiDes = Math.asin(clamp(vxDes / v, -0.95, 0.95))
      const inCv = snap.inCurve ? known.get(snap.inCurve.id) : null
      const ffScale = (0.25 + 0.75 * skill) * (inCv ? (2 - inCv.margin) : 1)
      const omegaDes = (psiDes - c.psi) * 3.5 + c.kappa * v * ffScale
      const aLatDes = omegaDes * Math.max(v, K.V_STEER_MIN)
      // hand noise: a blind driver closing the loop on a pan cue is not exact
      const noise = gauss() * (1 - skill) * 0.3
      steerCmd = clamp(aLatDes / K.STEER_DEMAND * (1 + gauss() * (1 - skill) * 0.25) + noise, -1, 1)
      if (!ANALOG) steerCmd = Math.abs(steerCmd) < 0.12 ? 0 : Math.sign(steerCmd)
    }

    g.step(DT, {steer: steerCmd, throttle: throttleCmd, analog: ANALOG})
    t += DT
    if (car.contact) scrapeT += DT
    vSum += car.v; vN++

    if (TRACE && t - lastLog > 0.5) {
      lastLog = t
      console.log(`t=${t.toFixed(1)} s=${car.s.toFixed(0)} x=${car.x.toFixed(2)} v=${car.v.toFixed(1)} psi=${car.psi.toFixed(2)} steer=${car.steer.toFixed(2)} k=${car.kappa.toFixed(4)} grip=${car.gripUse.toFixed(2)} hp=${car.health.toFixed(0)} L${g.state.level} tgt=${target ? target.type + '@' + target.rel.toFixed(1) : '-'}`)
    }
  }

  const s = g.state
  return {
    skill, seed, score: s.score, kills: s.kills, misses: s.misses, level: s.level, dist: Math.round(car.s),
    time: Math.round(g.state.t), cause: s.cause || 'alive', best: s.bestCombo, impacts: counts.impacts,
    callouts: counts.callouts, crossers: counts.crossers, events, scrapeT: Math.round(scrapeT), vMean: Math.round(vSum / Math.max(1, vN)),
  }
}

function median(a) { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0 }

const skills = ONE_SKILL != null ? [+ONE_SKILL] : [0, 0.25, 0.5, 0.75, 0.9, 1]
console.log(`KILLING SPREE sim — ${SEEDS} seeds/skill, cap ${MAX_T}s`)
for (const skill of skills) {
  const runs = []
  for (let i = 0; i < SEEDS; i++) {
    const seed = ONE_SEED != null ? +ONE_SEED : 1000 + i
    botSeed = 7 + i * 13
    const r = play(skill, seed, VERBOSE)
    runs.push(r)
    if (VERBOSE) {
      console.log(`  skill ${skill} seed ${seed}: score ${r.score} kills ${r.kills} misses ${r.misses} L${r.level} ${r.dist}m ${r.time}s ${r.cause} best×${r.best} impacts ${r.impacts} scrape ${r.scrapeT}s v̄ ${r.vMean}`)
      if (TRACE || SEEDS === 1) for (const e of r.events) console.log('    ', e.join(' '))
    }
  }
  const causes = {}
  for (const r of runs) causes[r.cause] = (causes[r.cause] || 0) + 1
  console.log(`skill ${skill.toFixed(2)}: score med ${median(runs.map((r) => r.score))} | kills ${median(runs.map((r) => r.kills))} / misses ${median(runs.map((r) => r.misses))} | level ${median(runs.map((r) => r.level))} | dist ${median(runs.map((r) => r.dist))} m | time ${median(runs.map((r) => r.time))} s | impacts ${median(runs.map((r) => r.impacts))} scrape ${median(runs.map((r) => r.scrapeT))}s | v̄ ${median(runs.map((r) => r.vMean))} | ${JSON.stringify(causes)}`)
}
