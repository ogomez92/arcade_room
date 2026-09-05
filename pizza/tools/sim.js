#!/usr/bin/env node
/**
 * Headless simulation harness for Pizza!
 *
 * Loads the real content modules (world, bike, lights, pedestrians,
 * police, gps, pizzas, game) and the real i18n module against stubbed
 * `engine` / `app` / `content.audio`, then drives a bot through complete
 * jobs at 60 Hz. The bot only uses what a player could: the GPS plan
 * (what F1 would say), the crossing-ahead light state (F7), and the
 * pizza list from the briefing.
 *
 *   node tools/sim.js                 # 3 jobs, law-abiding bot
 *   node tools/sim.js --jobs 6 --seed 7
 *   node tools/sim.js --reckless      # ignores red lights → police chases
 *   node tools/sim.js --wrongPizza    # throws the wrong pizza once
 *   node tools/sim.js --manual        # manual-steering smoke test
 *   node tools/sim.js --verbose       # print every announcement
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const args = process.argv.slice(2)
const flag = (n) => args.includes('--' + n)
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d }
const JOBS = parseInt(opt('jobs', '3'), 10)
const SEED = parseInt(opt('seed', '1'), 10)
const VERBOSE = flag('verbose')
const RECKLESS = flag('reckless')
const WRONG_PIZZA = flag('wrongPizza')
const MANUAL = flag('manual')
const ESCAPE = flag('escape')
const TRACE = flag('trace')          // dump bike state every 0.5 s       // run reds, never stop, keep cornering: can the chase be shaken?
const LOCALE = opt('locale', 'en')

// ---- deterministic RNG ----
let seed = SEED >>> 0 || 1
Math.random = () => {
  seed ^= seed << 13; seed >>>= 0
  seed ^= seed >>> 17
  seed ^= seed << 5; seed >>>= 0
  return (seed >>> 0) / 4294967296
}

// ---- stubs ----
let simTime = 0
const announcements = []
let input = {x: 0, rotate: 0}
const events = []

global.engine = {
  time: () => simTime,
  context: () => null,
}
global.app = {
  announce: {
    polite: (s) => { announcements.push({t: simTime, s, urgent: false}); if (VERBOSE) console.log(`  [${simTime.toFixed(1)}] ${s}`) },
    assertive: (s) => { announcements.push({t: simTime, s, urgent: true}); if (VERBOSE) console.log(`  [${simTime.toFixed(1)}] ! ${s}`) },
    setUseTts: () => {},
  },
  controls: {game: () => ({...input})},
  settings: {computed: {manualSteering: MANUAL, ttsFallback: false}},
  screenManager: {
    is: () => true,
    dispatch: (ev) => { events.push({t: simTime, ev}) },
  },
}
global.content = {}
global.localStorage = {getItem: () => LOCALE, setItem: () => {}}

function load(rel) {
  const p = path.join(__dirname, '..', 'src', 'js', rel)
  vm.runInThisContext(fs.readFileSync(p, 'utf8'), {filename: p})
}
load('app/i18n.js')
load('content/events.js')
load('content/world.js')
load('content/bike.js')
load('content/trafficLights.js')
load('content/pedestrians.js')
load('content/police.js')
load('content/gps.js')
load('content/pizzas.js')
load('content/game.js')

// Audio stub — records calls so we can assert on cue activity.
const audioLog = []
const noop = () => {}
content.audio = {
  start: noop, stop: noop, silenceAll: noop, isStarted: () => true,
  unlockListener: noop, setStaticListener: noop,
  setRestaurantActive: noop, setDeliveryTarget: noop,
  frame: noop, gpsChime: noop,
  oneShot: (n) => audioLog.push(n),
  turnBlip: (d) => audioLog.push('turnBlip' + d),
  turnChirp: (a) => audioLog.push('chirp:' + a),
  startSiren: () => audioLog.push('siren'), stopSiren: noop,
}

// ---- helpers ----
const DT = 1 / 60
function step() {
  simTime += DT
  content.game.frame()
}

const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const check = (cond, msg) => { if (!cond) fail(msg) }

function lightAheadState() {
  const leg = content.bike.currentLeg()
  if (!leg) return null
  const light = content.trafficLights.lightAt(leg.forward)
  if (!light) return null
  return {state: light.state[content.trafficLights.bikeAxis()], dF: leg.dF, light}
}

// ---- the bot ----
function driveJob(jobNo) {
  const job = content.game.currentJob()
  const bike = content.bike
  const gps = content.gps
  const pizzasAtStart = job.pizzas.map((p) => ({addr: p.address, ing: p.ingredients.join(', '), point: p.point}))
  console.log(`\n=== Job ${job.number}: ${job.pizzas.length} pizza(s) ===`)
  for (const p of pizzasAtStart) console.log(`  · ${p.ing} → ${p.addr}`)

  content.game.startDriving()
  const startT = simTime
  let holdDir = 0, holdUntil = 0
  let thrownWrong = false
  let lastLegKey = null
  const deliveries = []
  let lastTipsSeen = content.game.state.runTips
  let stuckSince = null
  let legSpeechCount = 0
  let manualRecenterUntil = 0
  let nextTapAt = 0
  let waitingAtRed = false
  let progressPos = {x: bike.state.x, y: bike.state.y}, progressAt = simTime

  while (simTime - startT < 420) {
    const st = content.game.state
    if (st.phase === 'gameOver') return {over: true, reason: st.runReason, deliveries}
    if (st.phase !== 'driving') break   // settled → next job

    const plan = gps.plan()
    const la = lightAheadState()
    input = {x: 1, rotate: 0}

    // Track legs for "GPS spoke once per leg" sanity.
    if (plan && plan.legKey !== lastLegKey) { lastLegKey = plan.legKey; legSpeechCount++ }

    // Stop for red / yellow at the crossing ahead (law-abiding bot), with
    // hysteresis: once braking for a light, stay stopped until it's green.
    if (!RECKLESS && !ESCAPE && la) {
      const stopDist = (bike.state.speed ** 2) / (2 * 32) + (MANUAL ? 17 : 14)
      if ((la.state === 'red' || la.state === 'yellow') && la.dF < stopDist) waitingAtRed = true
      if (la.state === 'green' || la.dF > 30) waitingAtRed = false
      if (waitingAtRed) input.x = -1
    }
    // Brake before corners so they aren't "wide".
    if (plan && !plan.finalApproach && plan.action !== 'straight' && plan.dF < 25 && bike.state.speed > 7.5) input.x = -1

    // Queue the GPS's turn once inside 60 m — as a TAP (one frame), retried
    // every 0.5 s while it hasn't registered.
    if (!MANUAL && plan && !plan.finalApproach && (plan.action === 'left' || plan.action === 'right') && plan.dF < 60 && !bike.state.queuedTurn && simTime >= nextTapAt) {
      input.rotate = plan.action === 'left' ? 1 : -1
      nextTapAt = simTime + 0.5
    }
    // U-turn (assisted): stop, then hold a direction. Manual mode just steers round.
    const wantsUturn = plan && (plan.action === 'uturn')
    if (wantsUturn && !MANUAL) {
      input.x = -1
      if (bike.state.speed === 0) { holdDir = 1; holdUntil = simTime + 0.8 }
    }
    if (!MANUAL && simTime < holdUntil) { input.rotate = holdDir; input.x = 0 }
    else if (!MANUAL && simTime < holdUntil + 0.2) { input.rotate = 0 }   // release the key after a hold

    // Manual steering: aim the bike at the next route node / the target.
    if (MANUAL && plan) {
      let tx, ty
      if (plan.finalApproach) { const t = gps.target(); tx = t.x; ty = t.y }
      else if (plan.dF > 14 || !plan.after) { tx = plan.upcoming.x; ty = plan.upcoming.y }
      else { tx = plan.after.x; ty = plan.after.y }
      const want = Math.atan2(ty - bike.state.y, tx - bike.state.x)
      let diff = want - bike.state.heading
      while (diff > Math.PI) diff -= 2 * Math.PI
      while (diff < -Math.PI) diff += 2 * Math.PI
      input.rotate = Math.abs(diff) < 0.03 ? 0 : (diff < 0 ? 1 : -1)   // rotate>0 = left = heading decreases
      if (Math.abs(diff) > 0.6 && bike.state.speed > 4) input.x = -1
      else if (input.x === 0) input.x = 1
      // Wedged against a wall (no progress while throttling): recentre.
      if (Math.hypot(bike.state.x - progressPos.x, bike.state.y - progressPos.y) > 0.5) {
        progressPos = {x: bike.state.x, y: bike.state.y}; progressAt = simTime
      } else if (input.x > 0 && !waitingAtRed && simTime - progressAt > 1.0) {
        bike.triggerRecenter(); manualRecenterUntil = simTime + 1.6; progressAt = simTime
      }
      if (simTime < manualRecenterUntil) { input.rotate = 0; input.x = 0.3 }
    }

    // Final approach: stop in range and hand over the right pizza.
    if (plan && plan.finalApproach && plan.action === 'arrive') {
      if (plan.inRange) {
        if (!ESCAPE) input.x = -1
        if (bike.state.speed < 3 || ESCAPE) {
          const target = gps.target()
          const held = content.pizzas.held()
          let idx = held.findIndex((p) => !p.delivered && !p.lost && Math.abs(p.point.x - target.x) < 0.5 && Math.abs(p.point.y - target.y) < 0.5)
          if (WRONG_PIZZA && !thrownWrong) {
            const other = held.findIndex((p, i) => i !== idx && !p.delivered && !p.lost)
            if (other >= 0) { idx = other; thrownWrong = true }
          }
          if (idx >= 0) content.game.selectPizza(idx)
          content.game.tryThrow()
        }
      } else if (plan.along < 40 && bike.state.speed > 6 && !ESCAPE) {
        input.x = -1
      }
    }

    step()
    if (TRACE && Math.floor(simTime * 2) !== Math.floor((simTime - DT) * 2)) {
      console.log(`    t=${(simTime - startT).toFixed(1)} pos=(${bike.state.x | 0},${bike.state.y | 0}) h=${bike.state.heading.toFixed(2)} v=${bike.state.speed.toFixed(1)} in=${input.x},${input.rotate} q=${bike.state.queuedTurn} la=${la ? la.state + "@" + (la.dF|0) : "-"} red=${waitingAtRed} plan=${plan ? plan.action + (plan.finalApproach ? '/final' : '') + ' dF=' + (plan.dF | 0) : 'none'} curb=${bike.state.curbDistLeft},${bike.state.curbDistRight}`)
    }

    // Delivery bookkeeping
    if (content.game.state.runTips !== lastTipsSeen || (content.game.state.lastTip && content.game.state.lastTip !== deliveries[deliveries.length - 1])) {
      const lt = content.game.state.lastTip
      if (lt && lt !== deliveries[deliveries.length - 1]) {
        deliveries.push(lt)
        console.log(`  delivered @${(simTime - startT).toFixed(1)}s: tip $${lt.tip}  (elapsed ${lt.elapsed.toFixed(1)}s, budget ${lt.budget.toFixed(1)}s, route ${content.game.state.routeDistance | 0}m, fines ${lt.fines.toFixed(2)}, fast=${lt.fast})`)
      }
      lastTipsSeen = content.game.state.runTips
    }

    // Stuck detector
    if (bike.state.speed === 0 && !wantsUturn && !(plan && plan.finalApproach)) {
      if (stuckSince == null) stuckSince = simTime
      else if (simTime - stuckSince > 45) { fail(`bike stuck for 45 s at (${bike.state.x | 0},${bike.state.y | 0}) leg=${plan && plan.legKey}`); return {over: true, deliveries} }
    } else stuckSince = null
  }
  if (simTime - startT >= 420) fail(`job ${jobNo} did not finish within 420 s`)
  return {over: false, deliveries, jobTime: simTime - startT}
}

// ---- run ----
console.log(`Pizza! sim — seed ${SEED}, locale ${LOCALE}, ${MANUAL ? 'MANUAL' : 'assisted'} steering, ${RECKLESS ? 'RECKLESS' : 'law-abiding'}`)
content.game.beginBriefing()
const w = content.world
console.log('City: N-S streets W→E:', w.vertNames().join(' | '))
console.log('      E-W streets N→S:', w.horizNames().join(' | '))
const e = w.edges()
console.log(`      edges: N=${e.north.name} S=${e.south.name} E=${e.east.name} W=${e.west.name}`)
check(w.blocks().length === 5 && new Set(w.blocks().flat().map((b) => b.landmark)).size === 25, 'blocks should have 25 unique landmarks')
check(w.deliverableAddresses().length > 400, 'deliverable address count sane')

let totalTips = 0
const allDeliveries = []
for (let j = 1; j <= JOBS; j++) {
  const r = driveJob(j)
  allDeliveries.push(...r.deliveries)
  if (r.over) { console.log(`  run ended: ${r.reason}`); break }
  console.log(`  job done in ${r.jobTime.toFixed(1)}s, run tips $${content.game.state.runTips}`)
  const ev = events[events.length - 1]
  check(ev && ev.ev === 'nextJob', 'screen should be asked for nextJob after settling')
  content.game.beginBriefing()
}
totalTips = content.game.state.runTips

// ---- report ----
console.log('\n=== Summary ===')
console.log(`deliveries: ${allDeliveries.length}, total tips $${totalTips}`)
const cues = audioLog.reduce((m, n) => { m[n] = (m[n] || 0) + 1; return m }, {})
console.log('audio cues:', JSON.stringify(cues))
const urgentGps = announcements.filter((a) => /Recalculating|Recalculando/.test(a.s)).length
console.log(`announcements: ${announcements.length}, wrong-turn recalcs: ${urgentGps}`)
if (!RECKLESS && !MANUAL && !ESCAPE) {
  check(urgentGps === 0, 'law-abiding assisted bot should never go off-route')
  check(!cues.squeal, 'bot brakes before corners → no squeal')
  check(!cues.hitPed, 'law-abiding bot should not hit pedestrians')
  check(!cues.redLight, 'law-abiding bot should not run reds')
  for (const d of allDeliveries) {
    check(d.tip > 0, 'every correct delivery should tip')
    check(d.elapsed <= d.budget * 1.15, `timid bot delivery should be near budget (elapsed ${d.elapsed.toFixed(1)} > 1.15 × budget ${d.budget.toFixed(1)})`)
  }
}
if (RECKLESS) {
  check(cues.siren > 0, 'reckless bot should attract the police')
}
if (ESCAPE) {
  check(cues.siren > 0, 'escape bot should attract the police')
  const shaken = announcements.filter((a) => /lost them|gave up|despistado|rendido/.test(a.s)).length
  const caught = announcements.filter((a) => /Pulled over|pillado/.test(a.s)).length
  console.log(`chases started: ${cues.siren}, shaken: ${shaken}, caught: ${caught}`)
  check(caught === 0, 'a bot that keeps moving and cornering must never be caught')
}
if (WRONG_PIZZA) {
  check(announcements.some((a) => /Wrong pizza|Pizza equivocada/.test(a.s)), 'wrong pizza should be announced')
  check(content.game.state.runReason === 'gameover.reasonZeroTip' || content.game.state.pendingGameOver, 'wrong pizza should end the shift at settle')
}
if (!VERBOSE) {
  console.log('\nlast 12 announcements:')
  for (const a of announcements.slice(-12)) console.log(`  [${a.t.toFixed(1)}]${a.urgent ? ' !' : ''} ${a.s}`)
}
console.log(process.exitCode ? '\nRESULT: FAIL' : '\nRESULT: OK')
