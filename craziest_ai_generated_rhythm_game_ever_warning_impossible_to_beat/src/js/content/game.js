// CADENCE run logic — the rhythm engine. Everything is timed against the audio
// clock so the gameplay beat and the music's kick are the same event.
//
// Per sector: a fixed chart of beats (content.sequence). On each beat the player
// owes ONE input (step / shoot-left / shoot-right / jump / duck). A correct
// input inside the timing window resolves the beat live (so the action sound
// fires under your finger); the window closing on an unresolved beat is a miss.
// Pressing far from any beat is "off the beat" and bleeds health. 100 health per
// sector, 3 lives for the run; lose all health -> lose a life + respawn mid-
// sector with a mercy window; lose the last life -> game over. Clear sector 10 ->
// victory. Audio is the source of truth; events drive the screen.
content.game = (() => {
  const K = () => content.constants
  const E = () => content.events
  const L = () => content.levels
  const SEQ = () => content.sequence

  const AUDIO_LOOKAHEAD = 0.28 // schedule telegraph cues this far ahead

  const state = {
    phase: 'idle', // idle | countin | play | levelclear | gameover-pending | gameover | victory
    score: 0,
    lives: 0,
    health: 0,
    level: 1,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    perfects: 0,
    misses: 0,
  }

  let def = null
  let chart = null      // {length, beats, events}
  let beatDur = 0.5
  let hitWindow = 0.18
  let perfectWindow = 0.07
  let t0 = 0
  let length = 0
  let resPtr = 0        // next beat to resolve in order
  let evPtr = 0         // next telegraph event to schedule
  let invulnUntilBeat = -1
  let pendingTimer = 0
  let lastClearLevel = 0

  function beatTime(n) { return t0 + n * beatDur }
  function cellTime(c) { return t0 + c.tBeat * beatDur }
  function lastCellTime() { return beatTime(length - 1) } // last cell is always the closing step
  function nowT() { return engine.context().currentTime }
  function currentBeat() { return Math.floor((nowT() - t0) / beatDur) }
  function isInvuln() { return currentBeat() < invulnUntilBeat }

  // ---- run lifecycle -------------------------------------------------------
  function reset() {
    state.phase = 'idle'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.health = K().MAX_HEALTH
    state.level = 1
    state.combo = 0
    state.bestCombo = 0
    state.hits = 0
    state.perfects = 0
    state.misses = 0
    lastClearLevel = 0
    E().emit('run-start', {lives: state.lives, level: state.level})
  }

  // Start the sector named by `level`. Refills health, builds the chart, and
  // schedules a four-beat count-in; beat 0 lands at t0.
  function startLevel(level) {
    state.level = Math.max(1, Math.min(L().count(), level | 0))
    def = L().get(state.level)
    chart = SEQ().generate(def)
    length = chart.length
    beatDur = 60 / def.bpm
    hitWindow = def.hitWindow
    perfectWindow = def.perfectWindow
    state.health = K().MAX_HEALTH
    state.combo = 0
    resPtr = 0
    evPtr = 0
    invulnUntilBeat = -1
    pendingTimer = 0

    const c = engine.context()
    t0 = c.currentTime + 0.4 + 4 * beatDur
    state.phase = 'countin'
    // schedule the four count-in ticks (beats -4..-1)
    for (let k = 0; k < 4; k++) {
      E().emit('count', {n: k + 1, downbeat: false, when: t0 - (4 - k) * beatDur})
    }
    E().emit('level-start', {level: state.level, beatDur, bpm: def.bpm})
  }

  function getT0() { return t0 }
  function getLevel() { return state.level }

  // ---- the player presses a timed action ----------------------------------
  // Resolution walks the unified cell list (steps + on/off-beat threats) and
  // answers the cell CLOSEST in time to the press. On the eighth-note grid a
  // step and an adjacent offbeat threat sit half a beat apart and their windows
  // don't overlap (windows are kept under a quarter beat), so "closest" is
  // unambiguous.
  function press(action, time) {
    if (state.phase !== 'play' && state.phase !== 'countin') return
    if (time < t0 - hitWindow) return            // before beat 0: no penalty
    const cells = chart.cells
    if (time > lastCellTime() + hitWindow) return // after the end: no penalty

    let best = null, bestAdt = Infinity
    for (const c of cells) {
      const adt = Math.abs(time - cellTime(c))
      if (adt < bestAdt) { bestAdt = adt; best = c }
    }

    if (best && bestAdt <= hitWindow) {
      if (best.result) return // closest cell already resolved (stray double-press): ignore
      const required = SEQ().requiredAction(best)
      if (action === required) {
        resolveHit(best, bestAdt <= perfectWindow)
        return
      }
      // wrong action inside the window: note it, but let a later correct press
      // still save the cell. A small dud so the player knows it didn't take.
      if (!best.wrong) { best.wrong = true; E().emit('wrong', {action}) }
      return
    }

    // Pressed nowhere near a cell: off the rhythm.
    state.combo = 0
    state.misses++
    E().emit('offbeat', {action})
    applyDamage(K().DAMAGE.offbeat, 'offbeat')
  }

  function resolveHit(b, perfect) {
    b.result = 'hit'
    const base = b.slot === 'step' ? K().STEP_POINTS : K().THREAT_POINTS
    const mult = K().comboMultiplier(state.combo)
    const perfMult = perfect ? (1 + K().PERFECT_BONUS) : 1
    const gained = Math.round(base * mult * perfMult)
    state.score += gained
    state.hits++
    if (perfect) state.perfects++
    state.combo++
    if (state.combo > state.bestCombo) state.bestCombo = state.combo
    const action = SEQ().requiredAction(b)
    E().emit('hit', {slot: b.slot, side: b.side, action, perfect, gained, combo: state.combo, off: b.off})
    if (K().COMBO_MILESTONES.includes(state.combo)) E().emit('combo', {combo: state.combo})
  }

  function resolveMiss(b) {
    b.result = 'miss'
    state.combo = 0
    state.misses++
    E().emit('miss', {slot: b.slot, side: b.side, off: b.off})
    if (b.slot !== 'step') applyDamage(K().damageForSlot(b.slot), b.slot)
    else applyDamage(K().DAMAGE.step, 'step')
  }

  function applyDamage(amount, kind) {
    if (isInvuln()) return
    state.health -= amount
    E().emit('health', {health: Math.max(0, state.health), kind})
    if (state.health <= 0) handleDeath()
  }

  function handleDeath() {
    state.lives--
    if (state.lives > 0) {
      state.health = K().MAX_HEALTH
      state.combo = 0
      invulnUntilBeat = currentBeat() + K().RESPAWN_INVULN_BEATS
      E().emit('life-lost', {lives: state.lives})
    } else {
      state.phase = 'gameover-pending'
      pendingTimer = 1.7
      E().emit('dying', {score: state.score})
    }
  }

  function beginLevelClear() {
    if (state.phase !== 'play') return
    state.phase = 'levelclear'
    const bonus = K().levelClearBonus(state.level)
    const hb = K().healthBonus(state.health)
    state.score += bonus + hb
    lastClearLevel = state.level
    E().emit('level-clear', {
      level: state.level, clearBonus: bonus, healthBonus: hb,
      score: state.score, last: state.level >= L().count(),
    })
  }

  // ---- per-frame update ----------------------------------------------------
  function update(delta) {
    const now = nowT()

    if (state.phase === 'countin') {
      if (now >= t0) { state.phase = 'play'; E().emit('go', {}) }
      return
    }

    if (state.phase === 'play') {
      // schedule telegraph cues a little ahead of their beat
      while (evPtr < chart.events.length && beatTime(chart.events[evPtr].atBeat) <= now + AUDIO_LOOKAHEAD) {
        const ev = chart.events[evPtr++]
        E().emit('telegraph', {
          kind: ev.kind, side: ev.side, type: ev.type, lead: ev.lead,
          when: Math.max(now, beatTime(ev.atBeat)),
        })
      }
      // resolve cells whose window has closed
      while (resPtr < chart.cells.length && now > cellTime(chart.cells[resPtr]) + hitWindow) {
        const b = chart.cells[resPtr++]
        if (b.result !== 'hit') resolveMiss(b)
        if (state.phase !== 'play') return // a miss ended the run
      }
      // sector complete?
      if (resPtr >= chart.cells.length && now > lastCellTime() + hitWindow + 0.05) {
        beginLevelClear()
      }
      return
    }

    if (state.phase === 'gameover-pending') {
      pendingTimer -= delta
      if (pendingTimer <= 0) {
        state.phase = 'gameover'
        E().emit('game-over', {score: state.score, level: lastClearLevel})
      }
    }
  }

  // ---- readouts for the HUD + F-keys --------------------------------------
  // The next few unresolved threats from the current beat, for "what's coming".
  function upcoming(maxItems) {
    const out = []
    const cb = Math.max(0, currentBeat())
    const max = maxItems || 3
    for (const c of chart.cells) {
      if (out.length >= max) break
      if (c.tBeat < cb || c.slot === 'step' || c.result) continue
      out.push({
        slot: c.slot, side: c.side, type: c.type, off: c.off,
        beatsAway: Math.max(0, Math.round(c.tBeat - cb)),
        action: SEQ().requiredAction(c),
      })
    }
    return out
  }

  function progress() {
    if (!length) return 0
    return Math.max(0, Math.min(1, (currentBeat() + 1) / length))
  }

  return {
    state,
    reset,
    startLevel,
    press,
    update,
    getT0,
    getLevel,
    beatDur: () => beatDur,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    levelCount: () => L().count(),
    upcoming,
    progress,
  }
})()
