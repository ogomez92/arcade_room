app.announce = (() => {
  let politeEl = null
  let assertiveEl = null

  function resolve() {
    if (!politeEl) politeEl = document.querySelector('[data-app-announce-polite]')
    if (!assertiveEl) assertiveEl = document.querySelector('[data-app-announce-assertive]')
  }

  // Toggle textContent so identical messages still re-fire for screen readers.
  function speak(el, msg) {
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = msg }, 20)
  }

  function polite(msg) {
    resolve()
    speak(politeEl, msg)
  }

  function assertive(msg) {
    resolve()
    speak(assertiveEl, msg)
  }

  return {polite, assertive}
})()
