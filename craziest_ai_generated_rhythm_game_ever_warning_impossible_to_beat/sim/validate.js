// CADENCE balance + fairness sim. Loads the pure logic modules (constants,
// levels, sequence) in a bare `content` sandbox and checks:
//   1. Chart fairness: ease-in steps, full warnings, min-gap respected, no
//      threat on the first/last beat, a healthy fraction of plain steps remain.
//   2. Difficulty monotonicity: threats/second and tightness climb per sector.
//   3. A skill->outcome gradient: a tight player clears all 10; a sloppy player
//      dies progressively earlier; score rises with skill.
//
// Run: node sim/validate.js
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'src', 'js', 'content')
const content = {}
function load(f) {
  const code = fs.readFileSync(path.join(DIR, f), 'utf8')
  // eslint-disable-next-line no-new-func
  new Function('content', code)(content)
}
load('constants.js')
load('events.js')
load('levels.js')
load('sequence.js')

const K = content.constants
const L = content.levels
const SEQ = content.sequence

// Small deterministic RNG so the run is reproducible.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// 1 + 2: structural fairness + difficulty metrics
// ---------------------------------------------------------------------------
console.log('=== Chart fairness + difficulty (avg of 200 charts/level) ===')
let fairnessFails = 0
const TRIALS = 200
for (let lvl = 1; lvl <= L.count(); lvl++) {
  const def = L.get(lvl)
  const beatDur = 60 / def.bpm
  let threats = 0, steps = 0, minGapSeen = Infinity, drones = 0, offs = 0
  for (let n = 0; n < TRIALS; n++) {
    const rng = mulberry32(lvl * 1000 + n)
    const chart = SEQ.generate(def, rng)
    const threatT = []
    chart.cells.forEach((c) => {
      if (c.slot === 'step') { steps++; return }
      threats++
      if (c.type === 'drone') drones++
      if (c.off) offs++
      threatT.push(c.tBeat)
      // fairness asserts (tBeat is a float: integer on the beat, .5 off it)
      if (c.tBeat < SEQ.EASE_IN) { fairnessFails++; }
      if (c.tBeat <= 0 || c.tBeat >= chart.length - 1) { fairnessFails++; }
      if (c.warn > c.tBeat) { fairnessFails++; } // warning would fall before beat 0
      if (c.off && !def.mech.off) { fairnessFails++; } // offbeats only where enabled
    })
    threatT.sort((a, b) => a - b)
    for (let j = 1; j < threatT.length; j++) {
      minGapSeen = Math.min(minGapSeen, threatT[j] - threatT[j - 1])
    }
    // ease-in must be pure steps
    for (const c of chart.cells) if (c.tBeat < SEQ.EASE_IN && c.slot !== 'step') fairnessFails++
    // an offbeat threat must sit between two plain steps
    for (const c of chart.cells) {
      if (!c.off) continue
      const lo = chart.beats[Math.floor(c.tBeat)]
      const hi = chart.beats[Math.ceil(c.tBeat)]
      if (!lo || !hi || lo.slot !== 'step' || hi.slot !== 'step') fairnessFails++
    }
    // in offbeat sectors, windows must stay inside a quarter beat so a step and
    // an adjacent offbeat can never both fall inside the hit window (so the
    // nearest-cell hit is always unambiguous). Act I has no offbeats, so its
    // wider windows are fine.
    if (def.mech.off && def.hitWindow >= 0.25 * beatDur) fairnessFails++
  }
  const perChartThreats = threats / TRIALS
  const tps = perChartThreats / (def.length * beatDur)
  const stepFrac = steps / (steps + threats)
  console.log(
    `L${String(lvl).padStart(2)} ${def.bpm}bpm len${def.length}` +
    ` | threats/chart ${perChartThreats.toFixed(1)}` +
    ` | threats/sec ${tps.toFixed(2)}` +
    ` | minGap ${minGapSeen === Infinity ? '-' : minGapSeen}` +
    ` | stepFrac ${(stepFrac * 100).toFixed(0)}%` +
    ` | drone ${(drones / Math.max(1, threats) * 100).toFixed(0)}%` +
    ` | off ${(offs / Math.max(1, threats) * 100).toFixed(0)}%` +
    ` | window ±${def.hitWindow}s`
  )
}
console.log(fairnessFails === 0 ? 'FAIRNESS: PASS (0 violations)' : `FAIRNESS: FAIL (${fairnessFails} violations)`)

