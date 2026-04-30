/**
 * content/player.js — player state and tap resolution.
 *
 * Stamina drains while the throw key is held and *also* per tap (small fixed
 * cost), recovers when not pressing. A depleted player still throws but for
 * less reward — the lane-value advance is scaled by max(stamina, 0.1).
 */
content.player = (() => {
  const RECOVER_REST = 0.34         // per second when not tapping
  const RECOVER_TAPPING = 0.10      // per second while actively tapping
  const TAP_COST = 0.07             // fixed stamina cost per tap

  // Tap rate-limit so auto-repeat keypresses don't fire 30+ taps/sec.
  const MIN_TAP_INTERVAL = 0.12

  // Window after a tap during which we treat the player as "actively tapping"
  // for stamina-recovery purposes — encourages periods of rest.
  const TAPPING_WINDOW = 0.4

  let horse = null
  let lastTapAt = -1

  function bind(playerHorse) {
    horse = playerHorse
    lastTapAt = -1
  }

  // Player taps the throw key — resolve hit/miss against the current cursor
  // lane. Returns {hit: bool, lane, value, advance} so callers (audio,
  // commentator) can react.
  function tap() {
    if (!horse) return null
    const t = engine.time()
    if (t - lastTapAt < MIN_TAP_INTERVAL) return null
    lastTapAt = t

    horse.stamina = Math.max(0, horse.stamina - TAP_COST)
    content.horse.recordThrow(horse)

    // Lane-window resolution at moment of tap.
    const lane = content.cursor.tap()

    // Audio: every tap thunks even if it misses. Gives the player rhythm
    // feedback regardless.
    try { content.audio.ballThunk(lane) } catch (e) { console.error(e) }

    // Hit detection: cursor lane is the lane the player chose. Always a
    // "hit" geometrically because the sweep covers all lane windows. The
    // skill ceiling is *which* lane the cursor was at, not whether it was
    // in any lane.
    const value = content.lanes.valueOf(lane)
    const staminaFactor = Math.max(0.1, horse.stamina)
    const advance = value * staminaFactor

    content.horse.advance(horse, advance)
    try { content.audio.hitChime(lane) } catch (e) { console.error(e) }

    // Network relay: ride the next snapshot so remote clients replay locally
    // through their own listener pose (CLAUDE.md "audio-event relay queue").
    try {
      content.race.pushEvent({kind: 'thunk', horseId: horse.id, lane})
      content.race.pushEvent({kind: 'hit', horseId: horse.id, lane, value, advance})
    } catch (e) {}

    return {hit: true, lane, value, advance, staminaFactor}
  }

  function frame(dt) {
    if (!horse) return
    const sinceTap = engine.time() - lastTapAt
    const isTapping = sinceTap >= 0 && sinceTap < TAPPING_WINDOW
    const recovery = isTapping ? RECOVER_TAPPING : RECOVER_REST
    horse.stamina = clamp(horse.stamina + recovery * dt, 0, 1)
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  function getStamina() { return horse ? horse.stamina : 0 }
  function getHorse() { return horse }

  return {
    RECOVER_REST, RECOVER_TAPPING, TAP_COST, MIN_TAP_INTERVAL,
    bind,
    tap,
    frame,
    getStamina,
    getHorse,
  }
})()
