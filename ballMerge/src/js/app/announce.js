// Screen reader announcer using two aria-live regions. Polite carries routine
// readouts (spawns, merges, status); assertive carries state changes (round
// start/clear, drop, pause, game over). Identical strings are re-fired via a
// cleared buffer so assistive tech doesn't swallow repeats.
app.announce = (() => {
  let polite, assertive
  let lastPolite = ''

  function ensure() {
    if (!polite) polite = document.querySelector('.a-app--announce')
    if (!assertive) assertive = document.querySelector('.a-app--announce-assertive')
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
    },
    assertive: function (text) {
      ensure()
      if (!assertive) return
      assertive.textContent = ''
      window.requestAnimationFrame(() => { assertive.textContent = text })
    },
    clear: function () {
      ensure()
      if (polite) polite.textContent = ''
      if (assertive) assertive.textContent = ''
      lastPolite = ''
    },
  }
})()
