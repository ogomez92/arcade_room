// KILLING SPREE pedestrians. Placed when a road segment is generated, using
// the segment's level: early levels drop them in the open; later ones favour
// "tough spots" — the shoulder, the exit of a curve, the inside of an apex —
// and add movers (joggers on the shoulder, crossers who wait at the kerb and
// step out when you're two seconds away). Every placement is individually
// reachable: |x| ≤ PED_MAX_X keeps the car off the wall while lining up.
content.peds = (() => {
  const K = () => content.constants
  const R = () => content.rng

  let list = []
  let nextId = 1
  let lastPlacedS = -Infinity

  function pedParams(level) {
    const g = Math.max(0, level - 1)
    return {
      spacing: Math.max(24, 46 - 2.4 * g),
      tough: Math.min(0.75, 0.12 + 0.08 * g),
      crosser: level >= 3 ? Math.min(0.26, 0.08 + 0.03 * (level - 3)) : 0,
      jogger: level >= 2 ? Math.min(0.16, 0.06 + 0.02 * (level - 2)) : 0,
      group: level >= 4 ? Math.min(0.22, 0.06 + 0.03 * (level - 4)) : 0,
    }
  }

  function add(ped) {
    ped.id = nextId++
    ped.alive = true
    ped.hit = false
    ped.passed = false
    ped.pitch = R().range(0.82, 1.22)
    ped.voice = R().int(0, 3)
    if (ped.vs == null) ped.vs = 0
    if (ped.vx == null) ped.vx = 0
    if (!ped.state) ped.state = 'idle'
    list.push(ped)
    return ped
  }

  function pickType(level, p, spot) {
    // moving types only in the open (a crosser needs room to cross)
    if (spot === 'open' || spot === 'edge') {
      const r = R().random()
      if (r < p.crosser) return 'crosser'
      if (r < p.crosser + p.jogger) return 'jogger'
    }
    const r = R().random()
    if (r < 0.62) return 'talker'
    if (r < 0.80) return 'phone'
    return 'whistler'
  }

  function place(s, seg, level, p, prevSeg) {
    const k = K()
    let spot = 'open'
    if (R().chance(p.tough)) {
      const options = ['edge']
      if (seg.type === 'curve') options.push('apex')
      if (seg.type === 'straight' && prevSeg && prevSeg.type === 'curve' && s - seg.s0 < 40) options.push('postCurve', 'postCurve')
      spot = R().pick(options)
    }

    let x
    if (spot === 'edge') {
      x = (R().chance(0.5) ? 1 : -1) * R().range(3.0, k.PED_MAX_X)
    } else if (spot === 'apex') {
      x = seg.dir * R().range(1.6, 3.6)
      s = seg.s0 + seg.length * R().range(0.35, 0.7)
    } else if (spot === 'postCurve') {
      // just past the exit, biased to the outside of the curve you left
      const outside = -prevSeg.dir
      x = (R().chance(0.7) ? outside : -outside) * R().range(2.0, 3.8)
      s = seg.s0 + R().range(6, 26)
    } else {
      x = R().range(-2.7, 2.7)
    }

    const type = pickType(level, p, spot)

    if (type === 'crosser') {
      const side = R().chance(0.5) ? 1 : -1
      add({type, s, x: side * 4.85, side, vx: -side * R().range(k.CROSSER_SPEED_MIN, k.CROSSER_SPEED_MAX), state: 'waiting', spot})
      return
    }
    if (type === 'jogger') {
      const side = R().chance(0.5) ? 1 : -1
      add({type, s, x: side * R().range(2.4, 3.8), vs: k.JOGGER_SPEED, spot})
      return
    }

    add({type, s, x, spot})

    if (spot !== 'apex' && R().chance(p.group)) {
      const n = R().int(1, 2)
      for (let i = 0; i < n; i++) {
        const gx = Math.max(-k.PED_MAX_X, Math.min(k.PED_MAX_X, x + R().range(-1.2, 1.2)))
        add({type: R().chance(0.7) ? 'talker' : 'phone', s: s + R().range(0.8, 3.2), x: gx, spot, group: true})
      }
    }
  }

  function populate(seg, prevSeg) {
    const k = K()
    const level = seg.level
    const p = pedParams(level)
    let s = Math.max(seg.s0, k.FIRST_PED_S, lastPlacedS + 12)
    if (seg.s0 < k.FIRST_PED_S && seg.s1 > k.FIRST_PED_S) s = k.FIRST_PED_S
    s += R().range(0, p.spacing * 0.5)
    while (s < seg.s1 - 4) {
      place(s, seg, level, p, prevSeg)
      lastPlacedS = s
      s += R().range(p.spacing * 0.6, p.spacing * 1.45)
    }
  }

  // Advance movers and test hits. `handlers` = {onHit(ped, car), onMiss(ped, car)}
  function step(dt, car, handlers) {
    const k = K()
    const front = car.s + k.CAR_HALF_L
    const prevRear = car.prevS - k.CAR_HALF_L
    const halfW = k.CAR_HALF_W + k.PED_RADIUS
    const trigger = 2.2

    for (const ped of list) {
      if (!ped.alive) continue

      if (ped.type === 'jogger') {
        ped.s += ped.vs * dt
      } else if (ped.type === 'crosser') {
        if (ped.state === 'waiting') {
          const tta = (ped.s - car.s) / Math.max(car.v, 6)
          if (tta <= trigger && ped.s > car.s) {
            ped.state = 'crossing'
            content.events.emit('ped-crossing', {id: ped.id, side: ped.side, rel: ped.x - car.x, dist: ped.s - car.s})
          }
        } else if (ped.state === 'crossing') {
          ped.x += ped.vx * dt
          if (Math.abs(ped.x) > 5.3 && ped.x * ped.vx > 0) {
            // reached the far kerb: gone
            ped.alive = false
            ped.state = 'gone'
            if (!ped.hit && !ped.passed) {
              ped.passed = true
              handlers.onMiss(ped, car, true)
            }
            continue
          }
        }
      }

      // hit test: pedestrian inside the car's swept footprint
      if (!ped.hit && ped.s <= front && ped.s >= prevRear && Math.abs(ped.x - car.x) < halfW) {
        ped.hit = true
        ped.alive = false
        handlers.onHit(ped, car)
        continue
      }

      // passed: behind the rear bumper without being hit
      if (!ped.passed && ped.s < car.s - k.CAR_HALF_L) {
        ped.passed = true
        handlers.onMiss(ped, car, false)
      }
    }
  }

  function prune(carS) {
    list = list.filter((p) => p.alive && p.s > carS - 30)
  }

  function reset() {
    list = []
    nextId = 1
    lastPlacedS = -Infinity
  }

  // Ahead-of-car view for the screen/audio/bots
  function visible(car, maxDist) {
    const out = []
    for (const p of list) {
      if (!p.alive) continue
      const dist = p.s - car.s
      if (dist < -25 || dist > maxDist) continue
      out.push({
        id: p.id, type: p.type, state: p.state, spot: p.spot,
        s: p.s, x: p.x, vx: p.vx, vs: p.vs,
        dist, rel: p.x - car.x, pitch: p.pitch, voice: p.voice, group: !!p.group,
      })
    }
    out.sort((a, b) => a.dist - b.dist)
    return out
  }

  return {
    reset,
    populate,
    step,
    prune,
    visible,
    pedParams,
    all: () => list,
    count: () => list.length,
  }
})()
