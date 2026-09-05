// Tunables for TALON. One place for the flight model, the enemy roster and the
// difficulty curve so feel can be adjusted without touching the logic. TALON is
// an audio Joust: you FLAP to fight gravity and hold an altitude, and you unseat
// an enemy rider by being HIGHER than it the instant it reaches you — or evade a
// clash you would lose. Enemies close in from the eight compass bearings.
content.constants = (() => {
  const STARTING_LIVES = 3

  // The eight compass bearings, clockwise from North. PLAYER-LOCKED: north is
  // always ahead, east right, south behind, west left — the listener never
  // rotates, so a bearing always sounds from the same place. This is the PAN
  // axis (where an enemy is). ALTITUDE is a separate axis carried by PITCH.
  const _names = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  const DIRS = _names.map((id, i) => {
    const angle = (i * Math.PI) / 4
    return {id, index: i, label: 'dir.' + id, angle, dx: Math.sin(angle), dy: -Math.cos(angle)}
  })

  // Flight model. Altitude runs 0 (ground) .. 1 (ceiling). A FLAP sets a strong
  // upward velocity; gravity pulls you back down every frame, so you bob and must
  // keep flapping to stay aloft — that effort IS the game. One flap from rest
  // peaks at ~+0.21 altitude after ~0.46s, then falls back; rapid flaps climb.
  const FLAP_V = 0.72      // upward velocity (altitude units/sec) added per flap
  const GRAVITY = 1.5      // downward acceleration (altitude units/sec^2) — gentle
                           // enough to hold and fine-tune an altitude by ear
  // You unseat a rider only by MEETING it at its height: if your altitude is
  // within MATCH_TOL of its altitude when it reaches you, you unseat it; too high
  // OR too low and it unseats you. So there is no safe altitude — low swoopers
  // pull you down, high soarers pull you up, and you must keep matching each
  // rider's height (its blip's pitch) or evade. The band is generous.
  const MATCH_TOL = 0.18

  // Combing a clash you would lose: a single Evade defeats the most imminent
  // enemy within EVADE_WINDOW of contact, then the helm needs EVADE_COOLDOWN.
  const EVADE_WINDOW = 0.26   // range below which an enemy can be evaded
  const EVADE_COOLDOWN = 0.6

  // Stamina is what stops you from just camping the ceiling. Each flap spends
  // FLAP_COST; it regenerates at STAMINA_REGEN/sec. Flying high means flapping
  // hard, which drains you — so you climb to meet a high soarer, then must glide
  // lower to recover, where the low swoopers live. Out of stamina, a flap gives
  // no lift and you sink (vulnerable) until it refills.
  const FLAP_COST = 0.07
  const STAMINA_REGEN = 0.22  // generous — stamina only punishes frantic over-flapping;
                              // matching each rider's height is the real challenge

  // Enemy archetypes by altitude band. `alt[min,max]` is the height it flies at
  // (its blip's PITCH); you must be at least that high (− tol) to win. `speed` is
  // the closing rate (range 1 -> 0). Low swoopers need only a light flap; high
  // soarers demand a hard climb — but they close slowly, giving you time.
  const TYPES = {
    swooper: {id: 'swooper', alt: [0.16, 0.34], speed: 0.34, points: 12, timbre: 'swooper'},
    glider:  {id: 'glider',  alt: [0.42, 0.60], speed: 0.26, points: 18, timbre: 'glider'},
    soarer:  {id: 'soarer',  alt: [0.70, 0.92], speed: 0.18, points: 28, timbre: 'soarer'},
  }

  // How an enemy's blip repeat interval shrinks as it closes — a quickening blip
  // means a clash is imminent (and its timbre then tells you matched vs threat).
  function blipInterval(range) {
    const r = Math.max(0, Math.min(1, range))
    return 0.18 + r * 0.62 // ~0.8s far -> ~0.18s at contact
  }

  // Combo: +1 per unseat, resets when you take a hit.
  function comboMultiplier(combo) { return 1 + Math.floor(combo / 6) }
  const COMBO_MILESTONES = [8, 20, 40, 80, 160]

  // Per-wave shape: more riders, faster closing, tighter spawns, a roster that
  // shifts toward high soarers (more flapping) and crowds that converge at mixed
  // altitudes you cannot all beat with one height — so you prioritise + evade.
  function waveConfig(wave) {
    const w = Math.max(1, wave)
    const speedMul = Math.min(3.0, 1 + 0.085 * (w - 1))
    const count = Math.min(5 + Math.round(w * 1.5), 44)
    const spawnInterval = Math.max(0.42, 1.9 - 0.09 * (w - 1))
    // Fewer riders at once early so you can match them one by one; late waves
    // close fast enough that arrivals BUNCH at mixed altitudes you cannot all
    // reach in time — that overwhelm (past your evade cooldown) ends the run.
    const concurrentCap = Math.min(2 + Math.floor(w / 1.4), 10)
    const soarW = Math.min(0.4, 0.12 + 0.026 * (w - 1))
    const swoopW = Math.max(0.22, 0.58 - 0.02 * (w - 1))
    const glideW = Math.max(0.2, 1 - soarW - swoopW)
    return {speedMul, count, spawnInterval, concurrentCap, weights: {swooper: swoopW, glider: glideW, soarer: soarW}}
  }

  function waveClearBonus(wave) { return 60 * Math.max(1, wave) }

  return {
    STARTING_LIVES,
    DIRS,
    FLAP_V,
    GRAVITY,
    MATCH_TOL,
    EVADE_WINDOW,
    EVADE_COOLDOWN,
    FLAP_COST,
    STAMINA_REGEN,
    TYPES,
    blipInterval,
    comboMultiplier,
    COMBO_MILESTONES,
    waveConfig,
    waveClearBonus,
    MAX_SCORE: 9999999,
  }
})()
