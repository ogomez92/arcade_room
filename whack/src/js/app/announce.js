app.announce = (() => {
  let politeEl, assertiveEl
  let politeFlip = false
  let assertiveFlip = false
  let politeLast = ''
  let assertiveLast = ''

  function ensure() {
    if (!politeEl) politeEl = document.querySelector('.a-app--announce')
    if (!assertiveEl) assertiveEl = document.querySelector('.a-app--announceAssertive')
  }

  function emit(el, msg, lastRef, flipRef) {
    ensure()
    if (!el) return
    if (msg === lastRef.value) {
      el.textContent = ''
      flipRef.value = !flipRef.value
      const padded = flipRef.value ? msg + ' ' : msg
      requestAnimationFrame(() => { el.textContent = padded })
      return
    }
    el.textContent = msg
    lastRef.value = msg
  }

  const politeRefLast = {get value () { return politeLast }, set value (v) { politeLast = v }}
  const politeRefFlip = {get value () { return politeFlip }, set value (v) { politeFlip = v }}
  const assertiveRefLast = {get value () { return assertiveLast }, set value (v) { assertiveLast = v }}
  const assertiveRefFlip = {get value () { return assertiveFlip }, set value (v) { assertiveFlip = v }}

  return {
    polite: (msg) => emit(politeEl || document.querySelector('.a-app--announce'), msg, politeRefLast, politeRefFlip),
    assertive: (msg) => emit(assertiveEl || document.querySelector('.a-app--announceAssertive'), msg, assertiveRefLast, assertiveRefFlip),
    clear: () => {
      ensure()
      if (politeEl) politeEl.textContent = ''
      if (assertiveEl) assertiveEl.textContent = ''
      politeLast = ''
      assertiveLast = ''
    },
  }
})()
