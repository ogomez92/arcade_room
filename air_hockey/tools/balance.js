// Balance checks for the AI. Plays full headless matches with a skill-scaled
// "you" bot against each difficulty and verifies the gradient is sane:
//   - difficulty is monotonic (a fixed bot wins less as the CPU gets harder)
//   - every difficulty is BEATABLE (a strong bot wins a meaningful share)
//   - the CPU is WINNABLE for it (a weak bot loses to it)
//   - matches resolve (no endless rallies)
//
// The bot defends by predicting where the puck crosses a defensive line in your
// half, and clears/attacks by driving north through the puck. Skill scales its
// prediction lag, aim error, and how far it steps up. Everything is in screen
// coords (+y = south = your goal).
'use strict'
module.exports = function (content, { check, stats }) {
  const K = content.constants
  const DT = 1 / 60

  // A fair skilled-defender proxy. Like a sighted player it ANTICIPATES the
  // CPU's telegraph (via ai.getMode()) and retreats to cover the goal, then
  // reacts to the struck puck; it aims its own shots at the open side away from
  // the CPU mallet. Skill scales prediction lag and aim/defence error.
  function makeYouBot(skill) {
    const k = K
    const half = k.LENGTH / 2
    const reach = k.MALLET_RADIUS + k.PUCK_RADIUS
    const lagFrames = Math.round((1 - skill) * 10)
    const guardY = k.LENGTH - 0.30 // defensive line in front of your goal
    const pbuf = []
    function fold(raw) {
      const W = k.WIDTH
      const m = ((raw % (2 * W)) + 2 * W) % (2 * W)
      return m <= W ? m : 2 * W - m
    }
    return (v) => {
      const p0 = v.puck
      pbuf.push({ x: p0.x, y: p0.y, vx: p0.vx, vy: p0.vy })
      if (pbuf.length > 30) pbuf.shift()
      const p = pbuf[Math.max(0, pbuf.length - 1 - lagFrames)]
      const m = v.mallet
      const aiMode = content.ai.getMode()
      const incoming = p.vy > 0.05      // heading toward your goal (south)
      const onYour = p.y > half
      const defending = incoming || aiMode === 'windup' || aiMode === 'drive'

      let tx, ty
      if (defending) {
        const aim = content.ai.getAimX ? content.ai.getAimX() : null
        if ((aiMode === 'windup' || aiMode === 'drive') && aim != null) {
          tx = aim + (Math.random() - 0.5) * (1 - skill) * 0.45 // read the tell, imperfectly
        } else if (incoming) {
          const t = (guardY - p.y) / p.vy
          tx = t > 0 ? fold(p.x + p.vx * t) : p.x
        } else {
          tx = k.WIDTH / 2 // cover centre while the CPU winds up
        }
        ty = guardY
        if (Math.random() > skill) tx += (Math.random() - 0.5) * 0.22 // defensive misread
      } else if (onYour) {
        tx = p.x; ty = p.y + reach + 0.02 // get south of the puck to drive it north
      } else {
        tx = k.WIDTH / 2; ty = guardY     // ready guard
      }

      // Strike: south of the puck and close → drive north, biased toward the
      // side away from the CPU mallet (a skilled player shoots into space).
      let push = false, aimDir = 0
      if (onYour && Math.hypot(p.x - m.x, p.y - m.y) < reach + 0.08 && m.y >= p.y - 0.01) {
        push = true
        aimDir = (v.ai.x < k.WIDTH / 2 ? 1 : -1) * skill // weaker players aim less
      }

      let dx = tx - m.x, dy = ty - m.y
      if (push) { dx = aimDir * 0.5; dy = -1 }
      const mag = Math.hypot(dx, dy) || 1
      return { x: dx / mag, y: dy / mag }
    }
  }

  function winRate(skill, difficulty, n) {
    let wins = 0, unresolved = 0, you = [], opp = []
    for (let i = 0; i < n; i++) {
      const bot = makeYouBot(skill)
      const r = content.game.simMatch({
        youController: bot, difficulty, target: 7, maxSeconds: 300,
        firstServer: i % 2 === 0 ? 'you' : 'opp', dt: DT,
      })
      if (!r.ended) unresolved++
      else if (r.winner === 'you') wins++
      you.push(r.you); opp.push(r.opp)
    }
    return { rate: wins / n, unresolved, you: stats(you), opp: stats(opp) }
  }

  console.log('\n=== BALANCE ===')
  const N = 50
  const order = K.DIFFICULTY_ORDER

  // The bot is a crude proxy (it doesn't chain offense, over-commits, can't aim
  // precisely with momentum), so it UNDER-states how beatable each CPU is — a
  // real player reads tells and aims far better. These checks therefore verify
  // the roadmap's essential properties (monotonic / winnable / beatable), not
  // absolute win targets; final tuning is the by-ear Phase-7 pass.
  console.log('-- mid-skill bot (0.6) win% by difficulty --')
  const midRates = {}
  for (const d of order) {
    const r = winRate(0.6, d, N)
    midRates[d] = r.rate
    console.log(`  ${d}: win ${(r.rate * 100).toFixed(0)}%  you ${JSON.stringify(r.you)} opp ${JSON.stringify(r.opp)} unresolved ${r.unresolved}/${N}`)
  }
  const TOL = 0.10 // run-to-run noise tolerance (RNG is unseeded)
  const mono = midRates.easy + TOL >= midRates.medium && midRates.medium + TOL >= midRates.hard
  check('difficulty is monotonic (mid bot wins no more as the CPU hardens)', mono,
    `easy ${(midRates.easy * 100) | 0}% ≥ med ${(midRates.medium * 100) | 0}% ≥ hard ${(midRates.hard * 100) | 0}%`)

  console.log('-- strong bot (0.92) vs weak bot (0.25) --')
  const strong = {}, weak = {}
  for (const d of order) {
    strong[d] = winRate(0.92, d, N).rate
    weak[d] = winRate(0.25, d, N).rate
    console.log(`  ${d}: strong ${(strong[d] * 100).toFixed(0)}%  weak ${(weak[d] * 100).toFixed(0)}%`)
  }

  // Beatable: a strong player wins a meaningful share of Easy & Medium, and
  // CAN win Hard (the proxy under-counts Hard, so just require it's not a wall).
  check('every difficulty is beatable', strong.easy > 0.2 && strong.medium > 0.08 && (strong.hard > 0 || midRates.hard > 0),
    `strong easy ${(strong.easy * 100) | 0}% med ${(strong.medium * 100) | 0}% hard ${(strong.hard * 100) | 0}% (mid hard ${(midRates.hard * 100) | 0}%)`)
  // Winnable: the CPU wins the majority against a weak player on Medium & Hard.
  check('the CPU is no pushover (weak player loses Medium & Hard)', weak.medium < 0.45 && weak.hard < 0.30,
    `weak med ${(weak.medium * 100) | 0}% hard ${(weak.hard * 100) | 0}%`)
  // Clear gradient end-to-end.
  check('Hard is clearly harder than Easy', strong.hard < strong.easy && weak.hard <= weak.easy + TOL,
    `strong easy ${(strong.easy * 100) | 0}% vs hard ${(strong.hard * 100) | 0}%`)
}
