// Rocket bullets. Transient projectiles with a per-bullet looping whoosh.
// Multiple can be airborne at once. They expire on hitting a wall or after
// their lifetime; a bullet within hit range of the player is a death.
content.bullets = (() => {
  const C = () => content.constants
  const S = () => content.state

  const HIT_RADIUS = 0.7
  const LIFETIME = 6
  const list = []           // {id, col, row, vx, vy, born}
  const voices = new Map()
  let nextId = 1

  function spawn(from, vel) {
    const id = 'b' + (nextId++)
    const b = {id, col: from.col, row: from.row, vx: vel.dx, vy: vel.dy, born: engine.time()}
    list.push(b)
    startVoice(b)
    return b
  }

  function startVoice(b) {
    const prop = content.audio.makeProp({
      col: b.col, row: b.row, gain: 0.09, maxDistance: 28, power: 1.8,
      build: (out, ctx, detune) => {
        // Airy projectile WHOOSH, not a tonal saw (a steady pitched saw read as
        // a trumpet). Looping filtered noise = rushing air; a slow bandpass
        // wobble keeps it alive; a faint low body adds rocket weight without a
        // clear pitch.
        const noise = ctx.createBufferSource()
        noise.buffer = engine.buffer.whiteNoise
          ? engine.buffer.whiteNoise({channels: 1, duration: 2})
          : (() => { const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1; return b })()
        noise.loop = true
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.8
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600
        const ng = ctx.createGain(); ng.gain.value = 0.9
        noise.connect(bp).connect(hp).connect(ng).connect(out)
        // Slow bandpass wobble so the rush shimmers instead of sitting static.
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 6
        const lfoG = ctx.createGain(); lfoG.gain.value = 400
        lfo.connect(lfoG).connect(bp.frequency)
        // Faint low body for weight (no clear pitch at this gain).
        const body = ctx.createOscillator(); body.type = 'triangle'; body.frequency.value = 150
        if (detune) detune.connect(body.detune)
        const bg = ctx.createGain(); bg.gain.value = 0.16
        body.connect(bg).connect(out)
        noise.start(); lfo.start(); body.start()
        return [
          () => { try { noise.stop() } catch (e) {} },
          () => { try { lfo.stop() } catch (e) {} },
          () => { try { body.stop() } catch (e) {} },
        ]
      },
    })
    voices.set(b.id, prop)
  }

  function killVoice(id) {
    const v = voices.get(id)
    if (v) { v.destroy(); voices.delete(id) }
  }

  function remove(i) {
    const b = list[i]
    if (!b) return
    killVoice(b.id)
    list.splice(i, 1)
  }

  function frame() {
    const dt = engine.loop.delta()
    const now = engine.time()
    const p = S().player()
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]
      b.col += b.vx * dt
      b.row += b.vy * dt
      if (!content.field.inBounds(b.col, b.row) || now - b.born > LIFETIME) {
        remove(i)
        continue
      }
      const v = voices.get(b.id)
      if (v) {
        v.setPosition(b.col, b.row)
        // Items-style distance fade: the StereoPanner path has no distance
        // model of its own, so this per-frame gain is what actually attenuates
        // the bullet with distance (without it the whoosh blared everywhere).
        if (p) {
          const d = Math.hypot(b.col - p.col, b.row - p.row)
          const dGain = d <= 2 ? 1 : Math.min(1, Math.pow(2 / d, 1.7))
          v.setGain(0.09 * dGain)
        }
        v.applyBehind(content.audio.behindness(b.col, b.row))
      }
    }
  }

  function checkCollisions() {
    const p = S().player()
    if (!p) return null
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]
      if (Math.hypot(b.col - p.col, b.row - p.row) <= HIT_RADIUS) {
        remove(i)
        return C().DEATH.BULLET
      }
    }
    return null
  }

  function clear() {
    for (let i = list.length - 1; i >= 0; i--) remove(i)
  }

  function silenceAll() { clear() }

  return {spawn, frame, checkCollisions, clear, silenceAll, list: () => list.slice()}
})()
