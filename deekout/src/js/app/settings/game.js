// Persistent player settings. Registered here (not in the commented-out
// example) so app.settings.computed.{music,musicVolume,tts} resolve and the
// setters used by the Options screen actually exist. settings.load() (called
// from main.js at boot) runs each `update` once; content.* modules already
// exist by then (content loads before app), so the hooks below are safe.

// Background music on/off. Re-applies the music master gain through setVolume
// (which honours this flag via musicEnabled()).
app.settings.register('music', {
  compute: (v) => v !== false,
  default: true,
  update: function () {
    if (content.music && content.music.setVolume) {
      content.music.setVolume(app.settings.computed.musicVolume)
    }
  },
})

// Music volume 0..1, driven by the Options slider.
app.settings.register('musicVolume', {
  compute: (v) => Math.max(0, Math.min(1, Number(v))),
  default: 0.8,
  update: function (v) {
    if (content.music && content.music.setVolume) content.music.setVolume(v)
  },
})

// Speak announcements with the built-in speech synth (off by default).
app.settings.register('tts', {
  compute: (v) => Boolean(v),
  default: false,
  update: function (v) {
    if (content.announcer && content.announcer.setUseTts) content.announcer.setUseTts(v)
  },
})
