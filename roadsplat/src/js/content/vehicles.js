// Vehicle catalogue. Each entry defines combat stats, spawning weight, the
// minimum level it appears at, and a build() that wires up its synth voices
// onto a syngen sound prop's `output` node.
content.vehicles = (() => {
  // Lazily-built shared noise buffers. content scripts run before main.js
  // configures the mixer, so we defer buffer construction to first use.
  let _noise5s, _brownNoise

  function noise5s() {
    if (!_noise5s) _noise5s = engine.buffer.whiteNoise({channels: 1, duration: 5})
    return _noise5s
  }

  function brownNoise() {
    if (!_brownNoise) {
      _brownNoise = engine.buffer.brownNoise
        ? engine.buffer.brownNoise({channels: 1, duration: 5})
        : noise5s()
    }
    return _brownNoise
  }

  const VEHICLES = {
    // ----- Level 1 -----
    sedan: {
      name: 'sedan',
      width: 2.0,
      damage: 35,
      speedRange: [12, 18],
      spawnWeight: 6,
      unlockLevel: 1,
      build: function (sound) {
        const e = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(40),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-5),
          modDepth: 0.25,
          modFrequency: 22,
        }).filtered({frequency: engine.fn.fromMidi(82), Q: 0.9})
          .connect(sound.output)
        const tire = engine.synth.buffer({
          buffer: noise5s(),
          gain: engine.fn.fromDb(-14),
        }).filtered({frequency: engine.fn.fromMidi(102), Q: 1.0})
          .connect(sound.output)
        sound.synths = [e, tire]
      },
    },
    motorbike: {
      name: 'motorbike',
      width: 0.8,
      damage: 30,
      speedRange: [22, 30],
      spawnWeight: 4,
      unlockLevel: 1,
      build: function (sound) {
        const e = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(46),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-6),
          modDepth: 0.6,
          modFrequency: 32,
        }).filtered({frequency: engine.fn.fromMidi(86), Q: 0.9})
          .connect(sound.output)
        const air = engine.synth.buffer({
          buffer: noise5s(),
          gain: engine.fn.fromDb(-16),
        }).filtered({frequency: engine.fn.fromMidi(102), Q: 0.8})
          .connect(sound.output)
        sound.synths = [e, air]
      },
    },
    bicycle: {
      name: 'bicycle',
      width: 0.5,
      damage: 12,
      speedRange: [4, 7],
      spawnWeight: 3,
      unlockLevel: 1,
      build: function (sound) {
        const swoosh = engine.synth.buffer({
          buffer: noise5s(),
          gain: engine.fn.fromDb(-10),
        }).filtered({frequency: engine.fn.fromMidi(102), Q: 1.0})
          .connect(sound.output)
        const tick = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(70),
          carrierGain: 0.5,
          gain: engine.fn.fromDb(-12),
          modDepth: 1,
          modFrequency: 5,
          modType: 'square',
        }).filtered({frequency: engine.fn.fromMidi(110), Q: 3})
          .connect(sound.output)
        sound.synths = [swoosh, tick]
      },
    },
    tractor: {
      name: 'tractor',
      width: 3.5,
      damage: 50,
      speedRange: [5, 9],
      spawnWeight: 2,
      unlockLevel: 1,
      build: function (sound) {
        const chug = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(32),
          carrierGain: 0.8,
          gain: engine.fn.fromDb(-3),
          modDepth: 0.9,
          modFrequency: 6,
          modType: 'square',
        }).filtered({frequency: engine.fn.fromMidi(74), Q: 0.8})
          .connect(sound.output)
        const rumble = engine.synth.buffer({
          buffer: brownNoise(),
          gain: engine.fn.fromDb(-6),
        }).filtered({frequency: engine.fn.fromMidi(64), Q: 0.6})
          .connect(sound.output)
        sound.synths = [chug, rumble]
      },
    },

    // ----- Level 2 -----
    truck: {
      name: 'truck',
      width: 4.5,
      damage: 60,
      speedRange: [9, 13],
      spawnWeight: 3,
      unlockLevel: 2,
      build: function (sound) {
        const diesel = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(30),
          carrierGain: 0.9,
          gain: engine.fn.fromDb(-2),
          modDepth: 0.7,
          modFrequency: 12,
          modType: 'square',
        }).filtered({frequency: engine.fn.fromMidi(74), Q: 0.8})
          .connect(sound.output)
        const rumble = engine.synth.buffer({
          buffer: brownNoise(),
          gain: engine.fn.fromDb(-4),
        }).filtered({frequency: engine.fn.fromMidi(66), Q: 0.5})
          .connect(sound.output)
        sound.synths = [diesel, rumble]
      },
    },
    scooter: {
      name: 'scooter',
      width: 0.7,
      damage: 22,
      speedRange: [10, 14],
      spawnWeight: 4,
      unlockLevel: 2,
      build: function (sound) {
        const putt = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(48),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-5),
          modDepth: 0.95,
          modFrequency: 8,
          modType: 'square',
        }).filtered({frequency: engine.fn.fromMidi(88), Q: 1.0})
          .connect(sound.output)
        const fizz = engine.synth.simple({
          frequency: engine.fn.fromMidi(76),
          type: 'sawtooth',
          gain: engine.fn.fromDb(-14),
        }).filtered({frequency: engine.fn.fromMidi(104), Q: 2})
          .connect(sound.output)
        sound.synths = [putt, fizz]
      },
    },
    van: {
      name: 'delivery van',
      width: 2.6,
      damage: 38,
      speedRange: [11, 15],
      spawnWeight: 4,
      unlockLevel: 2,
      build: function (sound) {
        const e = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(38),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-5),
          modDepth: 0.4,
          modFrequency: 18,
        }).filtered({frequency: engine.fn.fromMidi(80), Q: 0.9})
          .connect(sound.output)
        const rattle = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(72),
          carrierGain: 0.6,
          gain: engine.fn.fromDb(-9),
          modDepth: 1,
          modFrequency: 24,
          modType: 'square',
        }).shaped(engine.shape.noise())
          .filtered({frequency: engine.fn.fromMidi(104), Q: 2})
          .connect(sound.output)
        sound.synths = [e, rattle]
      },
    },

    // ----- Level 3 -----
    sportscar: {
      name: 'sports car',
      width: 1.8,
      damage: 45,
      speedRange: [22, 32],
      spawnWeight: 3,
      unlockLevel: 3,
      build: function (sound) {
        const exhaust = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(54),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-4),
          modDepth: 0.5,
          modFrequency: 32,
        }).filtered({frequency: engine.fn.fromMidi(94), Q: 1.6})
          .connect(sound.output)
        const whine = engine.synth.simple({
          frequency: engine.fn.fromMidi(74),
          type: 'sawtooth',
          gain: engine.fn.fromDb(-10),
        }).filtered({frequency: engine.fn.fromMidi(106), Q: 2.5})
          .connect(sound.output)
        sound.synths = [exhaust, whine]
      },
    },
    bus: {
      name: 'bus',
      width: 5.0,
      damage: 55,
      speedRange: [8, 12],
      spawnWeight: 2,
      unlockLevel: 3,
      build: function (sound) {
        const e = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(34),
          carrierGain: 0.8,
          gain: engine.fn.fromDb(-4),
          modDepth: 0.4,
          modFrequency: 9,
        }).filtered({frequency: engine.fn.fromMidi(78), Q: 0.8})
          .connect(sound.output)
        const air = engine.synth.buffer({
          buffer: noise5s(),
          gain: engine.fn.fromDb(-12),
        }).filtered({frequency: engine.fn.fromMidi(104), Q: 0.7})
          .connect(sound.output)
        sound.synths = [e, air]
      },
    },
    racecar: {
      name: 'race car',
      width: 1.6,
      damage: 70,
      speedRange: [32, 42],
      spawnWeight: 2,
      unlockLevel: 3,
      build: function (sound) {
        const scream = engine.synth.simple({
          frequency: engine.fn.fromMidi(86),
          type: 'sawtooth',
          gain: engine.fn.fromDb(-3),
        }).filtered({frequency: engine.fn.fromMidi(108), Q: 3})
          .connect(sound.output)
        const exhaust = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(60),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-5),
          modDepth: 0.6,
          modFrequency: 40,
        }).filtered({frequency: engine.fn.fromMidi(100), Q: 1.8})
          .connect(sound.output)
        sound.synths = [scream, exhaust]
      },
    },

    // ----- Level 4 -----
    police: {
      name: 'police car',
      width: 2.2,
      damage: 45,
      speedRange: [20, 28],
      spawnWeight: 2,
      unlockLevel: 4,
      build: function (sound) {
        const e = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(44),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-6),
          modDepth: 0.3,
          modFrequency: 18,
        }).filtered({frequency: engine.fn.fromMidi(84), Q: 0.8})
          .connect(sound.output)
        const siren = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(81),
          carrierGain: 0.5,
          gain: engine.fn.fromDb(-4),
          modDepth: 0.5,
          modFrequency: 1.5,
          modType: 'square',
          carrierType: 'square',
        }).filtered({frequency: engine.fn.fromMidi(108), Q: 1.5})
          .connect(sound.output)
        sound.synths = [e, siren]
      },
    },
    ambulance: {
      name: 'ambulance',
      width: 3.2,
      damage: 50,
      speedRange: [18, 24],
      spawnWeight: 1,
      unlockLevel: 4,
      build: function (sound) {
        const e = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(40),
          carrierGain: 0.7,
          gain: engine.fn.fromDb(-6),
          modDepth: 0.3,
          modFrequency: 16,
        }).filtered({frequency: engine.fn.fromMidi(82), Q: 0.8})
          .connect(sound.output)
        const wail = engine.synth.am({
          carrierFrequency: engine.fn.fromMidi(78),
          carrierGain: 0.55,
          gain: engine.fn.fromDb(-3),
          modDepth: 0.7,
          modFrequency: 0.6,
          modType: 'sine',
          carrierType: 'sine',
        }).filtered({frequency: engine.fn.fromMidi(108), Q: 2})
          .connect(sound.output)
        sound.synths = [e, wail]
      },
    },
  }

  const list = Object.entries(VEHICLES).map(([key, def]) => ({key, ...def}))

  return {
    defs: VEHICLES,
    list,
    forLevel: (level) => list.filter(v => v.unlockLevel <= level),
    newlyUnlockedAt: (level) => list.filter(v => v.unlockLevel === level),
  }
})()
