// Audio buses, ambient drone, and one-shot SFX. Initialized lazily on the
// first call to ready() so it runs after main.js has configured the mixer.
content.audio = (() => {
  let ready = false
  let buses = null
  let noise5s = null

  function init() {
    if (ready) return
    ready = true

    // Reverb tuning specific to the road environment.
    engine.mixer.reverb.param.delay.value = 1 / 32
    engine.mixer.reverb.param.highpass.frequency.value = engine.fn.fromMidi(30)
    engine.mixer.reverb.setImpulse(
      engine.buffer.impulse({
        buffer: engine.buffer.whiteNoise({channels: 2, duration: 3}),
        power: 2.5,
      })
    )

    buses = {
      ambient: engine.mixer.createBus(),
      traffic: engine.mixer.createBus(),
      player: engine.mixer.createBus(),
      alert: engine.mixer.createBus(),
    }
    buses.ambient.gain.value = engine.fn.fromDb(-16)
    buses.traffic.gain.value = engine.fn.fromDb(-8)
    buses.player.gain.value = engine.fn.fromDb(-10)
    buses.alert.gain.value = engine.fn.fromDb(-12)

    // Parallel reverb sends. Buses already feed the master dry; tap each into
    // the global reverb so SFX and the ambient drone live in the same room.
    // engine.sound props with reverb:true (cars) get their own positional send.
    function reverbSend(bus, db) {
      const send = engine.mixer.reverb.createBus()
      send.gain.value = engine.fn.fromDb(db)
      bus.connect(send)
    }
    reverbSend(buses.ambient, -6)
    reverbSend(buses.traffic, -12)
    reverbSend(buses.player, -12)
    reverbSend(buses.alert, -10)

    engine.synth.am({
      carrierFrequency: engine.fn.fromMidi(30),
      carrierGain: 0.6,
      gain: engine.fn.fromDb(-10),
      modDepth: 0.5,
      modFrequency: 1 / 9,
    }).shaped(engine.shape.noise()).filtered({
      frequency: engine.fn.fromMidi(52),
      Q: 0.3,
    }).connect(buses.ambient)

    noise5s = engine.buffer.whiteNoise({channels: 1, duration: 5})
  }

  function getBuses() {
    init()
    return buses
  }

  function getNoise() {
    init()
    return noise5s
  }

  // Footstep pitch table — floor 1 = D (MIDI 62); each subsequent road floor
  // adds one whole tone when there are <=6 road steps, one semitone when more.
  function footstepMidiNote(floor, roadWidth) {
    const roadSteps = roadWidth - 1
    const interval = (roadSteps > 6) ? 1 : 2
    return 62 + (floor - 1) * interval
  }

  function playFootstep(floor, roadWidth) {
    init()
    const now = engine.time()
    const freq = engine.fn.fromMidi(footstepMidiNote(floor, roadWidth))
    const body = engine.synth.simple({
      frequency: freq * 1.4,
      type: 'sine',
      gain: 0.0001,
    }).connect(buses.player)
    body.param.gain.exponentialRampToValueAtTime(0.6, now + 0.005)
    body.param.frequency.exponentialRampToValueAtTime(freq, now + 0.04)
    body.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    body.stop(now + 0.2)
    const click = engine.synth.buffer({
      buffer: noise5s, gain: 0.0001, loop: false,
    }).filtered({frequency: freq * 5, Q: 1.5}).connect(buses.player)
    click.param.gain.exponentialRampToValueAtTime(0.3, now + 0.003)
    click.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    click.stop(now + 0.07)
  }

  // Sidewalk-step chime: short, distinct from the cross-completion fanfare
  // (playScore). Two-note triangle sparkle, no noise click.
  function playSidewalkStep() {
    init()
    const now = engine.time()
    const a = engine.synth.simple({
      frequency: engine.fn.fromMidi(84),
      type: 'triangle',
      gain: 0.0001,
    }).connect(buses.player)
    a.param.gain.exponentialRampToValueAtTime(0.45, now + 0.005)
    a.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    a.stop(now + 0.2)
    const b = engine.synth.simple({
      frequency: engine.fn.fromMidi(91),
      type: 'triangle',
      gain: 0.0001,
    }).connect(buses.player)
    b.param.gain.exponentialRampToValueAtTime(0.4, now + 0.05)
    b.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    b.stop(now + 0.24)
  }

  function playScore() {
    init()
    const now = engine.time()
    for (let i = 0; i < 3; i++) {
      const s = engine.synth.simple({
        frequency: engine.fn.fromMidi(72 + i * 5),
        type: 'triangle',
        gain: 0.0001,
      }).connect(buses.player)
      const t = now + i * 0.07
      s.param.gain.exponentialRampToValueAtTime(0.4, t + 0.01)
      s.param.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
      s.stop(t + 0.24)
    }
  }

  function playLevelUp() {
    init()
    const now = engine.time()
    const notes = [60, 64, 67, 72, 76]
    for (let i = 0; i < notes.length; i++) {
      const s = engine.synth.simple({
        frequency: engine.fn.fromMidi(notes[i]),
        type: 'triangle',
        gain: 0.0001,
      }).connect(buses.player)
      const t = now + i * 0.09
      s.param.gain.exponentialRampToValueAtTime(0.55, t + 0.02)
      s.param.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
      s.stop(t + 0.48)
    }
  }

  function playLoiterTick() {
    init()
    const now = engine.time()
    const tick = engine.synth.simple({
      frequency: engine.fn.fromMidi(96),
      type: 'square',
      gain: 0.0001,
    }).filtered({frequency: engine.fn.fromMidi(100), Q: 4})
      .connect(buses.alert)
    tick.param.gain.exponentialRampToValueAtTime(0.35, now + 0.005)
    tick.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
    tick.stop(now + 0.07)
  }

  function playCollision() {
    init()
    const now = engine.time()
    const crash = engine.synth.buffer({
      buffer: noise5s, gain: 0.0001, loop: false,
    }).filtered({frequency: 700, Q: 0.5}).connect(buses.alert)
    crash.param.gain.exponentialRampToValueAtTime(1, now + 0.005)
    crash.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
    crash.stop(now + 0.72)
    const thump = engine.synth.simple({
      frequency: engine.fn.fromMidi(30), type: 'sine', gain: 0.0001,
    }).connect(buses.alert)
    thump.param.gain.exponentialRampToValueAtTime(1, now + 0.005)
    thump.param.frequency.exponentialRampToValueAtTime(engine.fn.fromMidi(18), now + 0.3)
    thump.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
    thump.stop(now + 0.42)
  }

  function playRagdollLaunch() {
    init()
    const now = engine.time()
    const yelp = engine.synth.simple({
      frequency: engine.fn.fromMidi(60),
      type: 'sine',
      gain: 0.0001,
    }).connect(buses.player)
    yelp.param.gain.exponentialRampToValueAtTime(0.6, now + 0.01)
    yelp.param.frequency.exponentialRampToValueAtTime(engine.fn.fromMidi(82), now + 0.35)
    yelp.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
    yelp.stop(now + 0.5)
    const whoosh = engine.synth.buffer({
      buffer: noise5s, gain: 0.0001, loop: false,
    }).filtered({frequency: 600, Q: 1}).connect(buses.player)
    whoosh.param.gain.exponentialRampToValueAtTime(0.45, now + 0.05)
    whoosh.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.85)
    whoosh.stop(now + 0.9)
  }

  function playRagdollTumble() {
    init()
    const now = engine.time()
    const grunt = engine.synth.simple({
      frequency: engine.fn.fromMidi(48 + Math.random() * 6),
      type: 'sine',
      gain: 0.0001,
    }).connect(buses.player)
    grunt.param.gain.exponentialRampToValueAtTime(0.35, now + 0.01)
    grunt.param.frequency.exponentialRampToValueAtTime(engine.fn.fromMidi(38), now + 0.18)
    grunt.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
    grunt.stop(now + 0.24)
  }

  function playRagdollLand() {
    init()
    const now = engine.time()
    const thud = engine.synth.simple({
      frequency: engine.fn.fromMidi(34),
      type: 'sine',
      gain: 0.0001,
    }).connect(buses.player)
    thud.param.gain.exponentialRampToValueAtTime(0.85, now + 0.005)
    thud.param.frequency.exponentialRampToValueAtTime(engine.fn.fromMidi(20), now + 0.25)
    thud.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    thud.stop(now + 0.4)
    const scrape = engine.synth.buffer({
      buffer: noise5s, gain: 0.0001, loop: false,
    }).filtered({frequency: 800, Q: 1}).connect(buses.player)
    scrape.param.gain.exponentialRampToValueAtTime(0.4, now + 0.02)
    scrape.param.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)
    scrape.stop(now + 0.55)
  }

  function playGameOver() {
    init()
    const now = engine.time()
    const s = engine.synth.simple({
      frequency: engine.fn.fromMidi(55), type: 'sawtooth', gain: 0.0001,
    }).filtered({frequency: 500, Q: 2}).connect(buses.alert)
    s.param.gain.exponentialRampToValueAtTime(0.5, now + 0.05)
    s.param.frequency.exponentialRampToValueAtTime(engine.fn.fromMidi(28), now + 2)
    s.param.gain.exponentialRampToValueAtTime(0.0001, now + 2.2)
    s.stop(now + 2.3)
  }

  return {
    init,
    buses: getBuses,
    noise: getNoise,
    playFootstep,
    playSidewalkStep,
    playScore,
    playLevelUp,
    playLoiterTick,
    playCollision,
    playRagdollLaunch,
    playRagdollTumble,
    playRagdollLand,
    playGameOver,
  }
})()
