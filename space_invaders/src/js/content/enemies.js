/**
 * SPACE INVADERS! — enemy logic.
 *
 * Each enemy carries (x, z) where x ∈ [-1, 1] is stereo pan, z ∈ [0, 1]
 * is approach distance. Ships drift laterally as they approach so static
 * aim doesn't cleanly hold them.
 *
 * Per-class kinematics are separated:
 *   scout:      fast approach (~12 s far→close), large lateral drift
 *   bomber:     medium approach (~17 s), small drift
 *   battleship: slow approach (~24 s), almost no drift
 *   civilian:   medium approach (~16 s), gentle drift
 *
 * Hit logic: |aim - x| < hitRadius(z). hitRadius(z) opens at point-blank
 * (closer = easier) and is per-weapon.
 *
 * Cross-module references resolved lazily inside functions.
 */
content.enemies = (() => {
  const A = () => content.audio
  const S = () => content.state
  const W = () => content.weapons

  // Approach time at z = 1 → 0, in seconds. Per class.
  const APPROACH_TIME = {
    scout:      12.0,
    bomber:     17.0,
    battleship: 24.0,
    civilian:   16.0,
  }
  // Lateral drift speed (Δx/sec)
  const DRIFT = {
    scout:      0.45,
    bomber:     0.18,
    battleship: 0.10,
    civilian:   0.22,
  }
  // Pulse rate at far (z=1) and close (z=0.05), in Hz. Linear interpolation.
  const PULSE_RATE = {
    scout:      {far: 1.4, near: 6.5},
    bomber:     {far: 0.9, near: 4.5},
    battleship: {far: 0.6, near: 3.5},
    civilian:   {far: 1.0, near: 4.0},
  }
  // HP pool per class (right weapon does 1.0 damage; wrong does 0.5; bounce 0).
  const HP = {
    scout:      1.0,
    bomber:     1.0,
    battleship: 1.4,   // battleships need *one* right-weapon shot OR three wrong-weapon shots
    civilian:   1.0,
  }
  // Score base per class (right weapon × 1.5 applied at scoring time).
  const BASE_SCORE = {
    scout:      100,
    bomber:     250,
    battleship: 500,
  }

  // ----------------------------- spawning -----------------------------
  function spawn({kind, x, chainIndex}) {
    const s = S().get()
    if (!s) return null
    const id = S().nextEnemyId()
    const sign = (Math.random() < 0.5) ? -1 : 1
    const enemy = {
      id,
      kind,
      x: x != null ? x : sign * (0.30 + Math.random() * 0.55),
      z: 1.0,
      dxPerSec: (Math.random() < 0.5 ? -1 : 1) * DRIFT[kind] * (0.7 + Math.random() * 0.6),
      hp: HP[kind],
      chainIndex: chainIndex || 0,
      pulsePhase: Math.random(),    // start out of phase across ships
      spawnedAt: engine.time(),
    }
    s.enemies.push(enemy)
    A().enqueue({type: 'spawn', enemy})
    return enemy
  }

  // ----------------------------- update each frame -----------------------------
  function tick(dt) {
    const s = S().get()
    if (!s) return
    const list = s.enemies
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i]
      // approach: z decreases linearly from 1 to 0 over APPROACH_TIME[kind]
      const dz = dt / APPROACH_TIME[e.kind]
      e.z -= dz
      // lateral drift, bounce off ±1
      e.x += e.dxPerSec * dt
      if (e.x > 1.0)  { e.x = 1.0;  e.dxPerSec = -Math.abs(e.dxPerSec) }
      if (e.x < -1.0) { e.x = -1.0; e.dxPerSec = Math.abs(e.dxPerSec) }
      // pulse cue: phase advances at a rate that ramps with closeness
      const closeness = 1 - Math.max(0, Math.min(1, e.z))
      const pr = PULSE_RATE[e.kind]
      const rate = pr.far + (pr.near - pr.far) * closeness
      e.pulsePhase += rate * dt
      while (e.pulsePhase >= 1) {
        e.pulsePhase -= 1
        A().enqueue({type: 'urgencyTick', x: e.x, kind: e.kind, chainIndex: e.chainIndex, z: e.z})
      }
      // Reached the player?
      if (e.z <= 0) {
        list.splice(i, 1)
        onReachedPlayer(e)
      }
    }
  }

  function onReachedPlayer(e) {
    const s = S().get()
    if (!s) return
    if (e.kind === 'civilian') {
      // Civilians passing by are fine — no damage, no chain consequence.
      A().enqueue({type: 'kill', x: e.x, id: e.id})
      bumpWaveCleared()
      return
    }
    // Hostile breakthrough — disqualifies the wave-clear bonus.
    s.waveShipsReached += 1
    // Hostile ships hit the player. Distinguish shield-absorb vs life-lost
    // so the audio + announcer match the actual outcome.
    if (s.energy >= 25) {
      s.energy -= 25
      A().enqueue({type: 'shieldHit', x: e.x, id: e.id})
      try {
        app.announce.assertive(app.i18n.t('ann.shieldHeld', {energy: s.energy | 0}))
      } catch (err) {}
    } else {
      // Breach: full impact, life lost, energy reset to 50.
      A().enqueue({type: 'breach', x: e.x, id: e.id})
      s.energy = 50
      s.lives -= 1
      content.scoring.onLifeLost()
      if (s.lives <= 0) {
        content.game.requestGameOver('ann.gameOver')
      } else {
        try {
          app.announce.assertive(app.i18n.t('ann.lostLife', {lives: s.lives}))
        } catch (err) {}
      }
    }
    // Either outcome breaks any chain on a tagged ship reaching the player.
    if (s.chainTaggingActive && e.chainIndex && !s.chainBroken) {
      content.scoring.breakChain()
    }
    bumpWaveCleared()
  }

  function bumpWaveCleared() {
    const s = S().get()
    if (!s) return
    s.waveClearedSpawns += 1
  }

  // ----------------------------- shoot resolution -----------------------------
  // Find the ship that the current aim is most plausibly hitting.
  function findHit(aim, weapon) {
    const s = S().get()
    if (!s || !s.enemies.length) return null
    let best = null
    let bestDist = Infinity
    const radius = W().hitRadius(weapon)
    for (const e of s.enemies) {
      const dx = Math.abs(e.x - aim)
      const r = radius * (1 + (1 - e.z) * 1.2)  // closer = easier
      if (dx <= r && dx < bestDist) {
        bestDist = dx
        best = e
      }
    }
    return best
  }

  // Apply a shot to the targeted enemy. Returns the kill-mode for scoring:
  //   'kill', 'partial', 'bounce'
  function applyShot(enemy, weapon) {
    const s = S().get()
    if (!s) return 'miss'
    const matchup = W().matchup(weapon, enemy.kind)
    if (matchup === 'bounce') return 'bounce'
    const damage = matchup === 'right' ? 1.0 : 0.5
    enemy.hp -= damage
    if (enemy.hp <= 0.001) {
      return 'kill'
    }
    return 'partial'
  }

  function removeEnemy(enemy) {
    const s = S().get()
    if (!s) return
    const idx = s.enemies.indexOf(enemy)
    if (idx >= 0) s.enemies.splice(idx, 1)
  }

  // ----------------------------- queries -----------------------------
  function nextChainShip() {
    const s = S().get()
    if (!s || !s.chainTaggingActive) return null
    const expect = s.chainExpected
    if (!expect) return null
    let candidate = null
    for (const e of s.enemies) {
      if (e.chainIndex === expect) {
        if (!candidate || e.z < candidate.z) candidate = e
      }
    }
    return candidate
  }

  return {
    spawn,
    tick,
    findHit,
    applyShot,
    removeEnemy,
    nextChainShip,
    bumpWaveCleared,
    BASE_SCORE,
    HP,
    APPROACH_TIME,
  }
})()
