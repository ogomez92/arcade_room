// Game settings. Music toggles the ambient bed; tts enables the optional
// built-in speech fallback in the announcer.
app.settings.register('music', {
  compute: (raw) => raw == null ? true : Boolean(raw),
  default: true,
  update: function (value) {
    if (content.music && content.music.setEnabled) content.music.setEnabled(value)
  },
})

app.settings.register('tts', {
  compute: (raw) => Boolean(raw),
  default: false,
  update: function (value) {
    if (content.announcer && content.announcer.setUseTts) content.announcer.setUseTts(value)
  },
})
