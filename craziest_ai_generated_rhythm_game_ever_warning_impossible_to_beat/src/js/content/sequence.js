// CADENCE chart generator. Turns a level definition into a fixed sequence of
// beats (one slot per beat) plus offbeat threats on the "and", unified into a
// single time-ordered list of cells (each the one input the player owes), plus
// a time-ordered list of telegraph cues so a blind player always hears a threat
// coming before its strike beat.
//
// THE GRID. Quarter beats live at integer positions 0..length-1; each carries a
// STEP (the metronome) unless a threat replaces it. From Act II on, levels also
// place threats on the OFFBEAT — the "and" between two beats, at i + 0.5 — which
// the player must hit syncopated, off the kick. Cells are measured in beats
// (`tBeat`, a float: integer = on the beat, .5 = off the beat).
//
// Fairness rules baked in:
//   - An ease-in of pure steps at the start (and a quiet tail at the end) so the
//     player locks the tempo before anything threatens.
//   - Every threat sits far enough in that its full warning fits (tBeat >=
//     easeIn + maxWarn), and threats keep at least `minGap` beats apart (early
//     sectors space them out; late sectors allow adjacency, the difficulty).
//   - Offbeat threats only ever sit between two plain steps, so the syncopation
//     reads cleanly: step, off-beat hit, step.
//   - Drones (one-beat warning) only appear once a level enables them.
content.sequence = (() => {
  const K = () => content.constants

  const EASE_IN = 4
  const TAIL = 2
  const MAX_WARN = 2

  function pickWeighted(weights, rng) {
    let total = 0
    for (const k in weights) total += weights[k]
    let r = rng() * total
    for (const k in weights) {
      r -= weights[k]
      if (r <= 0) return k
    }
    return Object.keys(weights)[0]
  }

  // Fill in a threat cell's kind-specific fields from the level's mix.
  function dressThreat(cell, slot, levelDef, mech, rng) {
    cell.slot = slot
    if (slot === 'enemy') {
      cell.side = rng() < 0.5 ? 'L' : 'R'
      const drone = mech.drone && rng() < (levelDef.droneShare || 0)
      cell.type = drone ? 'drone' : 'grunt'
      cell.warn = K().WARN_BEATS[cell.type]
    } else if (slot === 'hurdle') {
      cell.type = 'hurdle'; cell.warn = K().WARN_BEATS.hurdle
    } else if (slot === 'beam') {
      cell.type = 'beam'; cell.warn = K().WARN_BEATS.beam
    }
  }

  function generate(levelDef, rng) {
    rng = rng || Math.random
    const length = levelDef.length
    const beats = []
    for (let i = 0; i < length; i++) beats.push({i, tBeat: i, slot: 'step', side: null, type: null, warn: 0, off: false})

    // Which threat kinds this level permits, with their mix weights.
    const mech = levelDef.mech
    const mixWeights = {}
    if (mech.enemy && levelDef.mix.enemy > 0) mixWeights.enemy = levelDef.mix.enemy
    if (mech.hurdle && levelDef.mix.hurdle > 0) mixWeights.hurdle = levelDef.mix.hurdle
    if (mech.beam && levelDef.mix.beam > 0) mixWeights.beam = levelDef.mix.beam

    const hasThreats = Object.keys(mixWeights).length > 0 && levelDef.density > 0
    const minGap = Math.max(1, levelDef.minGap | 0)
    const offCells = []

    if (hasThreats) {
      const first = EASE_IN + MAX_WARN
      const last = length - 1 - TAIL
      const candidates = []
      for (let i = first; i <= last; i++) candidates.push(i)
      // shuffle candidates
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
      }
      const target = Math.round(levelDef.density * (last - first + 1))
      const placed = []
      for (const i of candidates) {
        if (placed.length >= target) break
        let ok = true
        for (const p of placed) if (Math.abs(p - i) < minGap) { ok = false; break }
        if (!ok) continue
        placed.push(i)
      }
      placed.sort((a, b) => a - b)

      for (const i of placed) dressThreat(beats[i], pickWeighted(mixWeights, rng), levelDef, mech, rng)

      // ---- offbeat threats (Act II syncopation) ----------------------------
      // Sit at i + 0.5, only where beats i and i+1 are both plain steps, far
      // enough in for a full warning, and `minGap` beats clear of any threat.
      const offShare = mech.off ? (levelDef.offShare || 0) : 0
      if (offShare > 0 && placed.length > 0) {
        const offTarget = Math.round(offShare * placed.length)
        const offCandidates = []
        for (let i = first; i <= last - 1; i++) {
          if (beats[i].slot === 'step' && beats[i + 1].slot === 'step') offCandidates.push(i)
        }
        for (let i = offCandidates.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1))
          ;[offCandidates[i], offCandidates[j]] = [offCandidates[j], offCandidates[i]]
        }
        const offPos = []
        for (const i of offCandidates) {
          if (offPos.length >= offTarget) break
          const p = i + 0.5
          let ok = true
          // keep clear of onbeat threats and other offbeats by >= minGap beats
          for (const q of placed) if (Math.abs(q - p) < minGap) { ok = false; break }
          if (ok) for (const q of offPos) if (Math.abs(q - p) < 1) { ok = false; break }
          if (!ok) continue
          offPos.push(p)
        }
        for (const p of offPos) {
          const i = Math.floor(p)
          const cell = {i, tBeat: p, slot: 'step', side: null, type: null, warn: 0, off: true}
          dressThreat(cell, pickWeighted(mixWeights, rng), levelDef, mech, rng)
          offCells.push(cell)
        }
      }
    }

    // The unified, time-ordered list of cells the player must answer: every
    // step + onbeat threat (the `beats`), plus the offbeat threats.
    const cells = beats.concat(offCells).sort((a, b) => a.tBeat - b.tBeat)

    // Telegraph events: for each threat, a warning cue on each beat from
    // (tBeat - warn) up to (tBeat - 1). `lead` counts beats until the strike
    // (warn..1). Offbeat threats warn on the matching offbeats, which doubles as
    // an audible "this one's syncopated" signal.
    const events = []
    for (const c of cells) {
      if (c.slot === 'step') continue
      for (let lead = c.warn; lead >= 1; lead--) {
        const at = c.tBeat - lead
        if (at < 0) continue
        events.push({
          atBeat: at,
          targetBeat: c.tBeat,
          lead,
          kind: c.slot,    // 'enemy' | 'hurdle' | 'beam'
          side: c.side,    // 'L' | 'R' | null
          type: c.type,    // 'grunt' | 'drone' | 'hurdle' | 'beam'
          off: c.off,
        })
      }
    }
    events.sort((a, b) => a.atBeat - b.atBeat || a.targetBeat - b.targetBeat)

    return {length, beats, cells, events}
  }

  // Required action per cell, for resolution + the F-key readout.
  function requiredAction(cell) {
    return K().actionForSlot(cell.slot, cell.side)
  }

  return {generate, requiredAction, EASE_IN, TAIL, MAX_WARN}
})()
