// The two enemies. 1O1 bot is an intelligent chaser; the rocket wanders
// erratically and, once you survive long enough, starts firing bullets.
// Enemy POSITIONS and SPEED persist across levels (they live in
// career.enemies). Speed scales with the PEAK level reached, so a level-drop
// nasty never slows them down. References siblings lazily.
content.enemies = (() => {
  const C = () => content.constants
  const S = () => content.state

  const CATCH_RADIUS = 0.9
  const voices = new Map()   // enemyId -> prop
  let peakLevel = 1
  let difficulty = 'normal'

  function initCareer(diff) {
    difficulty = diff
    peakLevel = 1
    silenceAll()
    const g = C().GRID
    const car = S().career()
    car.enemies = [{
      id: 'robot', type: C().ENEMY.ROBOT,
      col: g.min + 1, row: g.min + 1,
      baseSpeed: C().levelParams(diff, 1).enemySpeed,
      tempSpeedUntil: 0, tempSpeedMul: 1,
      alive: true, regenAt: 0,
      jitter: {dx: 0, dy: 0, until: 0},
      lastShotAt: 0,
    }]
  }

  function ensureRocket() {
    const car = S().career()
    if (car.enemies.some((e) => e.type === C().ENEMY.ROCKET)) return
    const g = C().GRID
    car.enemies.push({
      id: 'rocket', type: C().ENEMY.ROCKET,
      col: g.max - 1, row: g.max - 1,
      baseSpeed: C().levelParams(difficulty, peakLevel).enemySpeed * 1.1,
      tempSpeedUntil: 0, tempSpeedMul: 1,
      alive: true, regenAt: 0,
      wander: {dx: 1, dy: 0, until: 0},
      lastShotAt: 0,
    })
  }

  function scaleToLevel(n) {
    peakLevel = Math.max(peakLevel, n)
    const speed = C().levelParams(difficulty, peakLevel).enemySpeed
    const car = S().career()
    // The robot calls in the rocket from level 3 onward.
    if (peakLevel >= 3) ensureRocket()
    for (const e of car.enemies) {
      e.baseSpeed = e.type === C().ENEMY.ROCKET ? speed * 1.1 : speed
    }
  }

  function speedOf(e) {
    const mul = engine.time() < e.tempSpeedUntil ? e.tempSpeedMul : 1
    return e.baseSpeed * mul
  }

  // ----- voices -----
  function startVoice(e) {
    if (voices.has(e.id)) return
    const isRobot = e.type === C().ENEMY.ROBOT
    const prop = content.audio.makeProp({
      col: e.col, row: e.row, gain: 0, maxDistance: 34, power: 1.3,
      build: (out, ctx, detune) => {
        if (isRobot) {
          // An ENGINE ROLLING ON WHEELS, not a tonal buzz. The defining cue is a
          // per-step "chug" pulse whose rate AND punch scale with how fast the
          // bot is actually moving (see setRoll) — you hear it walking faster as
          // it closes in. Under the pulses sit a faint dark idle (so a stopped
          // bot stays locatable, engine ticking over) and a speed-driven wheel-
          // roll hiss. Everything passes through a soft body lowpass.
          const body = ctx.createBiquadFilter(); body.type = 'lowpass'; body.frequency.value = 3400; body.Q.value = 0.7
          body.connect(out)

          // Faint electric idle: a low square (buzzy, electronic) through a
          // lowpass, with a slow tremolo so it reads as a machine ticking over
          // rather than a clean drone. Always present so a stopped bot stays
          // locatable.
          const idle = ctx.createOscillator(); idle.type = 'square'; idle.frequency.value = 58
          if (detune) detune.connect(idle.detune)
          const idleLp = ctx.createBiquadFilter(); idleLp.type = 'lowpass'; idleLp.frequency.value = 320; idleLp.Q.value = 1
          const idleGain = ctx.createGain(); idleGain.gain.value = 0.10
          const idleTrem = ctx.createOscillator(); idleTrem.type = 'sine'; idleTrem.frequency.value = 7
          const idleTremG = ctx.createGain(); idleTremG.gain.value = 0.04
          idleTrem.connect(idleTremG).connect(idleGain.gain)
          idle.connect(idleLp).connect(idleGain).connect(body)

          // Rolling wheels: filtered noise, gain/cutoff set by setRoll().
          const wheels = ctx.createBufferSource()
          wheels.buffer = engine.buffer.brownNoise ? engine.buffer.brownNoise({channels: 1, duration: 3})
            : (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate); const ch = b.getChannelData(0); let last = 0; for (let i = 0; i < ch.length; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; ch[i] = last * 3.5 } return b })()
          wheels.loop = true
          const rollLp = ctx.createBiquadFilter(); rollLp.type = 'lowpass'; rollLp.frequency.value = 480; rollLp.Q.value = 0.7
          const rollGain = ctx.createGain(); rollGain.gain.value = 0.0
          wheels.connect(rollLp).connect(rollGain).connect(body)

          idle.start(); idleTrem.start(); wheels.start()

          // Pulse engine: one servo-STEP per wheel-step, rate from rolling
          // speed. Each step is three stacked layers that together read as a
          // small motorised robot taking a step: a servo whir, a metallic
          // gear/foot clank, and a low body thump.
          let roll = 0
          let stopped = false
          let timer = null
          let nextT = ctx.currentTime + 0.06

          function chug(t, intensity) {
            // 1. Servo whir: a resonant sawtooth that pitches up then settles,
            //    bandpassed so it whirs like a small motor actuating a joint.
            const sv = ctx.createOscillator(); sv.type = 'sawtooth'
            sv.frequency.setValueAtTime(150, t)
            sv.frequency.linearRampToValueAtTime(520, t + 0.035)
            sv.frequency.exponentialRampToValueAtTime(150, t + 0.11)
            if (detune) detune.connect(sv.detune)
            const svbp = ctx.createBiquadFilter(); svbp.type = 'bandpass'; svbp.frequency.value = 1000; svbp.Q.value = 4
            const svg = ctx.createGain()
            svg.gain.setValueAtTime(0.0001, t)
            svg.gain.linearRampToValueAtTime(0.24 * intensity, t + 0.008)
            svg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
            sv.connect(svbp).connect(svg).connect(body)
            sv.start(t); sv.stop(t + 0.14)

            // 2. Metallic clank: very short high-Q bandpass noise = the foot /
            //    gear striking the floor. The ring is what reads as "metal".
            const n = ctx.createBufferSource()
            const len = Math.ceil(ctx.sampleRate * 0.04)
            const b = ctx.createBuffer(1, len, ctx.sampleRate)
            const ch = b.getChannelData(0)
            for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len)
            n.buffer = b
            const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass'; nbp.frequency.value = 1700; nbp.Q.value = 7
            const ng = ctx.createGain()
            ng.gain.setValueAtTime(0.0001, t)
            ng.gain.linearRampToValueAtTime(0.16 * intensity, t + 0.003)
            ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
            n.connect(nbp).connect(ng).connect(body)
            n.start(t); n.stop(t + 0.06)

            // 3. Low thump for weight: a quick downward sine drop.
            const o = ctx.createOscillator(); o.type = 'sine'
            o.frequency.setValueAtTime(110, t)
            o.frequency.exponentialRampToValueAtTime(52, t + 0.09)
            if (detune) detune.connect(o.detune)
            const g = ctx.createGain()
            g.gain.setValueAtTime(0.0001, t)
            g.gain.linearRampToValueAtTime(0.34 * intensity, t + 0.006)
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
            o.connect(g).connect(body)
            o.start(t); o.stop(t + 0.14)
          }

          // Audio-clock lookahead so the chug cadence stays gapless.
          function pump() {
            if (stopped) return
            const horizon = ctx.currentTime + 0.12
            while (nextT < horizon) {
              if (roll > 0.04) {
                const pps = 1.5 + roll * 8          // ~1.5 (crawl) .. ~9.5 (full sprint) steps/sec
                chug(nextT, 0.4 + roll * 0.6)
                nextT += 1 / pps
              } else {
                nextT = ctx.currentTime + 0.1        // stopped: idle only, recheck soon
                break
              }
            }
            timer = setTimeout(pump, 25)
          }
          pump()

          return {
            stops: [
              () => { stopped = true; if (timer) clearTimeout(timer) },
              () => { try { idle.stop() } catch (e) {} },
              () => { try { idleTrem.stop() } catch (e) {} },
              () => { try { wheels.stop() } catch (e) {} },
            ],
            controls: {
              // s01 in [0,1]: 0 = stationary, 1 = rolling at full speed. Drives
              // the chug cadence (in pump) plus the wheel-roll hiss level/colour.
              setRoll(s01) {
                const tt = ctx.currentTime
                const s = Math.max(0, Math.min(1, s01))
                roll = s
                // Keep the continuous roll a faint texture under the steps —
                // the per-step chug carries the "rolling" feel, so a big hiss
                // here just muddies it. Silent when stopped.
                rollGain.gain.setTargetAtTime(s * 0.05, tt, 0.05)
                rollLp.frequency.setTargetAtTime(420 + s * 1000, tt, 0.06)
              },
            },
          }
        }
        // rocket: airy hiss + whine
        const noise = ctx.createBufferSource()
        noise.buffer = engine.buffer.whiteNoise ? engine.buffer.whiteNoise({channels: 1, duration: 2})
          : (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; return b })()
        noise.loop = true
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2
        const ng = ctx.createGain(); ng.gain.value = 0.5
        const whine = ctx.createOscillator(); whine.type = 'sawtooth'; whine.frequency.value = 520
        if (detune) detune.connect(whine.detune)
        const wg = ctx.createGain(); wg.gain.value = 0.25
        const wlfo = ctx.createOscillator(); wlfo.type = 'sine'; wlfo.frequency.value = 2.5
        const wlfoG = ctx.createGain(); wlfoG.gain.value = 120
        wlfo.connect(wlfoG).connect(whine.frequency)
        noise.connect(bp).connect(ng).connect(out)
        whine.connect(wg).connect(out)
        noise.start(); whine.start(); wlfo.start()
        return [
          () => { try { noise.stop() } catch (e) {} },
          () => { try { whine.stop() } catch (e) {} },
          () => { try { wlfo.stop() } catch (e) {} },
        ]
      },
    })
    voices.set(e.id, prop)
  }

  function killVoice(id) {
    const v = voices.get(id)
    if (v) { v.destroy(); voices.delete(id) }
  }
  function silenceAll() {
    for (const id of [...voices.keys()]) killVoice(id)
  }

  // Audition an enemy's looping voice on the learn screen: spin up a throwaway
  // voice under a reserved id (career frame() never touches it), drive it as if
  // rolling, and tear it down after a few seconds.
  function preview(type, world) {
    const g = C().GRID
    const w = world || {col: (g.cols - 1) / 2, row: (g.rows - 1) / 2 - 5}
    const id = '__preview_' + type
    killVoice(id)
    startVoice({id, type, col: w.col, row: w.row})
    const v = voices.get(id)
    if (v) {
      v.setGain(0.34)
      if (v.setRoll) v.setRoll(0.85)
    }
    setTimeout(() => killVoice(id), 3000)
  }

  // ----- movement -----
  function moveToward(e, tc, tr, dt) {
    const dc = tc - e.col, dr = tr - e.row
    const len = Math.hypot(dc, dr) || 1
    const sp = speedOf(e)
    e.col = content.field.clamp(e.col + (dc / len) * sp * dt)
    e.row = content.field.clamp(e.row + (dr / len) * sp * dt)
  }

  function chase(e, dt) {
    const p = S().player()
    const tracking = C().levelParams(difficulty, S().career().level).robotTracking
    if (e.type === C().ENEMY.ROCKET) {
      // Erratic: pick a new wander heading periodically, biased at the player.
      const now = engine.time()
      if (now >= e.wander.until) {
        const ang = Math.atan2(p.row - e.row, p.col - e.col) + (Math.random() * 2 - 1) * 1.4
        e.wander.dx = Math.cos(ang); e.wander.dy = Math.sin(ang)
        e.wander.until = now + 0.4 + Math.random() * 0.5
      }
      const sp = speedOf(e)
      e.col = content.field.clamp(e.col + e.wander.dx * sp * dt)
      e.row = content.field.clamp(e.row + e.wander.dy * sp * dt)
      return
    }
    // robot
    if (tracking === 'predict') {
      const lead = Math.min(2.5, Math.hypot(p.col - e.col, p.row - e.row) / Math.max(0.1, speedOf(e)))
      const pv = p.lastMoveDir, ps = (p.speed || 0)
      moveToward(e, p.col + pv.dx * ps * lead * 0.2, p.row + pv.dy * ps * lead * 0.2, dt)
    } else if (tracking === 'leaky') {
      const now = engine.time()
      if (now >= e.jitter.until) {
        e.jitter.dx = (Math.random() * 2 - 1) * 0.5
        e.jitter.dy = (Math.random() * 2 - 1) * 0.5
        e.jitter.until = now + 0.3
      }
      moveToward(e, p.col + e.jitter.dx, p.row + e.jitter.dy, dt)
    } else {
      moveToward(e, p.col, p.row, dt)
    }
  }

  function maybeShoot(e) {
    if (e.type !== C().ENEMY.ROCKET) return
    const lvl = S().level()
    const params = C().levelParams(difficulty, S().career().level)
    if (lvl.timer < params.rocketShootAfterS) return
    const now = engine.time()
    const cadence = 2.6 / Math.max(0.3, params.rocketAggro)
    if (now - e.lastShotAt < cadence) return
    e.lastShotAt = now
    if (content.bullets) {
      const p = S().player()
      const dc = p.col - e.col, dr = p.row - e.row
      const len = Math.hypot(dc, dr) || 1
      const bulletSpeed = params.enemySpeed * 1.8
      content.bullets.spawn({col: e.col, row: e.row}, {dx: (dc / len) * bulletSpeed, dy: (dr / len) * bulletSpeed})
    }
  }

  function frame() {
    const car = S().career()
    if (!car) return
    const dt = engine.loop.delta()
    const p = S().player()
    const now = engine.time()

    for (const e of car.enemies) {
      if (!e.alive) {
        if (now >= e.regenAt) regenerate(e)
        else { killVoice(e.id); continue }
      }
      startVoice(e)
      const pc0 = e.col, pr0 = e.row
      chase(e, dt)
      maybeShoot(e)
      if (content.items && content.items.tryEnemyGrab) content.items.tryEnemyGrab(e)

      const v = voices.get(e.id)
      if (v) {
        v.setPosition(e.col, e.row)
        const d = Math.hypot(e.col - p.col, e.row - p.row)
        // Robot chaser stays prominent (you must track it); the rocket is much
        // quieter with a steeper, items-style falloff so it doesn't blare.
        const isRobot = e.type === C().ENEMY.ROBOT
        const dGain = isRobot
          ? (d <= 3 ? 1 : Math.min(1, Math.pow(3 / d, 0.95)))
          : (d <= 2 ? 1 : Math.min(1, Math.pow(2 / d, 1.7)))
        v.setGain((isRobot ? 0.32 : 0.12) * dGain)
        v.applyBehind(content.audio.behindness(e.col, e.row))
        // Drive the wheel-roll from how far the bot actually travelled this
        // frame, normalised against its top speed (slows when cornering/walled).
        if (v.setRoll) {
          const inst = dt > 0 ? Math.hypot(e.col - pc0, e.row - pr0) / dt : 0
          v.setRoll(inst / Math.max(0.5, speedOf(e)))
        }
      }
    }
  }

  function checkCollisions() {
    const car = S().career()
    const p = S().player()
    if (!car || !p) return null
    for (const e of car.enemies) {
      if (!e.alive) continue
      if (Math.hypot(e.col - p.col, e.row - p.row) <= CATCH_RADIUS) {
        return e.type === C().ENEMY.ROCKET ? C().DEATH.ROCKET : C().DEATH.ROBOT
      }
    }
    return null
  }

  // Oil-slick kill: robot dies, big points, regenerates shortly.
  function kill(enemyId, cause) {
    const car = S().career()
    const e = car.enemies.find((x) => x.id === enemyId)
    if (!e || !e.alive) return
    e.alive = false
    e.regenAt = engine.time() + 1.2
    killVoice(e.id)
    content.audio.deathSound(cause || C().DEATH.OIL, {col: e.col, row: e.row})
    if (e.type === C().ENEMY.ROBOT) {
      content.scoring.award('killRobot')
      car.killedRobotCount++
      content.announcer.alert(app.i18n.t('ann.killRobot'))
    }
  }

  function regenerate(e) {
    const cell = content.field.randomFreeCell(null, {minFromPlayer: 8}) || {col: 1, row: 1}
    e.col = cell.col; e.row = cell.row
    e.alive = true
    e.regenAt = 0
  }

  function applyNastyEffect(effectId) {
    if (effectId !== C().NASTY.ROBOT_SPEEDUP) return
    const car = S().career()
    const robot = car.enemies.find((x) => x.type === C().ENEMY.ROBOT)
    if (robot) { robot.tempSpeedUntil = engine.time() + 6; robot.tempSpeedMul = 1.6 }
  }

  return {
    initCareer,
    scaleToLevel,
    frame,
    checkCollisions,
    kill,
    applyNastyEffect,
    silenceAll,
    preview,
    list: () => (S().career() ? S().career().enemies : []),
  }
})()
