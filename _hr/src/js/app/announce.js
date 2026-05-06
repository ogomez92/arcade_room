// Funnels announcements to the dedicated aria-live regions in
// index.html. Clearing-then-setting (via a short timeout) coaxes
// screen readers into re-reading even when the message is identical.
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
