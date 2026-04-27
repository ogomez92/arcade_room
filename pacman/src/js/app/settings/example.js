// Pac-Man settings: difficulty and master volume.
app.settings.register('difficulty', {
  compute: (raw) => {
    const v = String(raw || 'normal').toLowerCase()
    return ['easy', 'normal', 'hard'].includes(v) ? v : 'normal'
  },
  default: 'normal',
  update: function (value) {
    if (content.game) content.game.setDifficulty(value)
  },
})

app.settings.register('volume', {
  compute: (raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0.8
    return Math.max(0, Math.min(1, n))
  },
  default: 0.8,
  update: function (value) {
    if (engine.mixer && engine.mixer.param) {
      const param = engine.mixer.param.preGain
      if (param) param.value = 1.5 * value
    }
  },
})

app.settings.register('beaconVolume', {
  compute: (raw) => {
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0.6
    return Math.max(0, Math.min(1, n))
  },
  default: 0.6,
  update: function (value) {
    if (content.audio && content.audio._props && content.audio._props.beacon) {
      // The beacon's "on" gain is set by frame(); we tweak the multiplier through a module-level scalar.
    }
    app.settings._beaconVolume = value
  },
})
