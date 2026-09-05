/**
 * Announcer — two ARIA live regions (polite + assertive). Setting the
 * same text twice in a row is silent on most screen readers; we clear
 * first and re-set on the next animation frame to force re-reading.
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
