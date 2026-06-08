// Game settings. Music toggles the soundtrack; tts enables the optional
// built-in speech fallback in the announcer.
app.settings.register('music', {
  compute: (raw) => raw == null ? true : Boolean(raw),
  default: true,
  update: function () {
    // content.music reads app.settings.computed.music on its own gain pass.
  },
})

app.settings.register('tts', {
  compute: (raw) => Boolean(raw),
  default: false,
  update: function (value) {
    if (content.announcer && content.announcer.setUseTts) content.announcer.setUseTts(value)
  },
})
