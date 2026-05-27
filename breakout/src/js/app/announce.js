app.announce = (() => {
  let polite, assertive

  function ready() {
    polite = document.querySelector('.a-app--announce:not(.a-app--announce-assertive)')
    assertive = document.querySelector('.a-app--announce-assertive')
  }

  function write(el, text) {
    if (!el || !text) return
    el.textContent = ''
    window.setTimeout(() => { el.textContent = text }, 20)
  }

  return {
    ready,
    polite: (text) => write(polite, text),
    assertive: (text) => write(assertive, text),
  }
})()
