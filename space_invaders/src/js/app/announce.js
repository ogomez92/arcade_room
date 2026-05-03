/**
 * SPACE INVADERS! — announcer.
 *
 * Two aria-live regions, polite and assertive. The "identical strings get
 * swallowed" workaround is implemented per the bumper/pacman pattern:
 * clear the region, yield via requestAnimationFrame, then re-set.
 *
 * Optional TTS fallback via SpeechSynthesis for users without a screen
 * reader. Off by default; toggle with setUseTts(true).
 */
app.announce = (() => {
  let politeEl = null
  let assertiveEl = null
  let lastPolite = ''
  let lastAssertive = ''
  let useTts = false

  function ready() {
    politeEl = document.querySelector('.a-live--polite')
    assertiveEl = document.querySelector('.a-live--assertive')
  }

  function setText(el, str, prevSame) {
    if (!el) return
    if (prevSame) {
      // Clear, yield, then re-set so screen readers re-read it
      el.textContent = ''
      window.requestAnimationFrame(() => {
        el.textContent = str
      })
    } else {
      el.textContent = str
    }
  }

  function speak(str, urgent) {
    if (!useTts || !window.speechSynthesis) return
    try {
      if (urgent) window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(str)
      const loc = (app.i18n && app.i18n.locale) ? app.i18n.locale() : 'en'
      u.lang = loc === 'es' ? 'es-ES' : 'en-US'
      u.rate = 1.05
      window.speechSynthesis.speak(u)
    } catch (e) { /* ignore */ }
  }

  function polite(str) {
    if (!str) return
    if (!politeEl) ready()
    const same = (str === lastPolite)
    setText(politeEl, str, same)
    lastPolite = str
    speak(str, false)
  }
  function assertive(str) {
    if (!str) return
    if (!assertiveEl) ready()
    const same = (str === lastAssertive)
    setText(assertiveEl, str, same)
    lastAssertive = str
    speak(str, true)
  }
  function clear() {
    if (!politeEl) ready()
    if (politeEl) politeEl.textContent = ''
    if (assertiveEl) assertiveEl.textContent = ''
    lastPolite = ''
    lastAssertive = ''
  }

  return {
    ready,
    polite,
    assertive,
    clear,
    setUseTts: (v) => { useTts = !!v },
    isUsingTts: () => useTts,
  }
})()
