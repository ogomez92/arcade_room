// Speak announcements with the browser's SpeechSynthesis voice, for players
// without a screen reader. Off by default so it never doubles up with one.
app.settings.register('ttsFallback', {
  compute: (rawValue) => Boolean(rawValue),
  default: false,
  update: function (computed) {
    if (app.announce && app.announce.setUseTts) app.announce.setUseTts(computed)
  },
})
