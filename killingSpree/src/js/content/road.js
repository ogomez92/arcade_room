// KILLING SPREE road: a procedural ribbon of straights and constant-radius
// curves joined by short curvature ramps (so an S-bend reads as one voice
// sweeping across the stereo field, not a jump). Segments are generated on
// demand ahead of the car; difficulty comes from the level the segment is
// generated at (tighter radii, longer arcs, shorter straights, more S-bends).
//
// Sign conventions: dir = +1 is a RIGHT-hand curve (kappa > 0), -1 is LEFT.
content.road = (() => {
  const TRANSITION = 14 // metres of curvature ramp at each segment boundary

  let segments = []     // {id, type, s0, s1, kappa, dir, radius, tier, angle, level}
  let curves = []       // curve segments only, in order
  let nextId = 1
  let endS = 0
  let lastWasCurve = false
  let lastDir = 0

  const K = () => content.constants
  const R = () => content.rng

  function levelOf(s) { return Math.floor(s / K().LEVEL_LENGTH) + 1 }

  // Per-level road parameters. Level 1 is already a real road — the first
  // curve arrives inside 250 m and needs a lift — then radii shrink, arcs
  // lengthen and the straights between them collapse.
  function params(level) {
    const L = Math.max(1, level)
    const g = L - 1
    return {
      rMin: Math.max(30, 165 * Math.pow(0.87, g)),
      rMax: Math.max(65, 330 * Math.pow(0.885, g)),
      hairpin: L >= 6 ? Math.min(0.28, 0.06 + 0.03 * (L - 6)) : 0, // chance of a sub-40 m radius
      angleMin: (24 + Math.min(40, g * 4)) * Math.PI / 180,
      angleMax: (70 + Math.min(80, g * 7)) * Math.PI / 180,
      straightMin: Math.max(35, 130 - 9 * g),
      straightMax: Math.max(95, 270 - 16 * g),
      sChance: Math.min(0.55, 0.05 + 0.065 * g),
    }
  }

  function tierFor(radius) {
    if (radius >= 140) return 1
    if (radius >= 70) return 2
    if (radius >= 42) return 3
    return 4
  }

  function push(seg) {
    seg.id = nextId++
    seg.s0 = endS
    seg.s1 = endS + seg.length
    seg.level = levelOf(seg.s0)
    endS = seg.s1
    segments.push(seg)
    if (seg.type === 'curve') curves.push(seg)
    lastWasCurve = seg.type === 'curve'
    if (seg.type === 'curve') lastDir = seg.dir
    return seg
  }

  function makeStraight(len) {
    return push({type: 'straight', length: len, kappa: 0, dir: 0, radius: Infinity, tier: 0, angle: 0})
  }

  function makeCurve(level, forcedDir) {
    const p = params(level)
    let radius = R().range(p.rMin, p.rMax)
    if (p.hairpin && R().chance(p.hairpin)) radius = R().range(26, 40)
    const angle = R().range(p.angleMin, p.angleMax)
    const dir = forcedDir || (R().chance(0.5) ? 1 : -1)
    const length = Math.max(TRANSITION * 2 + 10, radius * angle)
    return push({type: 'curve', length, kappa: dir / radius, dir, radius, tier: tierFor(radius), angle})
  }

  // Generate until the road extends at least `sTarget` metres. Returns the
  // newly created segments so pedestrians can be placed on them.
  function ensureAhead(sTarget) {
    const created = []
    while (endS < sTarget) {
      const level = levelOf(endS)
      const p = params(level)
      if (segments.length === 0) {
        created.push(makeStraight(K().FIRST_CURVE_MIN + R().range(0, 90)))
        continue
      }
      if (lastWasCurve) {
        if (R().chance(p.sChance)) {
          // S-bend: a token straight, then the opposite direction
          created.push(makeStraight(R().range(6, 24)))
          created.push(makeCurve(level, -lastDir))
        } else {
          created.push(makeStraight(R().range(p.straightMin, p.straightMax)))
        }
      } else {
        created.push(makeCurve(level))
      }
    }
    return created
  }

  function segmentAt(s) {
    // segments are ordered; binary search
    let lo = 0, hi = segments.length - 1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      const seg = segments[mid]
      if (s < seg.s0) hi = mid - 1
      else if (s >= seg.s1) lo = mid + 1
      else return seg
    }
    return segments[segments.length - 1] || null
  }

  function indexOf(seg) { return segments.indexOf(seg) }

  // Curvature with a linear ramp over the first TRANSITION metres of each
  // segment, blending from the previous segment's curvature.
  function curvatureAt(s) {
    const seg = segmentAt(s)
    if (!seg) return 0
    const into = s - seg.s0
    if (into >= TRANSITION) return seg.kappa
    const i = indexOf(seg)
    const prev = i > 0 ? segments[i - 1].kappa : 0
    const f = into / TRANSITION
    return prev + (seg.kappa - prev) * f
  }

  // Next curve whose start lies at or beyond s (the one the car has not yet
  // entered), and the ones after it.
  function curvesFrom(s, count) {
    const out = []
    for (const c of curves) {
      if (c.s1 < s) continue
      out.push(c)
      if (out.length >= count) break
    }
    return out
  }

  function reset() {
    segments = []
    curves = []
    nextId = 1
    endS = 0
    lastWasCurve = false
    lastDir = 0
  }

  // Drop segments far behind the car to keep the arrays small.
  function prune(s) {
    const keepFrom = s - 200
    let n = 0
    while (n < segments.length && segments[n].s1 < keepFrom) n++
    if (n > 0) segments.splice(0, n)
    let m = 0
    while (m < curves.length && curves[m].s1 < keepFrom) m++
    if (m > 0) curves.splice(0, m)
  }

  return {
    reset,
    ensureAhead,
    prune,
    curvatureAt,
    segmentAt,
    curvesFrom,
    params,
    tierFor,
    levelOf,
    end: () => endS,
    segments: () => segments,
    curves: () => curves,
    TRANSITION,
  }
})()
