/**
 * SPACE INVADERS! — runtime state.
 *
 * Two layers:
 *   _session — rebuilt on every startRun(). score, lives, wave, energy,
 *              weapon, chain head, enemy list, derived stats.
 *   _persistent — high scores live in app.highscores, NOT here. This module
 *                 just exposes the session.
 *
 * Cross-module strings are stored as i18n keys (gameOverReasonKey,
 * weapon labels) — never rendered text — so a locale switch mid-flight
 * stays coherent.
 *
 * Co-op-readiness: session.enemies is a flat array of `{id, kind, x, z,
 * dxPerSec, hp, chainIndex, pulsePhase}` records — no DOM refs, no
 * closures. engine.state.export() can serialise it directly when net code
 * arrives.
 */
content.state = (() => {
  const STARTING_LIVES = 3
  const STARTING_ENERGY = 100
  const MAX_ENERGY = 100

  let _session = null
  let _enemyIdCounter = 0

  function freshSession() {
    return {
      wave: 0,                      // current wave number (1-based once started)
      score: 0,
      lives: STARTING_LIVES,
      energy: STARTING_ENERGY,
      kills: 0,
      civiliansLost: 0,
      maxEnergy: MAX_ENERGY,

      // Aim / fire state
      aim: 0,                       // [-1, 1] stereo position
      lastFireTime: 0,              // engine.time() of last shot (drives regen lockout)
      fireRequested: false,         // edge-triggered each frame

      // Weapon
      weapon: 'pulse',              // 'pulse' | 'beam' | 'missile'
      weaponUnlocked: {pulse: true, beam: false, missile: false},

      // Chain combo
      chainExpected: 1,             // next chain index expected; 0 = no chain active
      chainMult: 1,                 // ×1..×4
      chainBroken: false,           // becomes true on any out-of-order kill / civilian / breach
      bestChainMult: 1,
      chainTaggingActive: false,    // true from wave 5 onward

      // Wave state
      waveSpawnQueue: [],           // pending spawns: list of {kind, atTime}
      waveClearedSpawns: 0,         // killed-or-passed counters per wave for clear detection
      waveTotalSpawns: 0,
      waveShipsReached: 0,          // hostile ships that breached this wave (not civilians)
      waveHostilesKilled: 0,        // hostiles the player actually killed this wave
      waveHostilesTotal: 0,         // hostiles the wave will spawn (excludes civilians)
      waveStartTime: 0,
      lullUntil: 0,                 // engine.time(); set during inter-wave breaks
      waveAllSpawnedAt: -1,         // engine.time when last enemy of the wave spawned

      // Per-wave one-shot tutorial flags
      friendliesActive: false,
      bomberTutorialPlayed: false,
      battleshipTutorialPlayed: false,
      civilianTutorialPlayed: false,
      chainTutorialPlayed: false,

      // Enemies in flight
      enemies: [],                  // [{id, kind, x, z, dxPerSec, hp, chainIndex, pulsePhase, voice}]

      // Game-over coordination (per pendingGameOver pattern)
      pendingGameOver: false,
      gameOverAt: 0,
      gameOverReasonKey: null,

      // Score thresholds for life extends — increasing intervals
      // 20k, 60k, 120k, 200k, 300k, ...
      nextExtendAt: 20000,
      nextExtendStep: 40000,        // increment to next threshold

      // Audible state machines
      lowEnergyOn: false,

      // Auto-announce trackers — last bucket / value the announcer told the
      // player about, so we don't spam. Each is updated when the announcer
      // speaks; checked against current state in game.tick().
      lastEnergyBucket: 4,           // floor(energy/25). Starts at 4 (=100%).
      lastChainAnnounced: 1,         // last chainMult we announced
      criticalAnnounced: false,      // assertive "energy critical" fires once per descent
      lastAimEdge: 'centre',         // 'left' | 'centre' | 'right'
      lastAimEdgeAt: 0,              // engine.time() of last edge announce
    }
  }

  function startRun() {
    _session = freshSession()
    _enemyIdCounter = 0
    return _session
  }

  function endRun() {
    // Caller (game module) is expected to call audio.silenceAll().
    // We keep _session around so gameover screen can still snapshot it,
    // until the next startRun() rebuilds.
  }

  function get() { return _session }

  function nextEnemyId() { return ++_enemyIdCounter }

  function isAlive() { return _session && _session.lives > 0 }

  return {
    startRun,
    endRun,
    get,
    nextEnemyId,
    isAlive,
    MAX_ENERGY,
  }
})()
