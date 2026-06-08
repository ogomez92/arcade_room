// Tunables for AIRLIFT. One place for the rescue mix and the difficulty curve so
// feel can be adjusted without touching the logic. AIRLIFT is an audio Choplifter:
// you fly a rescue chopper across a strip, hover over stranded survivors to winch
// them aboard, and ferry them home to base — while ground tanks shell you from
// below (dodge by moving off their column, or bomb them first). Endless waves;
// three lives; score = survivors delivered + tanks destroyed.
content.constants = (() => {
  const STARTING_LIVES = 3

  // The field is a horizontal strip. BASE is the left edge (x = 0); survivors and
  // tanks sit at x positions out to FIELD_W. The listener rides the chopper, so
  // everything is panned by its x RELATIVE to you (left stays left — never rotates).
  const FIELD_W = 100
  const BASE_X = 0
  const BASE_RADIUS = 5
  const MOVE_SPEED = 27       // units/sec (chopper drifts only while you hold L/R)

  const CAP = 3               // survivors aboard at once before you must deliver
  const PICKUP_RADIUS = 4.5   // how close to a survivor's x you must hover
  const HOVER_TIME = 0.85     // seconds holding still over a survivor to winch them up

  const BOMB_CD = 0.6
  const BOMB_FALL = 0.4       // seconds for a dropped bomb to reach the ground
  const BOMB_RADIUS = 6       // a tank within this of the bomb's x is destroyed
  // Bombs are LIMITED — you can't simply level the field. Start with a few, earn
  // more each cleared wave. This is what keeps tanks a standing threat → bounded.
  const BOMB_AMMO_START = 4
  const BOMB_AMMO_PER_WAVE = 3

  const RISE_TIME = 0.5       // seconds for a fired tank shell to reach your altitude
  const HIT_RADIUS = 3.5      // chopper within this of the tank's x when the shell tops out = hit
                             // (narrow, so even a dense line of tanks leaves gaps to dodge into)
  const INVULN = 1.6

  // Per-wave shape: more survivors farther out, more tanks, firing sooner + with a
  // shorter aim telegraph (your warning to leave their column).
  function waveConfig(wave) {
    const w = Math.max(1, wave)
    const survivors = Math.min(3 + Math.floor(w * 0.8), 10)
    // tanks grow dense (their hit-columns overlap late, so the strip becomes a
    // gauntlet) and fire fast with a shrinking telegraph — eventually you can't
    // thread it while also stopping to winch survivors up.
    const tanks = Math.min(2 + Math.round(w * 1.4), 14)
    const tankFireEvery = Math.max(1.0, 4.3 - 0.34 * (w - 1)) // avg seconds between a tank's shots
    const tankAim = Math.max(0.34, 0.78 - 0.035 * (w - 1))    // telegraph before a shell launches
    return {survivors, tanks, tankFireEvery, tankAim}
  }

  // Scoring: delivering a full load at once pays a stacking bonus, so brave runs
  // (carry more before heading home) beat one-at-a-time ferrying.
  const DELIVER_POINTS = 80
  const TANK_POINTS = 60
  function deliverBonus(n) { return DELIVER_POINTS * n * (1 + (n - 1) * 0.5) } // 1→80, 2→240, 3→480
  function waveBonus(wave) { return 150 * Math.max(1, wave) }

  return {
    STARTING_LIVES,
    FIELD_W, BASE_X, BASE_RADIUS, MOVE_SPEED,
    CAP, PICKUP_RADIUS, HOVER_TIME,
    BOMB_CD, BOMB_FALL, BOMB_RADIUS, BOMB_AMMO_START, BOMB_AMMO_PER_WAVE,
    RISE_TIME, HIT_RADIUS, INVULN,
    waveConfig,
    DELIVER_POINTS, TANK_POINTS, deliverBonus, waveBonus,
    MAX_SCORE: 9999999,
  }
})()
