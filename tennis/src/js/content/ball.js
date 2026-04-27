// Ball state. The ball lives in 3D — (x, y) on the court (metres) plus
// z above the surface. Physics integrates with gravity and a light
// quadratic drag; spin is tracked as topspin/slice magnitude that
// nudges the bounce angle.
//
// State machine: 'idle' (held by server) → 'tossed' (ascending,
// awaiting strike) → 'inFlight' → 'bounced' (after first bounce) →
// 'dead' (out of bounds or second bounce). The physics module reads
// state transitions from here.
content.ball = (() => {
  const G = 9.81
  // Quadratic drag coefficient — the ball loses energy as it flies.
  // With this value a 30 m/s shot decays to ~24 m/s by the far baseline.
  const DRAG = 0.012
  // Coefficient of restitution off the court — 0.7 is typical for a
  // hard court.
  const COURT_REST = 0.7
  // A hit ball's height after a normal-trajectory groundstroke.
  const HIT_HEIGHT = 0.9

  let pos = {x: 0, y: 0, z: 0}
  let vel = {x: 0, y: 0, z: 0}
  let spin = 0          // -1 (heavy slice) … +1 (heavy topspin)
  let state = 'idle'    // 'idle' | 'tossed' | 'inFlight' | 'bounced' | 'dead'
  let lastHitter = null // 'south' | 'north'
  let bouncesSinceHit = 0
  let lastBouncePos = null

  function setPosition(p) {
    pos = {x: p.x || 0, y: p.y || 0, z: p.z || 0}
  }
  function setVelocity(v) {
    vel = {x: v.x || 0, y: v.y || 0, z: v.z || 0}
  }
  function getPosition() { return {...pos} }
  function getVelocity() { return {...vel} }
  function getState() { return state }
  function setState(s) { state = s }
  function getSpin() { return spin }
  function setSpin(s) { spin = Math.max(-1, Math.min(1, s)) }
  function getLastHitter() { return lastHitter }
  function setLastHitter(s) { lastHitter = s }
  function getBouncesSinceHit() { return bouncesSinceHit }
  function setBouncesSinceHit(n) { bouncesSinceHit = n }
  function getLastBouncePos() { return lastBouncePos ? {...lastBouncePos} : null }
  function setLastBouncePos(p) { lastBouncePos = p ? {...p} : null }
  function speed() {
    return Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z)
  }
  function horizontalSpeed() {
    return Math.sqrt(vel.x*vel.x + vel.y*vel.y)
  }

  function reset() {
    pos = {x: 0, y: 0, z: 0}
    vel = {x: 0, y: 0, z: 0}
    spin = 0
    state = 'idle'
    lastHitter = null
    bouncesSinceHit = 0
    lastBouncePos = null
  }

  return {
    G,
    DRAG,
    COURT_REST,
    HIT_HEIGHT,
    setPosition, getPosition,
    setVelocity, getVelocity,
    getState, setState,
    getSpin, setSpin,
    getLastHitter, setLastHitter,
    getBouncesSinceHit, setBouncesSinceHit,
    getLastBouncePos, setLastBouncePos,
    speed, horizontalSpeed,
    reset,
  }
})()
