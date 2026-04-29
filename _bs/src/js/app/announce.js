/**
 * Tiny announcer with two ARIA live regions (polite + assertive).
 *
 * Setting the same string twice in a row is a no-op for screen readers,
 * so we clear the region first and re-set on the next animation frame
 * to force re-reading of repeats (e.g. "Listen." every measure).
 */
app.announce = (() => {
  function set(el, text) {
    if (!el) return
    el.textContent = ''
    requestAnimationFrame(() => {
      el.textContent = text
    })
  }

  function polite(text) {
    set(document.querySelector('.a-app--announce-polite'), text)
  }

  function assertive(text) {
    set(document.querySelector('.a-app--announce-assertive'), text)
  }

  return {polite, assertive}
})()