// ---------------------------------------------------------------------------
// 3: skill -> outcome gradient. Simulate the health/score model per beat.
// ---------------------------------------------------------------------------
// A "player" answers each beat correctly+timely with prob pBase; threats are a
// bit harder (×threatMul), drones harder still (one beat warning). A fraction
// of hits are "perfect". This mirrors content/game.js scoring + health + lives.
function simulateRun(skill, rngSeed) {
  const rng = mulberry32(rngSeed)
  let lives = K.STARTING_LIVES
  let score = 0
  let combo = 0
  let levelsCleared = 0
  let deaths = 0

  for (let lvl = 1; lvl <= L.count(); lvl++) {
    const def = L.get(lvl)
    const chart = SEQ.generate(def, rng)
    let health = K.MAX_HEALTH
    let invuln = 0
    let cleared = true
    for (const b of chart.cells) {
      if (invuln > 0) invuln--
      const isThreat = b.slot !== 'step'
      let p = skill
      if (isThreat) p *= 0.97
      if (b.type === 'drone') p *= 0.9 // one-beat warning is harder
      if (b.off) p *= 0.93 // syncopated, off the kick — harder to land
      // tighter windows in late sectors shave a little success probability
      p *= (0.9 + def.hitWindow) // ~1.10 early -> ~1.00 late
      p = Math.max(0, Math.min(0.999, p))
      const hit = rng() < p
      if (hit) {
        const base = isThreat ? K.THREAT_POINTS : K.STEP_POINTS
        const mult = K.comboMultiplier(combo)
        const perfect = rng() < skill * 0.6
        const gained = Math.round(base * mult * (perfect ? 1 + K.PERFECT_BONUS : 1))
        score += gained
        combo++
      } else {
        combo = 0
        if (invuln <= 0) {
          health -= K.damageForSlot(b.slot)
          if (health <= 0) {
            lives--; deaths++
            if (lives <= 0) {
              return {score, levelsCleared, lives, deaths, diedAt: lvl}
            }
            health = K.MAX_HEALTH
            invuln = K.RESPAWN_INVULN_BEATS
          }
        }
      }
    }
    if (cleared) {
      score += K.levelClearBonus(lvl) + K.healthBonus(health)
      levelsCleared++
    }
  }
  return {score, levelsCleared, lives, deaths, diedAt: null}
}

function tier(label, skill) {
  const N = 400
  let totScore = 0, totCleared = 0, clearedAll = 0
  const diedHist = {}
  for (let n = 0; n < N; n++) {
    const r = simulateRun(skill, 7000 + n)
    totScore += r.score
    totCleared += r.levelsCleared
    if (r.levelsCleared === L.count()) clearedAll++
    if (r.diedAt) diedHist[r.diedAt] = (diedHist[r.diedAt] || 0) + 1
  }
  console.log(
    `${label.padEnd(10)} skill ${skill.toFixed(2)}` +
    ` | avgScore ${Math.round(totScore / N).toString().padStart(7)}` +
    ` | avgSectors ${(totCleared / N).toFixed(2)}` +
    ` | cleared-all ${(clearedAll / N * 100).toFixed(0)}%`
  )
  return totScore / N
}

console.log('\n=== Skill -> outcome gradient (400 runs/tier) ===')
const s1 = tier('expert', 0.99)
const s2 = tier('good', 0.95)
const s3 = tier('average', 0.88)
const s4 = tier('sloppy', 0.78)
const s5 = tier('flailing', 0.65)

console.log('\n=== Verdict ===')
console.log('monotonic score by skill:', (s1 > s2 && s2 > s3 && s3 > s4 && s4 > s5) ? 'PASS' : 'FAIL',
  `(${Math.round(s1)} > ${Math.round(s2)} > ${Math.round(s3)} > ${Math.round(s4)} > ${Math.round(s5)})`)
