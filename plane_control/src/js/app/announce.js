// Two aria-live regions: polite (routine: arrivals, headings, score) and
// assertive (state changes: cleared-to-land, landings, conflicts, crash,
// pause). Toggling textContent (clear then re-set) makes screen readers
// re-read identical strings.
app.announce = (() => {
  let politeEl = null
  let assertiveEl = null

  function resolve() {
    if (!politeEl) politeEl = document.querySelector('[data-app-announce-polite]')
    if (!assertiveEl) assertiveEl = document.querySelector('[data-app-announce-assertive]')
  }

  function speak(el, msg) {
    if (!el) return
    el.textContent = ''
    setTimeout(() => { el.textContent = msg }, 20)
  }

  function polite(msg) { resolve(); speak(politeEl, msg) }
  function assertive(msg) { resolve(); speak(assertiveEl, msg) }

  return {polite, assertive}
})()
