// Sonar for aiming. Beeps quicker and higher-pitched the more accurate your aim is
// at the target, and within the current weapon's range. Press shift+F or shift+R to
// switch between primary/secondary range context.
content.sonar = (() => {
  const context = () => engine.context()

  let active = false,
    node,
    lastBeep = 0,
    currentPitch = 440,
    currentRate = 0,
    mode = 'primary' // or 'secondary'

  function ensureNode() {
    if (node) return
    node = context().createGain()
    node.gain.value = 0
    node.connect(engine.mixer.input())
  }

  function beep() {
    const ctx = context()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = currentPitch
    const t = engine.time()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(0.1, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(g)
    g.connect(node)
    osc.start()
    osc.stop(t + 0.07)
  }

  // delta, local pos, local yaw, opponent pos, weapon def
  function update(delta, localPos, localYaw, oppPos, weaponDef) {
    if (!active || !weaponDef) return
    ensureNode()

    const dx = oppPos.x - localPos.x,
      dy = oppPos.y - localPos.y,
      dist = Math.hypot(dx, dy),
      rel = content.util.relativeYaw(localYaw, dx, dy),
      abs = Math.abs(rel)

    // Out of range: silent
    if (dist > (weaponDef.range || 1) * 1.1) {
      node.gain.setTargetAtTime(0, engine.time(), 0.05)
      return
    }

    // Aim cone: 0 = directly ahead, pi = behind
    // Quieter and slower the further off aim.
    // t: 0 behind, 1 perfectly on target.
    const aimT = Math.max(0, 1 - (abs / content.constants.sonar.maxAngle))

    if (aimT <= 0) {
      node.gain.setTargetAtTime(0, engine.time(), 0.05)
      return
    }

    // Volume scales from quiet (0.1) to loud (0.8)
    const vol = 0.1 + aimT * 0.7
    node.gain.setTargetAtTime(vol, engine.time(), 0.05)

    // Rate: slow (1 hz) to fast (10 hz)
    currentRate = 1 + aimT * 9

    // Pitch: low (300) to high (1200)
    currentPitch = 300 + aimT * 900

    lastBeep += delta
    const interval = 1 / currentRate
    if (lastBeep >= interval) {
      lastBeep = 0
      beep()
    }
  }

  return {
    start: () => {
      active = true
      ensureNode()
      lastBeep = 0
    },
    stop: () => {
      active = false
      if (node) node.gain.setTargetAtTime(0, engine.time(), 0.05)
    },
    setMode: (m) => { mode = m },
    getMode: () => mode,
    update,
  }
})()
