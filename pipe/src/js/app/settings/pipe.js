/**
 * Pipe settings registration (the original's configuration-manager options).
 * Registered at load time so app.settings.load() in main.js can merge persisted
 * values and run each update() once. The update callbacks only set flags on
 * content.audio (no audio graph yet at load), so they're safe to run early.
 */
app.settings.register('speakPipeNumbers', {
  compute: (v) => Boolean(v),
  default: true,
})

app.settings.register('backgroundMusic', {
  compute: (v) => Boolean(v),
  default: true,
  update: (v) => content.audio.setMusicEnabled(v),
})

app.settings.register('useTts', {
  compute: (v) => Boolean(v),
  default: false,
  update: (v) => content.audio.setUseTts(v),
})

app.settings.register('swapStereo', {
  compute: (v) => Boolean(v),
  default: false,
  update: (v) => content.audio.setStereoSign(v ? -1 : 1),
})

app.settings.register('keyboardLayout', {
  compute: (v) => (v === 'laptop' ? 'laptop' : 'desktop'),
  default: 'desktop',
})
