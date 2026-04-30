/**
 * content/horse.js — common state shape for player + AI horses.
 *
 * Each horse advances along a 1D track. Per-frame:
 *   - consume queued advances (from advance(amount))
 *   - apply small per-frame coast forward proportional to recent throw rate
 *   - update pace for the audio gallop voice
 *
 * The horse is purely a state holder; player.js and ai.js are the deciders.
 */
content.horse = (() => {
  // Lane index here means "which slot in the field", not the throw lane.
  // Used purely for spatial-audio rendering.

  function create({id, name, isPlayer, lane}) {
    return {
      id,
      name,
      isPlayer: !!isPlayer,
      lane: lane != null ? lane : 0,
      // Race state.
      distance: 0,
      pace: 0,
      _paceTarget: 0,
      _paceVel: 0,
      // Throw bookkeeping (for both player and AI).
      throws: 0,
      hits: 0,
      misses: 0,
      streak: 0,
      _recentTaps: [],   // rolling [t] of recent tap times
      // Stamina (player drives this; AI fakes a soft model).
      stamina: 1,
      // Last advance value, used by commentator for "bullseye".
      lastHitValue: 0,
      lastTapAt: 0,
      // Finishing.
      finishedAt: null,    // race time at finish (null = still running)
      finishOrder: null,
    }
  }

  function advance(horse, value) {
    horse.hits++
    horse.streak++
    horse.lastHitValue = value
    horse._recentTaps.push({t: nowSec(), advance: value})
    pruneTaps(horse)
    horse.distance += value * 4   // tile-distance per hit; tunable
  }

  function recordMiss(horse) {
    horse.misses++
    horse.streak = 0
    horse._recentTaps.push({t: nowSec(), advance: 0})
    pruneTaps(horse)
  }

  function recordThrow(horse) {
    horse.throws++
    horse.lastTapAt = nowSec()
  }

  function frame(horse, dt) {
    pruneTaps(horse)
    // Pace target: throws-per-second over the last 2.5 s, normalized to [0,1]
    // around an idealized 4 throws/sec.
    const window = 2.5
    const recent = horse._recentTaps.length
    const tps = recent / window
    horse._paceTarget = Math.min(1, tps / 4)

    // Smooth toward the target so the gallop tempo doesn't jitter.
    const decay = 4
    horse.pace += (horse._paceTarget - horse.pace) * Math.min(1, decay * dt)

    // Coast forward in proportion to current pace (the horse is *running*,
    // not teleporting) — this is the bulk of forward motion. Throws are
    // bursts on top of the coast. Stamina pulls coast down to 0.5x at empty
    // so a depleted horse actually slows, not just throws softer.
    const stam = (horse.stamina != null) ? Math.max(0, Math.min(1, horse.stamina)) : 1
    const staminaMul = 0.5 + 0.5 * stam
    horse.distance += horse.pace * 28 * dt * staminaMul
  }

  function pruneTaps(horse) {
    const cutoff = nowSec() - 2.5
    while (horse._recentTaps.length && horse._recentTaps[0].t < cutoff) {
      horse._recentTaps.shift()
    }
  }

  function nowSec() {
    return engine.time()
  }

  return {
    create,
    advance,
    recordMiss,
    recordThrow,
    frame,
  }
})()
