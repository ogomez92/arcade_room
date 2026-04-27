// Tiny announcer that funnels both polite and assertive aria-live updates
// to dedicated DOM regions in index.html. Clearing-then-setting (with a
// short timeout) coaxes screen readers into re-reading the same text.
app.announce = (() => {
  function speak(selector, message) {
    const el = document.querySelector(selector)
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = message }, 30)
  }

  return {
    polite: (msg) => speak('.js-announcer', msg),
    assertive: (msg) => speak('.js-announcer-assertive', msg),
    lobby: (msg) => speak('.js-lobby-announcer', msg),
  }
})()
