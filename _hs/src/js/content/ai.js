/**
 * content/ai.js — AI horses with personality, throw rhythm, and lane bias.
 *
 * Each AI is constructed with random {aggression, accuracy, fatigue, laneBias,
 * cooldown}. Per CLAUDE.md AI patterns: tune *ranges*, randomize per-instance,
 * apply post-action cooldowns and hysteresis on lane switching.
 *
 * Difficulty in championship scales accuracy and aggression upward each
 * subsequent race so race 5 AIs are sharper than race 1.
 *
 * The AI fakes stamina similarly to the player so the commentator can fire
 * "tired" / "exhausted" lines for them too.
 */
content.ai = (() => {
  const ais = []

  function reset(horseList, difficulty = 0) {
    ais.length = 0
    for (const horse of horseList) {
      if (horse.isPlayer) continue
      ais.push(create(horse, difficulty))
    }
  }

  function create(horse, difficulty) {
    // difficulty ∈ [0, 1]; later races scale accuracy and aggression up.
    const d = Math.max(0, Math.min(1, difficulty))
    const rand = (a, b) => a + Math.random() * (b - a)
    return {
      horse,
      aggression: clamp(rand(0.35, 0.85) + d * 0.15, 0.2, 1),
      accuracy: clamp(rand(0.45, 0.85) + d * 0.15, 0.3, 0.98),
      fatigue: rand(0.4, 0.9),
      laneBias: Math.floor(rand(0, 5)),     // preferred home lane
      cooldown: rand(0.18, 0.42),           // seconds between throws (base)
      _nextThrowAt: 0,
      _lockedLane: -1,
      _streak: 0,
      // soft stamina model — drains on each throw, recovers when idle.
      _drainPerThrow: 0.04 + (1 - d) * 0.02,
      _recoverPerSec: 0.08 + d * 0.05,
    }
  }

  function frame(dt) {
    const now = engine.time()
    for (const ai of ais) {
      const h = ai.horse
      if (h.finishedAt != null) continue

      // Stamina drift.
      h.stamina = clamp(h.stamina + ai._recoverPerSec * dt - 0.0001, 0, 1)

      if (now < ai._nextThrowAt) continue

      // Decide whether to throw this tick. Tired AIs throw less often.
      const fatigueFactor = clamp(h.stamina, 0.2, 1)
      const want = ai.aggression * fatigueFactor
      // Throw probability per second above the base cooldown — gives natural
      // rhythm variation without flooding.
      if (Math.random() > want * 0.85) {
        ai._nextThrowAt = now + ai.cooldown * (0.6 + Math.random() * 0.6)
        continue
      }

      throwOnce(ai)
      // Post-action cooldown / breather (CLAUDE.md "Post-action cooldown").
      ai._nextThrowAt = now + ai.cooldown * (0.8 + Math.random() * 0.8)
    }
  }

  function throwOnce(ai) {
    const h = ai.horse
    h.stamina = Math.max(0, h.stamina - ai._drainPerThrow)
    content.horse.recordThrow(h)

    // Lane choice: aggression biases toward higher-value (narrower) lanes.
    // laneBias is the AI's "home" lane. Hysteresis: once locked into a lane,
    // resist switching unless aggression change would make a different lane
    // strictly better.
    const targetLane = pickLane(ai)
    if (ai._lockedLane === -1 || Math.random() < 0.18) {
      ai._lockedLane = targetLane
    }
    const aim = ai._lockedLane

    // Resolve hit: accuracy modulated by lane width — narrow lanes are harder
    // to hit even for high-accuracy AIs.
    const widthBoost = content.lanes.widthOf(aim) / content.lanes.widthOf(0)
    const hitProb = clamp(ai.accuracy * (0.5 + 0.5 * widthBoost), 0, 0.98)
    const hit = Math.random() < hitProb

    // Tiny FX for AI taps (positioned at horse, not throwing line) — we
    // intentionally use the simple ballThunk panned to lane so the *texture*
    // of the race feels populated. Routed through the "distant" submix so 5
    // simultaneous throws don't drown out the player's own hand.
    try {
      content.audio.ballThunk(aim, {distant: true})
    } catch (e) {}

    if (hit) {
      const value = content.lanes.valueOf(aim)
      const staminaFactor = Math.max(0.1, h.stamina)
      const advance = value * staminaFactor
      content.horse.advance(h, advance)
      ai._streak++
      try { content.audio.hitChime(aim, {distant: true}) } catch (e) {}
      try {
        content.race.pushEvent({kind: 'thunk', horseId: h.id, lane: aim})
        content.race.pushEvent({kind: 'hit', horseId: h.id, lane: aim, value, advance})
      } catch (e) {}
    } else {
      content.horse.recordMiss(h)
      ai._streak = 0
      try { content.race.pushEvent({kind: 'miss', horseId: h.id}) } catch (e) {}
    }
  }

  function pickLane(ai) {
    // Score each lane by (aggression * value) - (1 - aggression) * difficulty,
    // then add a small bias toward laneBias. Argmax.
    let bestLane = ai.laneBias
    let bestScore = -Infinity
    for (let i = 0; i < content.lanes.COUNT; i++) {
      const value = content.lanes.valueOf(i)
      const widthDifficulty = 1 - content.lanes.widthOf(i) / content.lanes.widthOf(0)
      const score = ai.aggression * value
        - (1 - ai.aggression) * widthDifficulty * 4
        + (i === ai.laneBias ? 0.6 : 0)
      if (score > bestScore) {
        bestScore = score
        bestLane = i
      }
    }
    return bestLane
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

  return {
    reset,
    frame,
    ais: () => ais.slice(),
  }
})()
