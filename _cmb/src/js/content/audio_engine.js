// Persistent engine-hum sound for a mech. Spatialized to that mech's position.
content.audioEngine = (() => {
  function create({ pitch = 1, gain = 0.3 } = {}) {
    const context = engine.context()

    const osc1 = context.createOscillator(),
      osc2 = context.createOscillator(),
      lfo = context.createOscillator(),
      lfoGain = context.createGain(),
      sum = context.createGain(),
      out = context.createGain(),
      lp = context.createBiquadFilter()

    osc1.type = 'sawtooth'
    osc2.type = 'sine'
    osc1.frequency.value = 80 * pitch
    osc2.frequency.value = 40 * pitch

    lfo.type = 'sine'
    lfo.frequency.value = 7
    lfoGain.gain.value = 6 * pitch
    lfo.connect(lfoGain)
    lfoGain.connect(osc1.frequency)

    lp.type = 'lowpass'
    lp.frequency.value = 800

    osc1.connect(sum)
    osc2.connect(sum)
    sum.connect(lp)
    lp.connect(out)

    out.gain.value = 0
    out.gain.linearRampToValueAtTime(gain, context.currentTime + 0.3)

    osc1.start()
    osc2.start()
    lfo.start()

    // Custom gain model so opponents can be heard across the larger arena.
    const gainModel = engine.ear.gainModel.exponential.instantiate({
      maxDistance: content.constants.audio.maxAudibleDistance,
      power: 2,
    })
    const ear = engine.ear.binaural.create({ x: 0, y: 0, z: 0, gainModel })
    ear.from(out)
    ear.to(engine.mixer.input())

    return {
      setPitch: (p) => {
        const t = engine.time()
        osc1.frequency.setTargetAtTime(80 * p, t, 0.05)
        osc2.frequency.setTargetAtTime(40 * p, t, 0.05)
        lfoGain.gain.setTargetAtTime(6 * p, t, 0.05)
      },
      setGain: (g) => {
        out.gain.setTargetAtTime(g, engine.time(), 0.1)
      },
      setThrottle: (t) => {
        // t in [0,1] alters pitch and lfo speed
        const rpm = 0.7 + 0.5 * Math.min(1, Math.max(0, t))
        osc1.frequency.setTargetAtTime(80 * pitch * rpm, engine.time(), 0.05)
        osc2.frequency.setTargetAtTime(40 * pitch * rpm, engine.time(), 0.05)
      },
      updatePosition: (relative) => {
        try { ear.update(relative) } catch (_) {}
      },
      stop: () => {
        const t = engine.time()
        out.gain.setTargetAtTime(0, t, 0.05)
        setTimeout(() => {
          try { osc1.stop() } catch (_) {}
          try { osc2.stop() } catch (_) {}
          try { lfo.stop() } catch (_) {}
          try { lp.disconnect() } catch (_) {}
          try { out.disconnect() } catch (_) {}
          try { ear.destroy() } catch (_) {}
        }, 200)
      },
    }
  }

  return { create }
})()
