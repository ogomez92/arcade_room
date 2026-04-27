// Persistent + per-run state container for the Solvalou.
//
// Static (per session) values like score and level live here while the game
// is running. Persistent values like cash and unlocked upgrades are mirrored
// into engine.state so that app.autosave persists them across sessions.

content.state = (() => {
  const initial = {
    cash: 0,
    permanent: {
      // Store-purchased upgrades — these survive death so they keep
      // accumulating across runs (matches the original "session" model).
      rZaptime: 300,
      rBeamvel: 40,
      rBombarea: 4,
      rPowertime: 20000,
    },
  }

  const session = {
    alive: false,
    paused: false,
    playing: false,

    score: 0,
    totalScore: 0,
    level: 0,
    lives: 5,
    bursts: 0,
    shieldbits: 0,

    // Player position
    x: 5,
    y: 0,
    speed: 500, // ms per forward step (300 fastest, 700 slowest)
    checky: 0,

    maxlev: 101,

    // Active powerup deltas (set to base values then overridden temporarily)
    zaptime: 300,
    beamvel: 40,
    bombarea: 4,
    powertime: 20000,

    // Combo
    combovalue: 0,
    combotimer: 0,

    // Power-up timer
    poweruptimer: 0,

    // Extends thresholds
    extendCount: 1,
    lastExtend: 0,
    extendThreshold: 20000,

    // Genesis state
    genesisActive: false,
    destroyedGenesis: false,
    inDanger: false,
    dangerLoopRef: null,

    // Tower state
    toweractive: false,
    towertime: 0, // counts down
    towerWindow: 0, // open window after the alarm

    // Item spawn
    itemtime: 0,

    // Spawn cycle
    spawntime: 0,

    // Store request
    gotostore: false,

    // Movement timers
    moveTimer: 0,
    turnTimer: 0,

    // Store session counter (drives store costs)
    storeSession: 0,
    storeExtends: 0,
    storeShieldbits: 0,
    storeBursts: 0,
  }

  return {
    initial,
    session,

    persistent: {
      cash: initial.cash,
      ...initial.permanent,
    },

    onImport: function (data = {}) {
      if (typeof data.cash == 'number') this.persistent.cash = data.cash
      if (data.permanent) Object.assign(this.persistent, data.permanent)
    },

    export: function () {
      return {
        cash: this.persistent.cash,
        permanent: {
          rZaptime: this.persistent.rZaptime,
          rBeamvel: this.persistent.rBeamvel,
          rBombarea: this.persistent.rBombarea,
          rPowertime: this.persistent.rPowertime,
        },
      }
    },

    resetSession: function () {
      // Reset session for a brand new run; keep persistent upgrades.
      Object.assign(session, {
        alive: true,
        paused: false,
        playing: false,
        score: 0,
        totalScore: 0,
        level: 0,
        lives: 5,
        bursts: 0,
        shieldbits: 0,
        x: 5,
        y: 0,
        speed: 500,
        checky: 0,
        maxlev: 101,
        zaptime: this.persistent.rZaptime,
        beamvel: this.persistent.rBeamvel,
        bombarea: this.persistent.rBombarea,
        powertime: this.persistent.rPowertime,
        combovalue: 0,
        combotimer: 0,
        poweruptimer: 0,
        extendCount: 1,
        lastExtend: 0,
        extendThreshold: 20000,
        genesisActive: false,
        destroyedGenesis: false,
        inDanger: false,
        dangerLoopRef: null,
        toweractive: false,
        towertime: rand(25, 50) * 1000,
        towerWindow: 0,
        itemtime: rand(20, 50) * 1000,
        spawntime: 1000,
        gotostore: false,
        moveTimer: 0,
        turnTimer: 0,
        storeSession: 0,
        storeExtends: 0,
        storeShieldbits: 0,
        storeBursts: 0,
      })
    },

    addCash: function (n) { this.persistent.cash = Math.max(0, this.persistent.cash + n) },
    addScore: function (n) {
      session.score += n
      session.totalScore += n
      // Extend at 20000, 60000, 120000, 200000... (current + 20000*xn)
      while (session.totalScore >= session.extendThreshold) {
        session.lives++
        this.addCash(session.lives * 5)
        content.audio && content.audio.extend()
        session.extendCount++
        session.extendThreshold += 20000 * session.extendCount
      }
    },
  }

  function rand(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1))
  }
})()
