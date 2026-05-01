/**
 * Announcer for FIRE!. Two aria-live regions: polite (routine score / pickup
 * cues) and urgent (state changes — spread, building lost, level start, game
 * over). Screen readers swallow back-to-back identical strings, so each set
 * routes through a clear-then-set sequence with a one-frame yield.
 */
app.announce = (() => {
  const polite = () => document.querySelector('.a-live--polite')
  const urgent = () => document.querySelector('.a-live--urgent')

  function flash(el, text) {
    if (!el) return
    el.textContent = ''
    requestAnimationFrame(() => {
      el.textContent = text
    })
  }

  return {
    polite: (text) => flash(polite(), text),
    urgent: (text) => flash(urgent(), text),
    clear: () => {
      const p = polite(); if (p) p.textContent = ''
      const u = urgent(); if (u) u.textContent = ''
    },
  }
})()
