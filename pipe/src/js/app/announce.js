/**
 * Accessible announcer. Two aria-live regions, polite and assertive (see the
 * "Announcer and screen-reader patterns" section of the template CLAUDE.md):
 *
 *   - polite()    routine events (pipe numbers, fit/no-fit, score read-outs)
 *   - assertive() state changes (drench, life lost, level clear, game over)
 *
 * Screen readers swallow back-to-back identical strings, so each region keeps
 * two buffers and ping-pongs between them, and we append a zero-width space to
 * force a re-read of a truly identical message.
 *
 * Every message is also forwarded to content.audio.speak(), which is a no-op
 * unless the optional TTS setting is on — that covers players without a screen
 * reader. The reference is captured lazily because audio loads after this file.
 */
app.announce = (() => {
  let politeEl, assertiveEl
  let politeFlip = false, assertiveFlip = false

  function ready() {
    politeEl = document.querySelector('.a-app--announce')
    assertiveEl = document.querySelector('.a-app--announce-assertive')
  }

  function write(el, flip, text) {
    if (!el) return
    // Force a re-read of identical text by toggling a trailing zero-width space.
    el.textContent = flip ? text + '​' : text
  }

  function speak(text) {
    if (content && content.audio && content.audio.speak) content.audio.speak(text)
  }

  return {
    ready,
    polite: function (text) {
      politeFlip = !politeFlip
      write(politeEl, politeFlip, String(text))
      speak(text)
      return this
    },
    assertive: function (text) {
      assertiveFlip = !assertiveFlip
      write(assertiveEl, assertiveFlip, String(text))
      speak(text)
      return this
    },
    clear: function () {
      if (politeEl) politeEl.textContent = ''
      if (assertiveEl) assertiveEl.textContent = ''
      return this
    },
  }
})()

engine.ready(() => app.announce.ready())
