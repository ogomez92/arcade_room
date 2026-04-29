// World tick: spawning, collisions, level progression for Villains from Beyond.

content.world = (() => {
  const S = () => content.state.session
  const E = () => content.entities

  const enemies = []
  const eshots = []
  const beams = []
  const bombs = []

  let announceEl, urgentEl

  function ready() {
    announceEl = document.querySelector('[data-hud="announce"]')
    urgentEl = document.querySelector('[data-hud="urgent"]')
  }

  function announce(msg, urgent = false) {
    const el = urgent ? urgentEl : announceEl
    if (!el) return
    // Toggle to retrigger live region.
    el.textContent = ''
    setTimeout(() => { el.textContent = msg }, 16)
  }

  // ---- Spawning ----

  function spawnEnemyShot(ex, ey, guided, movetime, sphere) {
    eshots.push(new (content.entities.EnemyShot)(ex, ey, guided, movetime, sphere))
  }

  function spawn(dt) {
    const s = S()
    s.spawntime -= dt
    if (s.spawntime > 0) return
    s.spawntime = E().rand(1000, Math.max(1500, 6000 - s.level * 75))
    if (s.y >= s.level * 100 - 10) return

    let spawned = false
    while (!spawned) {
      const choose = E().rand(1, 9)
      const ex = E().rand(0, 10)
      const ey = E().rand(s.y + 20, s.y + 30)
      if (choose == 1 || choose == 3) {
        // Airship (basic aerial)
        const e = new (E().Enemy)(ex, ey, false, true, 0, 'enemy_1_lp', '', 'enemy_1_die')
        enemies.push(e); spawned = true
      } else if (choose == 2) {
        // Ground base
        const e = new (E().Enemy)(ex, ey, true, true, 0, 'enemy_2_lp', '', 'enemy_2_die')
        e.scoreMult = 150
        enemies.push(e); spawned = true
      } else if (choose == 4) {
        if (s.level < 7) continue
        enemies.push(new (E().SphereShooter)(ex, ey)); spawned = true
      } else if (choose == 5) {
        if (s.level < 2) continue
        // Armored airship
        const e = new (E().Enemy)(ex, ey, false, true, 0, 'enemy_4_lp', 'enemy_4_hit', 'enemy_4_die')
        e.hp = 4
        e.scoreMult = 20
        enemies.push(e); spawned = true
      } else if (choose == 6) {
        if (s.level < 3) continue
        enemies.push(new (E().Porter)(ex, ey)); spawned = true
      } else if (choose == 7) {
        if (s.level < 5) continue
        // Slider (aerial mvt)
        enemies.push(new (E().Mvt)(ex, ey, false)); spawned = true
      } else if (choose == 8) {
        if (s.level < 6) continue
        enemies.push(new (E().Bouncer)(ex, ey)); spawned = true
      } else if (choose == 9) {
        if (s.level < 4) continue
        // Turret (ground mvt)
        enemies.push(new (E().Mvt)(ex, ey, true)); spawned = true
      }
    }
  }

  function spawnItemTimer(dt) {
    const s = S()
    s.itemtime -= dt
    if (s.itemtime > 0) return
    s.itemtime = E().rand(20, 50) * 1000
    if (s.y < s.level * 100 - 20) {
      enemies.push(new (E().Scorpion)(E().rand(0, 10), E().rand(s.y + 15, s.y + 30)))
    }
  }

  function towerLoop(dt) {
    const s = S()
    if (!s.toweractive) {
      s.towertime -= dt
      if (s.towertime <= 0) {
        s.towertime = E().rand(25, 50) * 1000
        if (s.y < s.level * 100 - 30) {
          content.audio.towerAlarm()
          announce(app.i18n.t('ann.towerBelow'), true)
          s.toweractive = true
          s.towerWindow = 1100
        }
      }
    } else {
      s.towerWindow -= dt
      if (s.towerWindow <= 0) {
        s.toweractive = false
      }
    }
  }

  // ---- Combat / death ----

  function combo() {
    const s = S()
    if (s.combotimer <= 1500) {
      s.combovalue++
    } else {
      s.combovalue = 0
    }
    s.combotimer = 0
    if (s.combovalue >= 2) {
      content.audio.combo(s.combovalue)
      content.state.addScore(400 * s.combovalue)
      content.state.addCash(4 * s.combovalue)
    }
  }

  function clearScreenNoisily() {
    for (const en of enemies) {
      if (!en || en.dead) continue
      if (en.noburst) continue
      en.dead = true
    }
    for (const sh of eshots) {
      if (!sh || sh.dead) continue
      sh.dead = true
    }
  }

  function obtainItem(type) {
    const s = S()
    content.state.addScore(500)
    content.audio.itemObtain()
    s.poweruptimer = 0
    if (type == 1) {
      s.bursts++
      announce(app.i18n.t('ann.burstGained'))
    } else if (type == 2) {
      s.zaptime = 100
      announce(app.i18n.t('ann.rapidFire'))
    } else if (type == 3) {
      s.bombarea = 18
      announce(app.i18n.t('ann.bombArea'))
    } else if (type == 4) {
      const ra = E().rand(1, 2)
      s.shieldbits += ra
      announce(app.i18n.t(ra == 1 ? 'ann.singleShield' : 'ann.doubleShield'))
    } else if (type == 5) {
      s.beamvel = 15
      announce(app.i18n.t('ann.beamVelocity'))
    }
  }

  function expirePowerup() {
    const s = S()
    let expired = false
    if (s.bombarea == 18) { s.bombarea = content.state.persistent.rBombarea; expired = true }
    if (s.zaptime == 100) { s.zaptime = content.state.persistent.rZaptime; expired = true }
    if (s.beamvel == 15) { s.beamvel = content.state.persistent.rBeamvel; expired = true }
    if (expired) {
      content.audio.tone({freq: 300, type: 'triangle', duration: 0.3, peak: 0.3, sweep: -150})
      announce(app.i18n.t('ann.powerupEnded'))
    }
  }

  function die() {
    const s = S()
    if (s.shieldbits > 0) {
      s.shieldbits--
      content.audio.shieldHit(s.x, s.y, s.y)
      return
    }
    if (s.dangerLoopRef) { s.dangerLoopRef.stop(); s.dangerLoopRef = null }
    s.inDanger = false
    s.genesisActive = false
    s.gotostore = false
    expirePowerup()
    content.audio.die()
    content.state.addScore(-1000)
    s.score = Math.max(s.score, content.state.session.score)
    // Clear all enemies/projectiles. We just flag them — the main tick()
    // sweep at the end of this frame handles actual removal so we don't
    // splice arrays while another iterator is still walking them.
    for (const en of enemies) if (en) en.dead = true
    for (const sh of eshots) if (sh) sh.dead = true
    // Wait briefly, then continue
    s.lives -= 1
    s.poweruptimer = 0
    if (s.lives <= 0) {
      s.lives = 0
      s.alive = false
      s.playing = false
      announce(app.i18n.t('ann.gameOver'), true)
      return
    }
    // Reset to checkpoint
    s.y = s.checky
    announce(app.i18n.t('ann.livesLeft', {n: s.lives}), true)
  }

  // ---- Tick ----

  function startLevel() {
    const s = S()
    s.level++
    s.y = 0
    s.checky = 0
    s.maxlev = 1 + s.level * 100
    content.state.addCash(11 * s.level)
    s.genesisActive = false
    s.destroyedGenesis = false
    s.inDanger = false
    s.gotostore = false
    s.toweractive = false
    s.towertime = E().rand(25, 50) * 1000
    s.itemtime = E().rand(20, 50) * 1000
    s.spawntime = 1000
    s.poweruptimer = 0

    // Clear arrays for new level
    for (const en of enemies) if (en && en.onDestroy) en.onDestroy()
    enemies.length = 0
    for (const sh of eshots) if (sh && sh.onDestroy) sh.onDestroy()
    eshots.length = 0
    for (const b of beams) if (b && b.onDestroy) b.onDestroy()
    beams.length = 0
    bombs.length = 0

    content.audio.levelUp()
    announce(app.i18n.t('ann.level', {n: s.level}), true)
    s.playing = true
  }

  function endLevel() {
    const s = S()
    s.playing = false
    content.audio.levelEnd(s.x, s.y)
    // Killing the Genesis forces a store visit on the way to the next level
    // (matches the original "after genesis, igstore()" flow).
    if (s.destroyedGenesis) {
      s.gotostore = true
      s.destroyedGenesis = false
      announce(app.i18n.t('ann.motherDefeated'), true)
      return
    }
    if (s.gotostore) {
      announce(app.i18n.t('ann.enteringStore'))
      // The game screen detects `gotostore && !playing` and dispatches the
      // transition itself so it can also flag "resuming-from-store" mode.
      return
    }
    // Auto-advance to next level
    startLevel()
  }

  function sweepDead() {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const en = enemies[i]
      if (!en || en.dead) {
        if (en && en.onDestroy) en.onDestroy()
        enemies.splice(i, 1)
      }
    }
    for (let i = eshots.length - 1; i >= 0; i--) {
      const sh = eshots[i]
      if (!sh || sh.dead) {
        if (sh && sh.onDestroy) sh.onDestroy()
        eshots.splice(i, 1)
      }
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i]
      if (!b || b.dead) {
        if (b && b.onDestroy) b.onDestroy()
        beams.splice(i, 1)
      }
    }
    for (let i = bombs.length - 1; i >= 0; i--) {
      if (!bombs[i] || bombs[i].dead) bombs.splice(i, 1)
    }
  }

  function spawnGenesisIfNeeded() {
    const s = S()
    if (s.level % 3 != 0) return
    if (s.genesisActive || s.destroyedGenesis) return
    if (s.y < s.maxlev * 0.8) return
    content.audio.genesisAppear()
    announce(app.i18n.t('ann.motherDetected'), true)
    const hp = 3 + 2 * Math.floor(s.level / 3)
    enemies.push(new (E().Genesis)(E().rand(0, 10), s.y + 28, hp))
    s.genesisActive = true
  }

  function tick(dt) {
    const s = S()
    if (!s.playing || s.paused) return
    s.combotimer += dt
    s.poweruptimer += dt
    if (s.poweruptimer >= s.powertime) {
      s.poweruptimer = 0
      expirePowerup()
    }

    // Forward movement
    s.moveTimer += dt
    while (s.moveTimer >= s.speed) {
      s.moveTimer -= s.speed
      s.y += 1
      if (s.y >= s.maxlev && !s.genesisActive) {
        endLevel()
        return
      }
    }

    spawnGenesisIfNeeded()
    spawn(dt)
    spawnItemTimer(dt)
    towerLoop(dt)

    for (const en of enemies) {
      if (!en || en.dead) continue
      if (en.shoot) en.shoot(dt)
      if (en.loopAct) en.loopAct(dt)
      if (en.updateLoop) en.updateLoop()
    }

    for (const sh of eshots) {
      if (!sh || sh.dead) continue
      sh.cycle(dt)
    }

    for (const beam of beams) {
      if (!beam || beam.dead) continue
      beam.move(dt)
    }

    for (const bomb of bombs) {
      if (!bomb || bomb.dead) continue
      bomb.cycle(dt)
    }

    sweepDead()
  }

  function reset() {
    for (const en of enemies) if (en && en.onDestroy) en.onDestroy()
    enemies.length = 0
    for (const sh of eshots) if (sh && sh.onDestroy) sh.onDestroy()
    eshots.length = 0
    for (const b of beams) if (b && b.onDestroy) b.onDestroy()
    beams.length = 0
    bombs.length = 0
    if (S().dangerLoopRef) { S().dangerLoopRef.stop(); S().dangerLoopRef = null }
  }

  return {
    enemies, eshots, beams, bombs,
    announce, ready,
    spawnEnemyShot,
    combo, clearScreenNoisily, obtainItem, expirePowerup, die,
    startLevel, endLevel, tick, reset,
    sweepDead,
  }
})()
