// Real-time run logic for AIRLIFT (audio Choplifter).
//
// You fly a rescue chopper along a horizontal strip. Hover over a stranded
// survivor (hold still at their x) to winch them aboard — up to CAP at once — then
// fly home to BASE (left edge) to deliver them. Ground TANKS shell you from below:
// each telegraphs an aim, then a shell rises at its column — be off that column
// when it tops out, or drop a bomb to destroy the tank first. Clear every survivor
// in a wave to advance. Three lives, endless. Score = delivered + tanks killed.
//
// Side-view, NON-ROTATING audio: the listener rides the chopper, every source is
// panned by its x relative to you (left stays left). This module owns state and
// emits events; the screen turns them into audio + announcements. No DOM/audio
// refs, so it runs headless under /tmp/airlift-sim.js.
content.game = (() => {
  const K = () => content.constants

  const state = {
    phase: 'play', // play | wave-pending | gameover-pending | gameover
    score: 0,
    lives: 0,
    wave: 1,
    carried: 0,
    delivered: 0,   // this wave
    rescuedTotal: 0,
    kills: 0,
    elapsed: 0,
    invuln: 0,
    bombs: 0,
  }

  let chopper = {x: 0, moving: false, bombCd: 0}
  let hostages = []
  let tanks = []
  let bombs = []
  let nextId = 1
  let cfg = null
  let intentDir = 0
  let hoverTimer = 0
  let waveCount = 0
  let phaseTimer = 0
  let overDone = false

  function E() { return content.events }
  const W = () => K().FIELD_W

  function reset() {
    state.phase = 'play'
    state.score = 0
    state.lives = K().STARTING_LIVES
    state.wave = 1
    state.carried = 0
    state.delivered = 0
    state.rescuedTotal = 0
    state.kills = 0
    state.elapsed = 0
    state.invuln = K().INVULN
    state.bombs = K().BOMB_AMMO_START
    nextId = 1
    overDone = false
    buildWave(1)
    E().emit('run-start', {lives: state.lives, wave: 1})
  }

  function rnd(lo, hi) { return lo + Math.random() * (hi - lo) }

  function buildWave(wave) {
    state.wave = wave
    cfg = K().waveConfig(wave)
    chopper = {x: K().BASE_RADIUS + 2, moving: false, bombCd: 0}
    state.carried = 0
    state.delivered = 0
    hoverTimer = 0
    intentDir = 0
    waveCount = cfg.survivors
    hostages = []
    for (let i = 0; i < cfg.survivors; i++) {
      hostages.push({id: nextId++, x: rnd(16, W() - 3), state: 'waiting'})
    }
    tanks = []
    for (let i = 0; i < cfg.tanks; i++) {
      tanks.push({id: nextId++, x: rnd(12, W() - 3), phase: 'idle', timer: rnd(1.2, cfg.tankFireEvery), dead: false})
    }
    bombs = []
    state.invuln = K().INVULN
  }

  // ---- inputs ----
  function setMove(dir) { intentDir = dir < 0 ? -1 : dir > 0 ? 1 : 0 }

  function bomb() {
    if (state.phase !== 'play') return
    if (chopper.bombCd > 0) return
    if (state.bombs <= 0) { E().emit('no-ammo', {}); return }
    chopper.bombCd = K().BOMB_CD
    state.bombs--
    bombs.push({x: chopper.x, timer: K().BOMB_FALL})
    E().emit('bomb-drop', {ammo: state.bombs})
    E().emit('score-change')
  }

  function nearestWaiting() {
    let best = null
    for (const h of hostages) {
      if (h.state !== 'waiting') continue
      const d = Math.abs(h.x - chopper.x)
      if (!best || d < best.d) best = {h, d}
    }
    return best
  }

  function updateChopper(delta) {
    if (chopper.bombCd > 0) chopper.bombCd = Math.max(0, chopper.bombCd - delta)
    chopper.moving = intentDir !== 0
    if (chopper.moving) {
      chopper.x = Math.max(0, Math.min(W(), chopper.x + intentDir * K().MOVE_SPEED * delta))
      hoverTimer = 0
    }

    // deliver at base
    if (chopper.x <= K().BASE_RADIUS && state.carried > 0) {
      const n = state.carried
      for (const h of hostages) if (h.state === 'boarded') { h.state = 'delivered'; state.delivered++ }
      state.rescuedTotal += n
      state.carried = 0
      state.score += Math.round(K().deliverBonus(n))
      E().emit('deliver', {n, total: state.rescuedTotal})
      E().emit('score-change')
      checkWaveClear()
      return
    }

    // winch up survivors when hovering still over one
    if (!chopper.moving && state.carried < K().CAP) {
      const near = nearestWaiting()
      if (near && near.d <= K().PICKUP_RADIUS) {
        hoverTimer += delta
        E().emit('hover', {progress: Math.min(1, hoverTimer / K().HOVER_TIME), dx: near.h.x - chopper.x})
        if (hoverTimer >= K().HOVER_TIME) {
          near.h.state = 'boarded'
          state.carried++
          hoverTimer = 0
          E().emit('pickup', {carried: state.carried})
          E().emit('score-change')
        }
      } else hoverTimer = 0
    }
  }

  function updateTanks(delta) {
    for (const tk of tanks) {
      if (tk.dead) continue
      tk.timer -= delta
      if (tk.timer > 0) continue
      if (tk.phase === 'idle') { tk.phase = 'aim'; tk.timer = cfg.tankAim; E().emit('tank-aim', {dx: tk.x - chopper.x}) }
      else if (tk.phase === 'aim') { tk.phase = 'shell'; tk.timer = K().RISE_TIME; E().emit('tank-fire', {dx: tk.x - chopper.x}) }
      else { // shell tops out
        tk.phase = 'idle'; tk.timer = cfg.tankFireEvery * (0.7 + Math.random() * 0.6)
        E().emit('shell-top', {dx: tk.x - chopper.x})
        if (state.invuln <= 0 && Math.abs(chopper.x - tk.x) < K().HIT_RADIUS) hit()
      }
    }
  }

  function updateBombs(delta) {
    for (const b of bombs) {
      if (b.dead) continue
      b.timer -= delta
      if (b.timer <= 0) {
        b.dead = true
        let killed = 0
        for (const tk of tanks) {
          if (tk.dead) continue
          if (Math.abs(tk.x - b.x) <= K().BOMB_RADIUS) { tk.dead = true; killed++; state.kills++; state.score += K().TANK_POINTS; E().emit('tank-killed', {dx: tk.x - chopper.x}) }
        }
        E().emit('bomb-impact', {dx: b.x - chopper.x, killed})
        if (killed) E().emit('score-change')
      }
    }
    bombs = bombs.filter((b) => !b.dead)
  }

  function hit() {
    if (state.phase !== 'play') return
    state.lives--
    E().emit('hurt', {lives: state.lives})
    if (state.lives <= 0) { state.phase = 'gameover-pending'; phaseTimer = 1.3; overDone = false }
    else { state.invuln = K().INVULN; E().emit('respawn', {lives: state.lives}) }
  }

  function checkWaveClear() {
    if (state.phase === 'play' && state.delivered >= waveCount) {
      state.score += K().waveBonus(state.wave)
      state.bombs += K().BOMB_AMMO_PER_WAVE
      state.phase = 'wave-pending'
      phaseTimer = 1.8
      E().emit('wave-clear', {wave: state.wave, ammo: state.bombs})
      E().emit('score-change')
    }
  }

  function update(delta) {
    if (state.invuln > 0) state.invuln = Math.max(0, state.invuln - delta)

    if (state.phase === 'play') {
      state.elapsed += delta
      updateChopper(delta)
      if (state.phase !== 'play') return
      updateTanks(delta)
      if (state.phase !== 'play') return
      updateBombs(delta)
      return
    }
    if (state.phase === 'wave-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0) { buildWave(state.wave + 1); state.phase = 'play'; E().emit('wave-start', {wave: state.wave}) }
      return
    }
    if (state.phase === 'gameover-pending') {
      phaseTimer -= delta
      if (phaseTimer <= 0 && !overDone) { overDone = true; state.phase = 'gameover'; E().emit('game-over', {score: state.score, wave: state.wave, rescued: state.rescuedTotal}) }
    }
  }

  function waitingLeft() { let n = 0; for (const h of hostages) if (h.state === 'waiting') n++; return n }

  function nearest(kind) {
    let best = null
    const list = kind === 'tank' ? tanks : hostages
    for (const o of list) {
      if (kind === 'tank' ? o.dead : o.state !== 'waiting') continue
      const d = Math.abs(o.x - chopper.x)
      if (!best || d < best.d) best = {o, d}
    }
    return best ? {dx: best.o.x - chopper.x, dist: Math.round(best.d)} : null
  }

  return {
    state,
    reset,
    update,
    setMove,
    bomb,
    isPlaying: () => state.phase === 'play',
    phase: () => state.phase,
    carried: () => state.carried,
    waitingLeft,
    baseDx: () => K().BASE_X - chopper.x,
    nearest,
    snapshot: () => ({
      W: W(), chopperX: chopper.x, carried: state.carried, cap: K().CAP, ammo: state.bombs,
      baseDx: K().BASE_X - chopper.x,
      hostages: hostages.filter((h) => h.state === 'waiting').map((h) => ({id: h.id, dx: h.x - chopper.x})),
      tanks: tanks.filter((t) => !t.dead).map((t) => ({id: t.id, dx: t.x - chopper.x, phase: t.phase})),
      bombs: bombs.map((b) => ({dx: b.x - chopper.x})),
      invuln: state.invuln > 0,
    }),
  }
})()
