/**
 * content/cursor.js — continuous sweeping audio cursor.
 *
 * Triangle wave sweeping through [0, 1] with period CURSOR_PERIOD (1.6s by
 * default). Each frame, on lane-window *enter*, emit a quiet position tone so
 * the player has constant bearing on which lane they would hit if they fired
 * right now. Calling tap() captures the lane at the moment of the call so
 * downstream resolution is independent of timing jitter.
 */
content.cursor = (() => {
  const CURSOR_PERIOD = 1.6  // seconds — full there-and-back sweep

  let phase = 0               // [0, 1) — wraps once per CURSOR_PERIOD
  let currentLane = -1
  let lastTickedLane = -1

  function reset() {
    phase = 0
    currentLane = -1
    lastTickedLane = -1
  }

  function frame(dt) {
    // Phase advances linearly; we map it to a triangle below for the actual
    // [0,1] sweep position so the cursor lingers slightly at the edges, which
    // makes the bullseye lanes (at the extremes) feel more catchable.
    phase += dt / CURSOR_PERIOD
    if (phase >= 1) phase -= Math.floor(phase)

    const t = triangle(phase)
    currentLane = content.lanes.laneAtCursor(t)

    if (currentLane !== lastTickedLane) {
      try { content.audio.cursorTick(currentLane) } catch (e) { console.error(e) }
      lastTickedLane = currentLane
    }
  }

  function triangle(p) {
    // 0..0.5 ramp 0→1, 0.5..1 ramp 1→0.
    return p < 0.5 ? p * 2 : 2 - p * 2
  }

  function getPhase() { return phase }
  function getCurrentLane() { return currentLane }
  function getCursorX() { return triangle(phase) }

  // Capture the lane at the moment of tap so race resolution is independent
  // of frame timing.
  function tap() {
    return getCurrentLane()
  }

  return {
    CURSOR_PERIOD,
    reset,
    frame,
    getPhase,
    getCurrentLane,
    getCursorX,
    tap,
  }
})()
