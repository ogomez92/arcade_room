/**
 * Per-car engine timbre + ongoing wall-scrape voice. One CarEngine
 * instance is owned by each Car. It exposes `.update(state)` and
 * `.destroy()`.
 *
 * The engine is an FM oscillator + sub + filtered noise rumble, all
 * routed through a binaural ear so it appears at the car's world
 * position.
 *
 * Six profiles ensure each car sounds distinct.
 */
content.carEngine = (() => {
  // Six fixed timbres, indexed by car. `profileIndex` is resolved
  // per-listener in `content.game.start` (it swaps slots 0 and selfSlot
  // before constructing each Car), so on every peer the *local*
  // driver's car uses profile 0 — meaning the same player can sound
  // like a different timbre on different peers. That's intentional:
  // profile 0 (red) is the gentlest and least fatiguing of the six,
  // and we want each listener to hear *themselves* as red rather than
  // only the slot-0 driver getting the comfortable timbre. The other
  // profiles intentionally have more character so opponents are
  // audibly distinct from each other and from the listener.
  //
  // The `isSelf` flag (set when `controller === 'player'`) layers on
  // top: lower master gain, less sub, default (not cubic) distance
  // falloff. Together with the profile-0 swap, the local player gets
  // both the comfortable timbre and the comfortable spatial treatment.
  // Each profile occupies a distinct point across four axes: carrier
  // frequency, modRatio (harmonic = 1/2/3, inharmonic = 1.5/2.7/0.5
  // place the FM sidebands in audibly different spots), modDepth
  // (subtle vs prominent FM character), and noiseBase (the rumble
  // filter cutoff — sets each car's "rumble color" independently of
  // pitch). Square vs sawtooth alone doesn't differentiate much under
  // the 4 kHz tone-shaping lowpass, so we spread on the other axes.
  const profiles = [
    {name: 'red',    carrierFreq: 90,  modRatio: 1.0,  modDepth: 8,   noiseGain: 0.05, noiseBase: 350, type: 'triangle'},
    {name: 'blue',   carrierFreq: 150, modRatio: 2.0,  modDepth: 22,  noiseGain: 0.07, noiseBase: 650, type: 'square'},
    {name: 'green',  carrierFreq: 60,  modRatio: 1.5,  modDepth: 50,  noiseGain: 0.14, noiseBase: 280, type: 'sawtooth'},
    {name: 'yellow', carrierFreq: 200, modRatio: 0.5,  modDepth: 14,  noiseGain: 0.06, noiseBase: 950, type: 'triangle'},
    {name: 'purple', carrierFreq: 105, modRatio: 2.7,  modDepth: 48,  noiseGain: 0.09, noiseBase: 480, type: 'sawtooth'},
    {name: 'orange', carrierFreq: 75,  modRatio: 1.0,  modDepth: 30,  noiseGain: 0.12, noiseBase: 180, type: 'square'},
  ]

  function createForProfileIndex(profileIndex, options = {}) {
    const profile = profiles[profileIndex % profiles.length]
    const isSelf = !!options.isSelf
    const c = engine.context()

    // Self car is always at distance 0 from the listener — binaural gain
    // is 1.0 there, so we drop the master gain hard. 0.09 still lets the
    // pitch + rumble be your primary movement cue without drowning out
    // the rest of the mix. AI engines get ~half their previous gain and
    // a much steeper distance falloff (see ear creation below).
    const targetGain = isSelf ? 0.09 : 0.28

    // --- nodes ------------------------------------------------------
    const out = c.createGain()
    out.gain.value = 0

    // FM voice
    const carrier = c.createOscillator()
    carrier.type = profile.type
    carrier.frequency.value = profile.carrierFreq
    const modulator = c.createOscillator()
    modulator.type = 'sine'
    modulator.frequency.value = profile.carrierFreq * profile.modRatio
    const modGain = c.createGain()
    modGain.gain.value = profile.modDepth

    modulator.connect(modGain).connect(carrier.frequency)

    // Subtle low sub
    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.value = profile.carrierFreq / 2

    // Noise rumble
    const noiseBuf = engine.buffer.brownNoise({channels: 1, duration: 2})
    const noise = c.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true
    const noiseFilter = c.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = profile.noiseBase
    const noiseGain = c.createGain()
    noiseGain.gain.value = profile.noiseGain

    // Engine voice gains. Self gets less sub so the player isn't
    // sitting under a bass drone the whole round.
    const carrierGain = c.createGain()
    carrierGain.gain.value = isSelf ? 0.55 : 0.5
    const subGain = c.createGain()
    subGain.gain.value = isSelf ? 0.10 : 0.35

    carrier.connect(carrierGain).connect(out)
    sub.connect(subGain).connect(out)
    noise.connect(noiseFilter).connect(noiseGain).connect(out)

    // Tone shaper — fixed lowpass that lops off the upper harmonics of
    // the square/sawtooth profiles (and the upper FM sidebands) before
    // they hit the 4-8 kHz region the ear is most sensitive to. Without
    // this, blue/green/orange/purple feel sizzly even at low gain.
    const tone = c.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = isSelf ? 4500 : 4000
    tone.Q.value = 0.5
    out.connect(tone)

    // Behind-listener muffler. We let the tone-shaped voice flow through
    // a second lowpass whose cutoff drops as the source rotates behind
    // the listener. This adds an HRTF-style timbre cue on top of the
    // binaural pan ("source is behind" reads as "darker"). We do this
    // for non-self cars only — muffling your own engine all the time
    // would be tiring. The detune-based pitch drop handled in update()
    // complements this.
    const muffler = c.createBiquadFilter()
    muffler.type = 'lowpass'
    muffler.frequency.value = 4000
    muffler.Q.value = 0.7
    tone.connect(muffler)

    // Scrape voice (idle until set)
    const scrape = c.createBufferSource()
    scrape.buffer = engine.buffer.pinkNoise({channels: 1, duration: 2})
    scrape.loop = true
    const scrapeFilter = c.createBiquadFilter()
    scrapeFilter.type = 'bandpass'
    scrapeFilter.frequency.value = 1500
    scrapeFilter.Q.value = 3
    const scrapeGain = c.createGain()
    scrapeGain.gain.value = 0
    scrape.connect(scrapeFilter).connect(scrapeGain).connect(out)

    // Ear (binaural). For non-self cars we use a tighter distance
    // model (max 50 m, cubic falloff) so opponents fade in like the
    // walls do — quiet at far range, loud only when they're on top of
    // you. With the default exponential model (max 100 m, square)
    // they'd be ~half-gain at 50 m, which is too present.
    const ear = isSelf
      ? engine.ear.binaural.create()
      : engine.ear.binaural.create({
          gainModel: engine.ear.gainModel.exponential.instantiate({
            maxDistance: 50,
            power: 3,
          }),
        })
    // Self car bypasses the directional muffler (no behind-cue on your
    // own engine) but still flows through the tone shaper so the upper
    // harmonics aren't grating.
    ear.from(isSelf ? tone : muffler)
    ear.to(engine.mixer.output())

    carrier.start()
    modulator.start()
    sub.start()
    noise.start()
    scrape.start()

    out.gain.linearRampToValueAtTime(0.0, c.currentTime)
    out.gain.linearRampToValueAtTime(targetGain, c.currentTime + 0.3)

    let destroyed = false

    return {
      profile,
      /**
       * @param {Object} state
       * @param {{x:number,y:number}} state.position - world coords
       * @param {{x:number,y:number}} state.listener - world coords
       * @param {number} state.listenerYaw - radians
       * @param {number} state.speed - m/s
       * @param {number} state.throttle - input
       * @param {number} state.scrapeSpeed - 0+ tangential speed in contact, 0 if not
       * @param {boolean} state.eliminated
       */
      update: function (state) {
        if (destroyed) return

        // Spatialise: compute listener-local relative.
        const dx = state.position.x - state.listener.x,
          dy = state.position.y - state.listener.y
        const cos = Math.cos(-state.listenerYaw),
          sin = Math.sin(-state.listenerYaw)
        const localX = dx * cos - dy * sin
        const localY = dx * sin + dy * cos
        ear.update({x: localX, y: localY, z: 0})

        const t = engine.time()

        // Behindness cue: drop lowpass cutoff and detune main oscillators
        // when the source is behind the listener. 0 in front → 1 directly
        // behind. Non-self only — `muffler` is bypassed for the player's
        // own car. The behindness cue is a *small* modulation; the
        // perceptual dominant is still the binaural pan.
        if (!isSelf) {
          const dist = Math.hypot(localX, localY)
          const behind = dist > 0.001 ? engine.fn.clamp(-localX / dist, 0, 1) : 0
          engine.fn.setParam(muffler.frequency, engine.fn.lerp(4000, 1000, behind), 0.10)
          const detune = -120 * behind   // cents; ~1.2 semitones max
          engine.fn.setParam(carrier.detune, detune, 0.10)
          engine.fn.setParam(modulator.detune, detune, 0.10)
          engine.fn.setParam(sub.detune, detune, 0.10)
        }

        if (state.eliminated) {
          out.gain.cancelScheduledValues(t)
          out.gain.linearRampToValueAtTime(0, t + 0.3)
          scrapeGain.gain.cancelScheduledValues(t)
          scrapeGain.gain.linearRampToValueAtTime(0, t + 0.05)
          return
        }

        // Engine response. Speed dominates the *pitch* (so the engine
        // tracks how fast you're going, not what you've pressed), but
        // throttle gets a meaningful jump in the rumble noise + a small
        // pitch cue so pressing the gas is *immediately* perceptible.
        // The point is to give you continuous, distinguishable feedback
        // while you accelerate — the audible difference between idle,
        // pressing-gas-from-a-stop, half-speed cruise, and top-speed.
        const speedFactor = engine.fn.clamp(state.speed / 5, 0, 1)
        const throttleFactor = Math.abs(state.throttle)
        // Pitch is mostly speed. Throttle adds only a small immediate
        // cue so you can tell you've pressed the gas, not so much that
        // it sounds "pegged" before the car has moved.
        const intensity = engine.fn.clamp(speedFactor + throttleFactor * 0.18, 0, 1.2)
        const targetCarrier = profile.carrierFreq * (1 + intensity * 0.55)
        // Long smoothing time so the engine *glides* — no snap on
        // throttle press.
        const pitchSmooth = 0.35
        engine.fn.setParam(carrier.frequency, targetCarrier, pitchSmooth)
        engine.fn.setParam(modulator.frequency, targetCarrier * profile.modRatio, pitchSmooth)
        engine.fn.setParam(sub.frequency, targetCarrier / 2, pitchSmooth)
        engine.fn.setParam(noiseFilter.frequency, profile.noiseBase + intensity * 350, pitchSmooth)
        // Rumble jumps a bit on throttle (engine-working cue), then
        // grows with actual speed.
        engine.fn.setParam(
          noiseGain.gain,
          profile.noiseGain * (0.35 + throttleFactor * 0.30 + speedFactor * 0.55),
          0.20,
        )

        // Scrape
        const scrapeTarget = engine.fn.clamp(state.scrapeSpeed * 0.18, 0, 0.45)
        engine.fn.setParam(scrapeGain.gain, scrapeTarget, 0.05)
        engine.fn.setParam(scrapeFilter.frequency, 1200 + state.scrapeSpeed * 200, 0.08)
      },
      destroy: function () {
        if (destroyed) return
        destroyed = true
        const t = engine.time()
        out.gain.cancelScheduledValues(t)
        out.gain.linearRampToValueAtTime(0, t + 0.2)

        setTimeout(() => {
          try { carrier.stop() } catch (e) {}
          try { modulator.stop() } catch (e) {}
          try { sub.stop() } catch (e) {}
          try { noise.stop() } catch (e) {}
          try { scrape.stop() } catch (e) {}
          try { out.disconnect() } catch (e) {}
          try { ear.destroy() } catch (e) {}
        }, 300)
      },
    }
  }

  return {
    profiles,
    profileCount: profiles.length,
    profileName: (i) => profiles[i % profiles.length].name,
    create: createForProfileIndex,
  }
})()
