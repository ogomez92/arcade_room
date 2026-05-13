// Screen-reader announcer with two aria-live regions (polite + assertive).
// Optional SpeechSynthesis TTS path for users without a screen reader.
app.announce = (() => {
  let polite, assertive
  let lastPolite = ''
  let useTts = false

  function ensure() {
    if (!polite) polite = document.querySelector('.a-app--announce')
    if (!assertive) assertive = document.querySelector('.a-app--announce-assertive')
  }

  function speak(text, kind) {
    if (!useTts || !text) return
    try {
      const u = new SpeechSynthesisUtterance(text)
      // Assertive cues should jump the queue.
      if (kind === 'assertive') {
        try { window.speechSynthesis.cancel() } catch (e) {}
      }
      const loc = (app.i18n && app.i18n.locale && app.i18n.locale()) || 'en'
      u.lang = loc === 'es' ? 'es-ES' : 'en-US'
      u.rate = 1.05
      window.speechSynthesis.speak(u)
    } catch (e) { /* TTS not supported or blocked — silently fail */ }
  }

  return {
    polite: function (text) {
      ensure()
      if (!polite) return
      if (text === lastPolite) {
        polite.textContent = ''
        window.requestAnimationFrame(() => { polite.textContent = text })
      } else {
        polite.textContent = text
      }
      lastPolite = text
      speak(text, 'polite')
    },
    assertive: function (text) {
      ensure()
      if (!assertive) return
      assertive.textContent = ''
      window.requestAnimationFrame(() => { assertive.textContent = text })
      speak(text, 'assertive')
    },
    clear: function () {
      ensure()
      if (polite) polite.textContent = ''
      if (assertive) assertive.textContent = ''
      lastPolite = ''
      if (useTts) {
        try { window.speechSynthesis.cancel() } catch (e) {}
      }
    },
    setUseTts: function (v) {
      useTts = !!v
      if (!useTts) {
        try { window.speechSynthesis.cancel() } catch (e) {}
      }
    },
    usesTts: () => useTts,
  }
})()
