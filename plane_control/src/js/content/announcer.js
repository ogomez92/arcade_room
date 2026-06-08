// Speech routing. Wraps app.announce (polite/assertive) with a per-channel
// spam window so routine chatter doesn't flood the screen reader, and exposes
// one method per status hotkey + per game event. Optional TTS fallback (off by
// default) for players without a screen reader. References siblings lazily.
content.announcer = (() => {
  const I = () => app.i18n
  const S = () => content.state
  const A = () => content.airspace

  let useTts = false
  const lastAt = new Map()

  function setUseTts(on) { useTts = !!on }

  function tts(msg) {
    if (!useTts || !window.speechSynthesis) return
    try {
      const u = new SpeechSynthesisUtterance(msg)
      const loc = I().locale && I().locale()
      if (loc) u.lang = loc
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    } catch (e) {}
  }

  function polite(msg, key, minGapS = 0) {
    if (key && minGapS > 0) {
      const now = engine.time()
      const prev = lastAt.get(key) || -Infinity
      if (now - prev < minGapS) return
      lastAt.set(key, now)
    }
    app.announce.polite(msg)
    tts(msg)
  }
  function assertive(msg) { app.announce.assertive(msg); tts(msg) }
  function reset() { lastAt.clear() }
  function t(key, params) { return I().t(key, params) }

  function dir(key) { return t('dir.' + key) }

  // ----- selection / readouts -----

  // Full readout of a plane: callsign, bearing from tower, distance, fuel.
  function describe(p) {
    if (!p) return
    assertive(t('ann.plane', {
      name: p.name,
      bearing: dir(A().bearingFromTower(p)),
      distance: Math.round(A().distToTower(p)),
      fuel: Math.max(0, Math.round(p.fuel)),
    }))
  }

  function selected(p) {
    if (!p) { assertive(t('ann.noPlanes')); return }
    describe(p)
  }

  function heading(p) {
    if (!p) return
    polite(t('ann.heading', {name: p.name, dir: dir(A().compass(p.heading))}))
  }

  function status() {
    const car = S().career()
    if (!car) return
    assertive(t('ann.status', {
      airborne: S().airborne().length,
      landed: car.landed,
      score: Math.round(car.score),
    }))
  }

  // ----- events -----

  function arrival(p) {
    polite(t('ann.arrival', {name: p.name, bearing: dir(A().bearingFromTower(p))}), 'arrival', 0)
  }
  function clearedToLand(p) { assertive(t('ann.cleared', {name: p.name})) }
  function holding(p) { polite(t('ann.holding', {name: p.name})) }
  function runwayBusy() { polite(t('ann.runwayBusy'), 'busy', 1.0) }
  function landed(p, points) { assertive(t('ann.landed', {name: p.name, points})) }
  function lowFuel(p) { polite(t('ann.lowFuel', {name: p.name, fuel: Math.max(0, Math.round(p.fuel))}), 'low.' + p.id, 6) }
  function conflict(a, b) { polite(t('ann.conflict', {a: a.name, b: b.name}), 'conflict', 1.2) }

  function gameOver(cause, score, landedCount) {
    assertive(t('ann.crash.' + cause) + ' ' + t('ann.gameOver', {score: Math.round(score), landed: landedCount}))
  }
  function paused(on) { assertive(t(on ? 'ann.paused' : 'ann.resumed')) }

  return {
    setUseTts,
    reset,
    describe,
    selected,
    heading,
    status,
    arrival,
    clearedToLand,
    holding,
    runwayBusy,
    landed,
    lowFuel,
    conflict,
    gameOver,
    paused,
    info: (msg) => polite(msg),
    alert: (msg) => assertive(msg),
  }
})()
